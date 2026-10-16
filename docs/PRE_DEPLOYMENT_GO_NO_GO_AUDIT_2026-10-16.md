# Coding Intuition MCP — Pre-deployment Feasibility and Security Audit
**Date:** 2026-10-16  
**Decision:** **NO-GO for production / Plus+Go cross-account promise. GO for private GitHub development and testing only.**  
**Evaluated branch:** `feature/secure-chatgpt-mcp`, baseline commit `b4e6907392e4894744933a12a56f43d760f299cc`.  
**Scope:** Platform permissions, hosting, storage, identity, synchronization, security, functionality, cost, performance evidence.  
**Change policy:** This audit adds **documentation only**, without changing application code, deploying resources, exposing ports, provisioning accounts, accepting billing mandates, or merging the draft PR.

## 1. Executive decision and the central blocking assumption

The product goal is coherent: one durable, permissioned learning record used for LeetCode/Codeforces activity, GitHub solutions, intuition-first feedback, Supermemory summaries and progress-aware recommendations from multiple LLM interfaces.

It is **not** currently a proven working service for ChatGPT Plus + Go. In particular:
- ChatGPT **Plus can create ChatGPT Sites**, which can host MCP tools through a plugin; ChatGPT **Go cannot create/host Sites**. A plugin's general visibility on Go **does not prove** this particular Plus-created Site plugin can be installed and invoked from an independent Go account. An individual-to-individual plugin-sharing path has not been validated.
- **Direct custom external MCP connection** on ChatGPT is documented principally for Business/Enterprise/Edu workspaces (with narrower Pro read/fetch access); it is not a dependable Plus/Go escape hatch.
- A ChatGPT Site is **not a drop-in host for this repository's Node.js Express + node-postgres + mounted /data process**. Sites documents D1 (10 GB) and R2 storage and no raw TCP; its runtime excludes some background services and frameworks. No Site deployment artifact was generated or tested.
- **Claude remote MCP is documented on Free/Pro/Max** (Free: one custom connector), but that needs an actual live reachable and compatible server, which does not yet exist.
- **GitHub Actions/Pages/Codespaces do not constitute a permanent production MCP backend**; Codespaces is appropriate for bounded private development.

**Release decision:** Do not deploy, provision billed cloud resources, promise cross-plan compatibility or transfer the source of truth to Supermemory. Build nothing further until the Plus/Go access route and cross-LLM hosting architecture are settled.

## 2. Independent evidence summary

### Current proven test evidence

