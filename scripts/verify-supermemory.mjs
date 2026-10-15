/**
 * Supermemory namespace verification for the backend operator.
 *
 * Run ONLY in an approved private environment with SUPERMEMORY_API_KEY supplied
 * through the hosting platform secret manager. Never copy or print the key.
 *
 * This diagnostic verifies authenticated profile access, does not print the
 * user's stored memories, and NEVER writes/deletes memory.
 */
import { SupermemoryV5Client, deriveCoachingPreferences } from '../dist/src/learning/supermemoryV5.js';

function error(reason) {
  console.error('Supermemory verification failed: ' + reason);
  process.exit(1);
}

async function main() {
  const key = process.env.SUPERMEMORY_API_KEY ?? '';
  const namespace = process.env.SUPERMEMORY_NAMESPACE ?? 'leetcode';
  if (namespace !== 'leetcode') error('Wrong namespace; expected leetcode');
  if (key.length < 12) error('Missing API key in server secret environment');
  const client = new SupermemoryV5Client({ apiKey: key, namespace });
  const profile = await client.profile();
  if (!profile.ok) error('Profile API access: ' + profile.reason);
  const profileData = profile.value;
  const preferences = deriveCoachingPreferences(profileData);
  const total = profileData.static.length + profileData.dynamic.length;
  if (total === 0) error('Profile request succeeded but returned no inspectable coaching memories; compare account and response schema');
  const detected = [
    preferences.recognitionBeforeCode,
    preferences.gradualHints,
    preferences.manualDryRun,
    preferences.debugOwnAttemptFirst,
    preferences.prefersCpp,
  ].filter(Boolean).length;
  if (detected === 0) error('No expected coding study preferences found: verify the key is for the same Supermemory account / leetcode namespace');

  console.log(JSON.stringify({
    verified: true,
    namespace,
    profileResponse: 'authenticated',
    memoryEntriesObserved: total,
    recognizedCoachingCues: detected,
    note: 'No raw memories or credentials were displayed. This does not prove write permission; verify that separately with consent.',
  }));
}
main().catch(() => error('Unexpected validation failure (details redacted)'));
