#!/bin/bash
set -euo pipefail

# Requirements: curl, jq
# Usage: ADMIN_PASSWORD=... VIDEO_PATH=./sample.mp4 AUDIO_PATH=./audio.mp3 BASE_URL=http://localhost:3000 ./scripts/e2e.sh

BASE_URL=${BASE_URL:-http://localhost:3000}
COOKIE_JAR="$(mktemp)"

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "Set ADMIN_PASSWORD env var" >&2
  exit 1
fi

if [ -z "${VIDEO_PATH:-}" ]; then
  echo "Set VIDEO_PATH to a local video file" >&2
  exit 1
fi

echo "Logging in..."
curl -s -c "$COOKIE_JAR" -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"${ADMIN_PASSWORD}\"}" >/dev/null

CSRF=$(grep videolab_csrf "$COOKIE_JAR" | awk '{print $7}')
if [ -z "$CSRF" ]; then
  echo "Failed to read CSRF token" >&2
  exit 1
fi

echo "Creating project..."
PROJECT_JSON=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/projects" \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -d '{"name":"CLI Demo","prompt":"hype edit from script","style":"hype","outputWidth":1080,"outputHeight":1920,"targetDuration":20}')
PROJECT_ID=$(echo "$PROJECT_JSON" | jq -r '.id')

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "null" ]; then
  echo "Project creation failed: $PROJECT_JSON" >&2
  exit 1
fi
echo "Project id: $PROJECT_ID"

echo "Uploading media..."
UPLOAD_CMD=(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/projects/${PROJECT_ID}/assets" -H "x-csrf-token: $CSRF" -F "files=@${VIDEO_PATH}")
if [ -n "${AUDIO_PATH:-}" ]; then
  UPLOAD_CMD+=(-F "files=@${AUDIO_PATH}")
fi
"${UPLOAD_CMD[@]}" >/dev/null
echo "Upload complete"

echo "Starting render job..."
JOB_JSON=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/projects/${PROJECT_ID}/jobs" \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -d "{\"projectId\":\"${PROJECT_ID}\"}")
JOB_ID=$(echo "$JOB_JSON" | jq -r '.id')
if [ -z "$JOB_ID" ] || [ "$JOB_ID" = "null" ]; then
  echo "Job creation failed: $JOB_JSON" >&2
  exit 1
fi
echo "Job id: $JOB_ID"

STATUS="QUEUED"
while [ "$STATUS" = "QUEUED" ] || [ "$STATUS" = "PROCESSING" ]; do
  sleep 5
  STATUS_JSON=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/jobs/${JOB_ID}")
  STATUS=$(echo "$STATUS_JSON" | jq -r '.status')
  STAGE=$(echo "$STATUS_JSON" | jq -r '.stage')
  PROG=$(echo "$STATUS_JSON" | jq -r '.progress')
  echo "Status: $STATUS stage=$STAGE progress=$PROG%"
done

echo "Job finished with status $STATUS"
echo "Artifacts:"
curl -s -b "$COOKIE_JAR" "$BASE_URL/api/projects/${PROJECT_ID}/artifacts" | jq '.[] | {id, type, createdAt}'

rm -f "$COOKIE_JAR"
