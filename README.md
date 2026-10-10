# Meet.AI — AI-Powered Intelligent SaaS Meeting Platform

> Host video meetings with real-time AI voice agents, live WebRTC audio interaction, automated speech-to-text transcription, and post-call meeting summarization powered by Google Gemini.

---

## 📌 Overview & Problem Statement

Modern remote teams spend countless hours in video calls and lose crucial action items, decisions, and context in unreviewed recordings. **Meet.AI** solves this by providing:

1. **Customizable AI Meeting Agents**: Users can configure AI personas with tailored system instructions and custom voices.
2. **Real-Time Bidirectional Voice Assistance**: In every video call, an autonomous AI agent joins via WebRTC (powered by LiveKit and Google Gemini Realtime), actively listening and conversing with participants.
3. **Live Transcription & Persistence**: Every utterance is captured in real time and persisted securely to PostgreSQL.
4. **Automated AI Meeting Summaries**: Post-meeting, Google Gemini models analyze conversation transcripts and generate concise executive summaries, key decisions, and action items.

---

## 🏗️ Architecture & Technology Stack

```mermaid
flowchart TD
    User["👤 Browser Client (React 19 / Next.js 15)"]
    Auth["🔐 Better Auth (OAuth + Credentials)"]
    TRPC["⚡ tRPC Server API (Zod Validated)"]
    DB[("🐘 Neon PostgreSQL / Drizzle ORM")]
    Stream["📹 Stream Video SDK (Video Calls)"]
    LiveKit["🎙️ LiveKit WebRTC Cloud"]
    Gemini["✨ Google Gemini API (2.5 Live / 2.0 Flash)"]
    AgentWorker["🤖 Background Agent Worker (LiveKit Node)"]

    User -->|Auth Requests| Auth
    User -->|Type-Safe Queries / Mutations| TRPC
    TRPC -->|Data Persistence| DB
    TRPC -->|Call Token & Room Creation| Stream
    TRPC -->|WebRTC JWT Token| LiveKit
    TRPC -->|Meeting Summarization| Gemini
    User -->|WebRTC Audio / Video| Stream
    User -->|Audio Stream| LiveKit
    LiveKit <-->|Bidirectional Voice Stream| AgentWorker
    AgentWorker <-->|Realtime Voice LLM| Gemini
    AgentWorker -->|Live Transcriptions| DB
    Stream -->|Webhooks: Recordings & Status| TRPC
```

### Core Technologies

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | Next.js 15.5 (App Router, Server Components) | Full-stack architecture, SSR & API routes |
| **UI Library** | React 19, Tailwind CSS v4, Lucide Icons | Responsive modern frontend design |
| **Component Kit** | Radix UI primitives, shadcn/ui | Accessible dialogs, drawers, dropdowns |
| **API Layer** | tRPC v11 + TanStack React Query v5 | End-to-end type safety and query caching |
| **Validation** | Zod 3.25 | Runtime schema validation across client and server |
| **Authentication** | Better Auth (PostgreSQL adapter) | Multi-provider OAuth (GitHub, Google) & email/password |
| **Database** | Neon Serverless PostgreSQL + Drizzle ORM | Relational schema, indexes, and connection pooling |
| **Video Calls** | Stream Video SDK (@stream-io/video-react-sdk) | High-definition multi-party video conferencing |
| **Realtime Voice** | LiveKit Cloud + @livekit/agents | Low-latency WebRTC bidirectional audio streaming |
| **AI Models** | Google Gemini 2.5 Flash Live & Gemini 2.0 Flash | Realtime conversational voice & meeting summarization |
| **Testing** | Node.js Test Runner + tsx | Automated unit, authorization, and security tests |

---

## 🛡️ Security Architecture & Engineering Highlights

During our comprehensive security audit, Meet.AI was hardened with enterprise-grade safeguards:

1. **Strict Multi-Tenant Data Isolation (IDOR Defense)**:
   - All tRPC procedures (`meetings.getOne`, `meetings.update`, `meetings.remove`, `meetings.getTranscriptions`, `meetings.generateSummary`, `meetings.generateLiveKitToken`, `agents.*`) verify that records belong to `ctx.auth.user.id`.
   - Unauthorized attempts return generic `NOT_FOUND` errors, completely mitigating ID enumeration attacks.
   - Cross-tenant agent association is blocked; users can only link agents they own to new meetings.

2. **Defense-in-Depth Route Protection**:
   - Next.js Edge Middleware (`src/middleware.ts`) verifies session tokens on all protected routes (`/`, `/meetings/*`, `/agents/*`, `/call/*`) and redirects unauthenticated traffic to `/sign-in`.
   - Server-side session verification in `src/app/(dashboard)/layout.tsx` guarantees that unauthenticated requests can never render the dashboard shell.

3. **AI Prompt Injection Defense & Token Limits**:
   - Transcripts are bounded to a maximum of 30,000 characters prior to summarization, preventing token flooding and denial-of-service.
   - Meeting dialogue is isolated within strict `<meeting_transcription>` delimiters with explicit system instructions prohibiting execution of commands found in participant speech.
   - 30-second timeout handling and typed status error mapping (429 Rate Limits, Safety Violations, Timeouts).

4. **SSRF (Server-Side Request Forgery) Prevention**:
   - Webhook handlers validate external transcription URLs, requiring HTTPS protocol and trusted Stream CDN hostnames before executing requests.

