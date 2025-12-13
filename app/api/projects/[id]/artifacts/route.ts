import { NextRequest, NextResponse } from "next/server";
import { ensureApiAuth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    ensureApiAuth(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const artifacts = await prisma.artifact.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(
    artifacts.map((artifact) => ({
      ...artifact,
      createdAt: artifact.createdAt.toISOString()
    }))
  );
}
