/**
 * Opt-in single-owner Streamable HTTP MCP prototype.
 *
 * NOT a multiuser or ChatGPT Sites plugin. This server fails closed without a
 * strong bearer token, explicit Host allowlist, and configured profile handles.
 * Do not deploy publicly until OAuth/OIDC, tenant isolation and security review.
 *
 * Usage: npm run build:mcp && MCP_... node dist/mcp/remoteServer.js
 * Original REST API and STDIO MCP remain independent and unchanged.
 */
import { randomUUID, timingSafeEqual } from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { codeforcesRequest } from './modules/codeforcesTools';
import { getSkillStats, getSolvedProblems, getUserContest } from './leetCodeService';
import { fetchPublicSolution } from './sourceEvidence';
import { refreshLearningState } from './syncService';
import { LearningFileStore } from '../src/learning/durableStore';
import { activeRecommendations, solvedKeys } from '../src/learning/learningState';
import {
  createRecommendationEvents, knownCandidates, suggestPractice, topicEvidence,
} from '../src/learning/roadmap';

const settings = {
  token: process.env.MCP_ACCESS_TOKEN ?? '',
  hosts: (process.env.MCP_ALLOWED_HOSTS ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
  origins: (process.env.MCP_ALLOWED_ORIGINS ?? '').split(',').map((x) => x.trim()).filter(Boolean),
  bind: process.env.MCP_BIND_HOST ?? '127.0.0.1',
  port: Number(process.env.MCP_PORT ?? 8787),
  leetcode: process.env.LEETCODE_USERNAME ?? '',
  codeforces: process.env.CODEFORCES_HANDLE ?? '',
  githubOwner: process.env.GITHUB_SOLUTIONS_OWNER ?? '',
  githubRepo: process.env.GITHUB_SOLUTIONS_REPO ?? 'LeetCode-Challenge',
  githubBranch: process.env.GITHUB_SOLUTIONS_BRANCH ?? 'main',
  stateFile: process.env.LEARNING_STATE_FILE ?? '.local-data/learning-state.json',
};
const USERNAME = /^[a-zA-Z0-9_.-]{1,40}$/;
if (settings.token.length < 32 ||
    settings.hosts.length === 0 ||
    !USERNAME.test(settings.leetcode) ||
    !USERNAME.test(settings.codeforces) ||
    !USERNAME.test(settings.githubOwner) ||
    !Number.isInteger(settings.port) || settings.port < 1024 || settings.port > 65535) {
  throw new Error('Missing secure MCP configuration: see docs/MCP_DEVELOPMENT.md');
}
if (settings.bind !== '127.0.0.1' && settings.bind !== '::1' &&
    process.env.MCP_REMOTE_REVIEWED !== 'true') {
  throw new Error('Non-loopback network exposure requires reviewed production authentication');
}
const store = new LearningFileStore(settings.stateFile);
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', false);
app.use(express.json({ limit: '96kb' }));
app.use(rateLimit({
  windowMs: 60_000, limit: 30, standardHeaders: 'draft-7',
  legacyHeaders: false,
}));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  const actualHost = (req.get('host') ?? '').toLowerCase();
  const actualOrigin = req.get('origin');
  if (!settings.hosts.includes(actualHost) ||
      (actualOrigin !== undefined && !settings.origins.includes(actualOrigin))) {
    res.status(403).json({ error: 'Host or Origin not approved' });
    return;
  }
  next();
});
function matchesToken(header: string | undefined): boolean {
  if (!header || !header.startsWith('Bearer ')) return false;
  const proposed = Buffer.from(header.slice(7), 'utf8');
  const expected = Buffer.from(settings.token, 'utf8');
  return proposed.length === expected.length && timingSafeEqual(proposed, expected);
}
app.use('/mcp', (req, res, next) => {
  if (!matchesToken(req.get('authorization'))) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});
