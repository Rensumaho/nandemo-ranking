type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const okMessages: Record<string, string> = {
  "inquiry-sent": "問い合わせを受け付けました。必要があればメールで返信します。",
};

const errorMessages: Record<string, string> = {
  "invalid-inquiry": "問い合わせ内容を確認してください。",
};

export default async function InquiryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const ok = typeof params.ok === "string" ? params.ok : "";
  const error = typeof params.error === "string" ? params.error : "";

  return (
    <section className="stack">
      <h1 className="heading">問い合わせフォーム</h1>
      <p className="subtle">
        匿名で送信できます。返信希望の場合のみメールアドレスを入力してください。
      </p>

      {ok && okMessages[ok] ? <p className="statusOk">{okMessages[ok]}</p> : null}
      {error && errorMessages[error] ? <p className="statusError">{errorMessages[error]}</p> : null}

      <article className="card">
        <form action="/api/inquiries" method="post">
          <input type="hidden" name="redirect_to" value="/inquiry" />
          <label>
            種別
            <select name="category" required defaultValue="bug">
              <option value="bug">不具合</option>
              <option value="deletion">削除依頼</option>
              <option value="rights">権利侵害申告</option>
              <option value="other">その他</option>
            </select>
          </label>
          <label>
            連絡先メール（任意）
            <input type="email" name="email" placeholder="example@mail.com" />
          </label>
          <label>
            内容
            <textarea name="body" rows={8} maxLength={4000} required />
          </label>
          <button type="submit">送信する</button>
        </form>
      </article>
    </section>
  );
}