5. **Safe Meeting Teardown**:
   - Client disconnect handlers use `call.leave()` rather than destructive `call.endCall()`, ensuring that one participant leaving or refreshing does not terminate the call for other attendees.

---

## 🚀 Features

- **Personalized AI Agents**: Customize name, behavioral instructions, and voice timbre (`ash`, `ballad`, `coral`, `sage`, `verse`).
- **Interactive Call Lobby**: Preview camera and microphone inputs with hardware permission management prior to entering calls.
- **In-Call Voice Agent**: Visualized audio frequencies with animated visualizer and voice assistant control bar.
- **Fast Search & Filter**: Search agents and meetings by name, filter by status (`upcoming`, `active`, `completed`, `cancelled`, `processing`), and clear filters with a single click.
- **Command Palette**: Global keyboard shortcut (`⌘K` / `Ctrl+K`) for rapid navigation and quick actions.
- **Responsive Navigation**: Adaptive sidebar on desktop with a slide-out drawer on mobile screens.

---

## 📋 Prerequisites & Installation

### 1. Prerequisites
- **Node.js**: v20.x or higher
- **npm** or **pnpm**
- **Neon PostgreSQL**: Free cloud database instance
- **Stream Video Account**: Public and secret keys
- **LiveKit Cloud Project**: WebSocket URL and API credentials
- **Google AI Studio**: Gemini API key

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/Bhavik012/AI-Saas-Agent-Platform.git
cd AI-Saas-Agent-Platform
npm install
```

### 3. Environment Configuration
Copy the template and populate your credentials:
```bash
cp .env.example .env
```

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | Neon PostgreSQL pooled connection URI | `postgresql://user:pass@ep-pooler.neon.tech/db?sslmode=require` |
| `BETTER_AUTH_SECRET` | Symmetric cryptographic secret | `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | Application root URL | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | Public origin URL | `http://localhost:3000` |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | `Ov23...` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | `1fc0...` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `6389...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-...` |
| `NEXT_PUBLIC_STREAM_VIDEO_API_KEY` | Stream Video public API key | `qju9...` |
| `STREAM_VIDEO_SECRET_KEY` | Stream Video backend secret | `bat8...` |
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit WebRTC client URL | `wss://your-project.livekit.cloud` |
| `LIVEKIT_WS_URL` | LiveKit WebRTC server URL | `wss://your-project.livekit.cloud` |
| `LIVEKIT_API_KEY` | LiveKit API Key | `API...` |
| `LIVEKIT_API_SECRET` | LiveKit API Secret | `ZyrY...` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSy...` |
| `GEMINI_REALTIME_MODEL` | Realtime voice model name | `gemini-2.5-flash-live` |

### 4. Database Setup
Push the Drizzle schema to your PostgreSQL database:
```bash
npm run db:push
```
Inspect the database schema using Drizzle Studio:
```bash
npm run db:studio
```

---

## 💻 Development & Execution Commands

| Command | Action |
| :--- | :--- |
| `npm run dev` | Launch Next.js local development server on `http://localhost:3000` |
| `npm run agent` | Start the autonomous LiveKit Gemini voice agent worker |
| `npm run dev:webhook` | Expose port 3000 via Ngrok for Stream Video webhook events |
| `npm test` | Run automated test suite (authorization, validation, AI limits, SSRF) |
| `npm run build` | Produce optimized Next.js production build |
| `npm start` | Run production server |

---

## 📡 API Endpoint Reference (tRPC Procedures)

All mutations and queries are exposed under `/api/trpc` with type-safe client invocation:

### `agents` Router
- `agents.getMany({ page, pageSize, search })` — Paginated list of user-owned agents with meeting counts.
- `agents.getOne({ id })` — Retrieve single agent by ID.
- `agents.create({ name, instructions, voice })` — Create an agent.
- `agents.update({ id, name, instructions, voice })` — Update an agent.
- `agents.remove({ id })` — Delete an agent (cascades to related meetings).

### `meetings` Router
- `meetings.getMany({ page, pageSize, search, status, agentId })` — Filtered & paginated meeting history.
- `meetings.getOne({ id })` — Detailed meeting record with joined agent info and duration.
- `meetings.create({ name, agentId })` — Provision meeting record, Stream Video call, and avatar.
- `meetings.update({ id, name, agentId })` — Update meeting details and agent assignment.
- `meetings.remove({ id })` — Delete meeting and associated transcriptions.
- `meetings.generateToken()` — Generate authenticated Stream Video user token.
- `meetings.generateLiveKitToken({ meetingId })` — Issue authenticated WebRTC room join JWT.
- `meetings.generateSummary({ meetingId })` — Trigger Google Gemini post-meeting summarization.
- `meetings.getTranscriptions({ meetingId })` — Fetch verified meeting transcripts.
- `meetings.addTranscription({ meetingId, text, agentId })` — Save speech-to-text transcript entry.

---

## 🔮 Roadmap & Known Limitations

- **Stripe Billing Integration**: The project currently focuses on agent customization and WebRTC capabilities. Quotas and Stripe subscription tiers (`Free` vs `Pro`) can be layered onto `meetings.create` and `agents.create`.
- **Custom Domain & Live Demo**: Requires active Stream Video, LiveKit Cloud, and Google Gemini API keys in deployment environment (e.g. Vercel).