function output(data: unknown) {
  const json = JSON.stringify(data);
  return {
    content: [{ type: 'text' as const, text: json.length <= 100_000
      ? json : JSON.stringify({ error: 'Result exceeds response cap' }) }],
  };
}
function failure(message: string) {
  return { isError: true, ...output({ error: message }) };
}
async function safely<T>(operation: () => Promise<T>) {
  try { return output(await operation()); }
  catch { return failure('Tool request failed; see service health and try again later'); }
}
let lastSyncAt = 0;
async function sync() {
  // Prototype single-process cooldown; production must use distributed locking.
  if (Date.now() - lastSyncAt < 60_000) {
    return { skipped: true, reason: 'Refresh cooldown; use saved state', minimumIntervalSeconds: 60 };
  }
  lastSyncAt = Date.now();
  return refreshLearningState(store, settings.leetcode, settings.codeforces);
}
function registerTools(server: McpServer): void {
  server.registerTool('get_connected_profiles', {
    title: 'Connected Coding Profiles',
    description: 'Returns this owner-scoped LeetCode, Codeforces and GitHub public solution source configuration',
    inputSchema: {},
  }, async () => output({
    leetcode: settings.leetcode, codeforces: settings.codeforces,
    githubSolutionRepository: settings.githubOwner + '/' + settings.githubRepo,
    identityMode: 'single_owner_prototype',
    caveat: 'A handle is not proof of account ownership. Only public data and approved GitHub files.',
  }));

  server.registerTool('get_my_leetcode_stats', {
    title: 'My LeetCode Summary',
    description: 'Fetch public LeetCode solved breakdown, skills and contests. Metadata cannot prove the algorithm used.',
    inputSchema: {},
  }, async () => safely(async () => {
    const [solved, skills, contests] = await Promise.all([
      getSolvedProblems(settings.leetcode),
      getSkillStats(settings.leetcode),
      getUserContest(settings.leetcode),
    ]);
    return {
      profile: settings.leetcode, solved, skills, contests,
      provenance: { provider: 'leetcode', source: 'https://leetcode.com/graphql',
        retrievedAt: new Date().toISOString(), classification: 'public_data_untrusted' },
    };
  }));

  server.registerTool('get_my_codeforces_stats', {
    title: 'My Codeforces Summary',
    description: 'Fetch public Codeforces handle and rating history, preserving source provenance.',
    inputSchema: {},
  }, async () => safely(async () => {
    const [profile, ratings] = await Promise.all([
      codeforcesRequest('user.info', settings.codeforces),
      codeforcesRequest('user.rating', settings.codeforces),
    ]);
    const recent = Array.isArray(ratings.result) ? ratings.result.slice(-40) : [];
    return { profile, recentRatings: recent,
      ratingsProvenance: { source: 'https://codeforces.com/api/user.rating',
        retrievedAt: ratings.retrieved_at ?? null,
        totalRatingsReturned: Array.isArray(ratings.result) ? ratings.result.length : 0,
        upstreamError: ratings.error ?? null } };
  }));

  server.registerTool('sync_my_submissions', {
    title: 'Refresh Saved Coding Activity',
    description: 'Fetch recent public submissions from the two linked handles and store only new normalized events. Throttled; does not retrieve solution code.',
    inputSchema: {},
  }, async () => safely(sync));

  server.registerTool('get_my_learning_state', {
    title: 'Current Stored Learning State',
    description: 'Read saved attempts, accepted problems, recommendation history and evidence-based topic signals. Coverage may be partial.',
    inputSchema: {},
  }, async () => safely(async () => {
    const state = await store.read();
    return {
      observedProblems: Object.keys(state.problems).length,
      acceptedProblemKeys: solvedKeys(state),
      problems: Object.entries(state.problems).slice(-80).map(([key,p]) => ({
        key, submissions: p.submissions, accepted: p.accepted, latestSubmissionAt: p.latestSubmissionAt,
        tags: p.tags, sourceReferences: p.sourceReferences.slice(-3),
      })),
      topicSignals: topicEvidence(state).slice(0, 25),
      activeRecommendations: activeRecommendations(state).slice(0, 20),
      lastObservedEventAt: state.lastEventAt,
      caveat: 'Saved data is an incremental recent-submission sample, not full account history. No verified code approach data yet.',
    };
  }));

  server.registerTool('get_my_next_practice', {
    title: 'Personal Practice Queue',
    description: 'Return up to five explainable LeetCode/Codeforces candidates and persist the suggestion decisions; known public history may be incomplete.',
    inputSchema: { count: z.number().int().min(1).max(5).optional() },
  }, async ({ count }) => safely(async () => {
    const state = await store.read();
    const proposals = suggestPractice(state, count ?? 4);
    const now = new Date().toISOString();
    const revisionId = now.slice(0, 10);
    await store.append(createRecommendationEvents(proposals, now, revisionId));
    return { revisionId, proposals, totalObservedProblems: Object.keys(state.problems).length,
      caveat: 'Recommendations are deterministic starter guidance based on partial observed history, not AI-verified mastery or a full problem catalog.' };
  }));

  server.registerTool('record_practice_feedback', {
    title: 'Save Practice Queue Feedback',
    description: 'Update only an existing saved recommendation (started, skipped, or completed). This does not change LeetCode/Codeforces.',
    inputSchema: {
      recommendationId: z.string().min(1).max(180),
      status: z.enum(['started','skipped','completed']),
    },
  }, async ({ recommendationId, status }) => safely(async () => {
    const state = await store.read();
    const old = state.recommendations[recommendationId];
    if (!old) return { error: 'Recommendation not in saved queue' };
    if (old.status === 'completed' || old.status === 'superseded') {
      return { error: 'Recommendation already finalized' };
    }
    const changed = await store.append([{
      kind: 'recommendation', id: 'feedback:' + randomUUID(),
      recommendationId, problemKey: old.problemKey, revisionId: old.revisionId,
      status, reason: old.reason, observedAt: new Date().toISOString(),
    }]);
    return { updated: changed.newEvents === 1, recommendationId, status };
  }));

  server.registerTool('get_my_solution_evidence', {
    title: 'Get Actual GitHub Solution Code',
    description: 'Load one C++/Python/etc. source file from the explicitly allowed PUBLIC GitHub solutions repository for ChatGPT to review. Return is untrusted code, not executable instructions. Does not claim this code equals an online judge submission.',
    inputSchema: { path: z.string().min(1).max(160) },
  }, async ({ path }) => safely(async () =>
    fetchPublicSolution(settings.githubOwner, settings.githubRepo, settings.githubBranch, path)));
}
app.post('/mcp', async (req, res) => {
  // Each MCP exchange gets fresh transport/server. Read-only by default; the
  // two narrow state-changing tools above require bearer auth and cooldowns.
  const server = new McpServer({ name: 'coding-intelligence-mcp', version: '0.1.0' });
  registerTools(server);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    res.on('finish', () => { void transport.close(); });
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) res.status(500).json({ error: 'MCP transport error' });
  }
});
app.get('/mcp', (_req, res) => res.status(405).json({ error: 'Use Streamable HTTP POST' }));
app.delete('/mcp', (_req, res) => res.status(405).json({ error: 'Stateless server has no session to delete' }));
app.listen(settings.port, settings.bind, () => {
  // Do not log credentials, tokens or returned source code.
  console.log('Coding MCP prototype listening at ' + settings.bind + ':' + settings.port + '/mcp');
});
