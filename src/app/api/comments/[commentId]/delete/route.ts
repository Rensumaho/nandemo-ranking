import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, requireSupabaseData } from "@/lib/db";
import { ensureAnonCookie, getAnonIdFromRequest, isSameOriginPath } from "@/lib/anon";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ commentId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { commentId } = await params;
  const form = await request.formData();
  const redirectToRaw = String(form.get("redirect_to") ?? "/");
  const redirectTo = isSameOriginPath(redirectToRaw) ? redirectToRaw : "/";
  const anonId = getAnonIdFromRequest(request);

  const supabase = getSupabaseAdminClient();
  const deleteRes = await supabase
    .from("comments")
    .update({
      body: "縺薙・繧ｳ繝｡繝ｳ繝医・蜑企勁縺輔ｌ縺ｾ縺励◆",
      deleted_at: new Date().toISOString(),
      deleted_by_anon_id: anonId,
      delete_reason: "user_request",
    })
    .eq("id", commentId)
    .eq("anon_id", anonId)
    .is("deleted_at", null)
    .select("id");
  const updatedRows = requireSupabaseData(deleteRes, "Failed to delete comment");

  const statusQuery = updatedRows.length > 0 ? "ok=comment-deleted" : "error=comment-delete-denied";
  const res = NextResponse.redirect(new URL(`${redirectTo}?${statusQuery}`, request.url));
  ensureAnonCookie(res, anonId);
  return res;
}
