import { describe, expect, it } from 'vitest';
import { applyLearningEvents, emptyLearningState, type SubmissionEvent } from '../../src/learning/learningState';
import { getIntuitionDirection } from '../../src/learning/intuitionCoach';

const solvedEvent: SubmissionEvent = {
  kind: 'submission', id: 'lc-101', provider: 'leetcode', problemId: '3sum',
  verdict: 'accepted', observedAt: '2026-10-15T10:00:00.000Z',
  tags: ['two-pointers'], sourceReference: 'https://leetcode.com/problems/3sum/',
};

describe('instant intuition-first guidance', () => {
  it('starts with recognition questions, not code or a complete solution', () => {
    const result = getIntuitionDirection(emptyLearningState(), {
      problemKey: 'leetcode:3sum',
    });
    expect(result.stage).toBe('orientation');
    expect(result.match.topic).toBe('two-pointers');
    expect(result.hints[0]).toMatch(/two positions/);
    expect(result.hints.join(' ')).not.toContain('class Solution');
    expect(result.learningStyle).toBeUndefined();
    expect(result.goal).toBe('build_transferable_problem_solving_intuition');
  });

  it('reveals progressively stronger hints only when requested', () => {
    const light = getIntuitionDirection(emptyLearningState(), { topic: 'binary search' });
    const stronger = getIntuitionDirection(emptyLearningState(), { topic: 'binary search', stage: 'deeper' });
    const trace = getIntuitionDirection(emptyLearningState(), { topic: 'binary search', stage: 'dry-run' });
    expect(light.hints[0]).toContain('monotonic');
    expect(stronger.hints.join(' ')).toContain('invariant');
    expect(trace.hints.join(' ')).toContain('mid');
    expect(light.hints.join(' ')).not.toContain('predicate is true');
  });

  it('does not recommend a known accepted problem again', () => {
    const state = applyLearningEvents(emptyLearningState(), [solvedEvent]);
    const result = getIntuitionDirection(state, { topic: 'two-pointers' });
    expect(result.followUpProblems.some((p) => p.problemKey === 'leetcode:3sum')).toBe(false);
    expect(result.progressEvidence.some((line) => line.includes('accepted'))).toBe(true);
  });

  it('does not invent a solution strategy for an unrecognized question', () => {
    const result = getIntuitionDirection(emptyLearningState(), {
      problemKey: 'leetcode:unseen-problem', topic: 'unknown pattern'
    });
    expect(result.match.basis).toBe('insufficient_information');
    expect(result.match.topic).toBeNull();
    expect(result.followUpProblems).toEqual([]);
    expect(result.hints[0]).toContain('input');
  });

  it('provides a dry-run, debugging prompt and caveats for learning', () => {
    const guidance = getIntuitionDirection(emptyLearningState(), {
      topic: 'recursion', stage: 'debug',
    });
    expect(guidance.hints[0]).toContain('null');
    expect(guidance.learnerAction).toContain('smallest failing input');
    expect(guidance.limitations.join(' ')).toContain('incomplete');
  });
});
