import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, ensureApiAuth } from "../../lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    ensureApiAuth(req);
  } catch {
    // ignore
  }
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
