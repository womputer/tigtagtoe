# Deploy TigTagToe (live demo)

Goal: visitors on https://tigtagtoe.vercel.app can **upload → agent → inbox** without a local API.

## 1. Backend on Render

1. Create a **Web Service** from this repo (Blueprint: `backend/render.yaml`, or manual):
   - Root directory: `backend`
   - Runtime: Python
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Health check: `/healthz`
   - Plan: **free** is fine for the portfolio demo (SQLite is ephemeral; re-upload the sample CSV after cold starts)
2. Set env vars on the service:
   - `ANTHROPIC_API_KEY` — **required** (owner secret)
   - `CORS_ORIGINS` — default in `render.yaml` is `https://tigtagtoe.vercel.app,http://localhost:5173`
   - Optional: `ANTHROPIC_MODEL`, `AGENT_CONCURRENCY`, `MAX_EMAILS_PER_RUN`, `MAX_BODY_CHARS`, `DATABASE_URL`
3. Note the public URL, e.g. `https://tigtagtoe-api.onrender.com`. Confirm `GET /healthz` returns `{"status":"ok"}` (first hit on free tier can take 30–60s).

## 2. Frontend on Vercel

1. Project root: `frontend` (already used by `frontend/vercel.json`).
2. Set **build-time** env: `VITE_API_BASE_URL` = the Render URL from step 1 (no trailing slash).
3. Redeploy so Vite bakes the base URL into the bundle.
4. Open https://tigtagtoe.vercel.app — upload `data/sample_emails.csv`, wait for the agent, open the inbox.

## 3. Acceptance checklist

- [ ] Upload works against the Render API (not localhost)
- [ ] CORS is clean in the browser network panel
- [ ] Offline / wrong `VITE_API_BASE_URL` shows a clear error (not a hung spinner)
- [ ] Cold Render wake shows a recoverable error / retry path rather than infinite progress

## Blockers that need the owner

- Anthropic API key on Render (`ANTHROPIC_API_KEY`)
- Creating the Render web service (one-time console click, or Blueprint apply)
- Setting `VITE_API_BASE_URL` on Vercel and triggering a production rebuild

Paid Render disk / Postgres is **not** required for the demo; use free SQLite and re-upload after sleeps.
