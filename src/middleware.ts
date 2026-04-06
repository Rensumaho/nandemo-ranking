import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ANON_COOKIE_NAME } from "@/lib/anon";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const existing = request.cookies.get(ANON_COOKIE_NAME)?.value;

  if (!existing) {
    response.cookies.set(ANON_COOKIE_NAME, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

