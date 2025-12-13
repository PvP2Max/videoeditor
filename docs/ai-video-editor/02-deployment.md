# Deployment & Operations

## Environment
- Set `.env` from `.env.example`.
- Ensure Docker network for the Cloudflare tunnel exists: `docker network create apps-net` (tunnel name `apps-net`).
- R2 variables: `R2_ENDPOINT`, `R2_REGION`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
- Auth: `ADMIN_PASSWORD`, `SESSION_SECRET`, `APP_ORIGIN` (public URL or tunnel hostname, e.g., https://photobooth.pvp2max.com).
- Database: `DATABASE_URL=file:/data/db.sqlite` (shared volume).

## Build & run (two containers only)
```bash
# from repo root
docker compose build
docker compose up -d
```
- Services:
  - `app`: Next.js server + API.
  - `worker`: polling worker with FFmpeg/ffprobe.
- Shared volume `db_data` mounted at `/data` for SQLite.
- Both services join `apps-net` for tunnel compatibility.

## Data layout in R2
- Prefix: `projects/{projectId}/`
  - `uploads/` original assets
  - `analysis/` analysis JSON
  - `edl/` planned edit JSON
  - `logs/` per-job logs
  - `renders/` final MP4 exports

## First run checklist
1) Verify `.env` is populated and secrets are strong.
2) Confirm R2 bucket exists and credentials work via `aws s3 ls --endpoint-url=$R2_ENDPOINT` (optional).
3) Start stack: `docker compose up -d`.
4) Visit `/login`, sign in, create a project, upload media, render, and download artifacts.

## Maintenance
- Jobs/state live in SQLite on `db_data` volume. Back up volume regularly if needed.
- Logs per job are uploaded to R2 and also summarized in the Job record (`logSnippet`).
- To update schema, edit `app/prisma/schema.prisma`, add a migration, and rebuild images.

## Troubleshooting
- Auth failures: ensure `APP_ORIGIN` matches the browser origin; CSRF requires the matching origin header.
- Upload issues: check R2 credentials and bucket name; filenames are sanitized server-side.
- Worker stalls: inspect `projects/{id}/logs/{job}.log` artifact and container logs.
