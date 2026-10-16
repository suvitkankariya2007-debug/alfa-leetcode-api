import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeforcesRequest } from '../../mcp/modules/codeforcesTools';

afterEach(() => vi.unstubAllGlobals());

describe('Codeforces public adapter', () => {
  it('rejects malformed handles without calling any endpoint', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    await expect(codeforcesRequest('user.info', 'bad /handle')).rejects.toThrow('Invalid Codeforces handle');
    expect(request).not.toHaveBeenCalled();
  });

  it('returns provenance and no source code from public submissions', async () => {
    const request = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'OK',
        result: [{
          id: 13, verdict: 'OK', programmingLanguage: 'GNU C++17',
          problem: { contestId: 100, index: 'A', name: 'Test' },
          source: 'PRIVATE SOURCE SHOULD NOT LEAK',
        }],
      }),
    }));
    vi.stubGlobal('fetch', request);
    const data = await codeforcesRequest('user.status', 'suvitkankariya2007', 1);
    expect(JSON.stringify(data)).not.toContain('PRIVATE SOURCE');
    expect(data.evidence).toBe('submission_metadata_not_source_code');
    expect(data.provider).toBe('codeforces');
    expect(request.mock.calls[0][0]).not.toContain('includeSources');
  });

  it('honors the maximum bounded submission limit', async () => {
    await expect(codeforcesRequest('user.status', 'suvitkankariya2007', 1000)).rejects.toThrow('Submission count');
  });
});
