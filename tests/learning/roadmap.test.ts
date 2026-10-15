import { describe, expect, it } from 'vitest';
import { applyLearningEvents, emptyLearningState } from '../../src/learning/learningState';
import { suggestPractice, topicEvidence, knownCandidates } from '../../src/learning/roadmap';

describe('explainable practice queue', () => {
  it('does not recommend an observed accepted question', () => {
    const state = applyLearningEvents(emptyLearningState(), [{
      kind: 'submission', id: 'lc:1', provider: 'leetcode',
      problemId: 'two-sum', verdict: 'accepted', observedAt: '2026-10-15T00:00:00Z',
      sourceReference: 'https://leetcode.com/problems/two-sum/', tags: ['array'],
    }]);
    const queue = suggestPractice(state, 5);
    expect(queue).toHaveLength(5);
    expect(queue.some((p) => p.key === 'leetcode:two-sum')).toBe(false);
    expect(queue.some((p) => p.key.startsWith('codeforces:'))).toBe(true);
    expect(queue.every((p) => p.status === 'not_observed_solved')).toBe(true);
  });
  it('makes a diagnostic queue when history is absent', () => {
    expect(suggestPractice(emptyLearningState(), 3)).toHaveLength(3);
    expect(suggestPractice(emptyLearningState(), 3)[0].reason).toContain('not personalized');
    expect(topicEvidence(emptyLearningState())).toEqual([]);
    expect(knownCandidates().length).toBeGreaterThan(10);
  });
});
