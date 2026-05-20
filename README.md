# TigTagToe

An email triage assistant. You drop a CSV of emails into the app, an agent reads each one, picks the tools that should handle it (schedule a meeting, draft a reply, escalate, create a task, flag, archive), and shows you what each tool would have done. You can filter the inbox by tool, search by sender or subject, and click any tool call to run a mocked version of it.

I built TigTagToe to explore how an AI agent can sit on top of a real inbox and make routine triage calls without a human in the loop. The dataset is a 150-email sample from the Enron corpus, sized to keep the demo runnable in under two minutes.

## Quick look

- Two pages: `/upload` (drag the CSV in) and `/inbox` (browse and review).
- Six required tools plus a catalog endpoint so the UI doesn't drift from the backend.
- Each tool call carries a one-line rationale from the agent so you can see why it picked what it picked.
- Mock executions are deterministic from inputs, so the same email always gives you the same fake meeting ID, ticket number, draft preview, and so on.

## Live URL

Frontend: https://tigtagtoe.vercel.app

The backend is local-only right now. The deployed frontend renders, but upload and the agent run need the API URL set on Vercel (see "Deploy notes" at the bottom of this file).

## Stack

- Frontend: React 18 + Vite 6 + TypeScript, Tailwind, React Router, React Query, Zustand, Framer Motion.
- Backend: FastAPI, SQLAlchemy 2, SQLite, Anthropic Python SDK.
- Agent: Claude Haiku 4.5 by default (override with `ANTHROPIC_MODEL`).
- Deploy: Vercel for the frontend, Render for the backend.

## Repo layout

```
tigtagtoe/
  frontend/        React app, Vite, Tailwind
  backend/         FastAPI app, SQLAlchemy models, agent runner
  data/
    sample_emails.csv     150 emails sampled from Enron (committed)
    build_dataset.py      script to regenerate the sample
  docs/
    architecture.md       deeper notes on how the pieces fit
    decisions.md          short notes on each judgment call
    interview-prep.md     study guide
  .env.example
  README.md
```

## Run it locally

You need Python 3.10+, Node 18+, and an Anthropic API key.

### 1. Clone and set env

```bash
git clone git@github.com:womputer/tigtagtoe.git
cd tigtagtoe
cp .env.example .env
# Open .env and paste your ANTHROPIC_API_KEY
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The interactive API docs sit at `http://localhost:8000/docs`.

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Click "Upload", drop in `data/sample_emails.csv`, and watch the progress climb. When it's done, hit "Open the inbox".

### Regenerate the dataset (optional)

The sampled CSV is committed, so you almost never need this. If you want to:

```bash
python3 data/build_dataset.py
```

The script downloads the Enron tarball (about 400 MB) if it isn't already in `data/`, scans the corpus, and writes `data/sample_emails.csv`. Use `--maildir PATH` if you've already extracted the tarball.

## Environment variables

| Name | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | (required) | Anthropic API key. Loaded only on the backend. |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` | Model name. Haiku is plenty for tool selection. Sonnet works too. |
| `DATABASE_URL` | `sqlite:///./tigtagtoe.db` | SQLAlchemy URL. Swap to Postgres by changing this one value. |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed origins. |
| `AGENT_CONCURRENCY` | `5` | How many emails the agent processes in parallel. |
| `MAX_EMAILS_PER_RUN` | `300` | Safety cap so an oversized CSV can't run away. |
| `MAX_BODY_CHARS` | `4000` | Caps the email body sent to the model, to keep latency and cost in check. |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Frontend only. Where the API lives. |

API keys are read from environment variables on the backend. The browser never sees them.

## API contract

There's a full OpenAPI schema at `GET /openapi.json` and a browsable version at `/docs`. The endpoints you'll actually hit:

| Method + path | What it does |
|---|---|
| `POST /api/uploads` | Multipart upload of a CSV. Returns `upload_id`, count, parse warnings. |
| `POST /api/agent/run` | Body `{ "upload_id": "..." }`. Kicks off the agent in the background. |
| `GET /api/uploads/{id}/status` | Poll for progress (`agent_status`, `agent_progress`, `agent_total`). |
| `GET /api/emails` | List emails. Query params: `upload_id`, `tool`, `q`, `limit`, `offset`. |
| `GET /api/emails/{id}` | Single email plus every tool call the agent made for it. |
| `POST /api/tools/{name}/execute` | Run the deterministic mock for a tool. Body: `{ "arguments": {...} }`. |
| `GET /api/tools` | The tool catalog the agent is aware of. |

Errors come back as `{ "detail": "..." }` with a meaningful HTTP code.

## The tool catalog

The agent picks from these six tools. Every tool also requires a `rationale` field so the model has to explain its choice in one sentence.

