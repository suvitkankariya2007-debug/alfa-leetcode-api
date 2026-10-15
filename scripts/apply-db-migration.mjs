/**
 * Explicit operator-only migration runner.
 * Never executes on application startup or build. Uses a separate migration
 * credential supplied through an approved secret store. No SQL interpolation.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

const url = process.env.MIGRATION_DATABASE_URL ?? '';
if (!/^postgres(?:ql)?:\/\//.test(url)) {
  console.error('Migration blocked: MIGRATION_DATABASE_URL must be supplied from a protected operator environment.');
  process.exit(1);
}
const { Pool } = pg;
const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5000 });
const connection = await pool.connect();
try {
  const sql = await readFile(resolve('db/migrations/001_owner_learning.sql'), 'utf8');
  await connection.query('BEGIN');
  await connection.query(sql);
  await connection.query('COMMIT');
  console.log('Migration 001 committed successfully.');
} catch {
  await connection.query('ROLLBACK').catch(() => undefined);
  console.error('Migration failed, rolled back; inspect database with authorized operator tools.');
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}
