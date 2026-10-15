/**
 * Pure, deterministic learning-state projection.
 * Storage adapters will persist unique events and snapshots. This module never
 * handles secrets, networks, providers, or untrusted tool instructions.
 */
export type Provider = 'leetcode' | 'codeforces';
export type Verdict = 'accepted' | 'rejected' | 'unknown';
export type RecommendationStatus = 'suggested' | 'started' | 'completed' | 'skipped' | 'superseded';

export interface SubmissionEvent {
  kind: 'submission';
  id: string;
  provider: Provider;
  problemId: string;
  verdict: Verdict;
  observedAt: string;
  sourceReference: string;
  tags: string[];
}
export interface RecommendationEvent {
  kind: 'recommendation';
  id: string;
  recommendationId: string;
  problemKey: string;
  revisionId: string;
  status: RecommendationStatus;
  reason: string;
  observedAt: string;
}
export type LearningEvent = SubmissionEvent | RecommendationEvent;

export interface ProblemState {
  provider: Provider;
  problemId: string;
  submissions: number;
  accepted: boolean;
  latestSubmissionAt: string;
  tags: string[];
  sourceReferences: string[];
}
export interface RecommendationState {
  recommendationId: string;
  problemKey: string;
  revisionId: string;
  status: RecommendationStatus;
  reason: string;
  updatedAt: string;
}
export interface LearningState {
  seenEventIds: string[];
  problems: Record<string, ProblemState>;
  recommendations: Record<string, RecommendationState>;
  lastEventAt: string | null;
}
export function emptyLearningState(): LearningState {
  return { seenEventIds: [], problems: {}, recommendations: {}, lastEventAt: null };
}
function validInstant(value: string): boolean {
  return !Number.isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T/.test(value);
}
function keyFor(provider: Provider, problemId: string): string {
  return provider + ':' + problemId;
}
/** Applies only new events. A repeated event ID has no effect. */
export function applyLearningEvents(
  previous: LearningState,
  events: readonly LearningEvent[],
): LearningState {
  const seen = new Set(previous.seenEventIds);
  const next: LearningState = {
    seenEventIds: [...previous.seenEventIds],
    problems: { ...previous.problems },
    recommendations: { ...previous.recommendations },
    lastEventAt: previous.lastEventAt,
  };
  for (const event of events) {
    if (!event.id || seen.has(event.id) || !validInstant(event.observedAt)) continue;
    if (event.kind === 'submission') {
      if (!event.problemId || !event.sourceReference) continue;
      const problemKey = keyFor(event.provider, event.problemId);
      const old = next.problems[problemKey];
      next.problems[problemKey] = {
        provider: event.provider,
        problemId: event.problemId,
        submissions: (old?.submissions ?? 0) + 1,
        accepted: (old?.accepted ?? false) || event.verdict === 'accepted',
        latestSubmissionAt: !old || event.observedAt > old.latestSubmissionAt
          ? event.observedAt : old.latestSubmissionAt,
        tags: [...new Set([...(old?.tags ?? []), ...event.tags.filter((t) => t.length < 80)])],
        sourceReferences: [...new Set([...(old?.sourceReferences ?? []), event.sourceReference])],
      };
    } else {
      if (!event.recommendationId || !event.problemKey || !event.revisionId) continue;
      const old = next.recommendations[event.recommendationId];
      if (!old || event.observedAt >= old.updatedAt) {
        next.recommendations[event.recommendationId] = {
          recommendationId: event.recommendationId,
          problemKey: event.problemKey,
          revisionId: event.revisionId,
          status: event.status,
          reason: event.reason,
          updatedAt: event.observedAt,
        };
      }
    }
    seen.add(event.id);
    next.seenEventIds.push(event.id);
    if (!next.lastEventAt || event.observedAt > next.lastEventAt) {
      next.lastEventAt = event.observedAt;
    }
  }
  return next;
}
export function solvedKeys(state: LearningState): string[] {
  return Object.entries(state.problems)
    .filter(([, p]) => p.accepted)
    .map(([key]) => key)
    .sort();
}
export function activeRecommendations(state: LearningState): RecommendationState[] {
  return Object.values(state.recommendations).filter(
    (r) => r.status === 'suggested' || r.status === 'started',
  );
}
