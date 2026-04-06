import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, throwIfSupabaseError } from "@/lib/db";
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

  const supabase = getSupabaseAdminClient();
  const threadRes = await supabase.from("threads").select("id").eq("ranking_item_id", rankingItemId).maybeSingle();
  throwIfSupabaseError(threadRes, "Failed to find thread");

  if (!threadRes.data) {
    const res = NextResponse.redirect(new URL(`${redirectTo}?error=thread-not-found`, request.url));
    ensureAnonCookie(res, anonId);
    return res;
  }

  const insertRes = await supabase.from("score_change_requests").insert({
    thread_id: threadRes.data.id,
    requested_delta: requestedDelta,
    reason_text: reasonText,
    voting_deadline_at: endOfTodayJstIso(),
    created_by_anon_id: anonId,
  });
  throwIfSupabaseError(insertRes, "Failed to create score request");

  const res = NextResponse.redirect(new URL(`${redirectTo}?ok=request-created`, request.url));
  ensureAnonCookie(res, anonId);
  return res;
}
