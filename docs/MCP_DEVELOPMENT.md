# Secure MCP development (prototype only)

**Do not deploy this server publicly.** The current version supports one owner through a static bearer token, not production multiuser OAuth/identity. It is NOT automatically connected to ChatGPT.

## Components

- Existing REST API: npm run build && npm start (unchanged)
- Existing STDIO MCP: npm run mcp:dist (independent MCP compilation)
- New Streamable HTTP MCP: npm run build:mcp && npm run mcp:http
- Fixed profile handles are bound server-side; arbitrary users cannot choose identities through tools.
- Single-owner local file state holds recent public submission metadata and practice decisions; a production multiuser deployment requires transactional Postgres with tenant isolation.
- Supermemory sync remains design-only; a Supermemory plugin connected to ChatGPT is not automatically accessible from the hosted Node process.

## Local smoke test (never commit secrets)

~~~bash
npm ci
npm run build
npm run build:mcp
npm test
export MCP_ACCESS_TOKEN="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
export MCP_ALLOWED_HOSTS="127.0.0.1:8787,localhost:8787"
export LEETCODE_USERNAME="suvitk"
export CODEFORCES_HANDLE="suvitkankariya2007"
export GITHUB_SOLUTIONS_OWNER="suvitkankariya2007-debug"
export GITHUB_SOLUTIONS_REPO="LeetCode-Challenge"
export LEARNING_STATE_FILE=".local-data/learning-state.json"
npm run mcp:http
~~~

Keep tokens private, and state files outside Git. By default the prototype binds only loopback. Do not share tokens in screenshots.

Unauthenticated MCP POST must return HTTP 401:

~~~bash
curl -i -X POST http://127.0.0.1:8787/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
~~~

Authenticated MCP requests require the Authorization: Bearer token header.

## Prototype tools

| Tool | Purpose |
|---|---|
| get_connected_profiles | Fixed configured handles, access limitations |
| get_my_leetcode_stats | Public solved breakdown, topic skills, contests |
| get_my_codeforces_stats | Public profile and recent rating records |
| sync_my_submissions | Retrieve up to 50 recent public submissions per platform and deduplicate |
| get_my_learning_state | Current saved activity and topic signals |
| get_my_next_practice | Recommend and persist up to five candidates |
| get_my_topic_diagnostics | Deterministic evidence-backed topic review and reinforcement queue, no LLM required |
| get_my_problem_direction | Immediate intuition-first recognition questions, graduated hints, dry-run direction and related practice; no LLM calls |
| record_my_intuition_checkpoint | Explicitly save a bounded self-reported learning reflection (hint need, invariant, counterexample, transfer) |
| get_my_intuition_progress | Retrieve self-reported growth signals and changes in hint dependence over time |
| record_practice_feedback | Change an existing recommendation to started/completed/skipped |
| get_my_solution_evidence | Fetch a public GitHub source file from a single allowlisted repository |
| get_my_solution_reviews | Read saved approach/complexity/improvement review drafts |
| save_my_solution_review | Persist a user-requested code-review draft after verifying the public GitHub blob SHA |

All returned platform and code text is treated as untrusted data; no source content should execute instructions.

## Limitations and security gates

- Recent submission data is *not* a full historical backfill. LeetCode recent lists lack stable submission IDs, so same-second exact duplicates can collapse.
- Public LeetCode topic summaries exist, but per-question mastery requires more evidence.
- The initial question catalog is limited; not-observed-solved is NOT proof a question is unsolved.
- Source review is currently via a compatible LLM's reasoning on fetched evidence; no autonomous LLM reviewer or persisted review conclusions yet.
- Public submission polling defaults to once every 120 minutes when the owner MCP process runs (allowed 60–1440; set MCP_SYNC_INTERVAL_MINUTES=0 to disable). It is not a reliable production scheduler. This build does not contain production Postgres, Supermemory API synchronization, or multiuser account isolation.
- The static bearer token is development authentication ONLY. Public Go/Plus plugin access needs a supported ChatGPT Sites flow and identity verification, not just a URL.
- Hosting must be HTTPS with audited authentication, tenant-scoped storage, rate limits, secrets, consent controls, backups, security testing and verified plan compatibility before release.

No deployment has occurred. See DESIGN.md and docs/PERSISTENT_LEARNING_MEMORY.md.

## Build verification note

