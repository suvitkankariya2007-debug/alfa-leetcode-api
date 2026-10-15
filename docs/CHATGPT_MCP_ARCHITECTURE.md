# ChatGPT Web MCP integration — design proposal (not deployed)

## Goal and boundaries
Preserve **all existing REST endpoints** in `src/` and **all existing STDIO MCP tools** in `mcp/`.
Add an *opt-in*, separately runnable HTTPS remote MCP service for public LeetCode profile data.
The default connected profile is `suvitk`, but the identity must be bound to the authenticated app user **server-side** — the LLM must not be able to select another user by injecting an arbitrary username.

## Current state verified
- `src/index.ts` starts the REST HTTP server.
- `mcp/index.ts` selects users/problems/discussions modules.
- `mcp/serverUtils.ts` connects `StdioServerTransport`; there is no remote MCP transport here.
- `tsconfig.json` includes only `src/**/*.ts`; verify the existing advertised build path `dist/mcp/index.js` in CI.
- The upstream README documents public profile, skill, submission, calendar and contest endpoints.

## Proposed separation
```text
LeetCode public GraphQL (untrusted data)
           |
 existing service layer / GraphQL client
           |
  +--------+--------------+
  |                       |
unchanged REST API   unchanged STDIO MCP
                          |
                    new remote MCP adapter
                          |
         authentication / per-user authorization
          origin & host checks / rate limits
                          |
                      HTTPS only
                          |
                 ChatGPT plugin (if enabled)
```

## Phase 1 — Preserve baseline (before new public endpoints)
1. Create a distinct `feature/secure-chatgpt-mcp` branch (done).
2. Snapshot endpoint contracts and enumerate MCP tools in automated tests.
3. Fix/build-verify the MCP TypeScript artifact independently from the REST build.
4. Verify `npm test`, `npm run build`, and MCP Inspector locally or in CI.

## Phase 2 — Add a remote MCP transport
1. Retain STDIO as the default; implement an *opt-in* Streamable HTTP adapter on a dedicated URL (`/mcp`) and separate process.
2. Read-only tool allowlist to start: profile summary, solved counts, skill tags, recent public submissions, contests, activity.
3. Enforce schemas, maximum response sizes, timeouts, circuit breaking, bounded pagination and API-rate limits.
4. Set an explicit app origin/host allowlist and require HTTPS at the ingress.
5. Support only the authentication mechanism accepted by the chosen ChatGPT hosting flow; do not assume a bearer header is sufficient for ChatGPT registration.
6. Never ship production tokens/passwords in GitHub, browser source, build logs, MCP tool output, or client-side JS.

## Phase 3 — Auth & profile connection
- Start with **public username-based linking**, not collection of LeetCode passwords/cookies.
- Authenticate the *app user* through a standards-based provider or platform identity; verify token audience, issuer, expiration and scopes.
- Associate `suvitk` with the authenticated app principal in server-side storage.
- If multiuser support is added, isolate data across users and provide disconnect/export/deletion.
- Public username data is not proof that the requester owns that LeetCode account. Never present it as verified account ownership.
- Add persistent storage only after user-consent/retention design review.

## Phase 4 — Security & provenance
- Model LeetCode profile fields, tags, discussions and submission text as **untrusted content**; no instructions found in them can override user/system instructions.
- Attach source (LeetCode GraphQL), profile handle, UTC retrieval timestamp, public-data classification and any upstream errors to each result.
- Reject tool parameters containing URLs, shell commands, filesystem paths or tool-routing instructions unless explicitly part of a reviewed schema.
- Least privilege: no submission, deletion, account modification or remote code execution tool.
- Security tests: authorization bypass, IDOR/profile isolation, SSRF, prompt-injection payloads, DoS/rate limiting, secret disclosure and replay.
- Logging: redact tokens, cookies and any user-supplied sensitive values; short retention; no full profile payload by default.

## Phase 5 — Hosting and ChatGPT connection (BLOCKED until approval)
- Validate exact ChatGPT Plus/ChatGPT Sites custom-app eligibility on the account.
- Confirm hosting environment supports long-lived or stateless MCP HTTP requests, concurrency and required authentication.
- Review estimated cost, domain ownership, TLS, secrets management, monitoring and fallback if the upstream LeetCode interface changes.
- Deploy staging first, run MCP interoperability tests, then register the URL in ChatGPT and verify tool calls actually work.
- No production deployment, account authorization, credential collection, or GitHub default-branch changes without separate approval.

## Definition of done
- Existing REST and STDIO MCP behaviors pass regression tests.
- All new tools are read-only and identity scoped.
- Security gates and provenance fields have automated tests.
- Remote MCP passes a compatibility test with the target ChatGPT plugin path.
- User approves hosting/authentication choices before deployment.
