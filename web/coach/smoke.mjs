/** Dependency-free preflight for the standalone coaching UI (Node 22+). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.html'), 'utf8');
assert.ok(html.startsWith('<!DOCTYPE html>'), 'Must contain an HTML document');
assert.match(html, /Content-Security-Policy/, 'Must declare an offline-deny network CSP');
assert.match(html, /connect-src &#39;none&#39;|connect-src 'none'/, 'Must block outbound connections');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length, 1, 'Standalone app must not load remote scripts');
new Script(scripts[0][1], { filename: 'coach-inline-script.js' });
assert.doesNotMatch(scripts[0][1], /\bfetch\s*\(|\bXMLHttpRequest\s*\(|\bWebSocket\s*\(/, 'Offline UI must not send data over network');
for (const id of ['view-overview','view-practice','view-journal','view-connections',
  'checkin-form','checkin-problem','export-button','import-file','practice-list',
  'overview-recs','coach-topic','hint-next','reset-button','toast']) {
  assert.ok(html.includes('id="'+id+'"'), 'Missing essential control: '+id);
}
const catalogBlock = scripts[0][1].split('const CATALOG=')[1]?.split('].map(')[0] ?? '';
assert.equal((catalogBlock.match(/\['(?:leetcode|codeforces):/g)||[]).length,16,'Starter catalog size changed; update claims');
for (const warning of ['not a connected MCP plugin','do not synchronize automatically',
 'No automatic browser sync','self-reported']) {
 assert.ok(html.toLowerCase().includes(warning.toLowerCase()), 'Missing limitation disclosure: '+warning);
}
console.log('Standalone coach static/syntax/security preflight passed. Browser functionality still requires real browser testing.');
