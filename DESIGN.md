# DESIGN.md — Adaptive Coding Intelligence (LeetCode + Codeforces + GitHub)

**Status:** Architecture approved for incremental development only. **NOT DEPLOYED.**  
**Upstream:** alfaarghya/alfa-leetcode-api (preserve existing REST endpoints, STDIO MCP tools and tests)  
**Initial profile handles:** LeetCode `suvitk`; Codeforces `suvitkankariya2007`; GitHub `suvitkankariya2007-debug`  
**Last design review:** 2026-10-15

## 1. Product goal

A continuously useful coding coach, not merely a profile dashboard. In ChatGPT or an independent website, a learner can ask:
- Which problems did I solve this week? Did I use a good approach?
- Which algorithms and patterns am I avoiding? Show **evidence**.
- Review my latest solution and explain better options without replacing my reasoning process.
- Build a *small actionable* 7/30/90-day DSA + CP practice plan that adapts to new attempts and outcomes.
- Recommend 3–5 next problems from known providers, excluding solved items and respecting difficulty readiness.

## 2. Platform availability — do not overpromise

**ChatGPT Sites-hosted plugins:** Documentation says hosting an MCP plugin on a Site is available across plans, subject to Sites/plugin eligibility, permissions, publishing and supported surfaces. Test with separate Go and Plus accounts before marketing support.  
**Standalone custom remote MCP server registration:** Restricted by ChatGPT product / workspace capabilities. **An HTTPS URL alone does not make a custom MCP callable on Go or Plus.**  
**Fallback independent web app:** full learner dashboard and secure login available in normal browser, separate from ChatGPT subscriptions. The same service powers both channels.  
Do not confuse 'Sign in with ChatGPT' in participating apps with automatic custom MCP registration.  
Sources:
- https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites
- https://help.openai.com/en/articles/20001256-plugins-in-chatgpt
- https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt

## 3. Verified collection capabilities and limits

| Platform | Public data | Source code access | Truthfulness requirement |
|---|---|---|---|
| LeetCode | User profile, solved counts, skills, contest info, calendar, limited recent submissions via existing public GraphQL adapter | Public profile query does not guarantee accessible code for each submission; explicit authorized import or GitHub copy needed | Distinguish accepted metadata from actual code |
| Codeforces | Official `user.info`, `user.rating`, `user.status`, `problemset.problems` | Official API `includeSources` is only supported for the **requester's own account**. No impersonation or scraping behind login. | Treat verdict and problem tags as metadata, not the approach |
| GitHub | Authorized code repositories and history | Source available only under repository and connection permissions | Match files to problem IDs carefully; ask user to verify ambiguous matches |
| Manually supplied code | User-provided code snippets/files | Available explicitly | Record provenance, version and consent |

A solved problem is not proof of independent mastery; a solution's title is not evidence of complexity or chosen algorithm. No password harvesting, LeetCode session-cookie collection, or unsupported authentication bypass.

## 4. System architecture

```text
Browser / ChatGPT Sites-hosted plugin / other *supported* MCP client
                   | TLS + platform auth
           Identity + tenant authorization
                   | validated read-only tools
  +----------------+------------------------+
  | Public LeetCode adapter (existing)      |
  | Official Codeforces adapter (new)       |
  | Connected GitHub repository adapter     |
  | User-authorized solution upload/import  |
  +----------------+------------------------+
                   |
     Normalized event store + provenance
        (dedupe, snapshot, timestamp)
                   |
  +----------------+------------------------+
  | Pattern inference with evidence levels |
  | Source-aware complexity/approach review|
  | Spaced revision + next-problem ranking |
  | Adaptive roadmap (weekly recalculated) |
  +----------------+------------------------+
                   |
     MCP read-only tools + web dashboard
```

### Preserve upstream
- Do not modify upstream REST routes to implement the integration.
- Keep original STDIO MCP process working, and add a distinct Streamable HTTP entrypoint for hosted clients after auth design review.
- Use explicit `tsconfig.mcp.json` to fix/validate MCP build rather than changing the REST build unexpectedly.
- Regression-test existing 3 MCP tool modules and REST route contracts.

