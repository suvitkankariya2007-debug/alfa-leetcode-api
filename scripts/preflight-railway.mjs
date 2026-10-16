/**
 * Deliberately fail closed. This placeholder must NOT be turned into a live
 * Railway MCP service by setting an env flag. Production requires separately
 * implemented and reviewed OAuth, Postgres persistence and HTTPS transport.
 */
const requirements = [
  'Production authenticated remote MCP entrypoint (not loopback prototype)',
  'Tenant-scoped durable PostgreSQL storage with migrations/backups',
  'Supermemory API-key authorization and live namespace round-trip',
  'HTTPS/host and origin checks plus security and compatibility tests',
  'User approval for Railway plan, region, costs and public deployment',
];
console.error('BLOCKED: Coding Intelligence MCP is not yet approved for hosted deployment.');
for (const item of requirements) console.error('- ' + item);
process.exit(1);
