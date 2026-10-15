import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LearningFileStore } from '../../src/learning/durableStore';

const folders: string[] = [];
afterEach(async () => {
  await Promise.all(folders.splice(0).map((p) => rm(p, { recursive: true, force: true })));
});
describe('durable state store', () => {
  it('survives reopening and deduplicates events', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'coding-mcp-'));
    folders.push(folder);
    const file = join(folder, 'private', 'progress.json');
    const store = new LearningFileStore(file);
    const event = { kind: 'submission' as const, id: 'codeforces:1',
      provider: 'codeforces' as const, problemId: '279/B',
      verdict: 'accepted' as const, observedAt: '2026-10-15T12:00:00Z',
      sourceReference: 'https://codeforces.com/contest/279/submission/1', tags: ['two-pointers'] };
    const first = await store.append([event]);
    expect(first.newEvents).toBe(1);
    const second = await new LearningFileStore(file).append([event]);
    expect(second.newEvents).toBe(0);
    expect(second.state.problems['codeforces:279/B'].submissions).toBe(1);
  });
  it('serializes simultaneous append calls', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'coding-mcp-'));
    folders.push(folder);
    const store = new LearningFileStore(join(folder, 'learning.json'));
    const base = { kind: 'submission' as const, provider: 'leetcode' as const,
      problemId: 'two-sum', verdict: 'accepted' as const,
      observedAt: '2026-10-15T12:00:00Z',
      sourceReference: 'https://leetcode.com/problems/two-sum/', tags: [] };
    await Promise.all([
      store.append([{ ...base, id: 'a' }]),
      store.append([{ ...base, id: 'b' }]),
    ]);
    expect((await store.read()).problems['leetcode:two-sum'].submissions).toBe(2);
  });
});
