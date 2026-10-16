import { describe, expect, it } from 'vitest';
import {
  applyLearningEvents, emptyLearningState, solvedKeys, activeRecommendations,
  type SubmissionEvent, type RecommendationEvent,
} from '../../src/learning/learningState';

const submission: SubmissionEvent = {
  kind: 'submission', id: 'leetcode:submission:100',
  provider: 'leetcode', problemId: '15', verdict: 'accepted',
  observedAt: '2026-10-15T13:00:00Z', sourceReference: 'leetcode:submission:100',
  tags: ['two-pointers', 'sorting'],
};
const rec: RecommendationEvent = {
  kind: 'recommendation', id: 'recommendation:r1:create',
  recommendationId: 'r1', problemKey: 'codeforces:4A',
  revisionId: 'weekly-1', status: 'suggested', reason: 'practice',
  observedAt: '2026-10-15T13:10:00Z',
};
describe('learning-state incremental projection', () => {
  it('deduplicates previously ingested submission IDs', () => {
    const once = applyLearningEvents(emptyLearningState(), [submission]);
    const twice = applyLearningEvents(once, [submission]);
    expect(twice).toEqual(once);
    expect(twice.problems['leetcode:15'].submissions).toBe(1);
  });
  it('does not conflate providers with the same problem ID', () => {
    const state = applyLearningEvents(emptyLearningState(), [
      submission, { ...submission, id: 'cf:submission:101', provider: 'codeforces' },
    ]);
    expect(solvedKeys(state)).toEqual(['codeforces:15', 'leetcode:15']);
  });
  it('preserves recommendation decisions over subsequent refreshes', () => {
    const initial = applyLearningEvents(emptyLearningState(), [rec]);
    const skipped = applyLearningEvents(initial, [{
      ...rec, id: 'recommendation:r1:skip', status: 'skipped',
      observedAt: '2026-10-16T08:00:00Z',
    }]);
    const refresh = applyLearningEvents(skipped, [rec, submission]);
    expect(refresh.recommendations.r1.status).toBe('skipped');
    expect(activeRecommendations(refresh)).toHaveLength(0);
  });
  it('does not confuse accepted metadata with evidence of an algorithm approach', () => {
    const state = applyLearningEvents(emptyLearningState(), [submission]);
    expect(state.problems['leetcode:15'].accepted).toBe(true);
    expect(JSON.stringify(state)).not.toContain('complexity');
    expect(JSON.stringify(state)).not.toContain('approach');
  });
});
