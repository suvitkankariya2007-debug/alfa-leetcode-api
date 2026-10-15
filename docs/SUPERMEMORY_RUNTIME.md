# Supermemory v5 Runtime Synchronization — Single-owner prototype

**Status (2026-10-15):** Server-side read/write integration, durable retry queue, authenticated MCP health tools and mocked CI tests are implemented. **Real API-key authentication and hosted runtime delivery have NOT been verified.** Do not claim it is live or deploy it publicly until approval and verification.

## Connected public profile handles (owner-bound defaults)

- LeetCode: `suvitk`
- Codeforces: `suvitkankariya2007`
- GitHub solution owner: `suvitkankariya2007-debug`
- GitHub repository: `LeetCode-Challenge`, branch `main`
- Supermemory space/namespace: `leetcode`

These are intentionally single-owner defaults and **not verified account ownership**. Public LeetCode/Codeforces statistics require no passwords. For multi-user production, replace with authenticated per-user profile bindings.

## Transport and API

Official Supermemory **API v5** namespace endpoints:
- `POST https://api.supermemory.ai/ns/leetcode/profile` to retrieve coaching context.
- `POST https://api.supermemory.ai/ns/leetcode/search` for bounded context retrieval, when explicitly needed.
- `POST https://api.supermemory.ai/ns/leetcode/document` to save compact, consented learning summaries.

References:
- https://api.supermemory.ai/reference
- https://github.com/supermemoryai/sdk-ts/blob/main/docs/sdks/supermemory/README.md
- https://supermemory.ai/changelog/supermemory-api-v5/

The connector available inside a ChatGPT conversation is **not** a transferable API key for the user's Node server.

## Safe configuration (no local desktop LLM required)

In Supermemory's developer console, create an appropriate key with permission for the *`leetcode` namespace only*, where scope controls are supported. **Do not paste it in ChatGPT, commit it to GitHub, put it in a browser or print it in logs.** Place it only in the backend hosting service's secret/environment variable store when hosting is approved.

These are configuration names, *not* secrets:

```dotenv
SUPERMEMORY_API_KEY=<provide-through-host-secret-manager-not-GitHub>
SUPERMEMORY_NAMESPACE=leetcode
SUPERMEMORY_OUTBOX_FILE=.local-data/supermemory-outbox.json
LEETCODE_USERNAME=suvitk
CODEFORCES_HANDLE=suvitkankariya2007
GITHUB_SOLUTIONS_OWNER=suvitkankariya2007-debug
GITHUB_SOLUTIONS_REPO=LeetCode-Challenge
GITHUB_SOLUTIONS_BRANCH=main
```

For the current prototype, start on loopback using `docs/MCP_DEVELOPMENT.md`, with a private `MCP_ACCESS_TOKEN` created for the separate MCP access gate. Hosting and production OAuth remain blocked until reviewed.

## Runtime flow

1. On startup (when a Supermemory key is configured), the Node process fetches the `leetcode` profile once. It caches semantic *cues only*, refreshing at most every 15 minutes as needed; no arbitrary instructions are executed.
2. `get_my_problem_direction` immediately returns saved-state guidance and the cached preferences; it never waits for a Supermemory request on every hint.
3. `record_my_intuition_checkpoint` saves the owner's optional structured reflection locally, creates a minimal summary (not code or raw prompt), writes to the durable outbox and tries to deliver it to Supermemory.
4. `sync_my_submissions` fetches recent public provider submissions. Only when new activity is observed, it adds a *count/timestamp aggregate* to the memory outbox and tries to flush it.
5. Outages preserve pending summaries and existing learning state; the retry job runs every 30 minutes when configured. The backend never submits passwords, source code, private cookies, or session transcripts.
6. `get_my_supermemory_status` exposes credential configured/disabled (not the credential), outbox size, last sent time and profile retrieval health. `refresh_my_supermemory` explicitly retries fetching and sending.
7. The operational submission/reflection stores remain authoritative. Supermemory is a **semantic companion**, not the database.

## Validation criteria before production or PR merge

- [x] v5 endpoint client implemented without a runtime LLM dependency.
- [x] Namespace fixed server-side, only recognized coaching preferences interpreted.
- [x] Retried, file-backed outbox implemented with deterministic document IDs.
- [x] MCP introspection tool and manual retry tool added.
- [x] Mocked auth/scope/outage/idempotence tests added; GitHub Actions runs test/REST build/MCP runtime smoke.
- [ ] *Live* Supermemory API key installed in an approved secrets manager.
- [ ] Live `/ns/leetcode/profile` read returns expected learning cues for the owner's account.
- [ ] Live summary write is visible in Supermemory and is not mixed with unrelated spaces.
- [ ] An authorized end-to-end practice check-in reliably round-trips after restart, including retry after temporary failure.
- [ ] Secure hosting, OAuth, per-user isolation, backed-up persistent database, privacy/retention controls, plugin plan compatibility and security review completed.

## Known limitations

- File storage is single-process/single-owner; a serverless host with ephemeral storage would lose queued learning and submissions. Deploy with persistent storage or migrate to Postgres first.
- API keys are not generated, exposed or delivered by the ChatGPT Supermemory plugin. Live enablement requires an explicit secrets-manager setup step.
- A static MCP bearer token is only a development control, not production OAuth. Do not publicly expose the prototype.
- v5 responses and permissions are mock-tested; real API/namespace access is not yet verified.
- LeetCode public submission metadata does not reliably expose full code or complete solved history. GitHub code access requires the approved repo.
- A user handle is not account ownership; production handle verification and consent flows remain needed.

## Synchronization cadence

A running owner-only development server polls public coding submissions once every **120 minutes by default**, respecting bounded per-provider requests; set `MCP_SYNC_INTERVAL_MINUTES=0` to disable. When new events are ingested, it enqueues aggregate Supermemory summaries. The outbox retries delivery every 30 minutes only if its API key is present. No synchronization occurs while the backend is not running, and this is not a real-time stream.
