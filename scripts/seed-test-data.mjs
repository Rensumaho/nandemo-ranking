import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Put it in .env.local");
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

function endOfTodayJstIso() {
  const now = new Date();
  const jstString = now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
  const jstNow = new Date(jstString);
  const jstEnd = new Date(jstNow);
  jstEnd.setHours(23, 59, 59, 999);
  return new Date(jstEnd.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("begin");

    await client.query(
      `
        delete from score_change_requests
        where reason_text like '[SEED]%'
      `,
    );

    const itemsRes = await client.query(
      `
        select id, display_name
        from ranking_items
        where is_active = true
        order by current_score desc, display_name asc
        limit 3
      `,
    );

    if (itemsRes.rowCount === 0) {
      throw new Error("No ranking_items found. Run npm run db:setup first.");
    }

    const seedRows = [
      {
        delta: 7,
        reason:
          "[SEED] 国際ランキングと研究成果を考えると、現行スコアはやや低く見えるため上方修正を提案します。",
        good: 12,
        bad: 4,
      },
      {
        delta: -4,
        reason:
          "[SEED] 直近の入試難易度と志願者動向を踏まえると、現行スコアはやや高く見えるため下方修正を提案します。",
        good: 5,
        bad: 9,
      },
      {
        delta: 3,
        reason:
          "[SEED] 学部再編と研究予算の拡充により評価改善が見込まれるため、少し加点したいです。",
        good: 8,
        bad: 3,
      },
    ];

    for (let i = 0; i < itemsRes.rows.length; i += 1) {
      const item = itemsRes.rows[i];
      const seed = seedRows[i % seedRows.length];

      const threadRes = await client.query(`select id from threads where ranking_item_id = $1`, [item.id]);
      const threadId = threadRes.rows[0].id;

      const reqRes = await client.query(
        `
          insert into score_change_requests (
            thread_id,
            requested_delta,
            reason_text,
            voting_deadline_at,
            created_by_anon_id
          ) values ($1, $2, $3, $4, $5)
          returning id
        `,
        [threadId, seed.delta, seed.reason, endOfTodayJstIso(), `seed-author-${i + 1}`],
      );
      const requestId = reqRes.rows[0].id;

      const topCommentRes = await client.query(
        `
          insert into comments (request_id, anon_id, body)
          values ($1, $2, $3)
          returning id
        `,
        [requestId, `seed-commenter-${i + 1}`, "[SEED] たしかに根拠が明確で、検討する価値があると思います。"],
      );

      await client.query(
        `
          insert into comments (request_id, parent_comment_id, anon_id, body)
          values ($1, $2, $3, $4)
        `,
        [
          requestId,
          topCommentRes.rows[0].id,
          `seed-reply-${i + 1}`,
          "[SEED] 入試難易度との整合性も考えるべきなので、増減幅は慎重でも良さそうです。",
        ],
      );

      for (let g = 0; g < seed.good; g += 1) {
        await client.query(
          `
            insert into reactions (request_id, anon_id, reaction_type)
            values ($1, $2, 'good')
            on conflict (request_id, anon_id) do update set reaction_type = excluded.reaction_type
          `,
          [requestId, `seed-good-${i + 1}-${g + 1}`],
        );
      }

      for (let b = 0; b < seed.bad; b += 1) {
        await client.query(
          `
            insert into reactions (request_id, anon_id, reaction_type)
            values ($1, $2, 'bad')
            on conflict (request_id, anon_id) do update set reaction_type = excluded.reaction_type
          `,
          [requestId, `seed-bad-${i + 1}-${b + 1}`],
        );
      }
    }

    await client.query("commit");
    console.log("Seeded sample score requests, comments, and reactions.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

