import { NextRequest, NextResponse } from "next/server";
import { ensureApiAuth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { getDownloadUrl } from "../../../../lib/r2";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    ensureApiAuth(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const artifact = await prisma.artifact.findUnique({ where: { id: params.id } });
  if (!artifact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = await getDownloadUrl(artifact.r2Key, 300);
  return NextResponse.json({ url });
}
