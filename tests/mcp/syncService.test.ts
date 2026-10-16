import { describe, expect, it } from 'vitest';
import { normalizeCodeforces, normalizeLeetCode } from '../../mcp/syncService';

describe('provider-to-event normalization', () => {
  it('deduplicates LeetCode recent submission fingerprints across refreshes', () => {
    const payload = { submission: [
      { titleSlug: '3sum', timestamp: '1760539200', statusDisplay: 'Accepted', lang: 'cpp' },
    ] };
    const a = normalizeLeetCode(payload, 'suvitk');
    const b = normalizeLeetCode(payload, 'suvitk');
    expect(a[0].id).toBe(b[0].id);
    expect(a[0].problemId).toBe('3sum');
    expect(a[0].verdict).toBe('accepted');
    expect(a[0].tags).toEqual([]);
  });
  it('Codeforces includes stable IDs and public tags but no source code', () => {
    const payload = { result: [{
      id: 42, creationTimeSeconds: 1760539200, verdict: 'OK',
      problem: { contestId: 279, index: 'B', tags: ['two pointers'] },
      source: 'NEVER IMPORT SOURCE',
    }] };
    const events = normalizeCodeforces(payload, 'suvitkankariya2007');
    expect(events[0].problemId).toBe('279/B');
    expect(events[0].sourceReference).toContain('/submission/42');
    expect(JSON.stringify(events)).not.toContain('NEVER IMPORT SOURCE');
  });
  it('bad upstream shapes produce errors instead of clearing state', () => {
    expect(() => normalizeLeetCode({}, 'suvitk')).toThrow();
    expect(() => normalizeCodeforces({ error: 'blocked' }, 'user')).toThrow();
  });
});
