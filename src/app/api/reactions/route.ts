import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, throwIfSupabaseError } from "@/lib/db";
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

  const supabase = getSupabaseAdminClient();
  const upsertRes = await supabase.from("reactions").upsert(
    {
      request_id: requestId,
      anon_id: anonId,
      reaction_type: reactionType,
      created_at: new Date().toISOString(),
    },
    { onConflict: "request_id,anon_id" },
  );
  throwIfSupabaseError(upsertRes, "Failed to upsert reaction");

  const res = NextResponse.redirect(new URL(`${redirectTo}?ok=reaction-updated`, request.url));
  ensureAnonCookie(res, anonId);
  return res;
}
