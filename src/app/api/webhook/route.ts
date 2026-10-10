import { and, eq, not } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import {
    CallEndedEvent,
    CallRecordingReadyEvent,
    CallSessionParticipantLeftEvent,
    CallSessionStartedEvent,
} from "@stream-io/node-sdk";

import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { streamVideo } from "@/lib/stream-video";
import { geminiModel } from "@/lib/gemini";
import { CallTranscriptionReadyEvent } from "@stream-io/video-react-sdk";
import {
    formatTranscriptForSummary,
    buildSummaryPrompt,
    isValidTranscriptionUrl,
} from "@/modules/meetings/server/authorization";

function verifySignatureWithSDK(body: string, signature: string): boolean {
    return streamVideo.verifyWebhook(body, signature);
}

export async function POST(req: NextRequest) {
    const signature =
        req.headers.get("x-signature") ?? req.headers.get("stream-signature");
    if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const body = await req.text();
    if (!verifySignatureWithSDK(body, signature)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: unknown;
    try {
        payload = JSON.parse(body);
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventType = (payload as { type?: string })?.type;

    // Normalizing event types to support both dot and underscore notations
    const isSessionStarted =
        eventType === "call.session_started" || eventType === "call_session_started";
    const isParticipantLeft =
        eventType === "call.session_participant_left" || eventType === "call_session_participant_left";
    const isSessionEnded =
        eventType === "call.session_ended" || eventType === "call_session_ended";
    const isTranscriptionReady =
        eventType === "call.transcription_ready" || eventType === "call_transcription_ready";
    const isRecordingReady =
        eventType === "call.recording_ready" || eventType === "call_recording_ready";

    if (isSessionStarted) {
        const event = payload as CallSessionStartedEvent;
        const meetingId = event.call.custom?.meetingId;
        if (!meetingId) {
            return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
        }

        const [existingMeeting] = await db
            .select()
            .from(meetings)
            .where(
                and(
                    eq(meetings.id, meetingId),
                    not(eq(meetings.status, "completed")),
                    not(eq(meetings.status, "active")),
                    not(eq(meetings.status, "cancelled")),
                    not(eq(meetings.status, "processing"))
                )
            );

        if (!existingMeeting) {
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        await db
            .update(meetings)
            .set({ status: "active", startedAt: new Date(), updatedAt: new Date() })
            .where(eq(meetings.id, existingMeeting.id));

        const [existingAgent] = await db
            .select()
            .from(agents)
            .where(eq(agents.id, existingMeeting.agentsId));

        if (!existingAgent) {
            return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }

    } else if (isParticipantLeft) {
        const event = payload as CallSessionParticipantLeftEvent;
        const meetingId = event.call_cid ? event.call_cid.split(":")[1] : undefined;
        if (!meetingId) {
            return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
        }

        const call = streamVideo.video.call("default", meetingId);
        await call.end();

    } else if (isSessionEnded) {
        const event = payload as CallEndedEvent;
        const meetingId = event.call.custom?.meetingId;
        if (!meetingId) {
            return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
        }

        await db
            .update(meetings)
            .set({ status: "processing", endedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(meetings.id, meetingId), eq(meetings.status, "active")));

    } else if (isTranscriptionReady) {
        const event = payload as CallTranscriptionReadyEvent;
        const meetingId = event.call_cid ? event.call_cid.split(":")[1] : undefined;
        if (!meetingId) {
            return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
        }

        const transcriptUrl = event.call_transcription?.url;

        const [updatedMeeting] = await db
            .update(meetings)
            .set({ transcriptUrl, updatedAt: new Date() })
            .where(eq(meetings.id, meetingId))
            .returning();

        if (!updatedMeeting) {
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        // Generate AI summary if URL is safe and available
        if (transcriptUrl && isValidTranscriptionUrl(transcriptUrl)) {
            try {
                const transcriptRes = await fetch(transcriptUrl, {
                    signal: AbortSignal.timeout(10000), // 10s timeout
                    redirect: "error",
                });

                if (transcriptRes.ok) {
                    const rawTranscript = await transcriptRes.text();
                    const boundedTranscript = formatTranscriptForSummary(rawTranscript);
                    const prompt = buildSummaryPrompt(boundedTranscript);

                    const res = await geminiModel.generateContent(prompt);
                    const summary = res.response.text();

                    if (summary) {
                        await db
                            .update(meetings)
                            .set({ summary, status: "completed", updatedAt: new Date() })
                            .where(eq(meetings.id, meetingId));
                    }
                }
            } catch (e) {
                console.error("Webhook Gemini summary generation error:", e);
            }
        }

    } else if (isRecordingReady) {
        const event = payload as CallRecordingReadyEvent;
        const meetingId = event.call_cid ? event.call_cid.split(":")[1] : undefined;
        if (!meetingId) {
            return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
        }

        // Correct column: recordingUrl instead of transcriptUrl
        await db
            .update(meetings)
            .set({
                recordingUrl: event.call_recording?.url,
                updatedAt: new Date(),
            })
            .where(eq(meetings.id, meetingId));
    }

    return NextResponse.json({ status: "ok" });
}
