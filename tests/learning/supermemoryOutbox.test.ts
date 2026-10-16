import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SupermemoryV5Client } from '../../src/learning/supermemoryV5';
import { SupermemoryOutbox, reflectionSummary } from '../../src/learning/supermemoryOutbox';
import type { IntuitionReflection } from '../../src/learning/intuitionReflections';

const secret = 'mock-only-secret-never-commit-real-keys';
const goodResponse = () => ({ ok: true, status: 200, text: async () =>
  JSON.stringify({ id: 'accepted-doc', status: 'queued' }) }) as Response;

describe('Supermemory durable outbound sync', () => {
  it('queues reflections offline then retries successfully after restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'coding-memory-test-'));
    try {
      const filename = join(directory, 'outbox.json');
      const unavailableFetch = vi.fn();
      const offline = new SupermemoryOutbox(
        new SupermemoryV5Client({ apiKey: '', namespace: 'leetcode', fetchImpl: unavailableFetch }),
        filename,
      );
      const reflection: IntuitionReflection = {
        id: 'aaa-bbb', topic: 'two-pointers', problemKey: 'leetcode:3sum',
        hintNeed: 'nudge', explainedInvariant: true,
        triedCounterexample: false, transferredToNewProblem: false,
        confidence: 'medium', recordedAt: '2026-10-15T10:00:00Z',
        evidenceKind: 'self_reported_reflection',
      };
      const summary = reflectionSummary(reflection);
      expect(summary.content).not.toContain('sourceCode');
      expect(await offline.enqueue(summary.id, summary.content)).toBe(true);
      expect(await offline.enqueue(summary.id, summary.content)).toBe(false);
      const notConfigured = await offline.flush();
      expect(notConfigured.reason).toBe('not_configured');
      expect(notConfigured.pending).toBe(1);
      expect(unavailableFetch).not.toHaveBeenCalled();

      const fake = vi.fn(async () => goodResponse());
      const online = new SupermemoryOutbox(
        new SupermemoryV5Client({ apiKey: secret, namespace: 'leetcode', fetchImpl: fake }),
        filename,
      );
      expect((await online.status()).pending).toBe(1);
      const flushed = await online.flush();
      expect(flushed.sent).toBe(1);
      expect(flushed.pending).toBe(0);
      expect((await online.flush()).sent).toBe(0);
      expect(fake).toHaveBeenCalledTimes(1);
      expect((await online.status()).lastSentAt).toBeTruthy();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('retains queued insights when API responds forbidden, and never leaks keys', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'coding-memory-error-'));
    try {
      const filename = join(directory, 'outbox.json');
      const fake = vi.fn(async () => ({
        ok: false, status: 403, text: async () => 'Access denied'
      }) as Response);
      const store = new SupermemoryOutbox(
        new SupermemoryV5Client({ apiKey: secret, namespace: 'leetcode', fetchImpl: fake }),
        filename,
      );
      await store.enqueue('checkpoint_1','This person prefers small, incremental hints.');
      const result = await store.flush();
      expect(result.reason).toBe('unauthorized');
      expect(result.sent).toBe(0);
      expect((await store.status()).pending).toBe(1);
      expect(JSON.stringify(await store.status())).not.toContain(secret);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
