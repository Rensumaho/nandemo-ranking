# Nandemo Ranking - Requirements Draft

## 1. Purpose

This project provides rankings for topics that attract online attention, such as:

- academic background
- company hiring difficulty
- influencer appearance

Each ranking item has a numeric score, and ranking order is determined by that score.

## 2. Product Concept

- The developer defines ranking categories, items, and initial scores.
- Each item has its own thread.
- In each thread, users can post score change requests (increase/decrease proposals).
- Other users reply with agreement/disagreement and reasoning.
- Observers react to each score change request with Good/Bad.
- At the end of each day, requests are resolved and scores are updated.

## 3. Core Roles

- Admin (developer): creates categories, items, and initial scores.
- User: posts score change requests and replies.
- Observer: reacts with Good/Bad to score change requests.

## 4. Key Entities (Supabase)

### categories

- id
- name
- description
- created_at

### ranking_items

- id
- category_id (FK -> categories.id)
- name
- description
- current_score
- is_active
- created_at
- updated_at

### threads

- id
- ranking_item_id (FK -> ranking_items.id)
- title
- created_at

### score_change_requests

- id
- thread_id (FK -> threads.id)
- requested_delta (integer, e.g. +7 or -5)
- reason_text
- status (`pending` / `approved` / `rejected` / `applied`)
- voting_deadline_at (end of day in JST)
- created_by
- created_at

### comments

- id
- request_id (FK -> score_change_requests.id)
- parent_comment_id (nullable, self FK for reply chains)
- body
- created_by
- created_at

### reactions

- id
- request_id (FK -> score_change_requests.id)
- user_id
- reaction_type (`good` / `bad`)
- created_at
- unique(request_id, user_id)

### daily_score_logs

- id
- ranking_item_id
- request_id
- score_before
- applied_delta
- score_after
- applied_at

## 5. Daily Score Update Rules

Resolution timing: once per day (JST), e.g. 23:59 batch job.

For each `pending` score change request whose deadline has passed:

1. Count reactions.
2. If `good > bad`, approve and apply `requested_delta`.
3. Else, reject and do not change score.
4. Save result in `daily_score_logs`.
5. Update request status to `applied` (or `rejected`).

## 6. Example

Item: Tohoku University (Science/Engineering)

- Request: `+7`
- Reason: "It ranks #1 in Times Higher Education Japan and should not be below Osaka University."
- Reply: "That is too much. Entrance exam difficulty is clearly different."
- Reactions: Good 27 / Bad 12
- Result at end of day: apply `+7`

## 7. Ranking Display Requirements

- Category pages show item rankings sorted by `current_score DESC`.
- Item detail page shows:
  - current score
  - score history
  - thread (requests + comments)
- Request cards show:
  - requested delta
  - reason
  - good count / bad count
  - deadline
  - current status

## 8. Tech Stack

- Frontend/App: Next.js (App Router)
- Runtime adapter: OpenNext
- Database/Auth: Supabase
- Deployment target: Cloudflare Workers

## 9. MVP Scope

- Admin seeds categories, items, initial scores.
- Users can create score change requests and comment threads.
- Users can cast one Good/Bad reaction per request.
- Daily batch job resolves requests and updates scores.
- Public ranking pages show latest scores.

## 10. Future Considerations

- Abuse prevention (rate limits, moderation, report flow)
- User reputation weighting for reactions
- Duplicate or conflicting requests for same item/day handling
- Audit UI for applied/rejected requests
- Topic-specific rule tuning (different categories may need different resolution rules)

