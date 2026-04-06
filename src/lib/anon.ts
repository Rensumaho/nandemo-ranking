import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const ANON_COOKIE_NAME = "anon_id";

export function getAnonIdFromRequest(request: NextRequest) {
  const anonId = request.cookies.get(ANON_COOKIE_NAME)?.value;
  return anonId ?? crypto.randomUUID();
}

export function ensureAnonCookie(response: NextResponse, anonId: string) {
  response.cookies.set(ANON_COOKIE_NAME, anonId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function isSameOriginPath(path: string | null) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}
