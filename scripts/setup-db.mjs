import { Pool } from "pg";
import { facultyTypes, universities } from "./universities-data.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Put it in .env.local");
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const schemaSql = `
create extension if not exists pgcrypto;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists universities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('national', 'public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ranking_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id),
  university_id uuid not null references universities(id),
  faculty_type text not null check (faculty_type in ('science', 'humanities', 'medicine')),
  display_name text not null,
  current_score integer not null default 50,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, faculty_type)
);

create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  ranking_item_id uuid not null unique references ranking_items(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists score_change_requests (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  requested_delta integer not null,
  reason_text text not null,
  status text not null default 'pending' check (status in ('pending', 'applied', 'rejected')),
  voting_deadline_at timestamptz not null,
  created_by_anon_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references score_change_requests(id) on delete cascade,
  parent_comment_id uuid references comments(id) on delete set null,
  anon_id text not null,
  body text not null,
  deleted_at timestamptz,
  deleted_by_anon_id text,
  delete_reason text,
  created_at timestamptz not null default now()
);

create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references score_change_requests(id) on delete cascade,
  anon_id text not null,
  reaction_type text not null check (reaction_type in ('good', 'bad')),
  created_at timestamptz not null default now(),
  unique(request_id, anon_id)
);

create table if not exists daily_score_logs (
  id bigserial primary key,
  ranking_item_id uuid not null references ranking_items(id),
  request_id uuid not null references score_change_requests(id),
  score_before integer not null,
  applied_delta integer not null,
  score_after integer not null,
  decision text not null check (decision in ('applied', 'rejected')),
  applied_at timestamptz not null default now()
);

create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('bug', 'deletion', 'rights', 'other')),
  body text not null,
  contact_email text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_ranking_items_score on ranking_items(current_score desc);
create index if not exists idx_score_requests_thread_created on score_change_requests(thread_id, created_at desc);
create index if not exists idx_score_requests_deadline on score_change_requests(status, voting_deadline_at);
create index if not exists idx_score_requests_anon on score_change_requests(created_by_anon_id, created_at desc);
create index if not exists idx_comments_request_created on comments(request_id, created_at);
create index if not exists idx_comments_anon_created on comments(anon_id, created_at desc);
create index if not exists idx_reactions_request on reactions(request_id);
`;

async function main() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(schemaSql);

    const categoryRes = await client.query(
      `
      insert into categories (slug, name, description)
      values ('universities', '大学ランキング', '日本の大学を理系・文系・医学部で比較するランキング')
      on conflict (slug) do update set
        name = excluded.name,
        description = excluded.description
      returning id
      `,
    );
    const categoryId = categoryRes.rows[0].id;

    for (const university of universities) {
      const uniRes = await client.query(
        `
          insert into universities (name, kind)
          values ($1, $2)
          on conflict (name) do update set
            kind = excluded.kind,
            updated_at = now()
          returning id
        `,
        [university.name, university.kind],
      );

      const universityId = uniRes.rows[0].id;

      for (const facultyType of facultyTypes) {
        const score = university[facultyType.key];
        const displayName = `${university.name} ${facultyType.label}`;

        const itemRes = await client.query(
          `
            insert into ranking_items (
              category_id,
              university_id,
              faculty_type,
              display_name,
              current_score
            ) values ($1, $2, $3, $4, $5)
            on conflict (university_id, faculty_type) do update set
              display_name = excluded.display_name,
              current_score = excluded.current_score,
              updated_at = now()
            returning id
          `,
          [categoryId, universityId, facultyType.key, displayName, score],
        );

        const rankingItemId = itemRes.rows[0].id;
        await client.query(
          `
            insert into threads (ranking_item_id, title)
            values ($1, $2)
            on conflict (ranking_item_id) do nothing
          `,
          [rankingItemId, `${displayName} のスコア議論スレッド`],
        );
      }
    }

    await client.query("commit");
    console.log("Database schema and university seeds are ready.");
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

