/**
 * Explainable practice recommendations, deterministic and LLM-independent.
 * Catalog is an initial editorial starter list, NOT a complete problemset.
 * Saved submissions may be partial so "not observed solved" != "unsolved".
 */
import type { LearningState, RecommendationEvent, RecommendationStatus } from './learningState';

export interface Candidate {
  key: string;
  title: string;
  url: string;
  tags: string[];
  level: 'starter' | 'intermediate' | 'stretch';
}
const catalog: Candidate[] = [
  { key: 'leetcode:two-sum', title: 'Two Sum', url: 'https://leetcode.com/problems/two-sum/', tags: ['array', 'hash-table'], level: 'starter' },
  { key: 'leetcode:valid-parentheses', title: 'Valid Parentheses', url: 'https://leetcode.com/problems/valid-parentheses/', tags: ['stack', 'string'], level: 'starter' },
  { key: 'leetcode:binary-search', title: 'Binary Search', url: 'https://leetcode.com/problems/binary-search/', tags: ['binary-search', 'array'], level: 'starter' },
  { key: 'leetcode:3sum', title: '3Sum', url: 'https://leetcode.com/problems/3sum/', tags: ['two-pointers', 'sorting'], level: 'intermediate' },
  { key: 'leetcode:subarray-sum-equals-k', title: 'Subarray Sum Equals K', url: 'https://leetcode.com/problems/subarray-sum-equals-k/', tags: ['prefix-sum', 'hash-table'], level: 'intermediate' },
  { key: 'leetcode:validate-binary-search-tree', title: 'Validate Binary Search Tree', url: 'https://leetcode.com/problems/validate-binary-search-tree/', tags: ['tree', 'recursion'], level: 'intermediate' },
  { key: 'leetcode:binary-tree-level-order-traversal', title: 'Binary Tree Level Order Traversal', url: 'https://leetcode.com/problems/binary-tree-level-order-traversal/', tags: ['tree', 'bfs'], level: 'intermediate' },
  { key: 'leetcode:number-of-islands', title: 'Number of Islands', url: 'https://leetcode.com/problems/number-of-islands/', tags: ['graph', 'dfs', 'bfs'], level: 'intermediate' },
  { key: 'leetcode:house-robber', title: 'House Robber', url: 'https://leetcode.com/problems/house-robber/', tags: ['dynamic-programming'], level: 'intermediate' },
  { key: 'leetcode:sliding-window-maximum', title: 'Sliding Window Maximum', url: 'https://leetcode.com/problems/sliding-window-maximum/', tags: ['sliding-window', 'deque'], level: 'stretch' },
  { key: 'codeforces:279/B', title: 'Books', url: 'https://codeforces.com/problemset/problem/279/B', tags: ['two-pointers', 'sliding-window'], level: 'intermediate' },
  { key: 'codeforces:474/B', title: 'Worms', url: 'https://codeforces.com/problemset/problem/474/B', tags: ['binary-search', 'prefix-sum'], level: 'starter' },
  { key: 'codeforces:580/A', title: 'Kefa and First Steps', url: 'https://codeforces.com/problemset/problem/580/A', tags: ['array', 'implementation'], level: 'starter' },
  { key: 'codeforces:706/B', title: 'Interesting drink', url: 'https://codeforces.com/problemset/problem/706/B', tags: ['binary-search', 'sorting'], level: 'intermediate' },
  { key: 'codeforces:455/A', title: 'Boredom', url: 'https://codeforces.com/problemset/problem/455/A', tags: ['dynamic-programming'], level: 'stretch' },
  { key: 'codeforces:1520/D', title: 'Same Differences', url: 'https://codeforces.com/problemset/problem/1520/D', tags: ['hash-table', 'math'], level: 'intermediate' },
];

export interface TopicEvidence {
  topic: string;
  problemsAttempted: number;
  problemsAccepted: number;
  submissionAttempts: number;
  likelyNeedsReview: boolean;
}
export function topicEvidence(state: LearningState): TopicEvidence[] {
  const map = new Map<string, TopicEvidence>();
  for (const p of Object.values(state.problems)) {
    for (const tag of p.tags) {
      const key = tag.toLowerCase().trim();
      if (!key) continue;
      const row = map.get(key) ?? { topic: key, problemsAttempted: 0, problemsAccepted: 0, submissionAttempts: 0, likelyNeedsReview: false };
      row.problemsAttempted += 1;
      row.problemsAccepted += p.accepted ? 1 : 0;
      row.submissionAttempts += p.submissions;
      map.set(key, row);
    }
  }
  return [...map.values()].map((t) => ({
    ...t,
    likelyNeedsReview: t.problemsAttempted > t.problemsAccepted || t.submissionAttempts > t.problemsAccepted * 2,
  })).sort((a,b) => Number(b.likelyNeedsReview) - Number(a.likelyNeedsReview) || b.submissionAttempts - a.submissionAttempts);
}

export interface SuggestedProblem extends Candidate {
  reason: string;
  evidence: 'partial_submission_history';
  status: 'not_observed_solved';
}
export function suggestPractice(state: LearningState, count = 4): SuggestedProblem[] {
  const limited = Math.max(1, Math.min(5, count));
  const knownTopics = topicEvidence(state);
  const weak = new Set(knownTopics.filter((t) => t.likelyNeedsReview).map((t) => t.topic));
  const anySubmission = Object.keys(state.problems).length > 0;
  const excluded = new Set(Object.entries(state.problems).filter(([, p]) => p.accepted).map(([k]) => k));
  for (const r of Object.values(state.recommendations)) {
    if (r.status === 'skipped' || r.status === 'completed' || r.status === 'started') excluded.add(r.problemKey);
  }
  const scored = catalog.filter((p) => !excluded.has(p.key)).map((p) => {
    const overlap = p.tags.filter((tag) => weak.has(tag));
    const score = overlap.length * 10 + (p.level === 'intermediate' ? 2 : p.level === 'starter' ? 1 : 0);
    const reason = overlap.length
      ? 'Review signal in: ' + overlap.join(', ') + '. Based on observed attempts, not a verified measure of understanding.'
      : anySubmission ? 'Diversify practice; no direct weakness evidence for these tags.' : 'Starter diagnostic; not personalized yet because submission history is incomplete.';
    return { ...p, reason, evidence: 'partial_submission_history' as const, status: 'not_observed_solved' as const, score };
  });
  scored.sort((a,b) => b.score - a.score || a.key.localeCompare(b.key));
  const chosen: typeof scored = [];
  // Round-robin platforms if both are available, avoiding all recommendations from one site.
  for (const platform of ['leetcode','codeforces']) {
    if (chosen.length >= limited) break;
    const c = scored.find((p) => p.key.startsWith(platform + ':') && !chosen.includes(p));
    if (c) chosen.push(c);
  }
  for (const c of scored) {
    if (chosen.length >= limited) break;
    if (!chosen.includes(c)) chosen.push(c);
  }
  return chosen.map(({ score: _score, ...rest }) => rest);
}

export function createRecommendationEvents(
  items: readonly SuggestedProblem[],
  asOf: string,
  revisionId: string,
): RecommendationEvent[] {
  return items.map((item) => ({
    kind: 'recommendation', id: 'recommendation:' + revisionId + ':' + item.key + ':suggested',
    recommendationId: 'rec:' + revisionId + ':' + item.key,
    problemKey: item.key, revisionId,
    status: 'suggested' as RecommendationStatus, reason: item.reason,
    observedAt: asOf,
  }));
}

export function knownCandidates(): readonly Candidate[] {
  return catalog;
}
