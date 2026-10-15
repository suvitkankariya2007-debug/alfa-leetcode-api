# Railway hosting readiness — Adaptive Coding Intelligence MCP

**Status:** Preparation only, **NO project/service deployed, no GitHub-to-Railway source link, no database provisioned, no secrets set**.

## Purpose

Host an authenticated, intuition-first LeetCode + Codeforces coaching MCP over HTTPS; retain submission state and learner reflections; keep Supermemory v5 a separately authorized semantic companion. Preserve existing REST API and STDIO MCP.

## Current blockers (must be resolved BEFORE attaching a GitHub source)

- [ ] Replace prototype's static bearer token and loopback-only transport with a production **OAuth/OIDC** capable remote MCP server and account-specific scope validation.
- [ ] Replace single-owner JSON-file stores with **PostgreSQL**, using tenant-scoped queries / RLS, migrations, backup, retention and export/deletion paths. Railway filesystem is ephemeral without an attached persistent volume. Never treat a build cache as durable progress.
- [ ] Have consented, explicit account binding for LeetCode, Codeforces and GitHub source access. A public handle is not proof of ownership.
- [ ] Security review: no arbitrary URL fetch, no user-submitted code execution, prevent prompt-injection escalation, fixed allowed origins/hosts, HTTPS, redacted logs, bounded payloads, rate limits, authenticated state mutations.
- [ ] Supermemory API v5 credential supplied *only* via backend secret manager; namespace `leetcode`. Test live profile read, compact summary write, retry on outage, cross-namespace isolation; never send credentials to ChatGPT or GitHub.
- [ ] Verify Railway costs, chosen region, database backup/recovery, rate limits, bandwidth and spending alerts.
- [ ] Verify the targeted ChatGPT plan's supported plugin connection path separately for Plus and Go. A generic remote MCP endpoint does not guarantee plan eligibility.
- [ ] Verify TypeScript static typechecks for the MCP (current `build:mcp` uses transpilation only), unit/integration tests, MCP client interoperability and security review.

**Important:** Railway deploys a GitHub-connected service automatically as new commits are pushed on the selected branch. Do not connect this repository as a public service or add a public domain before production gates pass.

## Intended Railway project

Environment: **staging** first, then production with separate credentials and database.

| Component | Railway service | Notes |
|---|---|---|
| Remote MCP API | `coding-intelligence-mcp` | Node.js, Streamable HTTP, HTTPS, production OAuth, isolated data access |
| Durable learning state | `Postgres` | Private network; migrations, transactionally stored submissions/recommendation state |
| Periodic ingestion | `coding-sync-worker` (later) | Independent scheduler, upstream API backoff, concurrency controls; no duplicate jobs |
| Supermemory | External API v5 | Called server-side with secret; namespace-specific summaries only |
| ChatGPT plugin/site | Separate supported host flow | Must test Go/Plus; independent web dashboard fallback |

## Deployment configuration **template** (NOT ACTIVE)

See `deploy/railway/railway.template.json` — deliberately outside repository root and **not named** `railway.json` to prevent accidental automatic application. This is a conceptual template; may need adjustment for Railway settings at setup time.

- Repo: `suvitkankariya2007-debug/alfa-leetcode-api`
- Start from approved release tag or reviewed production branch; **do not connect the unfinished PR branch**.
- Build: install dependencies, typecheck, unit tests, MCP transport smoke tests.
- Start: a **new** production HTTPS-ready entrypoint (not current `mcp/remoteServer.ts`, which refuses non-loopback binding).
- Health: authenticated readiness probe or non-sensitive `/healthz` on production process, never reveal memory contents.
- Staging can test local communication without opening the MCP endpoint to the internet; ensure no unreviewed public service.

## Variables checklist (NAMES ONLY — never commit secret values)

- `NODE_ENV=production`
- `PORT`: Railway-provided port (production server must honor it)
- `DATABASE_URL`: Railway **reference variable** pointing to private Postgres service
- `SUPERMEMORY_API_KEY`: Railway secret variable, set after user grants scope
- `SUPERMEMORY_NAMESPACE=leetcode`
- `LEETCODE_USERNAME=suvitk` (prototype fixed owner; future authenticated per-user DB binding)
- `CODEFORCES_HANDLE=suvitkankariya2007` (prototype fixed owner)
- `GITHUB_SOLUTIONS_OWNER=suvitkankariya2007-debug` and `GITHUB_SOLUTIONS_REPO=LeetCode-Challenge`
- `OAUTH_ISSUER`, `OAUTH_AUDIENCE`, `OAUTH_CLIENT_ID`: **design placeholders** only; no current production implementation
- Allowed hostname, origin, webhook and token settings must be explicitly reviewed; never use wildcards.

## Safe order of operations

1. Finish OAuth and Postgres backend implementation on feature branch; run CI and review API security.
2. Pick plan/region/cost limit and confirm spend tolerance **before creating billable services**.
3. Create Railway staging project and private database (only with approval).
4. Set backend secrets in Railway UI/connected service, never in code, chat or CI logs.
5. Run private staging tests against real Supermemory namespace; verify API read/write/health without raw data disclosure.
6. Enable HTTPS endpoint and authentication; run MCP compatibility and Go/Plus eligibility tests.
7. Approve staged changes, then merge PR into `main` and deploy reviewed release.

## Relevant source docs

- https://docs.railway.com/services
- https://docs.railway.com/databases/postgresql
- https://docs.railway.com/variables
- https://docs.railway.com/guides/express
- https://api.supermemory.ai/reference

**No paid plan, project creation, service creation, deployment or PR merge authorized by this document.**