| Tool | When the agent reaches for it |
|---|---|
| `schedule_meeting` | The email proposes a time or asks if you're free. Arguments: attendees, proposed_time, duration_minutes, subject. |
| `draft_response` | The email asks a question or expects a reply. Arguments: to, subject, body, tone. |
| `escalate_to_manager` | The sender is unhappy, threatening to leave, or anything legally or politically sensitive. Arguments: reason, priority, original_email_id, suggested_owner. |
| `create_task` | There's a concrete deliverable or follow-up to track. Arguments: title, due_date, assignee, notes. |
| `flag_urgent` | Time-sensitive but no reply needed. Arguments: reason, deadline. |
| `archive_no_action` | Newsletters, FYIs, auto-generated messages. Arguments: category, reason. |

The mocked execution for each tool returns a realistic-looking JSON payload (fake meeting ID, ticket number, draft preview, archive folder, etc). Outputs are derived from a SHA-1 of the inputs so they're stable across runs.

## How the agent actually works

The runner is in `backend/app/agent/runner.py`. For each email it does this:

1. Pull the email out of SQLite.
2. Render a user message that includes the metadata and a trimmed body.
3. Call the Anthropic API with the tool catalog, a small system prompt, and `tool_choice={"type": "any"}` so the model always returns at least one tool call.
4. Pull the `tool_use` blocks out of the response, strip the `rationale` field off the arguments, and store one `ToolCall` row per call.
5. Update the upload's `agent_progress` counter so the UI can show live progress.

Calls run in parallel through an `asyncio.Semaphore` (default 5 at a time). Rate-limit responses are retried once with a short backoff. Per-email failures are caught, stored as an `error` status on the email, and surfaced in the inbox rather than crashing the whole run.

The system prompt and tool definitions are sent with `cache_control: {"type": "ephemeral"}` so the prompt cache covers the constant prefix. With 150 emails that drops latency noticeably after the first few calls.

## Persistence

SQLite. Three tables: `uploads`, `emails`, `tool_calls`. Created automatically on first boot (`Base.metadata.create_all`).

If you want Postgres in production, change `DATABASE_URL` to a `postgresql+psycopg://...` URL and the rest works. The agent runner doesn't assume SQLite anywhere.

## Re-uploads

If you upload a second CSV, it creates a new `Upload` row. The frontend's "active upload" is stored in `localStorage`, so the inbox always points at the most recent one. To wipe everything, delete `backend/tigtagtoe.db` and restart the API.

## What I deliberately didn't build

- Real integrations with calendar, Jira, email, or anything else. The spec was clear that tools should be mocked, so they are.
- A background job queue (Celery, RQ). For 150 emails, an `asyncio` task in the FastAPI process is enough. If you wanted to scale to 50 thousand emails per upload, that's the first thing I'd swap in.
- Multi-user accounts. There's one inbox.
- Tests beyond a couple of smoke checks. With more time I'd cover the CSV parser, the mock executor (it's deterministic, so easy), and the agent runner's error paths.
- Streaming progress via Server-Sent Events. Polling every 1.5 seconds is plenty for this workload and one less moving part.

## Tradeoffs worth calling out

- I picked Haiku as the default model. It's fast, cheap, and the tool selection is well within what it can handle. Bump to Sonnet by setting `ANTHROPIC_MODEL=claude-sonnet-4-6` if you want sharper rationales.
- Concurrency is 5 by default. Higher gets you 429s on the Anthropic side. Lower wastes time.
- The dropzone validates the column header before insert. Bad rows get logged as warnings and skipped rather than failing the whole upload.
- The agent's mock results are deterministic from the arguments. Reviewers see the same output if they click the same tool call twice, which is what the spec asks for.

## Notes on the dataset

The sampler scores emails on six categories (question, meeting, complaint, urgent, action, FYI) and picks a balanced mix. The goal is that reviewers see the agent making interesting decisions, not 150 archives in a row. Rough split in the sampled file: 30 questions, 25 meeting proposals, 20 complaints, 20 urgent, 20 action items, 25 FYIs, 10 general.

The sampler trims quoted reply chains (`-----Original Message-----` and friends) and caps bodies at 2500 characters so the CSV stays small and the prompts stay cheap.

## Deploy notes

- Frontend on Vercel reads `VITE_API_BASE_URL` at build time. Point it at the Render URL.
- Backend on Render reads everything from env vars. SQLite lives on a 1 GB persistent disk so data survives restarts. Switching to Render Postgres is a one-line change in `DATABASE_URL`.
- First request to a cold Render free-tier service can take 30 to 60 seconds. The upload page shows a "warming up" state when that happens.
- CORS is restricted to `CORS_ORIGINS`. Add your Vercel URL there.

## License

MIT.
