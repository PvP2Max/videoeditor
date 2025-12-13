#!/bin/sh
set -e
mkdir -p /data
echo "Applying database migrations..."
bun x prisma migrate deploy --schema app/prisma/schema.prisma
echo "Starting Next.js server..."
exec bun server.js
