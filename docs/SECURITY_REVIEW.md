# Pre-deployment security review (status: NOT APPROVED)

| Gate | Evidence required | Status |
|---|---|---|
| Original API compatibility | Existing route snapshot and regression tests | Pending |
| STDIO MCP compatibility | Tool inventory and inspector tests | Pending |
| Remote MCP transport | Verified Streamable HTTP implementation | Pending |
| Authentication | Platform-compatible auth; token validation; CSRF where applicable | Pending |
| Authorization | Server-side principal-to-LeetCode-handle mapping and isolation | Pending |
| Abuse prevention | Rate limits, response caps, timeouts, backoff | Pending |
| Prompt injection | Untrusted tool-result labeling, no instruction execution, adversarial tests | Pending |
| Provenance | Source, timestamp, handle, errors on every tool result | Pending |
| Secret hygiene | No checked-in secrets; protected environment variables; rotation | Pending |
| Deployment | TLS, supported hosting, cost estimate, logs and alerting | Pending |
| ChatGPT compatibility | Confirm account feature and successful MCP tool registration | Pending |

**Hard rule:** Do not ask users for their LeetCode passwords. Public statistics require a username only. If private data is required later, design consent-driven official authentication only where supported; do not collect session cookies.

**Hard rule:** Do not deploy or enable write-capable MCP tools until all relevant gates have been explicitly reviewed.