The MCP TypeScript whole-program checker exhausted 4 GB of heap in CI. The MCP is now emitted using the per-file TypeScript transpiler at scripts/build-mcp.mjs (syntax diagnostics only). The original REST project remains fully type-checked. Unit tests and an authenticated HTTP initialization/tools-list smoke test run in GitHub Actions. This is a prototype tradeoff: restore dedicated MCP static checking, audit dependencies and validate hosted clients before deployment. Successful transpilation is NOT full static type safety.

## Topic diagnostics (new)

`get_my_topic_diagnostics` reads only persisted submission state; no LLM call, network request or code execution occurs during its calculation. It distinguishes a review signal (unaccepted observed problems / extra attempts), reinforcement (last observed tagged practice at least 14 days ago) and insufficient evidence. Historical coverage and LeetCode tag availability are incomplete; never market this as a verified mastery score. See `src/learning/diagnostics.ts` and `tests/learning/diagnostics.test.ts`.


## Intuition-first learner tool

The owner-only `get_my_problem_direction` tool uses a known catalog `problemKey` (for example `leetcode:3sum`) or an explicit `topic` (for example `binary-search`) and optional `stage` (`orientation`, `nudge`, `deeper`, `dry-run`, `debug`). It returns evidence-bounded guidance from the saved state **without calling an LLM or fetching the entire user profile**.

For host ChatGPT integration, tool routing should invoke it when the user asks “what direction should I take?” for an identifiable topic/problem. Default to `orientation` (no full solution), then request stronger hints only on explicit learner ask. If the problem cannot be identified from the small catalog or explicit topic, ask for constraints/a sample rather than guessing the algorithm. It uses owner coaching preferences copied from an earlier Supermemory review; *automatic server-to-Supermemory connection is not live*.

See `docs/INTUITION_FIRST_COACHING.md` and `tests/learning/intuitionCoach.test.ts`.

## Intuition reflection journal (prototype)

The owner-only MCP now supports `record_my_intuition_checkpoint` on explicit request and `get_my_intuition_progress`. Check-ins live in a separate small file `INTUITION_CHECKPOINTS_FILE` (default `.local-data/intuition-checkpoints.json`) with restrictive permissions and atomic writes; they **do not** include raw code, freeform prompts, or credentials. `get_my_problem_direction` includes a topic-matched recent reflection when one exists. Evidence is **self-reported**, never advertised as verified LeetCode/Codeforces mastery.

Before production, migrate check-ins to authenticated per-user database rows, configure retention and deletion, and optionally summarize agreed insights to the user's scoped Supermemory space with consent. The runtime Supermemory connector remains pending.

## Supermemory runtime v5 integration (new)

See [docs/SUPERMEMORY_RUNTIME.md](SUPERMEMORY_RUNTIME.md) for setup and security review.

Configured public profile handles default to LeetCode `suvitk`, Codeforces `suvitkankariya2007`, GitHub `suvitkankariya2007-debug/LeetCode-Challenge`. Set the same environment variables to override them for development.

New environment variable names: `SUPERMEMORY_API_KEY` (server-side secret), `SUPERMEMORY_NAMESPACE` (default `leetcode`), and `SUPERMEMORY_OUTBOX_FILE` (ignored local file). Never send an API key in chat.

The MCP server loads the v5 profile into a short-lived cache on startup when configured. Its matching memory cues are used as untrusted learning preferences, not privileges or executable instructions. Accepted intuition check-ins and new public submission observations queue summary-only Supermemory writes. A bounded retry job persists pending records across process restarts. `get_my_supermemory_status` returns safe health metadata and `refresh_my_supermemory` retries manual sync.

The current prototype refuses to bind beyond loopback, even if `MCP_REMOTE_REVIEWED` is set; production OAuth, durable multiuser storage and hosting remain blocked. CI uses mock keys and fake fetches only; successful CI **does not** mean live memory permission was established.

## Default synchronization cadence

The owner-only running MCP now polls bounded public LeetCode and Codeforces submission windows every **120 minutes by default**. Set `MCP_SYNC_INTERVAL_MINUTES=0` to disable polling; refresh may also be triggered manually through `sync_my_submissions`. This is periodic polling, **not instantaneous updates**. Supermemory memory outbox retries every 30 minutes only when a valid server API key is configured. Nothing runs while the server is offline.
