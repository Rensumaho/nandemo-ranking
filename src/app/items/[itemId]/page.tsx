import Link from "next/link";
import { notFound } from "next/navigation";
import { getRankingItemDetail } from "@/lib/ranking";
import { facultyLabel, requestStatusLabel, universityKindLabel } from "@/lib/labels";

type PageProps = {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const okMessages: Record<string, string> = {
  "request-created": "スコア増減依頼を投稿しました。",
  "comment-created": "コメントを投稿しました。",
  "reaction-updated": "投票を更新しました。",
  "comment-deleted": "コメントを削除しました。",
};

const errorMessages: Record<string, string> = {
  "request-rate-limit": "スコア増減依頼は5分に1回までです。",
  "comment-rate-limit": "コメント投稿は30秒に1回までです。",
  "invalid-request": "依頼内容が正しくありません。",
  "invalid-comment": "コメント内容が正しくありません。",
  "invalid-reaction": "投票内容が正しくありません。",
  "comment-delete-denied": "コメント削除に失敗しました。",
  "thread-not-found": "対象スレッドが見つかりませんでした。",
  "delta-out-of-range": "増減幅は -100 から 100 の範囲で指定してください。",
};

export default async function ItemPage({ params, searchParams }: PageProps) {
  const { itemId } = await params;
  const query = await searchParams;
  const ok = typeof query.ok === "string" ? query.ok : "";
  const error = typeof query.error === "string" ? query.error : "";

  const detail = await getRankingItemDetail(itemId);
  if (!detail) {
    notFound();
  }

  return (
    <section className="stack">
      <Link href="/" className="subtle">
        ← ランキング一覧へ戻る
      </Link>

      <article className="card stack">
        <h1 className="heading">{detail.item.display_name}</h1>
        <p className="subtle">
          {detail.item.university_name} / {universityKindLabel(detail.item.university_kind)} /{" "}
          {facultyLabel(detail.item.faculty_type)}
        </p>
        <p>
          現在スコア: <strong>{detail.item.current_score}</strong>（順位: {detail.item.rank}位）
        </p>

        <form action="/api/score-requests" method="post">
          <input type="hidden" name="ranking_item_id" value={detail.item.id} />
          <input type="hidden" name="redirect_to" value={`/items/${detail.item.id}`} />
          <label>
            スコア増減値（例: +7 は 7、-5 は -5）
            <input type="number" name="requested_delta" min={-100} max={100} required />
          </label>
          <label>
            理由
            <textarea name="reason_text" rows={4} maxLength={2000} required />
          </label>
          <button type="submit">増減依頼を投稿</button>
        </form>
      </article>

      {ok && okMessages[ok] ? <p className="statusOk">{okMessages[ok]}</p> : null}
      {error && errorMessages[error] ? <p className="statusError">{errorMessages[error]}</p> : null}

      <section className="stack">
        <h2 className="heading">依頼一覧</h2>
        {detail.requests.length === 0 ? <p className="subtle">まだ依頼はありません。</p> : null}

        {detail.requests.map((request) => (
          <article key={request.id} className="requestCard stack">
            <p>
              <strong>{request.requested_delta > 0 ? `+${request.requested_delta}` : request.requested_delta}</strong>{" "}
              / {requestStatusLabel(request.status)}
            </p>
            <p>{request.reason_text}</p>
            <p className="subtle">
              Good {request.good_count} / Bad {request.bad_count} / 締切 {new Date(request.voting_deadline_at).toLocaleString("ja-JP")}
            </p>

            <div className="rowActions">
              <form action="/api/reactions" method="post">
                <input type="hidden" name="request_id" value={request.id} />
                <input type="hidden" name="reaction_type" value="good" />
                <input type="hidden" name="redirect_to" value={`/items/${detail.item.id}`} />
                <button type="submit" className="good">
                  Good
                </button>
              </form>
              <form action="/api/reactions" method="post">
                <input type="hidden" name="request_id" value={request.id} />
                <input type="hidden" name="reaction_type" value="bad" />
                <input type="hidden" name="redirect_to" value={`/items/${detail.item.id}`} />
                <button type="submit" className="bad">
                  Bad
                </button>
              </form>
            </div>

            <div>
              <h3>コメント</h3>
              {(detail.commentsByRequestId[request.id] ?? []).map((comment) => (
                <div
                  key={comment.id}
                  className={`comment${comment.parent_comment_id ? " reply" : ""}`}
                >
                  <p>{comment.body}</p>
                  <p className="subtle">{new Date(comment.created_at).toLocaleString("ja-JP")}</p>
                  {comment.deleted_at ? null : (
                    <form action={`/api/comments/${comment.id}/delete`} method="post">
                      <input type="hidden" name="redirect_to" value={`/items/${detail.item.id}`} />
                      <button type="submit" className="ghost">
                        このコメントを削除
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>

            <form action="/api/comments" method="post">
              <input type="hidden" name="request_id" value={request.id} />
              <input type="hidden" name="redirect_to" value={`/items/${detail.item.id}`} />
              <label>
                コメント投稿
                <textarea name="body" rows={3} maxLength={2000} required />
              </label>
              <button type="submit">コメントする</button>
            </form>
          </article>
        ))}
      </section>
    </section>
  );
}

