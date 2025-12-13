#!/bin/sh
set -e
mkdir -p /data
echo "Applying database migrations for worker..."
bun x prisma migrate deploy --schema app/prisma/schema.prisma
echo "Starting worker loop..."
exec bun run app/worker/index.ts
