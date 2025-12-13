import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSessionToken, setAuthCookies } from "../../lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ error: "ADMIN_PASSWORD not configured" }, { status: 500 });
  }
  if (password !== adminPassword) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const sessionToken = createSessionToken("admin");
  const csrf = crypto.randomBytes(24).toString("hex");
  const response = NextResponse.json({ ok: true });
  setAuthCookies(response, sessionToken, csrf);
  return response;
}
