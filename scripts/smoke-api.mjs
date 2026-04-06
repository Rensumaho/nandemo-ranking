const baseUrl = process.env.BASE_URL ?? "http://localhost:3005";

let cookie = "";

async function request(path, init = {}) {
  const headers = new Headers(init.headers ?? {});
  if (cookie) {
    headers.set("cookie", cookie);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    redirect: init.redirect ?? "manual",
  });

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    cookie = setCookie.split(";")[0];
  }

  return response;
}

async function main() {
  const itemsRes = await request("/api/ranking-items");
  if (!itemsRes.ok) {
    throw new Error(`GET /api/ranking-items failed: ${itemsRes.status}`);
  }

  const itemsJson = await itemsRes.json();
  const itemId = itemsJson.items?.[0]?.id;
  if (!itemId) {
    throw new Error("No ranking items found.");
  }

  const createReqBody = new URLSearchParams({
    ranking_item_id: itemId,
    requested_delta: "2",
    reason_text: "[SMOKE] API経由の依頼投稿テスト",
    redirect_to: `/items/${itemId}`,
  });
  const createReqRes = await request("/api/score-requests", {
    method: "POST",
    body: createReqBody,
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  if (createReqRes.status < 300 || createReqRes.status >= 400) {
    throw new Error(`POST /api/score-requests expected redirect, got ${createReqRes.status}`);
  }

  const detailRes1 = await request(`/api/ranking-items/${itemId}`);
  const detail1 = await detailRes1.json();
  const requestId = detail1.requests?.[0]?.id;
  if (!requestId) {
    throw new Error("Could not find created score request.");
  }

  const reactionBody = new URLSearchParams({
    request_id: requestId,
    reaction_type: "good",
    redirect_to: `/items/${itemId}`,
  });
  const reactionRes = await request("/api/reactions", {
    method: "POST",
    body: reactionBody,
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  if (reactionRes.status < 300 || reactionRes.status >= 400) {
    throw new Error(`POST /api/reactions expected redirect, got ${reactionRes.status}`);
  }

  const commentBody = new URLSearchParams({
    request_id: requestId,
    body: "[SMOKE] API経由のコメント投稿テスト",
    redirect_to: `/items/${itemId}`,
  });
  const commentRes = await request("/api/comments", {
    method: "POST",
    body: commentBody,
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  if (commentRes.status < 300 || commentRes.status >= 400) {
    throw new Error(`POST /api/comments expected redirect, got ${commentRes.status}`);
  }

  const detailRes2 = await request(`/api/ranking-items/${itemId}`);
  const detail2 = await detailRes2.json();
  const latestRequest = detail2.requests?.[0];
  const comments = detail2.commentsByRequestId?.[requestId] ?? [];
  const latestComment = comments[comments.length - 1];

  console.log(
    JSON.stringify(
      {
        itemId,
        requestId,
        latestReason: latestRequest?.reason_text,
        goodCount: latestRequest?.good_count,
        latestComment: latestComment?.body,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

