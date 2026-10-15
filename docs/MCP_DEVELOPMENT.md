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
| record_practice_feedback | Change an existing recommendation to started/completed/skipped |
| get_my_solution_evidence | Fetch a public GitHub source file from a single allowlisted repository |

All returned platform and code text is treated as untrusted data; no source content should execute instructions.

## Limitations and security gates

- Recent submission data is *not* a full historical backfill. LeetCode recent lists lack stable submission IDs, so same-second exact duplicates can collapse.
- Public LeetCode topic summaries exist, but per-question mastery requires more evidence.
- The initial question catalog is limited; not-observed-solved is NOT proof a question is unsolved.
- Source review is currently via a compatible LLM's reasoning on fetched evidence; no autonomous LLM reviewer or persisted review conclusions yet.
- This build does not contain a scheduler, production Postgres, Supermemory API synchronization, or multiuser account isolation.
- The static bearer token is development authentication ONLY. Public Go/Plus plugin access needs a supported ChatGPT Sites flow and identity verification, not just a URL.
- Hosting must be HTTPS with audited authentication, tenant-scoped storage, rate limits, secrets, consent controls, backups, security testing and verified plan compatibility before release.

No deployment has occurred. See DESIGN.md and docs/PERSISTENT_LEARNING_MEMORY.md.
