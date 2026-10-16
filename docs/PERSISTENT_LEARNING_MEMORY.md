# PERSISTENT_LEARNING_MEMORY.md

**Status:** Design and initial state reducer only. No hosted database, sync scheduler, or automatic Supermemory writes deployed.

## Why two stores, not LLM context alone?

1. **Postgres (source of truth):** per-user platform identities, exact submission IDs, solved problems, source hashes, attempts, provenance, review records, roadmap revisions, recommendation status and sync cursors. Unique constraints make reprocessing events safe.
2. **Supermemory (semantic companion):** compact user-approved durable coaching preferences, recurring reasoning mistakes, concepts mastered, and a weekly summary of the learning state. Memory retrieval supplies context to a coach, but never authoritative statistics. Existing `leetcode` space is used for initial personal coaching context, separate from unrelated work.
3. **Cache (optional):** recently fetched provider responses with TTL; never substitute cache freshness for verified upstream state.

## Minimal persisted schema

```sql
CREATE TABLE learning_event (
  user_id UUID NOT NULL,
  event_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  problem_key TEXT NOT NULL,
  event_kind TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  evidence JSONB NOT NULL,
  PRIMARY KEY (user_id, event_id)
);
CREATE TABLE source_version (
  user_id UUID NOT NULL,
  problem_key TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  git_ref TEXT,
  consented_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, problem_key, content_sha256)
);
CREATE TABLE recommendation (
  user_id UUID NOT NULL,
  recommendation_id UUID NOT NULL,
  problem_key TEXT NOT NULL,
  roadmap_revision_id UUID NOT NULL,
  why JSONB NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('suggested','started','completed','skipped','superseded')),
  generated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, recommendation_id)
);
CREATE TABLE review (
  user_id UUID NOT NULL,
  review_id UUID NOT NULL,
  problem_key TEXT NOT NULL,
  source_sha256 TEXT,
  approach TEXT,
  evidence JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, review_id)
);
CREATE TABLE sync_checkpoint (
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  cursor TEXT,
  last_success_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  PRIMARY KEY (user_id, provider)
);
```

Apply database row-level isolation by authenticated principal; do not allow the LLM to specify arbitrary `user_id`. Add retention, export and delete controls.

## Incremental event and recommendation lifecycle

1. Scheduler (consented) or user presses Refresh; read last provider cursor/checkpoint.
2. Fetch bounded public submissions from LeetCode and Codeforces, and authorized GitHub solutions.
3. Normalize provider IDs; transactionally upsert `learning_event` using unique IDs. For mutable GitHub solution content, hash versions.
4. Compute changes since the previous materialized learning state (newly accepted, changed verdict where observable, new source version).
5. Update solved/attempted state deterministically. Accepted is not evidence of knowing the approach; source review requires actual code evidence.
6. Re-score relevant topics; update recommendations only when meaningful new evidence arrives or revision due date is reached. Preserve prior recommendations and decisions.
7. Periodically summarize stable insights to Supermemory via a **server-side authorized connector**, if enabled. Version summary, namespace and timestamps. Never store credentials or raw source by default.
8. Client reads current snapshot immediately: no full-profile re-analysis by the LLM required.
9. When AI is invoked, retrieve only relevant evidence, current plan and semantic memory; cite data provenance and uncertainty.

## Algorithm for next actions

- Track topics as `observed_attempts`, `accepted_count`, `recent_failures`, `review_flags`, `last_practice_at`, `confidence`.
- A weighted score prioritizes due reviews, prerequisite gaps, user goals and solvable next difficulty, with diversity and solved-question exclusion.
- Do **not** infer review correctness, reasoning quality or time spent from an accepted verdict.
- Keep 3–5 recommended problems per practice session and a one-week active queue. Reuse prior plans unless new evidence warrants change.
- Provide reason for inclusion, source links, expected pattern, and revisit criteria.
- Allow the user to mark a recommendation attempted/skipped/too-easy, and reweight future recommendations.

## Operational principles

- Polling rather than 'instant': initial target once every few hours with configurable rate limits, plus on-demand refresh.
- Scheduled workflows run in the hosted backend, **not in ChatGPT or Supermemory by themselves**.
- Degraded providers should not destroy the last known valid state. Show last sync time and source errors.
- Model Supermemory as optional; the application must work even if it is disconnected or its API is unavailable.
- If a Supermemory connector is not accessible to the deployed server, add explicit user connection and consent rather than copying a personal ChatGPT connector token.

## Acceptance tests

- Duplicate submission ingestion is idempotent.
- Same problem on multiple providers is never accidentally conflated.
- Recommendation status and superseded revisions survive re-sync and restart.
- An upstream outage keeps the last valid plan, flags freshness and backs off.
- Per-user state never leaks to a second account, including through memory search.
- Solution approach claims always cite code evidence, not verdict metadata.
- Memory summarization excludes passwords, tokens and raw source code.
- After one new relevant submission, the system re-evaluates affected topics and recommendations without reprocessing an entire history.
