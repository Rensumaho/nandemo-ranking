import { getSupabaseAdminClient, requireSupabaseData, throwIfSupabaseError } from "@/lib/db";

export type RankingItem = {
  id: string;
  display_name: string;
  university_name: string;
  university_kind: "national" | "public" | "private";
  faculty_type: "science" | "humanities" | "medicine";
  current_score: number;
};

export type RankingRequest = {
  id: string;
  requested_delta: number;
  reason_text: string;
  status: "pending" | "applied" | "rejected";
  voting_deadline_at: string;
  created_at: string;
  good_count: number;
  bad_count: number;
};

export type RequestComment = {
  id: string;
  request_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  deleted_at: string | null;
  can_delete: boolean;
};

export type RankingItemDetail = {
  item: RankingItem & { rank: number };
  requests: RankingRequest[];
  commentsByRequestId: Record<string, RequestComment[]>;
};

type UniversityRow = {
  name: string;
  kind: RankingItem["university_kind"];
};

type RankingItemRow = {
  id: string;
  display_name: string;
  faculty_type: RankingItem["faculty_type"];
  current_score: number;
  universities: UniversityRow | UniversityRow[] | null;
};

type RankingRow = {
  id: string;
  current_score: number;
};

type ScoreChangeRequestRow = {
  id: string;
  requested_delta: number;
  reason_text: string;
  status: RankingRequest["status"];
  voting_deadline_at: string;
  created_at: string;
};

type ReactionRow = {
  request_id: string;
  reaction_type: "good" | "bad";
};

type CommentRow = {
  id: string;
  request_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  deleted_at: string | null;
  anon_id: string;
};

type PendingRequestRow = {
  id: string;
  thread_id: string;
  requested_delta: number;
};

type ThreadRow = {
  id: string;
  ranking_item_id: string;
};

type RankingScoreRow = {
  id: string;
  current_score: number;
};

function normalizeUniversity(row: UniversityRow | UniversityRow[] | null): UniversityRow {
  if (Array.isArray(row)) {
    if (row.length > 0) {
      return row[0];
    }
    throw new Error("University relation is empty");
  }
  if (!row) {
    throw new Error("University relation is missing");
  }
  return row;
}

export async function getRankingItems(): Promise<RankingItem[]> {
  const supabase = getSupabaseAdminClient();
  const itemRes = await supabase
    .from("ranking_items")
    .select("id,display_name,faculty_type,current_score,universities!inner(name,kind)")
    .eq("is_active", true)
    .order("current_score", { ascending: false })
    .order("display_name", { ascending: true });

  const rows = requireSupabaseData(itemRes, "Failed to fetch ranking items") as RankingItemRow[];

  return rows.map((row) => {
    const university = normalizeUniversity(row.universities);
    return {
      id: row.id,
      display_name: row.display_name,
      university_name: university.name,
      university_kind: university.kind,
      faculty_type: row.faculty_type,
      current_score: row.current_score,
    };
  });
}

