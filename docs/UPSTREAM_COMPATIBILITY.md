# Upstream preservation checklist

Repository forked from https://github.com/alfaarghya/alfa-leetcode-api .

Untouched by this planning change:
- `src/`: REST implementation and existing response contracts.
- `mcp/`: local STDIO transport and users/problems/discussions tools.
- `package.json`, lockfile and existing Docker scripts.
- Existing documentation and tests.

Regression requirements for subsequent implementation:
1. Validate profile, badges, solved, calendar, skill, language, progress, contest history and submission routes.
2. Validate problem listing/filtering, daily problem, selected problem and discussion routes.
3. Validate all registered MCP tool names and JSON schema contracts.
4. Preserve existing error handling and rate limits, then test failure cases.
5. Only add hosted MCP transport behind an opt-in command/entry point.
6. Avoid altering upstream client logic just to expose it remotely.

Proposed first engineering correction: verify/fix TypeScript build inclusion for `mcp/` since current `tsconfig.json` includes only `src/**/*.ts`; do this with an explicit build/test change and CI evidence.
