import "dotenv/config";
import { cli, defineAgent, WorkerOptions, voice } from "@livekit/agents";
import * as google from "@livekit/agents-plugin-google";
import { db } from "@/db";
import { agents, meetings, transcriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

// Ensure Google API key is set for @livekit/agents-plugin-google
if (!process.env.GOOGLE_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
}

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect();
    console.log(`✅ Connected to room: ${ctx.room.name}`);

    // Fetch Meeting and Agent Data
    const meetingId = ctx.room.name;
    if (!meetingId) return;

    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId));

    if (!meeting) {
      console.error(`❌ Meeting ${meetingId} not found in database.`);
      return;
    }

    const [agentData] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, meeting.agentsId));

    if (!agentData) {
      console.error(`❌ Agent for meeting ${meetingId} not found.`);
      return;
    }

    const RealtimeCtor =
      (google as any)?.beta?.realtime?.RealtimeModel ??
      (google as any)?.realtime?.RealtimeModel ??
      (google as any)?.RealtimeModel;

    if (!RealtimeCtor) {
      throw new Error("RealtimeModel not found in @livekit/agents-plugin-google");
    }

    const llm = new RealtimeCtor({
      model: process.env.GEMINI_REALTIME_MODEL ?? "gemini-2.5-flash-live",
      instructions: agentData.instructions || "You are a concise, helpful AI meeting assistant.",
      voice: agentData.voice || "ash",
    });

    const session = new voice.AgentSession({ llm });
    const agent = new voice.Agent({
      instructions: agentData.instructions,
    });

    // Logging transcripts to DB with error handling to avoid unhandled rejections
    (session as any).on("user_transcription", async (transcript: any) => {
      try {
        if (transcript.text && transcript.text.trim()) {
          await db.insert(transcriptions).values({
            meetingId: meeting.id,
            agentId: agentData.id,
            text: transcript.text,
          });
          console.log(`✍️ Saved transcript: ${transcript.text.substring(0, 30)}...`);
        }
      } catch (err) {
        console.error("Failed to save transcript to DB:", err);
      }
    });

    if (typeof session.start !== "function") {
      throw new Error("session.start is not a function.");
    }

    await session.start({ agent, room: ctx.room });
    console.log(`🚀 Gemini agent '${agentData.name}' activated for room: ${ctx.room.name}`);
  }
});

cli.runApp(new WorkerOptions({
  agent: __filename,
  wsURL: process.env.LIVEKIT_WS_URL || process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL,
  apiKey: process.env.LIVEKIT_API_KEY,
  apiSecret: process.env.LIVEKIT_API_SECRET
}));
