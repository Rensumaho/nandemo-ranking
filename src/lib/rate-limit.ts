import { db } from "@/lib/db";

export async function canCreateScoreRequest(anonId: string) {
  const { rows } = await db.query<{ created_at: string }>(
    `
      select created_at::text
      from score_change_requests
      where created_by_anon_id = $1
      order by created_at desc
      limit 1
    `,
    [anonId],
  );

  if (rows.length === 0) {
    return true;
  }

  const lastAt = new Date(rows[0].created_at).getTime();
  return Date.now() - lastAt >= 5 * 60 * 1000;
}

export async function canCreateComment(anonId: string) {
  const { rows } = await db.query<{ created_at: string }>(
    `
      select created_at::text
      from comments
      where anon_id = $1
      order by created_at desc
      limit 1
    `,
    [anonId],
  );

  if (rows.length === 0) {
    return true;
  }

  const lastAt = new Date(rows[0].created_at).getTime();
  return Date.now() - lastAt >= 30 * 1000;
}

