import { NextRequest, NextResponse } from "next/server";
import Busboy from "busboy";
import { PassThrough, Readable } from "stream";
import crypto from "crypto";
import { ensureApiAuth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { fileLimits, sanitizeFilename } from "../../../../lib/validation";
import { uploadStream } from "../../../../lib/r2";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    ensureApiAuth(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  const bb = Busboy({
    headers,
    limits: { fileSize: fileLimits.maxUploadBytes }
  });

  const uploads: Promise<void>[] = [];
  const assetPayloads: {
    filename: string;
    contentType: string;
    size: number;
    r2Key: string;
    kind: "VIDEO" | "AUDIO";
  }[] = [];
  let validFiles = 0;
  let sizeLimitHit = false;

  bb.on("file", (_name, file, info) => {
    const { filename, mimeType } = info;
    const isVideo = mimeType.startsWith("video/");
    const isAudio = mimeType.startsWith("audio/");
    if (!isVideo && !isAudio) {
      file.resume();
      return;
    }
    validFiles += 1;
    const safeName = sanitizeFilename(filename);
    const key = `projects/${params.id}/uploads/${crypto.randomUUID()}-${safeName}`;
    let size = 0;
    const pass = new PassThrough();
    const uploadPromise = uploadStream(key, mimeType, pass)
      .then(() => {
        if (sizeLimitHit) return;
        assetPayloads.push({
          filename: safeName,
          contentType: mimeType,
          size,
          r2Key: key,
          kind: isAudio ? "AUDIO" : "VIDEO"
        });
      })
      .catch(() => {
        sizeLimitHit = true;
      });
    uploads.push(uploadPromise);

    file.on("data", (chunk) => {
      size += chunk.length;
      if (size > fileLimits.maxUploadBytes) {
        sizeLimitHit = true;
        file.unpipe();
        pass.end();
      }
    });
    file.on("limit", () => {
      sizeLimitHit = true;
    });
    file.on("end", () => pass.end());
    file.pipe(pass);
  });

  const body = req.body;
  if (!body) {
    return NextResponse.json({ error: "No file stream" }, { status: 400 });
  }
  const stream = Readable.fromWeb(body as any);

  const done = new Promise<void>((resolve, reject) => {
    bb.on("finish", () => resolve());
    bb.on("error", reject);
  });

  stream.pipe(bb);
  await done;

  await Promise.allSettled(uploads);

  if (sizeLimitHit) {
    return NextResponse.json({ error: "File exceeds limit" }, { status: 413 });
  }

  if (validFiles === 0 || assetPayloads.length === 0) {
    return NextResponse.json({ error: "No valid audio/video files found" }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const saved = [];
    for (const payload of assetPayloads) {
      const asset = await tx.asset.create({
        data: {
          projectId: params.id,
          filename: payload.filename,
          contentType: payload.contentType,
          r2Key: payload.r2Key,
          size: payload.size,
          kind: payload.kind
        }
      });
      saved.push(asset);
    }
    return saved;
  });

  return NextResponse.json(
    created.map((asset) => ({
      ...asset,
      createdAt: asset.createdAt.toISOString()
    }))
  );
}
