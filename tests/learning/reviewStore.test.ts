import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReviewFileStore } from '../../src/learning/reviewStore';

const folders: string[] = [];
afterEach(async () => {
  await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })));
});

describe('persistent source-aware solution review', () => {
  it('stores metadata across restarts, not raw solution source', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'review-mcp-'));
    folders.push(dir);
    const path = join(dir, 'private', 'reviews.json');
    const store = new ReviewFileStore(path);
    const saved = await store.save({
      problemKey: 'leetcode:3sum',
      githubPath: '0015-3sum/0015-3sum.cpp',
      gitBlobSha: 'a'.repeat(40),
      sourceUrl: 'https://github.com/example/repo/blob/main/0015-3sum/0015-3sum.cpp',
      approach: 'Sorted array, two pointers with a set to deduplicate',
      timeComplexity: 'O(n^2 log n) worst-case estimate',
      spaceComplexity: 'O(output)',
      improvements: ['Skip repeated values directly instead of using a set'],
      tags: ['two-pointers', 'sorting'],
      confidence: 'medium',
    });
    expect(saved.verification).toBe('ai_draft_unverified');
    const savedAgain = await new ReviewFileStore(path).list();
    expect(savedAgain).toHaveLength(1);
    expect(savedAgain[0].gitBlobSha).toBe('a'.repeat(40));
    expect(JSON.stringify(savedAgain)).not.toContain('int main(');
  });
});
