# Changelog

## 2024-02-21
- Initial MVP delivery: Next.js + Bun app with password login and CSRF protection.
- SQLite + Prisma schema for projects, assets, jobs, artifacts shared via Docker volume.
- Streaming uploads to R2 with per-project prefixes; worker pipeline (analyze → plan → render) with FFmpeg/ffprobe.
- Deterministic EDL planning with hype/cinematic/clean presets and schema validation.
- Artifact publishing (analysis JSON, EDL JSON, logs, MP4) and signed download URLs in UI.
- Docker Compose with two services (app, worker) on `apps-net` network; docs and curl-based e2e script added.
