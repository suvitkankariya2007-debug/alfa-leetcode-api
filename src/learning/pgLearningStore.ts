/**
 * PostgreSQL backend using an injected node-postgres-compatible Pool.
 * Query parameters are always bound; per-request owner identity is validated by
 * OAuth before calling this. SET LOCAL + RLS separates owners in every TX.
 *
 * Intentional driver inversion: pass a production pool adapter that can be
 * independently tested, rather than making network/database calls in tests.
 * Provision pg as an explicit runtime dependency before actual deployment.
 */
import { applyLearningEvents, emptyLearningState, type LearningEvent, type LearningState } from './learningState';

export interface SqlQueryResult<Row = Record<string, unknown>> { rows: Row[]; rowCount?: number | null }
export interface SqlConnection {
  query<Row = Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<SqlQueryResult<Row>>;
  release(): void;
}
export interface SqlPool { connect(): Promise<SqlConnection> }
export interface PersistedProgress { state: LearningState; newEvents: number }

function validateSubject(subject: string): void {
  if (!/^[A-Za-z0-9_:.@|-]{8,200}$/.test(subject)) throw new Error('Invalid authenticated principal');
}
function validState(value: unknown): value is LearningState {
  if (!value || typeof value !== 'object') return false;
  const x = value as Partial<LearningState>;
  return Array.isArray(x.seenEventIds) && !!x.problems && typeof x.problems === 'object' &&
    !!x.recommendations && typeof x.recommendations === 'object' &&
    (x.lastEventAt === null || typeof x.lastEventAt === 'string');
}
export class PgLearningStore {
  constructor(private readonly pool: SqlPool, private readonly ownerSubject: string) {
    validateSubject(ownerSubject);
  }
  private async transaction<T>(fn: (c: SqlConnection) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Transaction-local owner ensures RLS does not bleed between pooled requests.
      await client.query('SELECT set_config($1, $2, true)', ['app.owner_subject', this.ownerSubject]);
      const value = await fn(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
  private async lockedState(c: SqlConnection): Promise<LearningState> {
    // First write creates the owner row atomically; UPDATE is guarded by RLS.
    await c.query(
      `INSERT INTO coding_learning_snapshot (owner_subject, snapshot)
       VALUES ($1, $2::jsonb) ON CONFLICT (owner_subject) DO NOTHING`,
      [this.ownerSubject, JSON.stringify(emptyLearningState())],
    );
    const result = await c.query<{ snapshot: unknown }>(
      'SELECT snapshot FROM coding_learning_snapshot WHERE owner_subject=$1 FOR UPDATE',
      [this.ownerSubject],
    );
    if (result.rows.length !== 1 || !validState(result.rows[0].snapshot))
      throw new Error('Invalid stored learning state');
    return result.rows[0].snapshot;
  }
  async read(): Promise<LearningState> {
    return this.transaction(async (c) => {
      const result = await c.query<{ snapshot: unknown }>(
        'SELECT snapshot FROM coding_learning_snapshot WHERE owner_subject=$1',
        [this.ownerSubject],
      );
      if (!result.rows.length) return emptyLearningState();
      if (result.rows.length !== 1 || !validState(result.rows[0].snapshot))
        throw new Error('Invalid stored learning state');
      return result.rows[0].snapshot;
    });
  }
  async append(events: readonly LearningEvent[]): Promise<PersistedProgress> {
    if (events.length > 100) throw new Error('Single sync batch exceeds 100 events');
    return this.transaction(async (c) => {
      const old = await this.lockedState(c);
      const applied: LearningEvent[] = [];
      for (const event of events) {
        if (!event.id || event.id.length > 240 || !/^\d{4}-\d{2}-\d{2}T/.test(event.observedAt))
          continue;
        // Existing events are skipped at DB level, independent of snapshot size.
        const inserted = await c.query(
          `INSERT INTO coding_learning_event(owner_subject,event_id,event,observed_at)
           VALUES ($1,$2,$3::jsonb,$4::timestamptz)
           ON CONFLICT(owner_subject,event_id) DO NOTHING RETURNING event_id`,
          [this.ownerSubject,event.id,JSON.stringify(event),event.observedAt],
        );
        if (inserted.rows.length) applied.push(event);
      }
      const state = applyLearningEvents(old, applied);
      if (applied.length) {
        await c.query(
          `UPDATE coding_learning_snapshot SET snapshot=$2::jsonb,updated_at=now()
           WHERE owner_subject=$1`,
          [this.ownerSubject,JSON.stringify(state)],
        );
      }
      return { state, newEvents: applied.length };
    });
  }
}
