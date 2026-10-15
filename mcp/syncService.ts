/**
 * Normalize recent public submissions. Historical coverage is intentionally
 * partial (upstream lists are capped). Never claim "all solutions".
 */
import { createHash } from 'node:crypto';
import { getRecentSubmission } from './leetCodeService';
import { codeforcesRequest } from './modules/codeforcesTools';
import { type SubmissionEvent, type LearningEvent, type LearningState } from '../src/learning/learningState';

type Row = Record<string, unknown>;
function row(value: unknown): Row | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
}
function fromUnix(value: unknown): string | null {
  const seconds = typeof value === 'string' ? Number(value) : value;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return null;
  const d = new Date(seconds * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 24);
}
export function normalizeLeetCode(payload: unknown, username: string): SubmissionEvent[] {
  const container = row(payload);
  if (!container || !Array.isArray(container.submission)) throw new Error('Unexpected LeetCode submission payload');
  const result: SubmissionEvent[] = [];
  for (const value of container.submission.slice(0, 50)) {
    const item = row(value);
    if (!item || typeof item.titleSlug !== 'string' || !/^[a-z0-9-]{1,100}$/.test(item.titleSlug)) continue;
    const observedAt = fromUnix(item.timestamp);
    if (!observedAt) continue;
    // LeetCode public recentSubmissionList does not expose stable submission IDs.
    // Same-second exact duplicates may collapse; explicitly disclose this limitation.
    const fingerprint = JSON.stringify([username,item.titleSlug,item.timestamp,item.statusDisplay,item.lang]);
    const id = 'leetcode:' + username + ':' + shortHash(fingerprint);
    result.push({
      kind: 'submission', id, provider: 'leetcode', problemId: item.titleSlug,
      verdict: item.statusDisplay === 'Accepted' ? 'accepted' :
        typeof item.statusDisplay === 'string' ? 'rejected' : 'unknown',
      observedAt, sourceReference: 'https://leetcode.com/problems/' + item.titleSlug + '/',
      tags: [], // Tags come from separate public skill data; never guess them from title.
    });
  }
  return result;
}
export function normalizeCodeforces(payload: unknown, handle: string): SubmissionEvent[] {
  const container = row(payload);
  if (!container || container.error || !Array.isArray(container.result)) throw new Error('Codeforces submissions unavailable');
  const result: SubmissionEvent[] = [];
  for (const value of container.result.slice(0, 50)) {
    const item = row(value);
    const problem = item && row(item.problem);
    if (!item || !problem || typeof item.id !== 'number' ||
        typeof problem.contestId !== 'number' ||
        typeof problem.index !== 'string' || !/^[A-Za-z0-9]{1,8}$/.test(problem.index)) continue;
    const observedAt = fromUnix(item.creationTimeSeconds);
    if (!observedAt) continue;
    const problemId = String(problem.contestId) + '/' + problem.index;
    result.push({
      kind: 'submission', id: 'codeforces:' + handle + ':' + item.id,
      provider: 'codeforces', problemId,
      verdict: item.verdict === 'OK' ? 'accepted' :
        typeof item.verdict === 'string' ? 'rejected' : 'unknown',
      observedAt,
      sourceReference: 'https://codeforces.com/contest/' + problem.contestId + '/submission/' + item.id,
      tags: Array.isArray(problem.tags) ? problem.tags.filter(
        (t): t is string => typeof t === 'string' && t.length <= 80,
      ).slice(0, 20) : [],
    });
  }
  return result;
}
export interface RefreshResult {
  updated: boolean;
  newEvents: number;
  attemptedProblemsSaved: number;
  lastObservedSubmissionAt: string | null;
  checkedAt: string;
  sources: {
    leetcode: { status: 'ok' | 'error'; observedRecords: number; note?: string };
    codeforces: { status: 'ok' | 'error'; observedRecords: number; note?: string };
  };
  caveat: string;
}
export async function refreshLearningState(
  store: { append(events: readonly LearningEvent[]): Promise<{ state: LearningState; newEvents: number }> },
  leetcodeUsername: string,
  codeforcesHandle: string,
): Promise<RefreshResult> {
  // Each provider fails independently. An upstream outage never clears existing progress.
  const [lc, cf] = await Promise.allSettled([
    getRecentSubmission({ username: leetcodeUsername, limit: 50 }),
    codeforcesRequest('user.status', codeforcesHandle, 50),
  ]);
  let lcEvents: SubmissionEvent[] = [], cfEvents: SubmissionEvent[] = [];
  let lcError: string | undefined, cfError: string | undefined;
  try {
    if (lc.status !== 'fulfilled') throw new Error('LeetCode upstream unavailable');
    lcEvents = normalizeLeetCode(lc.value, leetcodeUsername);
  } catch {
    lcError = 'LeetCode recent submissions unavailable or unexpected upstream format';
  }
  try {
    if (cf.status !== 'fulfilled') throw new Error('Codeforces upstream unavailable');
    cfEvents = normalizeCodeforces(cf.value, codeforcesHandle);
  } catch {
    cfError = 'Codeforces public submissions unavailable or unexpected upstream format';
  }
  // On total failure preserve the existing snapshot, no false update.
  const events = [...lcEvents, ...cfEvents];
  const { state, newEvents } = await store.append(events);
  return {
    updated: newEvents > 0, newEvents,
    attemptedProblemsSaved: Object.keys(state.problems).length,
    lastObservedSubmissionAt: state.lastEventAt,
    checkedAt: new Date().toISOString(),
    sources: {
      leetcode: { status: lcError ? 'error' : 'ok', observedRecords: lcEvents.length, ...(lcError ? { note: lcError } : {}) },
      codeforces: { status: cfError ? 'error' : 'ok', observedRecords: cfEvents.length, ...(cfError ? { note: cfError } : {}) },
    },
    caveat: 'Recent public submissions only; older solved history and private solution code may be missing. This is not a full account export.',
  };
}
