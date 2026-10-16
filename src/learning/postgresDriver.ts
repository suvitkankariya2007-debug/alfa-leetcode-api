/**
 * Optional runtime PostgreSQL driver. Load only when DATABASE_URL is set.
 * The package 'pg' must be present in a reproducible npm lockfile before deploy.
 */
import type { SqlPool } from './pgLearningStore';
export interface RunningPgPool extends SqlPool { end(): Promise<void> }
export function createRuntimePgPool(connectionString: string): RunningPgPool {
  if (!connectionString || connectionString.length > 2000 ||
      !/^postgres(ql)?:\/\//i.test(connectionString)) {
    throw new Error('Invalid PostgreSQL connection configuration');
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require('pg') as { Pool: new (options: Record<string, unknown>) => RunningPgPool };
  return new Pool({
    connectionString, max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 12000,
    application_name: 'coding-intuition-mcp',
  });
}

/**
 * Reject connections as an admin/superuser/BYPASSRLS role.
 * The schema forces RLS; the runtime must use a restricted role.
 */
export async function assertRestrictedPgRole(pool: SqlPool): Promise<void> {
  const connection = await pool.connect();
  try {
    const role = await connection.query<{ rolsuper:boolean; rolbypassrls:boolean }>(
      'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user'
    );
    if (role.rows.length !== 1 || role.rows[0].rolsuper || role.rows[0].rolbypassrls) {
      throw new Error('Application PostgreSQL role must not be superuser or BYPASSRLS');
    }
  } finally { connection.release(); }
}