export async function getRankingItemDetail(
  itemId: string,
  viewerAnonId?: string,
): Promise<RankingItemDetail | null> {
  const supabase = getSupabaseAdminClient();

  const itemRes = await supabase
    .from("ranking_items")
    .select("id,display_name,faculty_type,current_score,universities!inner(name,kind)")
    .eq("is_active", true)
    .eq("id", itemId)
    .maybeSingle();
  throwIfSupabaseError(itemRes, "Failed to fetch ranking item");

  if (!itemRes.data) {
    return null;
  }

  const itemRow = itemRes.data as RankingItemRow;
  const university = normalizeUniversity(itemRow.universities);

  const rankingRes = await supabase
    .from("ranking_items")
    .select("id,current_score")
    .eq("is_active", true)
    .order("current_score", { ascending: false })
    .order("id", { ascending: true });
  const rankingRows = requireSupabaseData(rankingRes, "Failed to fetch ranking positions") as RankingRow[];

  let currentRank = 0;
  let previousScore: number | null = null;
  const rankByItemId = new Map<string, number>();
  for (const row of rankingRows) {
    if (previousScore === null || previousScore !== row.current_score) {
      currentRank += 1;
      previousScore = row.current_score;
    }
    rankByItemId.set(row.id, currentRank);
  }

  const rank = rankByItemId.get(itemId);
  if (!rank) {
    return null;
  }

  const threadRes = await supabase.from("threads").select("id").eq("ranking_item_id", itemId).maybeSingle();
  throwIfSupabaseError(threadRes, "Failed to fetch thread");

  const threadId = threadRes.data?.id ?? null;
  let requestRows: ScoreChangeRequestRow[] = [];
  if (threadId) {
    const requestRes = await supabase
      .from("score_change_requests")
      .select("id,requested_delta,reason_text,status,voting_deadline_at,created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(50);
    requestRows = requireSupabaseData(requestRes, "Failed to fetch score requests") as ScoreChangeRequestRow[];
  }

  const requestIds = requestRows.map((row) => row.id);
  const reactionCountByRequestId = new Map<string, { good: number; bad: number }>();

  if (requestIds.length > 0) {
    const reactionRes = await supabase
      .from("reactions")
      .select("request_id,reaction_type")
      .in("request_id", requestIds);
    const reactionRows = requireSupabaseData(reactionRes, "Failed to fetch reactions") as ReactionRow[];
    for (const row of reactionRows) {
      const current = reactionCountByRequestId.get(row.request_id) ?? { good: 0, bad: 0 };
      if (row.reaction_type === "good") {
        current.good += 1;
      } else {
        current.bad += 1;
      }
      reactionCountByRequestId.set(row.request_id, current);
    }
  }

  const requests: RankingRequest[] = requestRows.map((row) => {
    const counts = reactionCountByRequestId.get(row.id) ?? { good: 0, bad: 0 };
    return {
      id: row.id,
      requested_delta: row.requested_delta,
      reason_text: row.reason_text,
      status: row.status,
      voting_deadline_at: row.voting_deadline_at,
      created_at: row.created_at,
      good_count: counts.good,
      bad_count: counts.bad,
    };
  });

  let commentsByRequestId: Record<string, RequestComment[]> = {};

  if (requestIds.length > 0) {
    const commentRes = await supabase
      .from("comments")
      .select("id,request_id,parent_comment_id,body,created_at,deleted_at,anon_id")
      .in("request_id", requestIds)
      .order("created_at", { ascending: true });
    const commentRows = requireSupabaseData(commentRes, "Failed to fetch comments") as CommentRow[];

    commentsByRequestId = commentRows.reduce<Record<string, RequestComment[]>>((acc, row) => {
      const canDelete = !!viewerAnonId && row.anon_id === viewerAnonId;
      const prev = acc[row.request_id] ?? [];
      prev.push({
        id: row.id,
        request_id: row.request_id,
        parent_comment_id: row.parent_comment_id,
        body: row.body,
        created_at: row.created_at,
        deleted_at: row.deleted_at,
        can_delete: canDelete,
      });
      acc[row.request_id] = prev;
      return acc;
    }, {});
  }

  return {
    item: {
      id: itemRow.id,
      display_name: itemRow.display_name,
      university_name: university.name,
      university_kind: university.kind,
      faculty_type: itemRow.faculty_type,
      current_score: itemRow.current_score,
      rank,
    },
    requests,
    commentsByRequestId,
  };
}

export async function resolveDailyRequests(now: Date = new Date()) {
  const supabase = getSupabaseAdminClient();
  const nowIso = now.toISOString();

  const pendingRes = await supabase
    .from("score_change_requests")
    .select("id,thread_id,requested_delta")
    .eq("status", "pending")
    .lte("voting_deadline_at", nowIso);
  const pendingRows = requireSupabaseData(pendingRes, "Failed to fetch pending requests") as PendingRequestRow[];

  if (pendingRows.length === 0) {
    return {
      processed: 0,
      applied: 0,
      rejected: 0,
    };
  }

  const threadIds = [...new Set(pendingRows.map((row) => row.thread_id))];
  const threadRes = await supabase.from("threads").select("id,ranking_item_id").in("id", threadIds);
  const threadRows = requireSupabaseData(threadRes, "Failed to fetch threads") as ThreadRow[];
  const rankingItemIdByThreadId = new Map<string, string>(
    threadRows.map((row) => [row.id, row.ranking_item_id]),
  );

  const requestIds = pendingRows.map((row) => row.id);
  const reactionRes = await supabase.from("reactions").select("request_id,reaction_type").in("request_id", requestIds);
  const reactionRows = requireSupabaseData(reactionRes, "Failed to fetch reactions") as ReactionRow[];

  const reactionCountByRequestId = new Map<string, { good: number; bad: number }>();
  for (const row of reactionRows) {
    const current = reactionCountByRequestId.get(row.request_id) ?? { good: 0, bad: 0 };
    if (row.reaction_type === "good") {
      current.good += 1;
    } else {
      current.bad += 1;
    }
    reactionCountByRequestId.set(row.request_id, current);
  }

  const rankingItemIds = [...new Set(threadRows.map((row) => row.ranking_item_id))];
  const scoreRes = await supabase.from("ranking_items").select("id,current_score").in("id", rankingItemIds);
  const scoreRows = requireSupabaseData(scoreRes, "Failed to fetch ranking scores") as RankingScoreRow[];
  const scoreByRankingItemId = new Map<string, number>(scoreRows.map((row) => [row.id, row.current_score]));

  let appliedCount = 0;
  let rejectedCount = 0;

  for (const req of pendingRows) {
    const rankingItemId = rankingItemIdByThreadId.get(req.thread_id);
    if (!rankingItemId) {
      throw new Error(`Thread not found for request ${req.id}`);
    }

    const scoreBefore = scoreByRankingItemId.get(rankingItemId);
    if (scoreBefore === undefined) {
      throw new Error(`Ranking item not found for request ${req.id}`);
    }

    const counts = reactionCountByRequestId.get(req.id) ?? { good: 0, bad: 0 };
    const shouldApply = counts.good > counts.bad;
    const appliedDelta = shouldApply ? req.requested_delta : 0;
    const scoreAfter = scoreBefore + appliedDelta;

    if (shouldApply) {
      const scoreUpdateRes = await supabase
        .from("ranking_items")
        .update({ current_score: scoreAfter, updated_at: nowIso })
        .eq("id", rankingItemId);
      throwIfSupabaseError(scoreUpdateRes, `Failed to update score for request ${req.id}`);
      scoreByRankingItemId.set(rankingItemId, scoreAfter);
    }

    const logInsertRes = await supabase.from("daily_score_logs").insert({
      ranking_item_id: rankingItemId,
      request_id: req.id,
      score_before: scoreBefore,
      applied_delta: appliedDelta,
      score_after: scoreAfter,
      decision: shouldApply ? "applied" : "rejected",
    });
    throwIfSupabaseError(logInsertRes, `Failed to insert daily log for request ${req.id}`);

    const requestUpdateRes = await supabase
      .from("score_change_requests")
      .update({ status: shouldApply ? "applied" : "rejected" })
      .eq("id", req.id);
    throwIfSupabaseError(requestUpdateRes, `Failed to update request status for request ${req.id}`);

    if (shouldApply) {
      appliedCount += 1;
    } else {
      rejectedCount += 1;
    }
  }

  return {
    processed: pendingRows.length,
    applied: appliedCount,
    rejected: rejectedCount,
  };
}
