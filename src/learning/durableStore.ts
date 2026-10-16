/**
 * Single-owner prototype storage. Durable across restarts, but NOT a multiuser
 * production database. Upgrade to Postgres with principal-scoped RLS before
 * sharing a hosted server among multiple users.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  applyLearningEvents,
  emptyLearningState,
  type LearningEvent,
  type LearningState,
} from './learningState';

export class LearningFileStore {
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly file: string) {}

  async read(): Promise<LearningState> {
    let raw: string;
    try {
      raw = await readFile(this.file, { encoding: 'utf8' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyLearningState();
      throw error;
    }
    if (raw.length > 5_000_000) {
      throw new Error('Local learning snapshot exceeds prototype size limit');
    }
    const data = JSON.parse(raw) as Partial<LearningState>;
    if (
      !data ||
      !Array.isArray(data.seenEventIds) ||
      typeof data.problems !== 'object' || data.problems === null ||
      typeof data.recommendations !== 'object' || data.recommendations === null ||
      !(data.lastEventAt === null || typeof data.lastEventAt === 'string')
    ) {
      throw new Error('Invalid saved learning snapshot');
    }
    return data as LearningState;
  }

  async append(events: readonly LearningEvent[]): Promise<{ state: LearningState; newEvents: number }> {
    const task = this.queue.then(async () => {
      const old = await this.read();
      const state = applyLearningEvents(old, events);
      const newEvents = state.seenEventIds.length - old.seenEventIds.length;
      if (!newEvents) return { state, newEvents };
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
      const temp = this.file + '.' + randomUUID() + '.tmp';
      try {
        await writeFile(temp, JSON.stringify(state), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        await rename(temp, this.file);
      } finally {
        await unlink(temp).catch(() => undefined);
      }
      return { state, newEvents };
    });
    this.queue = task.then(() => undefined, () => undefined);
    return task;
  }
}
