/**
 * Single-owner durable outbound sync queue for Supermemory v5.
 * Checkpoint records survive provider outages and process restarts.
 * Only allowlisted, compact coaching insights are stored. NOT a multiuser DB.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { type IntuitionReflection } from './intuitionReflections';
import { type MemoryResult, SupermemoryV5Client } from './supermemoryV5';

interface PendingSummary {
  id: string;
  content: string;
  createdAt: string;
}
interface Outbox {
  pending: PendingSummary[];
  lastSentAt: string | null;
  lastError: string | null;
}
const EMPTY = (): Outbox => ({ pending: [], lastSentAt: null, lastError: null });
const MAX_PENDING = 250;
const MAX_FILE_BYTES = 500000;

function validId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,100}$/.test(id);
}
function validateOutbox(input: unknown): Outbox {
  if (!input || typeof input !== 'object') throw new Error('Invalid memory outbox');
  const data = input as Partial<Outbox>;
  if (!Array.isArray(data.pending) || data.pending.length > MAX_PENDING ||
      !(typeof data.lastSentAt === 'string' || data.lastSentAt === null) ||
      !(typeof data.lastError === 'string' || data.lastError === null)) {
    throw new Error('Invalid memory outbox');
  }
  for (const item of data.pending) {
    if (!item || !validId(item.id) || !item.content ||
      item.content.length > 1600 || typeof item.createdAt !== 'string') {
      throw new Error('Invalid memory outbox item');
    }
  }
  return data as Outbox;
}
export function reflectionSummary(reflection: IntuitionReflection): { id: string; content: string } {
  return {
    id: 'intuition-' + reflection.id.replace(/-/g, ''),
    content: [
      'Coding coach learning reflection (self-reported, not verified mastery).',
      'Topic: ' + reflection.topic,
      reflection.problemKey ? 'Problem: ' + reflection.problemKey : '',
      'Hint level needed: ' + reflection.hintNeed,
      'Could explain invariant: ' + String(reflection.explainedInvariant),
      'Tried a counterexample: ' + String(reflection.triedCounterexample),
      'Transferred idea to a new problem: ' + String(reflection.transferredToNewProblem),
      'Self-reported confidence: ' + reflection.confidence,
      'Recorded (UTC): ' + reflection.recordedAt,
      'Do not infer source-code technique or correctness from this reflection.',
    ].filter(Boolean).join('\n'),
  };
}
export interface FlushResult {
  configured: boolean;
  sent: number;
  pending: number;
  reason: 'ok' | 'not_configured' | 'unauthorized' | 'unavailable' | 'invalid_response';
  lastSentAt: string | null;
}
export class SupermemoryOutbox {
  private queue: Promise<void> = Promise.resolve();
  constructor(
    private readonly client: SupermemoryV5Client,
    private readonly file: string,
  ) {}

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.queue.then(operation);
    this.queue = task.then(() => undefined, () => undefined);
    return task;
  }

  private async load(): Promise<Outbox> {
    let content: string;
    try { content = await readFile(this.file, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY();
      throw error;
    }
    if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error('Memory outbox too large');
    return validateOutbox(JSON.parse(content));
  }

  private async save(data: Outbox): Promise<void> {
    const raw = JSON.stringify(data);
    if (Buffer.byteLength(raw) > MAX_FILE_BYTES) throw new Error('Memory outbox too large');
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    const temp = this.file + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(temp, raw, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      await rename(temp, this.file);
    } finally {
      await unlink(temp).catch(() => undefined);
    }
  }

  async enqueue(id: string, content: string): Promise<boolean> {
    if (!validId(id) || !content || content.length > 1600) throw new Error('Invalid memory summary');
    return this.serialized(async () => {
      const outbox = await this.load();
      if (outbox.pending.some((item) => item.id === id)) return false;
      if (outbox.pending.length >= MAX_PENDING) throw new Error('Memory outbox capacity reached');
      outbox.pending.push({ id, content, createdAt: new Date().toISOString() });
      await this.save(outbox);
      return true;
    });
  }

  async flush(limit = 4): Promise<FlushResult> {
    return this.serialized(async () => {
      const state = await this.load();
      if (!this.client.isConfigured) {
        return { configured: false, sent: 0, pending: state.pending.length,
          reason: 'not_configured' as const, lastSentAt: state.lastSentAt };
      }
      let sent = 0;
      let reason: FlushResult['reason'] = 'ok';
      for (const item of [...state.pending].slice(0, Math.max(1, Math.min(10, limit)))) {
        const response: MemoryResult<{id:string;status:string}> =
          await this.client.addSummary(item.id, item.content);
        if (!response.ok) {
          reason = response.reason;
          state.lastError = response.reason;
          await this.save(state);
          break;
        }
        state.pending = state.pending.filter((candidate) => candidate.id !== item.id);
        state.lastSentAt = new Date().toISOString();
        state.lastError = null;
        sent++;
        await this.save(state);
      }
      return { configured: true, sent, pending: state.pending.length, reason, lastSentAt: state.lastSentAt };
    });
  }

  async status(): Promise<{ configured: boolean; pending: number; lastSentAt: string | null; lastError: string | null; namespace: string }> {
    const data = await this.serialized(() => this.load());
    return {
      configured: this.client.isConfigured,
      pending: data.pending.length,
      lastSentAt: data.lastSentAt,
      lastError: data.lastError,
      namespace: this.client.namespace,
    };
  }
}
