# AI Video Editor – Overview

## What this MVP does
- Next.js + TypeScript + Tailwind UI for creating projects, uploading media, and triggering renders.
- Password-gated admin experience with CSRF protection and signed download URLs.
- In-process queue backed by a shared SQLite volume so the web app and worker stay in sync.
- Worker stages: analyze (ffprobe + audio heuristics), plan (deterministic EDL presets), render (FFmpeg H264/AAC), and artifact uploads to Cloudflare R2 using the `projects/{projectId}/...` prefix layout.

## Tech stack
- Bun for package management, Next.js 14 (app router), Prisma + SQLite (shared Docker volume).
- AWS SDK v3 for R2 (S3-compatible), Busboy for streaming uploads.
- FFmpeg/ffprobe inside the worker image; no dev server is started by default in this repo.

## Prerequisites
1) Bun installed locally (for optional dev commands).  
2) Docker + Docker Compose.  
3) Cloudflare R2 bucket/credentials.  
4) A Docker network named `apps-net` for the Cloudflare tunnel:
```bash
docker network create apps-net
```

## Configuration
1) Copy `.env.example` to `.env` and set values:
   - `ADMIN_PASSWORD`, `SESSION_SECRET` (random string), `APP_ORIGIN` (e.g., http://localhost:3000).
   - `R2_ENDPOINT`, `R2_REGION=auto`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
   - `DATABASE_URL=file:/data/db.sqlite` (shared volume path for both containers).
2) Keep credentials out of Git.

## Local usage (optional, without running dev servers here)
- Install deps locally if desired: `bun install`.
- Generate Prisma client: `bun run prisma:generate`.
- Start Next.js locally only if explicitly needed: `bun run dev` (protected by middleware).
- Run the worker locally if needed: `bun run worker`.

## Workflow summary
1) Login at `/login` with `ADMIN_PASSWORD`.  
2) Create a project (name, prompt, style preset, output size/duration).  
3) Upload one or more videos and an optional audio track (streamed directly to R2).  
4) Click Render. The worker claims the job, updates progress/stage, and uploads artifacts:
   - Analysis JSON → `projects/{id}/analysis/{job}.json`
   - EDL JSON → `projects/{id}/edl/{job}.json`
   - Logs → `projects/{id}/logs/{job}.log`
   - Final MP4 → `projects/{id}/renders/{job}.mp4`
5) Download artifacts via signed URLs from the Project Detail page.

## Sample media note
- No media is committed. Provide your own test files (e.g., small MP4 for `VIDEO_PATH`, MP3/WAV for `AUDIO_PATH`) when running the included `scripts/e2e.sh`.

## Security notes
- Single admin password, httpOnly session cookie, CSRF token cookie + origin check, and sanitized filenames.
- R2 credentials are server-only; browser only sees short-lived signed URLs.
