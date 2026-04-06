import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureAnonCookie, getAnonIdFromRequest, isSameOriginPath } from "@/lib/anon";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const requestId = String(form.get("request_id") ?? "");
  const reactionType = String(form.get("reaction_type") ?? "");
  const redirectToRaw = String(form.get("redirect_to") ?? "/");
  const redirectTo = isSameOriginPath(redirectToRaw) ? redirectToRaw : "/";
  const anonId = getAnonIdFromRequest(request);

  if (!requestId || !["good", "bad"].includes(reactionType)) {
    const res = NextResponse.redirect(new URL(`${redirectTo}?error=invalid-reaction`, request.url));
    ensureAnonCookie(res, anonId);
    return res;
  }

  await db.query(
    `
      insert into reactions (request_id, anon_id, reaction_type)
      values ($1, $2, $3)
      on conflict (request_id, anon_id)
      do update set reaction_type = excluded.reaction_type, created_at = now()
    `,
    [requestId, anonId, reactionType],
  );

  const res = NextResponse.redirect(new URL(`${redirectTo}?ok=reaction-updated`, request.url));
  ensureAnonCookie(res, anonId);
  return res;
}

