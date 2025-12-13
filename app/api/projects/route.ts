import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/db";
import { ensureApiAuth } from "../../lib/auth";
import { projectInputSchema } from "../../lib/validation";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    ensureApiAuth(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      jobs: { orderBy: { createdAt: "desc" }, take: 1 },
      assets: true
    }
  });

  return NextResponse.json(
    projects.map((project) => ({
      ...project,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      jobs: project.jobs.map((job) => ({
        ...job,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        startedAt: job.startedAt ? job.startedAt.toISOString() : null,
        completedAt: job.completedAt ? job.completedAt.toISOString() : null
      })),
      assets: project.assets.map((asset) => ({
        ...asset,
        createdAt: asset.createdAt.toISOString()
      }))
    }))
  );
}

export async function POST(req: NextRequest) {
  try {
    ensureApiAuth(req);
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json();
  const parsed = projectInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { name, prompt, style, outputHeight, outputWidth, targetDuration } = parsed.data;
  const project = await prisma.project.create({
    data: {
      name,
      prompt,
      style,
      outputHeight,
      outputWidth,
      targetDuration: targetDuration ?? 30
    }
  });

  return NextResponse.json({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  });
}
