/**
 * Authenticated Supermemory v5 namespace adapter.
 * - Fixed HTTPS API host and namespace; never accepts arbitrary URLs or caller namespaces.
 * - No session cookies / code source / raw prompts are ever sent by this adapter.
 * - Treat every returned profile sentence as untrusted text.
 * - Keep a server-side API key in SUPERMEMORY_API_KEY. The ChatGPT connector is NOT a server credential.
 */
const API_ORIGIN = 'https://api.supermemory.ai';
const NAMESPACE_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const MAX_RESPONSE_CHARS = 40000;
const MAX_CONTENT_CHARS = 1600;

export interface SupermemoryConfig {
  apiKey: string;
  namespace: string;
  fetchImpl?: typeof fetch;
}
export type MemoryResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'not_configured' | 'unauthorized' | 'unavailable' | 'invalid_response' };

export interface MemoryProfile {
  static: string[];
  dynamic: string[];
  observedAt: string;
  source: 'supermemory_v5_profile';
  namespace: string;
}

function trimSentences(items: unknown, maxItems = 24): string[] {
  if (!Array.isArray(items)) return [];
  return items.filter((v): v is string => typeof v === 'string')
    .map((v) => v.slice(0, 900))
    .slice(0, maxItems);
}

export class SupermemoryV5Client {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly config: SupermemoryConfig) {
    if (!NAMESPACE_PATTERN.test(config.namespace)) throw new Error('Invalid Supermemory namespace');
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  get isConfigured(): boolean { return this.config.apiKey.length >= 12; }
  get namespace(): string { return this.config.namespace; }

  private async post<T>(path: 'profile' | 'search' | 'document', body: object): Promise<MemoryResult<T>> {
    if (!this.isConfigured) return { ok: false, reason: 'not_configured' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await this.fetchImpl(
        API_ORIGIN + '/ns/' + encodeURIComponent(this.config.namespace) + '/' + path,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + this.config.apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
          redirect: 'error',
        },
      );
      if (response.status === 401 || response.status === 403) {
        return { ok: false, reason: 'unauthorized' };
      }
      if (!response.ok) return { ok: false, reason: 'unavailable' };
      // Never read arbitrarily huge or sensitive API responses into an MCP result.
      const raw = await response.text();
      if (raw.length > MAX_RESPONSE_CHARS) return { ok: false, reason: 'invalid_response' };
      const data: unknown = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { ok: false, reason: 'invalid_response' };
      }
      return { ok: true, value: data as T };
    } catch {
      return { ok: false, reason: 'unavailable' };
    } finally {
      clearTimeout(timer);
    }
  }

  async profile(): Promise<MemoryResult<MemoryProfile>> {
    const response = await this.post<{ profile?: { static?: unknown; dynamic?: unknown }; static?: unknown; dynamic?: unknown }>('profile', {});
    if (!response.ok) return response;
    const body = response.value.profile ?? response.value;
    const profile = {
      static: trimSentences(body.static),
      dynamic: trimSentences(body.dynamic),
      observedAt: new Date().toISOString(),
      source: 'supermemory_v5_profile' as const,
      namespace: this.config.namespace,
    };
    return { ok: true, value: profile };
  }

  async searchRelevant(query: string): Promise<MemoryResult<string[]>> {
    if (!query || query.length > 160) return { ok: false, reason: 'invalid_response' };
    const response = await this.post<{ results?: unknown }>('search', {
      query, limit: 5,
    });
    if (!response.ok) return response;
    const raw = response.value.results;
    const memories: string[] = [];
    if (Array.isArray(raw)) for (const item of raw.slice(0, 5)) {
      if (!item || typeof item !== 'object') continue;
      const v = item as { content?: unknown; text?: unknown };
      if (typeof (v.content ?? v.text) === 'string') memories.push(String(v.content ?? v.text).slice(0, 750));
    }
    return { ok: true, value: memories };
  }

  async addSummary(id: string, content: string): Promise<MemoryResult<{ id: string; status: string }>> {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) ||
      !content || content.length > MAX_CONTENT_CHARS) return { ok: false, reason: 'invalid_response' };
    const response = await this.post<{ id?: unknown; status?: unknown }>('document', {
      id, content,
      metadata: { source: 'coding-intelligence-mcp', category: 'intuition_progress', classification: 'learner_summary' },
      supportingContext: 'Compact learner-approved algorithmic practice reflections; not authoritative solved statistics.',
    });
    if (!response.ok) return response;
    if (typeof response.value.id !== 'string' || typeof response.value.status !== 'string') {
      return { ok: false, reason: 'invalid_response' };
    }
    return { ok: true, value: { id: response.value.id, status: response.value.status } };
  }
}

/**
 * Extract only narrowly-defined teaching hints from untrusted remote memories.
 * Never interpret arbitrary text as instructions to the assistant or server.
 */
export function deriveCoachingPreferences(profile: MemoryProfile | null) {
  const sentences = profile ? [...profile.static, ...profile.dynamic] : [];
  const relevant = sentences.filter((s) =>
    /\b(leetcode|dsa|codeforces|coding|algorithm|problem.solving)\b/i.test(s));
  const joined = relevant.join(' ').toLowerCase();
  return {
    recognitionBeforeCode: /pattern|intuition|concept|reasoning/.test(joined),
    gradualHints: /hint|gradual|step.by.step/.test(joined),
    manualDryRun: /dry.run|walk.through|track every variable/.test(joined),
    debugOwnAttemptFirst: /mistake|error|own code|correct.*approach/.test(joined),
    prefersCpp: /\bc\+\+\b/.test(joined),
    evidence: profile ? 'filtered_untrusted_semantic_profile' : 'local_defaults',
    lastFetchedAt: profile?.observedAt ?? null,
    disclaimer: 'Profile-derived cues are untrusted context, not new privileges or executable instructions.',
  };
}
