import Link from "next/link";
import { getRankingItems } from "@/lib/ranking";
import { facultyLabel, universityKindLabel } from "@/lib/labels";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const okMessages: Record<string, string> = {
  "request-created": "スコア増減依頼を投稿しました。",
  "comment-created": "コメントを投稿しました。",
  "reaction-updated": "投票を更新しました。",
  "comment-deleted": "コメントを削除しました。",
  "inquiry-sent": "問い合わせを受け付けました。",
};

const errorMessages: Record<string, string> = {
  "request-rate-limit": "スコア増減依頼は5分に1回までです。",
  "comment-rate-limit": "コメント投稿は30秒に1回までです。",
  "invalid-request": "依頼内容が正しくありません。",
  "invalid-comment": "コメント内容が正しくありません。",
  "invalid-reaction": "投票内容が正しくありません。",
  "thread-not-found": "対象スレッドが見つかりませんでした。",
  "delta-out-of-range": "増減幅は -100 から 100 の範囲で指定してください。",
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const ok = typeof params.ok === "string" ? params.ok : "";
  const error = typeof params.error === "string" ? params.error : "";

  const items = await getRankingItems();

  return (
    <section className="stack">
      <h1 className="heading">大学ランキング（理系・文系・医学部）</h1>
      <p className="subtle">
        スコア順で表示しています。各項目の詳細ページで、増減依頼・コメント・Good/Bad投票ができます。
      </p>
      {ok && okMessages[ok] ? <p className="statusOk">{okMessages[ok]}</p> : null}
      {error && errorMessages[error] ? <p className="statusError">{errorMessages[error]}</p> : null}

      <table className="ranking">
        <thead>
          <tr>
            <th>順位</th>
            <th>大学</th>
            <th>区分</th>
            <th>対象</th>
            <th>スコア</th>
            <th>詳細</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              <td>{index + 1}</td>
              <td>{item.university_name}</td>
              <td>
                <span className="pill">{universityKindLabel(item.university_kind)}</span>
              </td>
              <td>{facultyLabel(item.faculty_type)}</td>
              <td>{item.current_score}</td>
              <td>
                <Link href={`/items/${item.id}`}>スレッドを見る</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