- Latest reviewed GitHub Actions run: [MCP and learning core checks, run 38913338423](https://github.com/suvitkankariya2007-debug/alfa-leetcode-api/actions/runs/38913338423): **success**, 33 test files / **291 passing tests**, local HTTP MCP initialization/tool-list smoke test passed; absent secrets fail closed.
- [Container check, run 38910549370](https://github.com/suvitkankariya2007-debug/alfa-leetcode-api/actions/runs/38910549370): success; image builds, declared non-root user, refuses unconfigured startup. Not a deployed image.
- [Draft PR #1](https://github.com/suvitkankariya2007-debug/alfa-leetcode-api/pull/1) remains open, **draft**, and unmerged; `main` not changed.
- Tests do **not** establish real PostgreSQL RLS, OAuth login, account linking, real Supermemory authorization, public platform API uptime, remote ChatGPT/Claude client onboarding, production restart persistence, data deletion, prompt-injection resilience under attack, or latency under load.
- `scripts/build-mcp.mjs` explicitly uses **TypeScript per-file transpilation only**, rather than type-checking the whole MCP TypeScript program. Original REST build retains typechecking. This is a static-safety gap.

### Official platform references (reviewed 2026-10-16)

1. [ChatGPT Sites availability, storage, limits](https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites): Plus/Pro supported; Free/Go unavailable; D1/R2 storage supported; runtime and publishing limitations.
2. [Hosting an MCP plugin with ChatGPT Sites](https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites): owner publishes Site, plugin is installed/connected separately, Site and plugin permissions both apply.
3. [Plugins in ChatGPT](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt): plugins can include Sites-backed MCP apps; the directory is cross-plan but capabilities are plan and permission dependent; workspace plugin sharing documented for Business/Enterprise.
4. [Connecting custom MCP servers in ChatGPT](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt): explicit workspace eligibility and OAuth considerations.
5. [ChatGPT Sites technical runtime](https://learn.chatgpt.com/docs/sites): D1/R2, HTTP/HTTPS/WebSockets, **no raw TCP**, some unsupported frameworks/background services.
6. [Claude remote MCP custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp): Free, Pro, Max, Team, Enterprise; Free limited to one custom connector.
7. [GitHub Codespaces billing](https://docs.github.com/en/billing/concepts/product-billing/github-codespaces): personal GitHub Free includes 120 core-hours/month and 15 GB-month storage, subject to quota/billing behavior.
8. [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions): standard public repository runners generally free; private repository and storage allowances apply.
9. [Cloudflare Workers/D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/): free D1 storage/requests quotas; exceeding limits can block service.
10. [MCP authorization guidance](https://apps.extensions.modelcontextprotocol.io/api/documents/authorization.html): protected-resource metadata, bearer scope and audience checks.

## 3. Platform and hosting feasibility matrix

| Route | Development | Durable remote MCP | ChatGPT Plus | ChatGPT Go | Claude / other MCP clients | Verdict |
|---|---|---|---|---|---|---|
| GitHub Actions + GitHub Pages | Yes, builds + static docs | **No**, jobs temporary; Pages static | N/A | N/A | N/A | CI only |
| GitHub Codespaces | Yes, time-limited, private port | **No**, stops; private GitHub-authenticated forwarding | Not a general ChatGPT remote connector | Not a general ChatGPT remote connector | Local clients possible, depending on transport | Best immediate dev |
| ChatGPT Sites hosted MCP plugin | Requires Plus/Pro Site creation | Potentially within supported Sites runtime after redesign | Documented Site/plugin creation route | **Go cannot create Sites; receiving/using a Plus-created plugin in another personal Go account unverified** | External generic MCP endpoint support not established | Experiment only, not universal backend |
| Cloudflare Workers + D1 | Candidate requiring redesign | Potentially yes, within free quotas and Workers runtime | **Direct external custom MCP connection not established for Plus** | **Direct external custom MCP connection not established for Go** | Claude remote MCP is documented; test required | Best low-cost *candidate*, not approved |
| Google Compute Engine VM + Postgres + mounted disk | Technically plausible | Yes after OAuth/TLS/backup/config | Product permission still blocks direct connection | Product permission still blocks direct connection | Generic MCP clients may work | Not needed for now; billing approval declined |
| Existing Railway staging | Staged config only, no live service | Would require compute + DB + volume/OAuth | Same ChatGPT eligibility issue | Same Go eligibility issue | Would require client tests | Not cost/fit justified |

**Important:** No hosting provider can override a ChatGPT plan's product entitlement. A portable HTTPS MCP is useful to external clients but does not itself create an eligible Plus/Go custom connection.

## 4. Code and data audit (verified by inspecting branch files)

| ID | Priority | Finding / evidence | Consequence | Required pre-release resolution |
|---|---|---|---|---|
| P0-01 | Blocker | Cross-personal Plus/Go Site-backed plugin installation/invocation unverified; Go cannot create Sites | Central cross-account goal may be impossible through chosen surface | Obtain official documented cross-account path **and** two-account live tool invocation, or explicitly mark Go-native tool integration unsupported |
| P0-02 | Blocker | No deployed HTTPS server and no authorized OAuth issuer/client registration | No current ChatGPT/Claude live MCP connection | Prove HTTPS MCP initialization, metadata, OAuth login/refresh and tool invocation from actual clients |
| P0-03 | Blocker | `hostedServer.ts` requires restricted Postgres, `/data` mount, external issuer, Supermemory key; Sites offers D1/R2 rather than arbitrary TCP and mounted Linux process | Current production binary does not run unchanged in Sites/Workers | Choose **one** target runtime and storage/auth contract before development |
| P0-04 | Blocker | Fixed `OAUTH_OWNER_SUBJECT` in `JwksOwnerVerifier` and `PgLearningStore`; no explicit linking of separate ChatGPT/Claude users to one internal owner | Progress may fragment across accounts or another user's data may be misbound if shortcuts are used | Server-side account linking with verified ownership, least privileges, revocation and explicit conflict handling |
| P0-05 | Blocker | Database stores learning snapshot/events, but reviews, intuition reflections, Supermemory outbox are JSON journals in `/data` | Mixed persistence, backups and write ordering; not suitable for serverless/multiple replicas | Move all mutable records to one transactional store, test concurrent writes, migrations, restart, restore and deletion |
| P0-06 | Blocker | OAuth provider isn't implemented: server is only a JWT-protected resource. Refresh issuance/consent and client compatibility untested | ChatGPT/Claude login may fail or expire | Verify provider, authorization code + PKCE, scopes, protected-resource metadata and refresh token renewal with both clients |
| P1-01 | High | `scripts/build-mcp.mjs`: syntax transpilation, not MCP-wide TypeScript semantic checking | Type errors may bypass CI | Restore realistic MCP typecheck or justify and compensate with contract tests |
| P1-02 | High | GitHub/LeetCode/Codeforces public content enters LLM as untrusted text; labeling and filtering exist but no demonstrated adversarial end-to-end prompt-injection evaluation | Tool-output injection can bias recommendations, tool choice or attempts to write data | Threat-model source-to-LLM and memory-to-LLM paths; malicious fixture tests, consent checks, tool read/write separation |
| P1-03 | High | `syncService.ts`: maximum 50 recent submissions **per provider**; LeetCode public list lacks stable IDs | Missing past history and duplicate collisions; inferred weaknesses unreliable | Initial backfill where permitted, gap detection, provider-coverage indicators and explicit unknown classification |
| P1-04 | High | `roadmap.ts` contains only **16 curated candidates**, not the requested broad conceptual practice system | Recommendations saturate, exclude known skipped tasks, and may lack user-specific pattern diversity | Curate a reviewed extensible 60–90-problem diagnostic/training corpus with provenance and coverage tests |
| P1-05 | High | `hostedServer.ts` starts timed sync every 120 min *only while process is running*; single-process cooldown | Missed updates when sleeping, unreliable multi-instance concurrency | External/scheduled jobs or scheduled triggers, idempotent worker, sync watermark/backoff |
| P1-06 | High | Real `SupermemoryV5Client` integration uses secret and HTTP; tests use mocked requests; live key/namespace scope not validated | Stored memory may never reach backend; ChatGPT-connected Supermemory app is not a server-side API key | Validate authorized namespace live with harmless test record and retrieval, explicit user consent and outbox-retry semantics |
| P1-07 | High | Real Postgres RLS migration not validated using a live non-superuser pool with two different principals | Isolation currently verified primarily by mock DB tests | Run PostgreSQL-backed cross-principal read/write/denial tests and role privilege tests |
| P1-08 | High | Scope-based write tools (`record_my_intuition_checkpoint`, recommendation tracking and review writes) require account/client capability; ChatGPT plan permission not verified | Personalization cannot persist from restricted clients | Create a usable read-only fallback + separate write path with explicit consent, and verify availability |
| P1-09 | High | Single-process `express-rate-limit` with `trust proxy=false` behind ingress can collapse clients to one IP | Unfair shared rate limiting/false throttling, and no distributed limiter | Validate trusted reverse-proxy chain and per-principal distributed quotas; test under load |
| P1-10 | High | No demonstrated deletion/export policy, backups, key rotation, retention or user recovery | Data-loss/privacy risks, especially sharing a Site across accounts | Implement and test export/delete, backup/restore, retention, audit log redaction and key rotation |
| P2-01 | Medium | Public GitHub solution files bounded to allowlisted repo/path/blob; cannot prove online judge submission identity | Approach reviews are hypotheses, not verified submissions | Keep provenance labels; optionally opt-in to verified submitted-code source where officially authorized |
| P2-02 | Medium | `intuitionCoach.ts` provides deterministic pattern prompts; no autonomous code reviewer or actual test execution | Cannot verify correctness, time complexity or thinking growth solely from verdicts | Measure learning outcomes using explicit learner check-ins, reviewed test cases and source-backed reasoning |
| P2-03 | Medium | No production p50/p95 latency, availability, quota-exhaustion or egress measurements | “Fast,” “always on,” and “free forever” would be unsupported claims | Run controlled synthetic and end-to-end load tests and collect cost/latency telemetry before launch |
| P2-04 | Medium | Existing fixed LeetCode/Codeforces/GitHub handle config does not independently prove platform account ownership | Risks claiming ownership and history completeness | Make provenance/ownership claims precise; use explicit linking if available |
| P2-05 | Medium | Existing code has **no TLE Eliminators/Striver training sheet integration** and no Codeforces rating-growth experiment | Missing desired curated CP pedagogy coverage | Decide whether these are in initial product scope and add explicit acceptance tests only after architecture decision |

### Controls that are present (but not enough by themselves)

Strong qualities visible in the source: RS256 JWT signature and issuer/audience/sub/scope verification; narrowly allowlisted tools; rejection on missing configuration; parameterized PostgreSQL SQL and RLS policy; HTTPS-only JWKS; bounded public solution file path/size; response limits; randomized IDs; server-side Supermemory API secret requirement; mock security/regression coverage; non-root container build.

These are **design and test findings**, not independent production penetration-test certification.

## 5. Identity and durability: the required invariant

A distinct ChatGPT Plus user, ChatGPT Go user and Claude user will generally have different platform-issued identity values. **Never equate a username, email similarity, cookie or public LeetCode handle with proven identity.**

To enable shared progress, the application must maintain an **internal learner ID** whose linking to each verified client account is explicit and consented to. Each connector must receive only a narrow, renewable credential for that learner; authorization must be enforced server-side on every request. Disconnecting one LLM should revoke only that connector, not delete learning data. An unrelated user must never see the learner's reviews or reflections.

The single source of truth must include attempts, recommendations, check-ins, reviews, sync cursors and memory-delivery events. Supermemory may hold permitted **summary copies** but should not be the only source of truth or silently override authoritative submission evidence.

## 6. Cost and operational assessment

- **Immediate development:** GitHub's public Actions runs and a quota-limited personal Codespace are suitable. No new Google Cloud/Railway subscription is necessary for the feasibility stage.
- **Plus-specific experiment:** ChatGPT Sites hosting is presently included with Plus, subject to usage/storage limits. Its D1/R2 architecture is different from this repository's current runtime and **Go access remains unresolved**.
- **Cross-LLM general server candidate:** Cloudflare Workers + D1 potentially offers a free HTTPS/storage combination, but **needs code rewrite, OAuth implementation, resource-budget tests, and does not solve ChatGPT Plus/Go entitlement limitations**.
- **Billing:** Do not authorize the INR 15,000 Google Cloud autopay mandate for this feasibility exercise. No resource should be created merely to test a product-plan entitlement.
- **GitHub Codespaces is not free unlimited compute:** Included quota depends on account plan; spending limits must be checked before extended use.

## 7. Measurable acceptance gates before a single public deployment

| Gate | Passing evidence required | Current state |
|---|---|---|
| G1 — Product eligibility | A **real Go account** successfully installs/connects and calls a read and a write tool from the chosen plugin route (or a written confirmed unsupported result plus fallback) | **Unverified / blocker** |
| G2 — Plus workflow | A **real Plus account** invokes profile + personalized recommendation tools, with successful consent-aware write | **Unverified** |
| G3 — Claude compatibility | HTTPS MCP initialize, list tools, read and optional approved write from Claude remote MCP, no auth bypass | **Unverified** |
| G4 — Identity linking | Independently verify all intended accounts map to one internal learner, while unrelated account is denied | **Not built** |
| G5 — Durable recovery | Persist recommendation + check-in + review + outbox, restart host, verify all records, test backup restoration | **Not tested live** |
| G6 — DB isolation | Real two-principal RLS denial with restricted runtime role | **Mock tests only** |
| G7 — Security | Wrong JWT issuer/audience/sub/scope, SSRF, prompt injection in GitHub solution/memory content, rate-limit/concurrency and tool write-consent tests | **Partially tested** |
| G8 — Data quality | Coverage counters, missed-history indicators, canonical problem IDs, curated corpus, recommendation explanations/duplicates | **Partial** |
| G9 — Supermemory | Authorized namespace write/read, expected retry behavior, no secret leaks, explicit consent | **Mocked; not live** |
| G10 — Performance/cost | Measured endpoint latency (p50/p95), memory footprint, API failures, cold start, daily request/storage quotas and operator-approved cost limits | **Not measured** |
| G11 — Static/build quality | Full MCP static checking (or reviewed typed contracts) and all CI suites green | **Partially met** |
| G12 — Compliance and lifecycle | User export/delete, key rotation, data retention, backup-restore, no surprise bill, rollback | **Not verified** |

**Required release threshold: G1–G7, G9–G12 passed, with G8's limitations disclosed.** Inability to meet G1 means release cannot claim the original Plus+Go native ChatGPT objective, even if a Plus-only or Claude product is successful.

## 8. Actionable recommendation (without writing code yet)

**Decision A — Client availability, first:** Verify actual Go access to a *Plus-created Site-hosted plugin* through supported installation/sharing permissions. A general plugin directory listing is not sufficient. If unsupported, be explicit that the requested two-account native ChatGPT product cannot be delivered on current plan terms; keep a web/dashboard or supported-client alternative instead of attempting an unsafe workaround.

**Decision B — Universal backend:** Separate durable user state from LLM-client access. For an inexpensive prototype, evaluate a serverless HTTPS + transactional DB architecture such as Workers/D1. Do not attempt to run the current Express/PG/`/data` image unchanged on Sites/Workers.

**Decision C — Minimum complete learning loop:** Prioritize one verified submission read, one evidence-backed problem explanation, one consented saved reflection/recommendation, reload from a different approved client, and survive restart. Only then extend problem catalog, multi-agent reviewer, and scheduling.

**Decision D — Security release signoff:** Mandatory independent review plus live negative tests; green unit tests are necessary but insufficient.

### What this audit did **not** claim
- It did **not** log into a second Plus or Go account or simulate plan entitlements.
- It did **not** obtain OAuth, Supermemory, payment, cloud or developer credentials.
- It did **not** create a Site, runtime server, database, cloud resource, CodeSpace or client connection.
- It did **not** run an independent commercial GPT/Notion reviewer agent. The connected Notion-agent facility was checked and requires additional Business entitlement; no paid upgrade was authorized.
- It did **not** claim penetration-test certification, complete upstream history or real production latency.
- This is an evidence-based **static/preflight audit**, not a finished system validation against live accounts.

**Next engineering task after eligibility resolution:** choose one supported shared backend and write a client-agnostic identity/persistence contract. Do not write deployment code until the access gate is resolved.
