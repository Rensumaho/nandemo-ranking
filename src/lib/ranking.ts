import { db, withDbClient } from "@/lib/db";

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

export async function getRankingItems(): Promise<RankingItem[]> {
  const { rows } = await db.query<RankingItem>(
    `
      select
        ri.id,
        ri.display_name,
        u.name as university_name,
        u.kind as university_kind,
        ri.faculty_type,
        ri.current_score
      from ranking_items ri
      join universities u on u.id = ri.university_id
      where ri.is_active = true
      order by ri.current_score desc, ri.display_name asc
    `,
  );

  return rows;
}

export async function getRankingItemDetail(
  itemId: string,
  viewerAnonId?: string,
): Promise<RankingItemDetail | null> {
  const itemRes = await db.query<
    RankingItem & {
      rank: number;
    }
  >(
    `
      with ranked as (
        select
          ri.id,
          ri.display_name,
          u.name as university_name,
          u.kind as university_kind,
          ri.faculty_type,
          ri.current_score,
          dense_rank() over(order by ri.current_score desc) as rank
        from ranking_items ri
        join universities u on u.id = ri.university_id
        where ri.is_active = true
      )
      select * from ranked where id = $1
    `,
    [itemId],
  );

  if (itemRes.rowCount === 0) {
    return null;
  }

  const reqRes = await db.query<RankingRequest>(
    `
      select
        r.id,
        r.requested_delta,
        r.reason_text,
        r.status,
        r.voting_deadline_at::text,
        r.created_at::text,
        count(*) filter (where re.reaction_type = 'good')::int as good_count,
        count(*) filter (where re.reaction_type = 'bad')::int as bad_count
      from threads t
      join score_change_requests r on r.thread_id = t.id
      left join reactions re on re.request_id = r.id
      where t.ranking_item_id = $1
      group by r.id
      order by r.created_at desc
      limit 50
    `,
    [itemId],
  );

  const requestIds = reqRes.rows.map((row) => row.id);
  let commentsByRequestId: Record<string, RequestComment[]> = {};

  if (requestIds.length > 0) {
    const commentRes = await db.query<RequestComment>(
      `
        select
          c.id,
          c.request_id,
          c.parent_comment_id,
          c.body,
          c.created_at::text,
          c.deleted_at::text,
          case when $2::text is not null and c.anon_id = $2 then true else false end as can_delete
        from comments c
        where c.request_id = any($1::uuid[])
        order by c.created_at asc
      `,
      [requestIds, viewerAnonId ?? null],
    );

    commentsByRequestId = commentRes.rows.reduce<Record<string, RequestComment[]>>((acc, row) => {
      const prev = acc[row.request_id] ?? [];
      prev.push(row);
      acc[row.request_id] = prev;
      return acc;
    }, {});
  }

  return {
    item: itemRes.rows[0],
    requests: reqRes.rows,
    commentsByRequestId,
  };
}

export async function resolveDailyRequests(now: Date = new Date()) {
  return withDbClient(async (client) => {
    try {
      await client.query("begin");

      const pendingRes = await client.query<{
        id: string;
        ranking_item_id: string;
        requested_delta: number;
      }>(
        `
          select
            r.id,
            t.ranking_item_id,
            r.requested_delta
          from score_change_requests r
          join threads t on t.id = r.thread_id
          where r.status = 'pending'
            and r.voting_deadline_at <= $1
          for update of r
        `,
        [now.toISOString()],
      );

      let appliedCount = 0;
      let rejectedCount = 0;

      for (const req of pendingRes.rows) {
        const reactionRes = await client.query<{ good_count: number; bad_count: number }>(
          `
            select
              count(*) filter (where reaction_type = 'good')::int as good_count,
              count(*) filter (where reaction_type = 'bad')::int as bad_count
            from reactions
            where request_id = $1
          `,
          [req.id],
        );

        const { good_count: goodCount, bad_count: badCount } = reactionRes.rows[0];
        const shouldApply = goodCount > badCount;

        const scoreRes = await client.query<{ current_score: number }>(
          `select current_score from ranking_items where id = $1 for update`,
          [req.ranking_item_id],
        );

        const scoreBefore = scoreRes.rows[0].current_score;
        const appliedDelta = shouldApply ? req.requested_delta : 0;
        const scoreAfter = scoreBefore + appliedDelta;

        if (shouldApply) {
          await client.query(`update ranking_items set current_score = $2, updated_at = now() where id = $1`, [
            req.ranking_item_id,
            scoreAfter,
          ]);
        }

        await client.query(
          `
            insert into daily_score_logs (
              ranking_item_id,
              request_id,
              score_before,
              applied_delta,
              score_after,
              decision
            ) values ($1, $2, $3, $4, $5, $6)
          `,
          [req.ranking_item_id, req.id, scoreBefore, appliedDelta, scoreAfter, shouldApply ? "applied" : "rejected"],
        );

        await client.query(`update score_change_requests set status = $2 where id = $1`, [
          req.id,
          shouldApply ? "applied" : "rejected",
        ]);

        if (shouldApply) {
          appliedCount += 1;
        } else {
          rejectedCount += 1;
        }
      }

      await client.query("commit");
      return {
        processed: pendingRes.rowCount,
        applied: appliedCount,
        rejected: rejectedCount,
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}
