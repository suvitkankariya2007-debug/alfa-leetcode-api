import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicSolution, validateSolutionPath } from '../../mcp/sourceEvidence';

afterEach(() => vi.unstubAllGlobals());
describe('public code evidence boundary', () => {
  it('rejects path traversal and unsupported filenames', () => {
    expect(validateSolutionPath('0015-3sum/0015-3sum.cpp')).toBe(true);
    expect(validateSolutionPath('../.env')).toBe(false);
    expect(validateSolutionPath('x/../../secrets.cpp')).toBe(false);
    expect(validateSolutionPath('README.md')).toBe(false);
  });
  it('fetches only a fixed GitHub repository and provides provenance', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true, json: async () => ({ type: 'file', encoding: 'base64',
        content: Buffer.from('int main() { return 0; }').toString('base64'),
        sha: 'abc123', size: 25 }),
    }));
    vi.stubGlobal('fetch', fetcher);
    const r = await fetchPublicSolution('owner','leetcode-solutions','main','some/answer.cpp');
    expect(r.code).toContain('main');
    expect(r.gitBlobSha).toBe('abc123');
    expect(r.untrusted).toBe(true);
    expect(String(fetcher.mock.calls[0][0])).toContain('api.github.com/repos/owner/leetcode-solutions/contents/some/answer.cpp');
  });
});