## 5. Schema (initial)

```text
User(id, auth_subject, created_at, consent_version)
Connection(user_id, provider, handle, verification_level, synced_at, status)
Problem(provider, external_id, url, title, difficulty, tags)
Submission(id, user_id, provider, provider_submission_id, problem_id, verdict,
           language, timestamp, source_kind, code_version_id nullable, evidence_ref)
SolutionVersion(id, user_id, problem_id, source_kind, git_commit_or_upload_id,
                code_hash, user_consent, created_at)
SolutionReview(version_id, approach, complexity_time, complexity_space,
               correctness_risks, opportunities, confidence, evidence_refs)
LearningSignal(user_id, problem_id, tag, signal_type, weight, recorded_at)
RoadmapRevision(user_id, generated_at, horizon, goals, selected_problem_ids,
                reasoning, evidence_refs, supersedes_revision_id)
SyncRun(provider, user_id, started_at, completed_at, status, error, cursor)
```
Relational store: Postgres in production. Keep code encrypted at rest (or store only hashes, selected excerpts with consent) and isolate by authenticated user ID. User-controlled deletion and data export.

## 6. Solution-level approach analysis

1. Resolve accepted problem ID from public submission metadata; do not equate an accepted verdict with optimized code.
2. Attach *verifiable code*: link solution file/commit, explicit uploaded code, or provider-authorized export. Never claim private LeetCode code was retrieved from a public endpoint.
3. Parse language + function signatures; optional AST/static analysis; run no arbitrary user code on main MCP host.
4. AI reviewer identifies algorithm pattern, data structures, time/space complexity, correctness risks, edge cases and alternative strategies. Uncertainty is explicit.
5. Review stores evidence (file + commit + line range or upload checksum), flags **possible** issues pending validation, and requests tests when needed.
6. If execution is necessary, isolate in a hardened sandbox (no network, strict CPU/memory/time/filesystem limits), not in the MCP host.
7. Coach encourages user-generated explanations and hints before revealing full solutions.

## 7. Learning engine

**Signals**: accepted/failed submissions, retry count, elapsed time if *actually tracked*, contest rating trajectory, problem tags, code review issues, manual confidence, revision performance. Do not fabricate speed, attempts or hidden tests.
**Pattern mastery**: confidence-weighted state using evidence quality and recency; expose why every pattern was scored and what remains unknown.
**Roadmap generator**: 7-day execution queue, 30-day improvement themes, optional 90-day map. Prioritize prerequisites, weak but learnable patterns, spaced repetition and target goals. Recommend 3–5 fresh problems per session; deduplicate and exclude solved ones based on accessible history.
**Diagnostic**: short weekly assessment based on observed outcomes, with option to correct misclassified approaches.
**Change triggers**: after explicit `sync_now`, after new authorized code import, and on scheduled background refresh where configured. 'Real time' means fresh-on-request or delayed polling; no claim of instantaneous event stream from LeetCode.
**Polling**: configurable 1–6-hour intervals initially, respecting source limits and backoff. Store last sync time and freshness state; do not send autonomous notifications without explicit opt-in and a supported notification service.

## 8. MCP tool contract (proposed)

| Tool | Read/write | Output |
|---|---|---|
| `get_connected_profiles` | read | handles, scopes, freshness |
| `sync_now` | narrowly authorized state change | status, counts, errors (requires authenticated user and throttle) |
| `get_solved_problems` | read | IDs, timestamps, platform, source |
| `get_recent_submissions` | read | bounded verdict + metadata |
| `get_solution_review` | read | evidence-backed strategy and complexity |
| `get_weak_patterns` | read | signals, uncertainty, explanations |
| `get_adaptive_roadmap` | read | personalized session plan and evidence |
| `get_recommended_problems` | read | 3–5 unsolved, difficulty calibrated |
| `get_sync_health` | read | last sync and ingestion failures |

Hosted MCP must not expose arbitrary username queries for authenticated profile-specific tools. External problem statements and submission text must be treated as untrusted inputs, never instructions for the AI agent.

