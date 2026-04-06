import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canCreateScoreRequest } from "@/lib/rate-limit";
import { ensureAnonCookie, getAnonIdFromRequest, isSameOriginPath } from "@/lib/anon";

export const runtime = "nodejs";

function endOfTodayJstIso() {
  const now = new Date();
  const jstString = now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
  const jstNow = new Date(jstString);
  const jstEnd = new Date(jstNow);
  jstEnd.setHours(23, 59, 59, 999);
  const utcMs = jstEnd.getTime() - 9 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const rankingItemId = String(form.get("ranking_item_id") ?? "");
  const requestedDelta = Number(form.get("requested_delta"));
  const reasonText = String(form.get("reason_text") ?? "").trim();
  const redirectToRaw = String(form.get("redirect_to") ?? "/");
  const redirectTo = isSameOriginPath(redirectToRaw) ? redirectToRaw : "/";
  const anonId = getAnonIdFromRequest(request);

  if (!rankingItemId || !Number.isFinite(requestedDelta) || !reasonText) {
    const res = NextResponse.redirect(new URL(`${redirectTo}?error=invalid-request`, request.url));
    ensureAnonCookie(res, anonId);
    return res;
  }

  if (requestedDelta === 0 || requestedDelta < -100 || requestedDelta > 100) {
    const res = NextResponse.redirect(new URL(`${redirectTo}?error=delta-out-of-range`, request.url));
    ensureAnonCookie(res, anonId);
    return res;
  }

  const allowed = await canCreateScoreRequest(anonId);
  if (!allowed) {
    const res = NextResponse.redirect(new URL(`${redirectTo}?error=request-rate-limit`, request.url));
    ensureAnonCookie(res, anonId);
    return res;
  }

  const threadRes = await db.query<{ id: string }>(
    `select id from threads where ranking_item_id = $1 limit 1`,
    [rankingItemId],
  );

  if (threadRes.rowCount === 0) {
    const res = NextResponse.redirect(new URL(`${redirectTo}?error=thread-not-found`, request.url));
    ensureAnonCookie(res, anonId);
    return res;
  }

  await db.query(
    `
      insert into score_change_requests (
        thread_id,
        requested_delta,
        reason_text,
        voting_deadline_at,
        created_by_anon_id
      ) values ($1, $2, $3, $4, $5)
    `,
    [threadRes.rows[0].id, requestedDelta, reasonText, endOfTodayJstIso(), anonId],
  );

  const res = NextResponse.redirect(new URL(`${redirectTo}?ok=request-created`, request.url));
  ensureAnonCookie(res, anonId);
  return res;
}

