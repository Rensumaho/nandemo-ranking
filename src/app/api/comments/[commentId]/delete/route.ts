import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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

  const resUpdate = await db.query(
    `
      update comments
      set
        body = 'このコメントは削除されました',
        deleted_at = now(),
        deleted_by_anon_id = $2,
        delete_reason = 'user_request'
      where id = $1
        and anon_id = $2
        and deleted_at is null
      returning id
    `,
    [commentId, anonId],
  );

  const statusQuery = (resUpdate.rowCount ?? 0) > 0 ? "ok=comment-deleted" : "error=comment-delete-denied";
  const res = NextResponse.redirect(new URL(`${redirectTo}?${statusQuery}`, request.url));
  ensureAnonCookie(res, anonId);
  return res;
}
