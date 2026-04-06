import { NextRequest, NextResponse } from "next/server";
import { ANON_COOKIE_NAME } from "@/lib/anon";
import { getRankingItemDetail } from "@/lib/ranking";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ itemId: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { itemId } = await params;
    const anonId = request.cookies.get(ANON_COOKIE_NAME)?.value;
    const detail = await getRankingItemDetail(itemId, anonId);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch ranking item detail",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    );
  }
}
