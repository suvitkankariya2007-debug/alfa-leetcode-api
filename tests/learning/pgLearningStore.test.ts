import { describe, expect, it } from 'vitest';
import { PgLearningStore, type SqlConnection, type SqlPool } from '../../src/learning/pgLearningStore';
import { emptyLearningState, type SubmissionEvent, type LearningState } from '../../src/learning/learningState';

const initial: SubmissionEvent = {
  kind:'submission', id:'codeforces:owner:101',provider:'codeforces',
  problemId:'1/A',verdict:'accepted',observedAt:'2026-10-16T00:00:00Z',
  sourceReference:'https://codeforces.com/contest/1/submission/101',tags:['math'],
};
class FakePool implements SqlPool {
  states = new Map<string,LearningState>();
  seen = new Map<string,Set<string>>();
  queries: {sql:string;values:readonly unknown[]}[] = [];
  releases = 0;
  async connect(): Promise<SqlConnection> {
    let current:string|null=null;
    return {
      query: async (sql,values=[]) => {
        this.queries.push({sql,values});
        if (sql.startsWith('SELECT set_config')) {
          current=String(values[1]);return {rows:[]};
        }
        if (sql.startsWith('INSERT INTO coding_learning_snapshot')) {
          if (!current || values[0]!==current) throw Error('RLS mismatch');
          if (!this.states.has(current)) this.states.set(current,JSON.parse(String(values[1])));
          return {rows:[]};
        }
        if (sql.includes('FROM coding_learning_snapshot')) {
          return {rows:current && this.states.has(current) ? [{snapshot:this.states.get(current)}] : []};
        }
        if (sql.startsWith('INSERT INTO coding_learning_event')) {
          if (!current || values[0]!==current) throw Error('RLS mismatch');
          const key=String(values[1]);const had=this.seen.get(current)??new Set<string>();
          if (had.has(key)) return {rows:[]};
          had.add(key);this.seen.set(current,had);
          return {rows:[{event_id:key}]};
        }
        if (sql.startsWith('UPDATE coding_learning_snapshot')) {
          if (!current || values[0]!==current) throw Error('RLS mismatch');
          this.states.set(current,JSON.parse(String(values[1])));return {rows:[]};
        }
        if (['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rows:[]};
        throw Error('Unexpected SQL command');
      },
      release: () => { this.releases++; },
    } as SqlConnection;
  }
}
describe('tenant-scoped Postgres learning store', () => {
  it('starts empty and records exact event only once across reconnects', async () => {
    const pool=new FakePool();const store=new PgLearningStore(pool,'person_123456');
    expect(await store.read()).toEqual(emptyLearningState());
    expect((await store.append([initial])).newEvents).toBe(1);
    expect((await new PgLearningStore(pool,'person_123456').append([initial])).newEvents).toBe(0);
    const state=await store.read();
    expect(state.problems['codeforces:1/A'].accepted).toBe(true);
    expect(state.problems['codeforces:1/A'].submissions).toBe(1);
    expect(pool.queries.some(q=>q.sql.includes('set_config')&&q.values[1]==='person_123456')).toBe(true);
    expect(pool.releases).toBe(4);
  });
  it('keeps unrelated owner history separate using principal-bound RLS context', async () => {
    const pool=new FakePool();
    const a=new PgLearningStore(pool,'owner_one_123');
    const b=new PgLearningStore(pool,'owner_two_456');
    await a.append([initial]);
    expect((await b.read()).problems).toEqual({});
    expect((await b.append([initial])).newEvents).toBe(1);
    expect((await a.read()).problems['codeforces:1/A'].submissions).toBe(1);
    expect((await b.read()).problems['codeforces:1/A'].submissions).toBe(1);
  });
  it('rejects malformed principals and oversized batches', async () => {
    const pool=new FakePool();
    expect(()=>new PgLearningStore(pool,'; DROP TABLE users;')).toThrow();
    await expect(new PgLearningStore(pool,'person_123456')
      .append(Array.from({length:101},(_,i)=>({...initial,id:'e'+i})))).rejects.toThrow();
    expect(pool.queries).toHaveLength(0);
  });
});
