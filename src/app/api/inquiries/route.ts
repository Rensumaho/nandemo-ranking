import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSameOriginPath } from "@/lib/anon";

export const runtime = "nodejs";

const validCategories = new Set(["bug", "deletion", "rights", "other"]);

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const category = String(form.get("category") ?? "");
  const body = String(form.get("body") ?? "").trim();
  const emailRaw = String(form.get("email") ?? "").trim();
  const email = emailRaw.length > 0 ? emailRaw : null;
  const redirectToRaw = String(form.get("redirect_to") ?? "/inquiry");
  const redirectTo = isSameOriginPath(redirectToRaw) ? redirectToRaw : "/inquiry";

  if (!validCategories.has(category) || body.length === 0) {
    return NextResponse.redirect(new URL(`${redirectTo}?error=invalid-inquiry`, request.url));
  }

  await db.query(
    `
      insert into inquiries (category, body, contact_email)
      values ($1, $2, $3)
    `,
    [category, body, email],
  );

  return NextResponse.redirect(new URL(`${redirectTo}?ok=inquiry-sent`, request.url));
}

