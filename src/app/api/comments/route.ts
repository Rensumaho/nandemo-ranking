import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canCreateComment } from "@/lib/rate-limit";
import { ensureAnonCookie, getAnonIdFromRequest, isSameOriginPath } from "@/lib/anon";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const requestId = String(form.get("request_id") ?? "");
  const parentCommentIdRaw = form.get("parent_comment_id");
  const parentCommentId =
    typeof parentCommentIdRaw === "string" && parentCommentIdRaw.trim() ? parentCommentIdRaw : null;
  const body = String(form.get("body") ?? "").trim();
  const redirectToRaw = String(form.get("redirect_to") ?? "/");
  const redirectTo = isSameOriginPath(redirectToRaw) ? redirectToRaw : "/";
  const anonId = getAnonIdFromRequest(request);

  if (!requestId || !body) {
    const res = NextResponse.redirect(new URL(`${redirectTo}?error=invalid-comment`, request.url));
    ensureAnonCookie(res, anonId);
    return res;
  }

  if (body.length > 2000) {
    const res = NextResponse.redirect(new URL(`${redirectTo}?error=comment-too-long`, request.url));
    ensureAnonCookie(res, anonId);
    return res;
  }

  const allowed = await canCreateComment(anonId);
  if (!allowed) {
    const res = NextResponse.redirect(new URL(`${redirectTo}?error=comment-rate-limit`, request.url));
    ensureAnonCookie(res, anonId);
    return res;
  }

  await db.query(
    `
      insert into comments (request_id, parent_comment_id, anon_id, body)
      values ($1, $2, $3, $4)
    `,
    [requestId, parentCommentId, anonId, body],
  );

  const res = NextResponse.redirect(new URL(`${redirectTo}?ok=comment-created`, request.url));
  ensureAnonCookie(res, anonId);
  return res;
}

