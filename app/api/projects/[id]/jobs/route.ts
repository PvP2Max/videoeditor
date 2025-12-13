import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { ensureApiAuth } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    ensureApiAuth(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  if (payload?.projectId && payload.projectId !== params.id) {
    return NextResponse.json({ error: "Project mismatch" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { assets: true }
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const hasVideo = project.assets.some((a) => a.kind === "VIDEO");
  if (!hasVideo) {
    return NextResponse.json({ error: "Upload at least one video asset" }, { status: 400 });
  }

  const existing = await prisma.job.findFirst({
    where: { projectId: params.id, status: { in: ["QUEUED", "PROCESSING"] } }
  });
  if (existing) {
    return NextResponse.json({ error: "A job is already queued or processing" }, { status: 400 });
  }

  const job = await prisma.job.create({
    data: {
      projectId: params.id,
      status: "QUEUED",
      stage: "queued",
      progress: 0
    }
  });

  return NextResponse.json({
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: null,
    completedAt: null
  });
}
