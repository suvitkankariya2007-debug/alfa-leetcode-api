/**
 * Evidence-based review diagnostics with no LLM dependency.
 * Never infer the actual algorithm from an accepted verdict alone.
 * Data from recent provider windows may be incomplete.
 */
import type { LearningState } from './learningState';

export interface ReviewDiagnostic {
  topic: string;
  observedProblems: number;
  acceptedProblems: number;
  submissions: number;
  extraAttempts: number;
  latestActivityAt: string;
  priority: 'review' | 'reinforce' | 'explore';
  evidence: string[];
  confidence: 'limited' | 'moderate';
  suggestedAction: string;
}
const normalize = (value: string) => value.toLowerCase().trim().replace(/\s+/g, '-');
export function diagnoseTopics(state: LearningState, asOf = new Date().toISOString()): ReviewDiagnostic[] {
  const current = Date.parse(asOf);
  if (!Number.isFinite(current)) throw new Error('Invalid diagnostic timestamp');
  const grouped = new Map<string, {
    problems: Set<string>; accepted: Set<string>; attempts: number; latest: string; references: Set<string>;
  }>();
  for (const [problemKey, item] of Object.entries(state.problems)) {
    for (const rawTag of item.tags) {
      const topic = normalize(rawTag);
      if (!topic || topic.length > 80) continue;
      const g = grouped.get(topic) ?? {
        problems: new Set<string>(), accepted: new Set<string>(), attempts: 0,
        latest: item.latestSubmissionAt, references: new Set<string>(),
      };
      g.problems.add(problemKey);
      if (item.accepted) g.accepted.add(problemKey);
      g.attempts += item.submissions;
      if (item.latestSubmissionAt > g.latest) g.latest = item.latestSubmissionAt;
      for (const ref of item.sourceReferences.slice(-3)) g.references.add(ref);
      grouped.set(topic, g);
    }
  }
  return [...grouped.entries()].map(([topic, g]): ReviewDiagnostic => {
    const observedProblems = g.problems.size;
    const acceptedProblems = g.accepted.size;
    const extraAttempts = Math.max(0, g.attempts - observedProblems);
    const gap = observedProblems - acceptedProblems;
    const elapsedDays = (current - Date.parse(g.latest)) / 86400000;
    // 'Review' means evidence of struggling in a tag, not proven conceptual weakness.
    const priority: ReviewDiagnostic['priority'] =
      gap > 0 || extraAttempts >= 2 ? 'review'
      : elapsedDays >= 14 && acceptedProblems > 0 ? 'reinforce' : 'explore';
    const evidence = [
      `${observedProblems} distinct problems with this public tag were observed`,
      `${acceptedProblems} observed problems have an accepted result`,
      `${g.attempts} submission events; ${extraAttempts} additional attempts beyond one per observed problem`,
    ];
    if (elapsedDays >= 14) evidence.push('Most recent observed activity is at least 14 days old');
    return {
      topic, observedProblems, acceptedProblems, submissions: g.attempts,
      extraAttempts, latestActivityAt: g.latest, priority, evidence,
      confidence: observedProblems >= 4 ? 'moderate' : 'limited',
      suggestedAction: priority === 'review'
        ? 'Try one fresh diagnostic problem; explain your reasoning, then review a solution version if available.'
        : priority === 'reinforce'
          ? 'Revisit one previously solved pattern without consulting the old solution.'
          : 'Continue practicing varied problems; not enough evidence to call this a weakness.',
    };
  }).sort((a, b) => {
    const rank = { review: 0, reinforce: 1, explore: 2 };
    return rank[a.priority] - rank[b.priority] || b.extraAttempts - a.extraAttempts ||
      a.topic.localeCompare(b.topic);
  });
}
