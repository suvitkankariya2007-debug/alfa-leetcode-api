/**
 * Auth/protocol smoke test: local only, no upstream calls, no credentials.
 * Must be executed AFTER "npm run build:mcp".
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const access = randomBytes(32).toString('hex');
const port = 18787;
const base = 'http://127.0.0.1:' + port + '/mcp';
const server = spawn(process.execPath, ['dist/mcp/remoteServer.js'], {
  env: {
    ...process.env,
    MCP_ACCESS_TOKEN: access,
    MCP_ALLOWED_HOSTS: '127.0.0.1:' + port,
    MCP_PORT: String(port),
    LEETCODE_USERNAME: 'integration_test_handle',
    CODEFORCES_HANDLE: 'integration_test_handle',
    GITHUB_SOLUTIONS_OWNER: 'github-test-owner',
    GITHUB_SOLUTIONS_REPO: 'leetcode-solutions',
    MCP_SYNC_INTERVAL_MINUTES: '0',
  },
  stdio: ['ignore','pipe','pipe'],
});
let exited = false;
server.on('exit', () => { exited = true; });
async function ready() {
  for (let i=0;i<90;i++) {
    if (exited) throw new Error('MCP subprocess stopped unexpectedly');
    try {
      const r = await fetch(base, { signal: AbortSignal.timeout(1000) });
      if (r.status === 401) return;
    } catch { /* app still starting */ }
    await sleep(100);
  }
  throw new Error('MCP process failed to start');
}
async function rpc(payload, token) {
  return fetch(base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(4000),
  });
}
try {
  await ready();
  const unauthorized = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
  assert.equal(unauthorized.status, 401, 'Requests without bearer token must fail');
  const initialize = await rpc({
    jsonrpc: '2.0', id: 2, method: 'initialize',
    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'smoke-client', version: '0.1.0' } },
  }, access);
  assert.equal(initialize.status, 200, 'Authenticated MCP initialize must succeed');
  const initialized = await initialize.json();
  assert.ok(initialized.result?.serverInfo, 'Initialized response must include server info');
  const toolResponse = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }, access);
  assert.equal(toolResponse.status, 200, 'Authenticated MCP tools/list must succeed');
  const tools = await toolResponse.json();
  assert.ok(Array.isArray(tools.result?.tools), 'MCP tools/list must return tools');
  const names = new Set(tools.result.tools.map((t) => t.name));
  assert.ok(names.has('get_my_leetcode_stats'), 'LeetCode tool should exist');
  assert.ok(names.has('get_my_codeforces_stats'), 'Codeforces tool should exist');
  assert.ok(names.has('get_my_solution_evidence'), 'Evidence tool should exist');
  assert.ok(names.has('get_my_next_practice'), 'Practice tool should exist');
  assert.ok(names.has('get_my_problem_direction'), 'Immediate hint-first direction tool should exist');
  assert.ok(names.has('record_my_intuition_checkpoint'), 'Intuition checkin tool should exist');
  assert.ok(names.has('get_my_intuition_progress'), 'Intuition growth tool should exist');
  console.log('MCP smoke test: auth enforcement, initialization, tool discovery passed');
} finally {
  server.kill('SIGTERM');
}
