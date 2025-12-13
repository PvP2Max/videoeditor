import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { ensureApiAuth } from "../../../lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    ensureApiAuth(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      assets: true,
      jobs: { orderBy: { createdAt: "desc" } },
      artifacts: true
    }
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    assets: project.assets.map((asset) => ({
      ...asset,
      createdAt: asset.createdAt.toISOString()
    })),
    jobs: project.jobs.map((job) => ({
      ...job,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      startedAt: job.startedAt ? job.startedAt.toISOString() : null,
      completedAt: job.completedAt ? job.completedAt.toISOString() : null
    })),
    artifacts: project.artifacts.map((artifact) => ({
      ...artifact,
      createdAt: artifact.createdAt.toISOString()
    }))
  });
}
