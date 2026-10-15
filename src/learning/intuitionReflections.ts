/**
 * Small structured intuition-reflection journal for the single-owner prototype.
 * Self-reported learning reflections are NOT verified account statistics.
 * No code, passwords, prompts, or freeform private data are stored here.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type HintNeed = 'none' | 'orientation' | 'nudge' | 'deeper' | 'dry-run' | 'debug';
export type ReportedConfidence = 'low' | 'medium' | 'high';

export interface IntuitionReflectionInput {
  topic: string;
  problemKey?: string;
  hintNeed: HintNeed;
  explainedInvariant: boolean;
  triedCounterexample: boolean;
  transferredToNewProblem: boolean;
  confidence: ReportedConfidence;
}
export interface IntuitionReflection extends IntuitionReflectionInput {
  id: string;
  recordedAt: string;
  evidenceKind: 'self_reported_reflection';
}
const LEVEL: Record<HintNeed, number> = {
  none: 0, orientation: 1, nudge: 2, deeper: 3, 'dry-run': 4, debug: 5,
};
const MAX_ENTRIES = 500;
const MAX_BYTES = 1024 * 1024;

export function summarizeReflections(records: readonly IntuitionReflection[]) {
  const byTopic = new Map<string, IntuitionReflection[]>();
  for (const r of records) {
    const t = r.topic.toLowerCase().trim().replace(/\s+/g, '-');
    if (!t) continue;
    const arr = byTopic.get(t) ?? [];
    arr.push(r);
    byTopic.set(t, arr);
  }
  return Array.from(byTopic.entries()).map(([topic, events]) => {
    const latest = [...events].sort((a,b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, 5);
    return {
      topic,
      recordedCheckins: events.length,
      latestAt: latest[0]?.recordedAt ?? null,
      recentHintNeed: latest.map((item) => item.hintNeed),
      lastHintNeed: latest[0]?.hintNeed ?? null,
      reportedInvariantExplanations: events.filter((x) => x.explainedInvariant).length,
      reportedCounterexampleTests: events.filter((x) => x.triedCounterexample).length,
      reportedTransferExercises: events.filter((x) => x.transferredToNewProblem).length,
      lastReportedConfidence: latest[0]?.confidence ?? null,
      priority: latest[0] && (LEVEL[latest[0].hintNeed] >= 3 || !latest[0].explainedInvariant)
        ? 'guided_revision' : 'independent_transfer',
      caveat: 'Self-reported reflection only; cannot verify mastery or code correctness.',
    };
  }).sort((a,b) => String(b.latestAt).localeCompare(String(a.latestAt)) || a.topic.localeCompare(b.topic));
}

export class IntuitionReflectionFileStore {
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly file: string) {}

  async list(): Promise<IntuitionReflection[]> {
    let raw: string;
    try { raw = await readFile(this.file, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    if (Buffer.byteLength(raw, 'utf8') > MAX_BYTES) throw new Error('Reflection journal exceeds size limit');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Invalid reflection journal structure');
    return parsed as IntuitionReflection[];
  }

  async append(input: IntuitionReflectionInput): Promise<IntuitionReflection> {
    if (!/^[a-zA-Z0-9 _-]{1,60}$/.test(input.topic) ||
      (input.problemKey !== undefined && !/^(leetcode|codeforces):[a-zA-Z0-9/_-]{1,95}$/.test(input.problemKey)) ||
      !(input.hintNeed in LEVEL) ||
      !['low','medium','high'].includes(input.confidence)) {
      throw new Error('Invalid intuition checkpoint');
    }
    const task = this.queue.then(async () => {
      const entries = await this.list();
      if (entries.length >= MAX_ENTRIES) throw new Error('Reflection journal capacity reached');
      const entry: IntuitionReflection = {
        ...input, topic: input.topic.toLowerCase().trim().replace(/\s+/g, '-'),
        id: randomUUID(), recordedAt: new Date().toISOString(),
        evidenceKind: 'self_reported_reflection',
      };
      entries.push(entry);
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
      const tmp = this.file + '.' + randomUUID() + '.tmp';
      try {
        await writeFile(tmp, JSON.stringify(entries), { flag: 'wx', mode: 0o600 });
        await rename(tmp, this.file);
      } finally {
        await unlink(tmp).catch(() => undefined);
      }
      return entry;
    });
    this.queue = task.then(() => undefined, () => undefined);
    return task;
  }
}
