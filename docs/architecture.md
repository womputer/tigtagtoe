# Architecture notes

This is the long-form version of what's in the README. If you're reviewing the code, this is the file to read first.

## The shape of the app

Three pieces talk to each other:

```
Browser (Vite/React)
   |
   |  fetch /api/...
   v
FastAPI (uvicorn)  ───►  SQLite (file)
   |
   |  Anthropic API (only the backend has the key)
   v
Claude (Haiku by default)
```

The browser never holds the Anthropic API key. Every model call goes through the backend.

## Data model

Three tables. Foreign keys cascade on delete so removing an upload removes its emails and tool calls.

```
uploads
  id (uuid hex)
  filename
  email_count
  agent_status         idle | running | done | error
  agent_progress       counter the agent updates as it works
  agent_total          number of emails the agent is currently working on
  agent_error_count    incremented when an email's run fails
  agent_started_at
  agent_finished_at

emails
  id (uuid hex)
  upload_id (fk)
  source_id            id from the original CSV
  sender
  recipients
  cc
  subject
  sent_at
  body
  agent_status         pending | done | error
  agent_error          text if a run failed for this email

tool_calls
  id (uuid hex)
  email_id (fk)
  tool_name
  arguments (JSON, with rationale stripped out)
  rationale (separate column so it can't get lost in the JSON blob)
  order_idx            so the UI can show calls in the order the agent emitted them
```

I picked separate columns for `rationale` and `arguments` instead of stuffing the rationale inside the JSON because it's queryable and because the schema in the spec example treats them as distinct.

## Request lifecycle: upload to inbox

1. **POST /api/uploads** receives the multipart CSV, parses it (`backend/app/services/csv_parser.py`), validates column headers, drops rows that are missing required fields, and inserts an `Upload` plus one `Email` per row. Returns the `upload_id` and any per-row warnings.

2. **POST /api/agent/run** with `{ "upload_id": "..." }` enqueues a FastAPI `BackgroundTask` that calls `run_agent_for_upload`. The HTTP response goes back immediately; the agent runs out of band.

3. **The runner** loads the email IDs that are `pending` or `error`, spawns an `asyncio.gather` over them with a `Semaphore` set to `AGENT_CONCURRENCY`. Each worker:
   - Opens its own short-lived SQLite session.
   - Renders the email into a user-turn message (system prompt is cached separately via Anthropic prompt caching).
   - Sends the message to Claude with `tool_choice={"type": "any"}`. This is the trick that guarantees at least one tool call per email, satisfying the spec.
   - Reads `tool_use` blocks from the response and inserts one `ToolCall` row per block, splitting the `rationale` field off the arguments before persisting.
   - Bumps the upload's `agent_progress` counter.

4. **GET /api/uploads/{id}/status** is what the upload page polls every 1.5 seconds while the run is in flight.

5. **GET /api/emails** powers the inbox table. It supports `upload_id`, `tool`, `q`, `limit`, `offset` as query params. The `tool` filter uses a subquery against `tool_calls.tool_name`.

6. **GET /api/emails/{id}** returns the full email plus every tool call. The detail panel uses this.

7. **POST /api/tools/{name}/execute** runs a deterministic mock. The function is in `backend/app/agent/mocks.py`. Same arguments always produce the same output (SHA-1 of the JSON-encoded args).

## Concurrency model

I went with `asyncio` + a bounded semaphore inside the FastAPI process. Rationale:

- For 150 emails at Anthropic's rate limits, a single Python process is plenty.
- A Celery or RQ queue would mean another moving piece (Redis, a worker container) and another thing for a reviewer to spin up.
- Per-email failures don't poison the whole run because each worker catches its own exceptions.

If this had to handle 10x the volume, the swap is:
- Move the runner into a queue worker (RQ on top of Render Redis, say).
- Replace the in-process counter with the queue's job state.

The rest of the app doesn't change.

## Why I went with SQLite

Three reasons:
1. The reviewer can clone the repo and run it with no extra services.
2. `Base.metadata.create_all` at startup means no migrations to babysit while the schema is still settling.
3. The `DATABASE_URL` is the only change needed to move to Postgres. There's no SQLite-specific code anywhere else.

It does mean writes are single-process. For this scope that's fine.

## Frontend state

Three sources of state, each with a clear job:

- **React Query** owns server cache (emails, single email, upload status). Refetch intervals power the live progress: while `agent_status === "running"`, status polls every 1.5 seconds. The inbox polls every 2 seconds while any email is `pending`.
- **Zustand** stores the active `upload_id` (persisted to `localStorage`) and the current filter chips. Two tiny stores, no provider trees.
- **URL search params** mirror the filter and search state, so deep links and the back button work.

I deliberately did not put the filter state in React Query. It's UI state, not server data.

## Styling system

Tailwind, with a small token layer in `tailwind.config.ts`:

- `bg` is the page color. Near-black with a hint of warm blue.
- `surface-1`, `surface-2`, `surface-3` are translucent panels.
- `line` and `line-strong` are border colors.
- `accent` is the one violet that runs through the app.
- Per-tool colors (`tool-meeting`, `tool-response`, etc) so badges and result cards share a color identity.

There's a single `.glass` utility in `index.css` that applies the standard panel treatment (translucent fill, blur, hairline border, soft shadow). Most surfaces use it.

Motion lives in Framer Motion. Three places it's used:
- Page intro: fade and 8px translate.
- Detail panel: slide in from the right with a spring.
- Tool result reveal: small fade and lift.

It's restrained on purpose. The visual identity should come from typography, depth, and color, not from animations.

## Errors and edge cases the code handles

- **CSV missing columns**: 422 with the list of missing columns.
- **Empty CSV**: 422 with a friendly message.
- **Oversized upload**: 413.
- **Re-uploads**: each upload is a new row. The frontend's active upload is whatever was most recently created.
- **Per-email agent failure**: caught, stored on the row, shown in the inbox as an `error` tag in the row, and on the detail panel as a banner.
- **Model returns no tool calls** (rare with `tool_choice: any`): treated as an error so the user sees it instead of an empty list.
- **Rate limited (429)**: retried once with a 5-second sleep.
- **Cold backend on Render**: the upload page polls; once the API wakes up everything resumes.

## Security and secrets

- API keys come from `os.environ` on the backend only. Pydantic Settings validates them at startup.
- `.env` is in `.gitignore`. `.env.example` is committed.
- CORS is an allow-list driven by env var.
- No raw user input is interpolated into SQL (SQLAlchemy parameters everywhere).
- Upload size is capped at 5 MB. Long bodies are trimmed before they reach the model.

## What I would change in a v2

- Add a streaming endpoint that pushes agent progress over SSE so the UI doesn't have to poll.
- Persist tool execution results, with a "re-run" button if you want fresh output. Right now I just compute deterministically each click.
- Add a dashboard route with per-day, per-tool charts.
- Make the agent re-runnable per email, not just per upload.
- Add a real test suite. The CSV parser and mock executor are the two highest-value targets.
