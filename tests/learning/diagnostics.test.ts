import { describe, expect, it } from 'vitest';
import { applyLearningEvents, emptyLearningState, type SubmissionEvent } from '../../src/learning/learningState';
import { diagnoseTopics } from '../../src/learning/diagnostics';
const sample = (id: string, problemId: string, accepted: boolean, date: string): SubmissionEvent => ({
  kind: 'submission', id, provider: 'codeforces', problemId,
  verdict: accepted ? 'accepted' : 'rejected',
  observedAt: date, sourceReference: 'https://codeforces.com/submission/' + id,
  tags: ['binary search'],
});
describe('evidence-based topic diagnostics', () => {
  it('uses actual recorded attempts, never invented code approaches', () => {
    const state = applyLearningEvents(emptyLearningState(), [
      sample('1','1/A',false,'2026-10-01T10:00:00Z'),
      sample('2','1/A',true,'2026-10-02T10:00:00Z'),
      sample('3','2/B',false,'2026-10-03T10:00:00Z'),
    ]);
    const [signal] = diagnoseTopics(state,'2026-10-15T10:00:00Z');
    expect(signal.topic).toBe('binary-search');
    expect(signal.observedProblems).toBe(2);
    expect(signal.acceptedProblems).toBe(1);
    expect(signal.extraAttempts).toBe(1);
    expect(signal.priority).toBe('review');
    expect(signal.confidence).toBe('limited');
    expect(JSON.stringify(signal)).not.toMatch(/O\(n|two-pointer/);
  });
  it('proposes spaced reinforcement from time since last evidence', () => {
    const state = applyLearningEvents(emptyLearningState(), [
      sample('4','4/C',true,'2026-09-01T10:00:00Z'),
    ]);
    expect(diagnoseTopics(state,'2026-10-15T10:00:00Z')[0].priority).toBe('reinforce');
  });
  it('does not invent weaknesses when tag evidence is absent', () => {
    const state = applyLearningEvents(emptyLearningState(), [
      { ...sample('5','5/D',true,'2026-10-15T10:00:00Z'), tags: [] },
    ]);
    expect(diagnoseTopics(state,'2026-10-15T12:00:00Z')).toEqual([]);
  });
});
