/**
 * Owner-only review journal: stores review metadata, NOT raw source code.
 * All AI reviews are unverified drafts. A code SHA links review to evidence.
 * A production implementation should use authenticated Postgres and row-level
 * tenant policies rather than a per-process JSON file.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface SolutionReviewDraft {
  problemKey: string;
  sourceUrl: string;
  githubPath: string;
  gitBlobSha: string;
  approach: string;
  timeComplexity: string;
  spaceComplexity: string;
  improvements: string[];
  tags: string[];
  confidence: 'low' | 'medium' | 'high';
}
export interface SavedSolutionReview extends SolutionReviewDraft {
  reviewId: string;
  createdAt: string;
  verification: 'ai_draft_unverified';
}
export class ReviewFileStore {
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly file: string) {}

  async list(): Promise<SavedSolutionReview[]> {
    let raw: string;
    try { raw = await readFile(this.file, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    if (raw.length > 2_000_000) throw new Error('Prototype review journal exceeds maximum size');
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('Review journal has invalid schema');
    return data as SavedSolutionReview[];
  }

  async save(draft: SolutionReviewDraft): Promise<SavedSolutionReview> {
    const work = this.queue.then(async () => {
      if (draft.approach.length > 500 || draft.improvements.length > 5 ||
          draft.tags.length > 8 || draft.improvements.some((x) => x.length > 500)) {
        throw new Error('Review metadata exceeds storage limit');
      }
      const saved: SavedSolutionReview = {
        ...draft, reviewId: randomUUID(),
        createdAt: new Date().toISOString(), verification: 'ai_draft_unverified',
      };
      const records = await this.list();
      records.push(saved);
      if (records.length > 250) throw new Error('Prototype review journal is full');
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
      const temp = this.file + '.' + randomUUID() + '.tmp';
      try {
        await writeFile(temp, JSON.stringify(records), { flag: 'wx', mode: 0o600 });
        await rename(temp, this.file);
      } finally {
        await unlink(temp).catch(() => undefined);
      }
      return saved;
    });
    this.queue = work.then(() => undefined, () => undefined);
    return work;
  }
}
