import { describe, expect, it, vi } from 'vitest';
import { createSign, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { JwksOwnerVerifier, AuthFailure, type AuthConfig } from '../../src/security/jwksOwnerAuth';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const owner = 'owner-subject-123';
const issuer = 'https://identity.example.com';
const audience = 'https://coding.example.com/mcp';
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'testing-2026', alg: 'RS256', use: 'sig' };
const now = Date.parse('2026-10-16T12:00:00Z');
const fake = vi.fn(async () => ({
  ok: true,
  text: async () => JSON.stringify({ keys: [jwk] }),
}) as Response);
const config: AuthConfig = {
  issuer, audience, ownerSubject: owner, jwksUri: issuer + '/.well-known/jwks.json',
  fetchImpl: fake, clock: () => now,
};
function issue(claims: Record<string,unknown> = {}, header: Record<string,unknown> = {}) {
  const head = Buffer.from(JSON.stringify({ alg:'RS256', typ:'JWT',kid:jwk.kid,...header })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss:issuer, aud:audience, sub:owner, exp:Math.floor(now / 1000) + 3600,
    scope:'coding:read coding:write', ...claims,
  })).toString('base64url');
  const sign = createSign('RSA-SHA256');
  sign.update(head + '.' + payload);
  sign.end();
  return 'Bearer ' + head + '.' + payload + '.' + sign.sign(privateKey).toString('base64url');
}
describe('JWKS owner-bound OAuth access', () => {
  it('validates signed owner token and required read/write scopes', async () => {
    const v = new JwksOwnerVerifier(config);
    expect((await v.verifyBearer(issue(), 'coding:read')).sub).toBe(owner);
    expect((await v.verifyBearer(issue(), 'coding:write')).iss).toBe(issuer);
    expect(fake).toHaveBeenCalledTimes(1);
  });
  it('rejects wrong owner, audience, issuer, expiration and insufficient scopes', async () => {
    const v = new JwksOwnerVerifier(config);
    for (const claims of [
      { sub:'another-user-345' }, { aud:'https://other.example.com' },
      { iss:'https://evil.example.com' }, { exp:Math.floor(now / 1000) - 1 },
      { nbf:Math.floor(now / 1000) + 1000 }, { scope:'coding:read' },
    ]) {
      await expect(v.verifyBearer(issue(claims),'coding:write')).rejects.toBeInstanceOf(AuthFailure);
    }
  });
  it('rejects tampering, unsigned, expired key, bad kid and missing bearer', async () => {
    const v = new JwksOwnerVerifier(config);
    const valid = issue();
    await expect(v.verifyBearer(undefined,'coding:read')).rejects.toBeInstanceOf(AuthFailure);
    await expect(v.verifyBearer(valid.replace('Bearer ','Token '),'coding:read')).rejects.toBeInstanceOf(AuthFailure);
    await expect(v.verifyBearer(issue({}, {alg:'none'}),'coding:read')).rejects.toBeInstanceOf(AuthFailure);
    await expect(v.verifyBearer(issue({}, {kid:'unapproved'}),'coding:read')).rejects.toBeInstanceOf(AuthFailure);
    const arr = valid.split('.');
    arr[1] = Buffer.from(JSON.stringify({ sub:'another-user-345',scope:'coding:read' })).toString('base64url');
    await expect(v.verifyBearer(arr.join('.'),'coding:read')).rejects.toBeInstanceOf(AuthFailure);
  });
  it('never permits arbitrary JWKS hosts, HTTP, loopback or wrong namespace', () => {
    for (const override of [
      { issuer:'http://identity.example.com' }, { issuer:'https://localhost' },
      { jwksUri:'https://another.example.com/keys' },
      { jwksUri:'http://identity.example.com/keys' },
      { ownerSubject:'!' },
    ]) expect(() => new JwksOwnerVerifier({...config,...override})).toThrow();
  });
  it('does not follow JWKS redirects or allow unauthenticated requests', async () => {
    const intercepted = vi.fn(async (_url:string, init:RequestInit) => {
      expect(init.redirect).toBe('error');
      return { ok:false, status:302, text: async () => '' } as Response;
    });
    const v = new JwksOwnerVerifier({...config,fetchImpl:intercepted as unknown as typeof fetch});
    await expect(v.verifyBearer(issue(),'coding:read')).rejects.toBeInstanceOf(AuthFailure);
  });
});
