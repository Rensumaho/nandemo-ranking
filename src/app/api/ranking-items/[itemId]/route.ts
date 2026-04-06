import { NextResponse } from "next/server";
import { getRankingItemDetail } from "@/lib/ranking";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ itemId: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const { itemId } = await params;
    const detail = await getRankingItemDetail(itemId);
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

