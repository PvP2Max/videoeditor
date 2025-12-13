import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const SESSION_COOKIE = "videolab_session";
const CSRF_COOKIE = "videolab_csrf";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

type Session = {
  user: string;
  iat: number;
};

const getSecret = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
};

const sign = (payload: string) =>
  crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");

export const createSessionToken = (user: string) => {
  const iat = Date.now();
  const payload = `${user}:${iat}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
};

export const verifySessionToken = (token: string | undefined | null): Session | null => {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (sign(payload) !== signature) return null;
  const [user, iatStr] = payload.split(":");
  const iat = Number(iatStr);
  if (!user || Number.isNaN(iat)) return null;
  if (Date.now() - iat > SESSION_TTL_MS) return null;
  return { user, iat };
};

export const getSession = (): Session | null => {
  const cookie = cookies().get(SESSION_COOKIE);
  return verifySessionToken(cookie?.value ?? null);
};

export const requireSession = () => {
  const session = getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
};

export const setAuthCookies = (response: NextResponse, token: string, csrf: string) => {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000
  });
  response.cookies.set({
    name: CSRF_COOKIE,
    value: csrf,
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000
  });
};

export const clearAuthCookies = (response: NextResponse) => {
  response.cookies.set({ name: SESSION_COOKIE, value: "", maxAge: 0, path: "/" });
  response.cookies.set({ name: CSRF_COOKIE, value: "", maxAge: 0, path: "/" });
};

export const readCsrfToken = (): string | null => {
  const token = cookies().get(CSRF_COOKIE)?.value;
  return token ?? null;
};

export const enforceCsrf = (req: NextRequest) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  const headerToken = req.headers.get("x-csrf-token");
  const cookieToken = req.cookies.get(CSRF_COOKIE)?.value;
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    throw new Error("CSRF validation failed");
  }
  const origin = req.headers.get("origin");
  const allowedOrigin = process.env.APP_ORIGIN ?? "";
  if (origin && allowedOrigin && origin !== allowedOrigin) {
    throw new Error("Origin mismatch");
  }
};

export const ensureApiAuth = (req: NextRequest) => {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token ?? null);
  if (!session) throw new Error("Unauthorized");
  enforceCsrf(req);
  return session;
};

export const ensurePageAuth = (req: NextRequest) => {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token ?? null);
  return session;
};

export const getClientCsrf = (): string | null => {
  const headerList = headers();
  const csrf = headerList.get(`x-internal-csrf`);
  return csrf;
};

export { SESSION_COOKIE, CSRF_COOKIE };
