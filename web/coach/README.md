# Coding Intuition — browser-first coaching studio

**Status (2026-10-16): implemented, browser-smoke-tested proof of concept, not a connected MCP plugin.**

Open [index.html](index.html) in a recent browser. It is a self-contained file with no build step, API keys, third-party scripts, remote fetches, cloud credentials or backend hosting costs. The UI works offline in a browser that permits local storage on this origin. For more consistent persistence, serve the directory over a local HTTP server with a stable origin:

```bash
cd web/coach
python3 -m http.server 8000 --bind 127.0.0.1
# open http://127.0.0.1:8000
```

Do not serve it publicly alongside privileged internal backends. The page is designed for **one person's private browser**, not multiuser shared storage.

## What has actually been built

- Responsive dashboard, recorded attempts, solved-state tracking and review queue.
- Sixteen curated LeetCode/Codeforces starting problems plus up to 300 owner-added exercises.
- Recommendations based on *self-reported* unsolved attempts, help levels and topic signals, with a displayed reason for each recommendation.
- Guided pattern recognition, nudge, invariant and dry-run stages for eight patterns.
- Check-ins with hint level, confidence, solved/attempted status and optional reflective note.
- Browser-local persistence, JSON export, validated import and reset.
- Honest access/compatibility cards: Plus and Go can open a normal browser application, but this is **not** a native plugin and does not automatically synchronize their data.

It does **not** fetch actual LeetCode/Codeforces records, verify online-judge submissions, use GitHub OAuth, analyze code with an LLM, connect to Supermemory, or sync separate accounts. No actual Plus/Go sign-in occurred. The existing Node MCP development/hosted backends remain independent and unchanged.

## Cross-account learning continuity — current manual path

1. Open the page in the first browser; record an attempt and reflection.
2. Choose **Connections & data → Export JSON backup**. Keep the backup private; it contains your notes in readable text.
3. Open the page in a separate browser (for example, from your other ChatGPT account's device/browser) and **Import saved learning data**. Confirm replacement. The same records and recommendations appear.
4. This procedure is **manual portability**, not automatic cross-device synchronization. The two copies can diverge; re-importing **replaces**, rather than merges, progress.

Because browser access does not depend on ChatGPT subscription type, the UI is browser-compatible with Plus or Go. **We did not log into either ChatGPT account or verify native plugin tool execution on either plan.**

## Why direct private MCP sharing to Go is blocked

OpenAI's official ChatGPT Sites documentation says personal accounts cannot directly share their Site-hosted plugin to another account. Sharing a Site is not sharing the Site-hosted MCP plugin:
https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites

Read `docs/PLUS_GO_MCP_ACCESS_VERDICT_2026-10-16.md` and `docs/PRE_DEPLOYMENT_GO_NO_GO_AUDIT_2026-10-16.md` for the release gates. A custom reviewed public-directory plugin is a different process and does not guarantee Go tool eligibility.

## Testing and provenance

- Local browser smoke test performed in independent Chromium contexts with one desktop and one mobile viewport: initial state, recommendation filtering, graduated hints, recorded and reloaded check-ins, JSON backup/export/import, and harmless prompt/script injection string escaped as visible text. The test used an in-memory `localStorage` substitute because the isolated browser runner disallowed localhost and file URL navigation; this does not independently verify persistence permissions on a normal user browser.
- GitHub Actions runs `node web/coach/smoke.mjs` to syntax-check and enforce a small set of offline/no-network and disclosure boundaries. These static tests are **not** an end-to-end SaaS security test.
- Profile handles are shown only as unverified public-source references.
- There is no production deployment, OAuth provider, encrypted cloud database, backup service, permissioned user identity, automated tracking service or public sharing release.

## What is required for true cross-LLM progress

Select a supported HTTPS backend, stable storage for *all* learning records and an identity provider with explicit linking and revocation of each client account. Implement transactional updates, data export/deletion, independently verified account isolation, rate limits and security testing. Make supported ChatGPT/Claude tools optional client adapters; never store authoritative learning state solely inside a chat. No infrastructure or billing decision has been made.
