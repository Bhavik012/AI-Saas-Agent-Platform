import { z } from "zod";
import { db } from "@/db";
import { agents, meetings, transcriptions } from "@/db/schema";
import { TRPCError } from "@trpc/server";

import { and, count, desc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/constants";
import { meetingsInsertSchema, meetingsUpdateSchema } from "../schemas";
import { MeetingStatus } from "../types";
import { streamVideo } from "@/lib/stream-video";
import { AccessToken } from "livekit-server-sdk";
import { geminiModel } from "@/lib/gemini";
import { generateAvatarUri } from "@/lib/avatar";
import {
    assertMeetingOwnership,
    assertAgentOwnership,
    buildStreamUserPayload,
    buildLiveKitGrants,
    formatTranscriptForSummary,
    buildSummaryPrompt,
} from "./authorization";

export const meetingsRouter = createTRPCRouter({
    generateToken: protectedProcedure.mutation(async ({ ctx }) => {
        // Upsert user with standard role (not admin) to prevent privilege escalation
        await streamVideo.upsertUsers([
            buildStreamUserPayload(ctx.auth.user),
        ]);

        const validityInSeconds = 3600; // 1 hour token validity

        const token = streamVideo.generateUserToken({
            user_id: ctx.auth.user.id,
            validity_in_seconds: validityInSeconds,
        });

        return token;
    }),

    remove: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const [removedMeeting] = await db
                .delete(meetings)
                .where(
                    and(
                        eq(meetings.id, input.id),
                        eq(meetings.userId, ctx.auth.user.id),
                    ),
                )
                .returning();

            if (!removedMeeting) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Meeting not found",
                });
            }
            return removedMeeting;
        }),

    update: protectedProcedure
        .input(meetingsUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            // Remap agentId to agentsId to match database schema column and update updatedAt
            const { id, agentId, ...rest } = input;
            const updateValues: Record<string, unknown> = {
                ...rest,
                updatedAt: new Date(),
            };

            if (agentId) {
                // Verify the agent belongs to the user
                const [existingAgent] = await db
                    .select()
                    .from(agents)
                    .where(
                        and(
                            eq(agents.id, agentId),
                            eq(agents.userId, ctx.auth.user.id),
                        )
                    );

                if (!existingAgent) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: "Agent not found",
                    });
                }

                updateValues.agentsId = agentId;
            }

            const [updatedMeeting] = await db
                .update(meetings)
                .set(updateValues)
                .where(
                    and(
                        eq(meetings.id, id),
                        eq(meetings.userId, ctx.auth.user.id),
                    ),
                )
                .returning();

            if (!updatedMeeting) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Meeting not found",
                });
            }
            return updatedMeeting;
        }),

    create: protectedProcedure
        .input(meetingsInsertSchema)
        .mutation(async ({ input, ctx }) => {
            // Verify that the user owns the agent being assigned
            const [existingAgent] = await db
                .select({ id: agents.id, userId: agents.userId, name: agents.name })
                .from(agents)
                .where(
                    and(
                        eq(agents.id, input.agentId),
                        eq(agents.userId, ctx.auth.user.id),
                    )
                );

            assertAgentOwnership(existingAgent, ctx.auth.user.id);

            const [createdMeeting] = await db
                .insert(meetings)
                .values({
                    name: input.name,
                    userId: ctx.auth.user.id,
                    agentsId: input.agentId,
                })
                .returning();

            const call = streamVideo.video.call("default", createdMeeting.id);
            await call.create({
                data: {
                    created_by_id: ctx.auth.user.id,
                    custom: {
                        meetingId: createdMeeting.id,
                        meetingName: createdMeeting.name,
                    },
                    settings_override: {
                        transcription: {
                            language: "en",
                            mode: "auto-on",
                            closed_caption_mode: "auto-on",
                        },
                        recording: {
                            mode: "auto-on",
                            quality: "1080p",
                        },
                    },
                },
            });

            await streamVideo.upsertUsers([
                {
                    id: existingAgent.id,
                    name: existingAgent.name,
                    role: "user",
                    image: generateAvatarUri({
                        seed: existingAgent.name,
                        variant: "botttsNeutral",
                    }),
                },
            ]);

            return createdMeeting;
        }),

    getOne: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }) => {
            const [existingMeeting] = await db
                .select({
                    ...getTableColumns(meetings),
                    agent: agents,
                    duration: sql<number>`EXTRACT(EPOCH FROM (ended_at - started_at))`.as("duration"),
                })
                .from(meetings)
                .innerJoin(agents, eq(meetings.agentsId, agents.id))
                .where(
                    and(
                        eq(meetings.id, input.id),
                        eq(meetings.userId, ctx.auth.user.id),
                    )
                );

            if (!existingMeeting) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
            }

            return existingMeeting;
        }),

    getMany: protectedProcedure
        .input(
            z.object({
                page: z.number().default(DEFAULT_PAGE),
                pageSize: z
                    .number()
                    .min(MIN_PAGE_SIZE)
                    .max(MAX_PAGE_SIZE)
                    .default(DEFAULT_PAGE_SIZE),
                search: z.string().nullish(),
                agentId: z.string().nullish(),
                status: z
                    .enum([
                        MeetingStatus.Upcoming,
                        MeetingStatus.Active,
                        MeetingStatus.Completed,
                        MeetingStatus.Cancelled,
                        MeetingStatus.Processing,
                    ])
                    .nullish(),
            })
        )
        .query(async ({ ctx, input }) => {
            const { search, page, pageSize, status, agentId } = input;

            const data = await db
                .select({
                    ...getTableColumns(meetings),
                    agent: agents,
                    duration: sql<number>`EXTRACT(EPOCH FROM (ended_at - started_at))`.as("duration"),
                })
                .from(meetings)
                .innerJoin(agents, eq(meetings.agentsId, agents.id))
                .where(
                    and(
                        eq(meetings.userId, ctx.auth.user.id),
                        search ? ilike(meetings.name, `%${search}%`) : undefined,
                        status ? eq(meetings.status, status as typeof meetings.$inferSelect.status) : undefined,
                        agentId ? eq(meetings.agentsId, agentId) : undefined,
                    )
                )
                .orderBy(desc(meetings.createdAt), desc(meetings.id))
                .limit(pageSize)
                .offset((page - 1) * pageSize);

            const [total] = await db
                .select({ count: count() })
                .from(meetings)
                .innerJoin(agents, eq(meetings.agentsId, agents.id))
                .where(
                    and(
                        eq(meetings.userId, ctx.auth.user.id),
                        search ? ilike(meetings.name, `%${search}%`) : undefined,
                        status ? eq(meetings.status, status as typeof meetings.$inferSelect.status) : undefined,
                        agentId ? eq(meetings.agentsId, agentId) : undefined,
                    )
                );

            const totalPages = Math.ceil(total.count / pageSize);

            return {
                items: data,
                total: total.count,
                totalPages,
            };
        }),

    addTranscription: protectedProcedure
        .input(z.object({
            meetingId: z.string(),
            text: z.string().min(1, "Text is required").max(5000, "Text exceeds character limit"),
            agentId: z.string().nullish(),
        }))
        .mutation(async ({ input, ctx }) => {
            // Verify meeting ownership to prevent cross-tenant transcript injection
            const [meeting] = await db
                .select({ id: meetings.id, userId: meetings.userId })
                .from(meetings)
                .where(
                    and(
                        eq(meetings.id, input.meetingId),
                        eq(meetings.userId, ctx.auth.user.id),
                    )
                );

            assertMeetingOwnership(meeting, ctx.auth.user.id);

            const [newTranscription] = await db
                .insert(transcriptions)
                .values({
                    meetingId: input.meetingId,
                    text: input.text,
                    userId: ctx.auth.user.id,
                    agentId: input.agentId,
                })
                .returning();

            return newTranscription;
        }),

    getTranscriptions: protectedProcedure
        .input(z.object({ meetingId: z.string() }))
        .query(async ({ input, ctx }) => {
            // Verify meeting ownership to prevent unauthorized transcript access (IDOR fix)
            const [meeting] = await db
                .select({ id: meetings.id, userId: meetings.userId })
                .from(meetings)
                .where(
                    and(
                        eq(meetings.id, input.meetingId),
                        eq(meetings.userId, ctx.auth.user.id),
                    )
                );

            assertMeetingOwnership(meeting, ctx.auth.user.id);

            return await db
                .select()
                .from(transcriptions)
                .where(eq(transcriptions.meetingId, input.meetingId))
                .orderBy(desc(transcriptions.timestamp));
        }),

    generateLiveKitToken: protectedProcedure
        .input(z.object({
            meetingId: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            // Verify meeting ownership before issuing WebRTC join token (IDOR fix)
            const [meeting] = await db
                .select({ id: meetings.id, userId: meetings.userId })
                .from(meetings)
                .where(
                    and(
                        eq(meetings.id, input.meetingId),
                        eq(meetings.userId, ctx.auth.user.id),
                    )
                );

            assertMeetingOwnership(meeting, ctx.auth.user.id);

            const at = new AccessToken(
                process.env.LIVEKIT_API_KEY!,
                process.env.LIVEKIT_API_SECRET!,
                {
                    identity: ctx.auth.user.id,
                    name: ctx.auth.user.name,
                }
            );

            at.addGrant(buildLiveKitGrants(input.meetingId));

            return await at.toJwt();
        }),

    generateSummary: protectedProcedure
        .input(z.object({ meetingId: z.string() }))
        .mutation(async ({ input, ctx }) => {
            // 1. Verify meeting ownership BEFORE generating summary (IDOR fix)
            const [meeting] = await db
                .select({ id: meetings.id, userId: meetings.userId })
                .from(meetings)
                .where(
                    and(
                        eq(meetings.id, input.meetingId),
                        eq(meetings.userId, ctx.auth.user.id),
                    )
                );

            assertMeetingOwnership(meeting, ctx.auth.user.id);

            // 2. Fetch transcriptions for the meeting
            const meetingTranscripts = await db
                .select()
                .from(transcriptions)
                .where(eq(transcriptions.meetingId, input.meetingId))
                .orderBy(transcriptions.timestamp);

            if (meetingTranscripts.length === 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "No transcriptions found for this meeting.",
                });
            }

            // 3. Length bounding & token limit protection (max 30,000 characters)
            const transcriptText = formatTranscriptForSummary(meetingTranscripts);

            // 4. Prompt injection protection: isolate content with XML delimiters and framing
            const prompt = buildSummaryPrompt(transcriptText);

            // 5. Safe Gemini call with timeout and typed error handling
            let summary: string;
            try {
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error("GEMINI_TIMEOUT")), 30000)
                );

                const generatePromise = geminiModel.generateContent(prompt);
                const result = await Promise.race([generatePromise, timeoutPromise]);

                const response = result.response;
                if (!response || !response.candidates || response.candidates.length === 0) {
                    throw new Error("EMPTY_GEMINI_RESPONSE");
                }

                const candidate = response.candidates[0];
                if (candidate.finishReason === "SAFETY") {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "Summary could not be generated due to content safety restrictions.",
                    });
                }

                summary = response.text();
                if (!summary || !summary.trim()) {
                    throw new Error("EMPTY_SUMMARY_TEXT");
                }
            } catch (error: unknown) {
                if (error instanceof TRPCError) throw error;

                const err = error as { status?: number; message?: string };
                console.error(`Gemini summary generation failed: ${err.message ?? "Unknown error"}`);

                if (err.message === "GEMINI_TIMEOUT") {
                    throw new TRPCError({
                        code: "TIMEOUT",
                        message: "AI summary generation timed out. Please try again.",
                    });
                }

                if (
                    err.status === 429 ||
                    err.message?.includes("quota") ||
                    err.message?.includes("RESOURCE_EXHAUSTED")
                ) {
                    throw new TRPCError({
                        code: "TOO_MANY_REQUESTS",
                        message: "AI service is currently busy or rate-limited. Please try again shortly.",
                    });
                }

                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to generate meeting summary. Please try again later.",
                });
            }

            // 6. Update meeting record with summary and completed status
            await db
                .update(meetings)
                .set({ summary, status: "completed", updatedAt: new Date() })
                .where(
                    and(
                        eq(meetings.id, input.meetingId),
                        eq(meetings.userId, ctx.auth.user.id),
                    )
                );

            return { summary };
        }),
});