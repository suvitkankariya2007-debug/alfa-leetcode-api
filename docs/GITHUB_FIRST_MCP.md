# GitHub-first coding intuition MCP: no Google Cloud billing required for development

**Current status:** Development/testing option, not an always-on remote MCP deployment. GitHub Codespaces can consume quota and may incur charges if allowances are exceeded; review GitHub billing settings and stop unused Codespaces.

## What works on GitHub

- GitHub repository and Actions: source control, security reviews, tests and build validation.
- GitHub Codespaces: browser-accessible Linux development environment running the real Node MCP process while the Codespace is active.
- Private Codespaces port 8787: development-only Streamable HTTP server with strong bearer token and Host allowlist. **Never make this port public or share its bearer token.** Codespaces port forwarding may change hostnames; loopback-only MCP currently requires a local MCP client within the Codespace. It is **not** a public ChatGPT/Claude connector.
- GitHub Pages: optional static frontend only; it cannot host Node, PostgreSQL, OAuth or durable server state.
- STDIO MCP (`node dist/mcp/index.js`): existing general LeetCode/Codeforces tools for desktop clients that support local MCP processes. **It is not the full 16-tool coaching backend.** The full coaching prototype is `dist/mcp/remoteServer.js` (local-only) and production-target backend is `dist/mcp/hostedServer.js` (OAuth, PostgreSQL, mounted disk).

## Launch a Codespace

1. On the feature branch in GitHub, select **Code > Codespaces > Create codespace on feature/secure-chatgpt-mcp**.
2. Wait for the post-create build. In its terminal run `npm test && node scripts/smoke-mcp.mjs`.
3. To start the development HTTP server, set a randomly generated local bearer token and loopback Host allowlist in the Codespace terminal, then run `node dist/mcp/remoteServer.js`. See `docs/MCP_DEVELOPMENT.md` for exact variables.
4. Leave forwarded port **private**. Shut down the Codespace after testing to conserve included hours. Do not store secrets in the repository or in shared terminals.

## Cross-LLM connection matrix

| Client class | GitHub-only path | Caveat |
|---|---|---|
| Desktop MCP clients with STDIO support | Configure command `node` and absolute path to `dist/mcp/index.js` | Current STDIO tools are a smaller set than full coaching backend; Node and repo needed on that machine |
| Clients supporting private loopback HTTP MCP | Connect to `http://127.0.0.1:8787/mcp` with locally configured bearer token | Requires running local prototype, appropriate client support and matching allowed Host |
| ChatGPT / Claude hosted remote MCP | **Not yet available from GitHub-only hosting** | Requires HTTPS reachable backend, supported OAuth/client authorization and durable persistence |
| GitHub Pages | Static informational dashboard only | Cannot run MCP backend |

**Do not claim universal compatibility:** MCP support, transport, and authentication vary by LLM application.

## Preserve all user requirements

The existing full 16-tool remote MCP prototype includes public platform profile statistics, recent submission sync, diagnostics, coaching hints, solution evidence/reviews, practice tracking, reflection checkpoints and Supermemory status/synchronization. Keep its state files private. Live Supermemory integration requires an authorized runtime API key; never commit it.

The production-oriented hosted MCP additionally requires PostgreSQL restricted role and migrations, an external OAuth issuer, and a real persistent `/data` mount. Those requirements are deliberately not bypassed by Codespaces.

## Honest limitations

GitHub Codespaces is not an always-on hosting service: it stops after inactivity and its storage lifecycle is not a production backup strategy. GitHub Actions jobs are temporary and cannot keep an MCP server alive between runs. A durable hosted multi-LLM MCP still requires a backend host (possibly an eligible free tier elsewhere) plus authentication and persistence. Never expose a local static-bearer development endpoint publicly just to connect a hosted LLM.
