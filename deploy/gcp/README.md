# Google Cloud hosting plan — secure remote MCP, portable across clients

**Status: deployment preparation only.** No Google Cloud account, project, billing or resources have been accessed or created. Existing Railway staging remains unchanged.

## Recommended route

Use GitHub for source, PR review, tests and container builds. For an initial single-owner pilot, Google Compute Engine (GCE) with a small Linux VM, attached persistent disk, PostgreSQL and a reverse proxy is the most straightforward way to preserve **all existing features** without redesigning file-backed review/reflection/outbox journals. The existing hosted MCP currently requires a real mount at `/data`; a plain Cloud Run container's filesystem is ephemeral and fails this guard.

Cloud Run is attractive for low-traffic request-based compute, but would require replacing the file-backed journals with transaction-safe managed persistence, and likely Cloud SQL/other storage costs. Do not claim it is equivalent or deploy it unchanged.

**Credit caveat:** Google's new-customer trial eligibility and amount are account-specific; Google currently advertises $300 / 90 days. GCE CPU, disks, IP addresses, egress, logs, snapshots and optional managed services may use credits or cost money after they expire. Obtain explicit account-owner approval and configure budgets/alerts before provisioning.

## Current portable service

- Container: `deploy/gcp/Dockerfile`, Node.js 22, runs the verified build/tests before producing a minimal non-root runtime image.
- Entrypoint: `node dist/mcp/hostedServer.js`.
- Private PostgreSQL: use a dedicated database and non-superuser `coding_runtime` with `NOBYPASSRLS`; apply `db/migrations/001_owner_learning.sql` separately using an admin/migration role.
- Persistent `/data`: attach a dedicated VM persistent disk or correctly mounted durable filesystem, mounted at `/data` **inside the container**. File-backed journals require one writer; do not scale to multiple replicas before migrating all journals to a transactional store.
- TLS ingress: HTTPS reverse proxy on a stable domain; only expose ports 443 (and 80 for certificate issuance). Restrict DB port 5432 to a private Docker network; do not expose to the internet.
- OAuth: external trusted OAuth 2.1 authorization server, issuer-bound JWKS, audience-bound tokens and a verified owner subject. Never use public handles as identity proof.
- Supermemory: only inject `SUPERMEMORY_API_KEY` from a secret store into the runtime; namespace `leetcode`. Never commit the key or paste it into CI logs.
- MCP: `https://<your-domain>/mcp`, Streamable HTTP. Client compatibility must be tested per application.

## Required configuration at runtime (no values committed)

```text
PORT=8080
NODE_ENV=production
PERSISTENT_DATA_DIR=/data
DATABASE_URL=postgresql://<restricted-runtime-role>@<private-db>/coding
OAUTH_ISSUER=https://<trusted-issuer>
OAUTH_JWKS_URI=https://<trusted-issuer>/<jwks-path>
OAUTH_AUDIENCE=https://<your-domain>/mcp
OAUTH_OWNER_SUBJECT=<verified-idp-subject>
MCP_PUBLIC_BASE_URL=https://<your-domain>
MCP_ALLOWED_HOSTS=<your-domain>
MCP_ALLOWED_ORIGINS=<approved-browser-origins>
SUPERMEMORY_API_KEY=<from-secret-store>
SUPERMEMORY_NAMESPACE=leetcode
LEETCODE_USERNAME=<public-handle>
CODEFORCES_HANDLE=<public-handle>
GITHUB_SOLUTIONS_OWNER=<repo-owner>
GITHUB_SOLUTIONS_REPO=<repo>
GITHUB_SOLUTIONS_BRANCH=<branch>
```

Use secure secret injection, not a committed `.env`. Some values (OAuth issuer, subject, domain, database host) are **not known** until the cloud project, identity provider and DNS are configured. Do not invent them.

## Before exposing the endpoint

1. Confirm Google Cloud billing/trial eligibility, available region and spending cap; have account owner approve any costs.
2. Provision private VM/disk and DB with backup/restore plan, restricted runtime role, and dedicated unprivileged container user. Use the VM's private networking, OS firewall and least-privilege IAM.
3. Configure TLS and the OAuth issuer, redirect/consent flow, subject binding and token tests with a real MCP client.
4. Run database migration and verify PostgreSQL RLS against a real DB (two different principals); verify the mounted journal files persist after restart.
5. Test Supermemory namespace access and safe outbox replay using the authorized key. Test LeetCode/Codeforces/GitHub source access and prompt-injection handling.
6. Validate authenticated MCP from ChatGPT, Claude and at least one generic Streamable HTTP client; check unauthorized/unknown tools are denied.
7. Check resource usage, cost alerts, backup and recovery, privacy and logging. Only then deploy publicly or merge PR.

## GitHub-only alternative

GitHub Actions can build/test and deploy a container to a cloud host, and GitHub Pages can host a static dashboard. GitHub Pages **cannot** itself run a persistent authenticated HTTP MCP server or PostgreSQL. A local MCP process started by an MCP-capable desktop client is another alternative, but it is not a remote endpoint and does not satisfy browser-only access.

## Portability

The same OCI container can run on other VM/container providers with a real mounted `/data`, private PostgreSQL, HTTPS and OAuth. No Google-specific APIs are required by the existing MCP runtime. Never promise support for every LLM: remote MCP/OAuth support and UI vary by client.