## 9. Authentication & security

- Prefer platform identity / standard OAuth/OIDC, PKCE where relevant. Verify issuer, audience, signature, expiry, scopes; secure refresh-token lifecycle.
- Separate user's *app login* from LeetCode account linking. Public username linking is **unverified ownership**. Source-code import requires explicit authorization.
- Per-user row-level isolation, read-only by default, explicit approval for imports/deletions.
- Enforce input schemas; restrict URLs and allowed hostnames; use fixed outbound adapters; SSRF protection; cursor and response size limits.
- Store secrets server-side; rotate; never log tokens or solution bodies.
- Apply abuse controls, origin checks, request timeouts and upstream caching/backoff.
- Prompt injection: label user/provider/code content as untrusted, prohibit tool-output instructions from modifying system directives or invoking tools; test malicious comments, README, discussion entries.
- Provenance: provider, endpoint, handle, collection timestamp, evidence type, permissions, source commit/hash, confidence and freshness on each insight.
- Data minimization, consent ledger, retention controls, disconnect/export/delete flows.
- Threat model: unauthorized profile access, account enumeration, token replay, IDOR, cross-tenant leaks, poisoned recommendations, malicious code execution, rate-limit DoS.

## 10. Feature scope and releases

**R0 — baseline & safety:** Snapshot REST + STDIO behavior; build CI; source adapter tests; security checks.  
**R1 — usable prototype:** Public LeetCode and Codeforces profile tools, verified provenance, browser status dashboard, explicit refresh and rate limits.  
**R2 — code-aware:** Authenticated GitHub solution matching, opt-in imports, review evidence and complexity feedback.  
**R3 — learning coach:** mastery diagnostics, feedback-based roadmap, next-question ranking and revision loop.  
**R4 — hosted channel:** authenticated Streamable HTTP, ChatGPT Sites plugin and Go/Plus smoke tests, independent web fallback.  
**R5 — monitored operation:** opt-in sync scheduler, failure alerts, performance/privacy assessment.

## 11. Acceptance tests
- All existing REST routes and STDIO tools still work.
- Codeforces invalid handles and unavailable/rate-limited upstream return structured errors without secrets.
- Every solved/attempted claim cites a provider submission or import; every approach claim cites code.
- No cross-user data or source code is accessible via another authenticated session.
- Injection attempts embedded in upstream JSON/README/code do not affect tools or privileges.
- Personalized roadmap updates only from real new evidence and records revision IDs.
- Explicit tests for Go and Plus plugin access on supported ChatGPT Web surfaces; independent web dashboard works irrespective of plan.
- No public deployment until hosting and security gates are reviewed and explicitly authorized.

## 12. Open decisions before deployment
- ChatGPT Sites app as main distribution vs standalone hosted application with provider-specific plugin.
- User model: one account now, multi-tenant later?
- Code storage: metadata + GitHub links or encrypted snapshots?
- Sync interval and retention policy.
- Service budget and data residency.

## 13. Persistent learning memory and cost-efficient analysis

See [docs/PERSISTENT_LEARNING_MEMORY.md](docs/PERSISTENT_LEARNING_MEMORY.md).

The hosted system must maintain an incremental operational database, not rely on a conversational LLM to reconstruct all submissions each time. Changes are applied as idempotent provider-scoped events and recommendations retain their disposition and prior revision history. A deterministic state reducer in `src/learning/learningState.ts` is the first implementation slice; database persistence, sync cursors, scheduling, adaptive scoring and secured Supermemory API synchronization are **not yet implemented**.

Supermemory is an optional semantic companion for persistent tutoring preferences, recurring reasoning gaps and approved weekly insights. Existing `leetcode` space is the initial target and remains logically separate from unrelated projects. Never store passwords, OAuth tokens or unapproved raw source code in Supermemory. If unavailable, fall back to the authoritative database without losing progress.

Each new submission should trigger only an affected-topic update, not complete profile re-analysis. Track retrieval time and truthfulness: public solved counts are not evidence of a specific source-code approach. Recommend only problems that are unobserved as solved in available history, with disclosure when history is incomplete.
