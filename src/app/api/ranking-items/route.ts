import { NextResponse } from "next/server";
import { getRankingItems } from "@/lib/ranking";

export const runtime = "nodejs";

export async function GET() {
  try {
    const items = await getRankingItems();
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch ranking items",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    );
  }
}

