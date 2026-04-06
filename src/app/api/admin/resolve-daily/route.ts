import { NextResponse } from "next/server";
import { resolveDailyRequests } from "@/lib/ranking";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await resolveDailyRequests();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "daily-resolution-failed",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    );
  }
}

