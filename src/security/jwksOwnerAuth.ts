/**
 * Authenticated JWT verifier for a single-owner protected MCP resource.
 * Verifies RS256 signature with issuer-bound JWKS, strict audience/sub/scope,
 * expiration, bounded inputs, HTTPS issuer and same-origin JWKS.
 * No unsigned tokens, no static bearer override, no token introspection fallback.
 *
 * The project still needs an independent OAuth authorization server for login
 * and consent. This module does NOT mint JWTs or authorize users by username.
 */
import { createPublicKey, verify as verifySignature, type KeyObject } from 'node:crypto';

export type Scope = 'coding:read' | 'coding:write';
export interface TokenClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  nbf?: number;
  iat?: number;
  scope?: string;
  scp?: string | string[];
}
export interface AuthConfig {
  issuer: string;
  audience: string;
  ownerSubject: string;
  jwksUri: string;
  fetchImpl?: typeof fetch;
  clock?: () => number;
}
export class AuthFailure extends Error {
  constructor() { super('Unauthorized'); }
}
function allowedHttps(input: string): URL {
  let parsed: URL;
  try { parsed = new URL(input); } catch { throw new Error('Invalid OAuth endpoint'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
      parsed.hash || parsed.search || !parsed.hostname ||
      parsed.hostname === 'localhost' || parsed.hostname.endsWith('.localhost') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname) || parsed.hostname.includes(':')) {
    throw new Error('OAuth configuration requires public HTTPS host');
  }
  return parsed;
}
function readObject(input: string): Record<string, unknown> {
  if (!/^[A-Za-z0-9_-]{1,12000}$/.test(input)) throw new AuthFailure();
  try {
    const o: unknown = JSON.parse(Buffer.from(input, 'base64url').toString('utf8'));
    if (o && typeof o === 'object' && !Array.isArray(o)) return o as Record<string, unknown>;
  } catch { /* invalid JSON */ }
  throw new AuthFailure();
}
function getScopeSet(payload: Record<string, unknown>): Set<string> {
  const scopes = [
    ...(typeof payload.scope === 'string' ? payload.scope.split(' ') : []),
    ...(typeof payload.scp === 'string' ? payload.scp.split(' ') : []),
    ...(Array.isArray(payload.scp) ? payload.scp.filter((x): x is string => typeof x === 'string') : []),
  ];
  return new Set(scopes.filter((s) => /^[a-zA-Z0-9:._-]{1,80}$/.test(s)));
}
export class JwksOwnerVerifier {
  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => number;
  private cached = new Map<string, KeyObject>();
  private cacheUntil = 0;
  private inFlight: Promise<void> | null = null;
  constructor(private readonly config: AuthConfig) {
    const iss = allowedHttps(config.issuer);
    const jwks = allowedHttps(config.jwksUri);
    if (iss.origin !== jwks.origin || !config.audience ||
        !/^[A-Za-z0-9_-]{8,200}$/.test(config.ownerSubject)) {
      throw new Error('Invalid issuer, JWKS origin, audience or owner binding');
    }
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.clock = config.clock ?? (() => Date.now());
  }
  private async refresh(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const task = (async () => {
      const c = new AbortController();
      const timer = setTimeout(() => c.abort(), 4000);
      try {
        const response = await this.fetchImpl(this.config.jwksUri, {
          headers: { Accept: 'application/json' },
          redirect: 'error', signal: c.signal,
        });
        if (!response.ok) throw new AuthFailure();
        const body = await response.text();
        if (body.length > 20000) throw new AuthFailure();
        const decoded: unknown = JSON.parse(body);
        if (!decoded || typeof decoded !== 'object' || !Array.isArray((decoded as { keys?: unknown }).keys))
          throw new AuthFailure();
        const keys = (decoded as { keys: unknown[] }).keys;
        if (keys.length > 20) throw new AuthFailure();
        const next = new Map<string, KeyObject>();
        for (const entry of keys) {
          if (!entry || typeof entry !== 'object') continue;
          const jwk = entry as Record<string, unknown>;
          if (jwk.kty !== 'RSA' || (jwk.alg && jwk.alg !== 'RS256') ||
            jwk.use && jwk.use !== 'sig' ||
            typeof jwk.kid !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(jwk.kid)) continue;
          try { next.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' } as unknown as Parameters<typeof createPublicKey>[0])); }
          catch { /* invalid key */ }
        }
        if (!next.size) throw new AuthFailure();
        this.cached = next;
        this.cacheUntil = this.clock() + 300_000;
      } catch { throw new AuthFailure(); }
      finally { clearTimeout(timer); }
    })();
    this.inFlight = task.finally(() => { this.inFlight = null; });
    return this.inFlight;
  }
  async verifyBearer(header: string | undefined, required: Scope): Promise<TokenClaims> {
    if (!header || !/^Bearer [A-Za-z0-9_.-]{1,10000}$/.test(header)) throw new AuthFailure();
    const jwt = header.slice(7);
    const pieces = jwt.split('.');
    if (pieces.length !== 3 || pieces.some((p) => !p)) throw new AuthFailure();
    const protectedHeader = readObject(pieces[0]);
    const payload = readObject(pieces[1]);
    if (protectedHeader.alg !== 'RS256' || typeof protectedHeader.kid !== 'string' ||
      protectedHeader.typ && protectedHeader.typ !== 'JWT' && protectedHeader.typ !== 'at+jwt') throw new AuthFailure();
    if (this.clock() >= this.cacheUntil || !this.cached.has(protectedHeader.kid)) await this.refresh();
    const key = this.cached.get(protectedHeader.kid);
    if (!key) throw new AuthFailure();
    const signed = Buffer.from(pieces[0] + '.' + pieces[1], 'ascii');
    const signature = Buffer.from(pieces[2], 'base64url');
    if (!signature.length || !verifySignature('RSA-SHA256', signed, key, signature)) throw new AuthFailure();
    const now = Math.floor(this.clock() / 1000);
    if (payload.iss !== this.config.issuer || payload.sub !== this.config.ownerSubject ||
      !(payload.aud === this.config.audience ||
        Array.isArray(payload.aud) && payload.aud.includes(this.config.audience)) ||
      typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) ||
      payload.exp <= now || payload.exp - now > 86_400 ||
      payload.nbf !== undefined && (typeof payload.nbf !== 'number' || payload.nbf > now + 30) ||
      payload.iat !== undefined && (typeof payload.iat !== 'number' || payload.iat > now + 30) ||
      !getScopeSet(payload).has(required)) throw new AuthFailure();
    return payload as unknown as TokenClaims;
  }
}
