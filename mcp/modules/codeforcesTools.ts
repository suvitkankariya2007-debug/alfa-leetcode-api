import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createToolResult } from '../serverUtils';
import { ToolModule } from '../types';

const HANDLE = z.string().regex(/^[a-zA-Z0-9_.-]{1,40}$/);
const API_BASE = 'https://codeforces.com/api';
const MAX_SUBMISSIONS = 50;
const REQUEST_TIMEOUT_MS = 10000;

type CodeforcesEnvelope = { status: string; result?: unknown; comment?: string };

export async function codeforcesRequest(
  method: 'user.info' | 'user.rating' | 'user.status',
  handle: string,
  count?: number,
): Promise<Record<string, unknown>> {
  if (!HANDLE.safeParse(handle).success) {
    throw new Error('Invalid Codeforces handle');
  }
  if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > MAX_SUBMISSIONS)) {
    throw new Error('Submission count outside permitted range');
  }

  const params = new URLSearchParams(method === 'user.info' ? { handles: handle } : { handle });
  if (method === 'user.status') {
    params.set('from', '1');
    params.set('count', String(count ?? 20));
    // No includeSources: this endpoint uses unauthenticated public data only.
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}/${method}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return { provider: 'codeforces', handle, method, error: 'Upstream HTTP error', status: response.status };
    }
    const envelope = (await response.json()) as CodeforcesEnvelope;
    if (envelope.status !== 'OK' || !Array.isArray(envelope.result)) {
      return { provider: 'codeforces', handle, method, error: 'Upstream API error or invalid response' };
    }
    const result = method === 'user.status'
      ? envelope.result.map((entry) => {
          if (typeof entry !== 'object' || entry === null) return {};
          // Public submission metadata only. Never expose source code inadvertently.
          const { id, creationTimeSeconds, verdict, programmingLanguage, problem, testset, passedTestCount } =
            entry as Record<string, unknown>;
          return { id, creationTimeSeconds, verdict, programmingLanguage, problem, testset, passedTestCount };
        })
      : envelope.result;

    return {
      provider: 'codeforces',
      handle,
      source: `${API_BASE}/${method}`,
      retrieved_at: new Date().toISOString(),
      classification: 'public_profile_metadata_untrusted',
      evidence: method === 'user.status' ? 'submission_metadata_not_source_code' : 'public_api',
      result,
    };
  } catch {
    return { provider: 'codeforces', handle, method, error: 'Upstream request failed or timed out' };
  } finally {
    clearTimeout(timeout);
  }
}

export class CodeforcesToolsModule implements ToolModule {
  register(server: McpServer): void {
    server.registerTool(
      'codeforces_user_info',
      {
        title: 'Codeforces Public Profile',
        description: 'Read-only Codeforces profile information with source and freshness metadata',
        inputSchema: { handle: HANDLE },
      },
      async ({ handle }) => createToolResult(await codeforcesRequest('user.info', handle)),
    );
    server.registerTool(
      'codeforces_rating_history',
      {
        title: 'Codeforces Rating History',
        description: 'Read-only rated contest history; does not estimate unobserved performance',
        inputSchema: { handle: HANDLE },
      },
      async ({ handle }) => createToolResult(await codeforcesRequest('user.rating', handle)),
    );
    server.registerTool(
      'codeforces_recent_submissions',
      {
        title: 'Codeforces Public Submissions',
        description: 'Returns public submission metadata only, not solution source or algorithm approach',
        inputSchema: {
          handle: HANDLE,
          count: z.number().int().min(1).max(MAX_SUBMISSIONS).optional(),
        },
      },
      async ({ handle, count }) => createToolResult(await codeforcesRequest('user.status', handle, count)),
    );
  }
}
