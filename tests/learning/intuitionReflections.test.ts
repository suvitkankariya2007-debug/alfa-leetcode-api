import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  IntuitionReflectionFileStore, summarizeReflections, type IntuitionReflection,
} from '../../src/learning/intuitionReflections';

describe('intuition reflection journal', () => {
  it('saves compact evidence, survives a restart, and summarizes transfer', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'intuition-test-'));
    try {
      const path = join(folder, 'journal.json');
      const first = new IntuitionReflectionFileStore(path);
      await first.append({
        topic: 'binary search',
        problemKey: 'leetcode:binary-search',
        hintNeed: 'deeper', explainedInvariant: false,
        triedCounterexample: true, transferredToNewProblem: false, confidence: 'low',
      });
      const fresh = new IntuitionReflectionFileStore(path);
      const saved = await fresh.list();
      expect(saved).toHaveLength(1);
      expect(saved[0].topic).toBe('binary-search');
      expect(saved[0].evidenceKind).toBe('self_reported_reflection');
      const summary = summarizeReflections(saved);
      expect(summary[0].priority).toBe('guided_revision');
      expect(summary[0].reportedCounterexampleTests).toBe(1);
      expect(JSON.stringify(saved)).not.toContain('sourceCode');
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
  it('never treats self-reported success as verified algorithmic mastery', () => {
    const entry: IntuitionReflection = {
      id:'r1', topic:'recursion', recordedAt:'2026-10-15T12:00:00Z',
      hintNeed:'none', explainedInvariant:true, triedCounterexample:true,
      transferredToNewProblem:true, confidence:'high', evidenceKind:'self_reported_reflection',
    };
    const [summary] = summarizeReflections([entry]);
    expect(summary.priority).toBe('independent_transfer');
    expect(summary.caveat).toContain('cannot verify mastery');
  });
  it('rejects commands, URLs, and arbitrary code in topic fields', async () => {
    const store = new IntuitionReflectionFileStore('/tmp/never-created-intuition.json');
    await expect(store.append({
      topic: 'binary search; rm -rf /',
      hintNeed:'none', explainedInvariant:false,
      triedCounterexample:false, transferredToNewProblem:false,
      confidence:'low',
    })).rejects.toThrow('Invalid intuition checkpoint');
  });
});
