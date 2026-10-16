# PostgreSQL runtime and migration review

**Implemented:** `db/migrations/001_owner_learning.sql`, `src/learning/pgLearningStore.ts`, `src/learning/postgresDriver.ts`, and `scripts/apply-db-migration.mjs`. **No Railway PostgreSQL database has been provisioned or migrated.**

## Principle of least privilege

The application must NOT use Railway's template's default admin database credentials for serving MCP requests. Provision separate roles using approved database administrator tooling:

- `coding_migrator`: owns schema and runs controlled migrations from `MIGRATION_DATABASE_URL`; never used by the web application.
- `coding_runtime`: LOGIN, NOSUPERUSER, NOBYPASSRLS; runtime `DATABASE_URL`; allowed SELECT, INSERT, UPDATE on `coding_learning_snapshot` and `coding_learning_event`. Do not grant DELETE, CREATE, TRUNCATE or schema ownership.
- Apply `001_owner_learning.sql` with the migrator under a transaction. After migration, GRANT USAGE ON SCHEMA public and grant only necessary table privileges to runtime. Owner-specific RLS applies to both tables with `FORCE ROW LEVEL SECURITY`.
- Audit database backups/retention, TLS trust, deployment region, billing and restore procedures before connecting sensitive learner data.

Example administrative SQL is illustrative; replace with verified DB roles and appropriate password-management methods using the provider UI. Do not embed credentials in SQL files or shell history:

```sql
CREATE ROLE coding_runtime LOGIN NOSUPERUSER NOBYPASSRLS;
GRANT CONNECT ON DATABASE railway TO coding_runtime;
GRANT USAGE ON SCHEMA public TO coding_runtime;
GRANT SELECT, INSERT, UPDATE ON
  coding_learning_snapshot, coding_learning_event TO coding_runtime;
```

`coding_runtime` must be different from the owner of those tables. The app checks `pg_roles` at startup and fails if it is a superuser or has `BYPASSRLS`. Use a separate database/role for production versus staging.

## Owner binding

An OAuth resource server verifies a trusted issuer/JWKS RS256 signature, audience, expiry, scopes, and a fixed owner subject. The subject is **not** a LeetCode handle. It must come from the owner's account in the *external identity provider* and be pinned in private runtime settings. The current service is single-owner by design; broad multiuser use requires proper account lifecycle and principal-scoped storage for every journal as well as its database.

## Important limitations

- The PostgreSQL adapter has mocked transaction/isolation tests, **not an actual PostgreSQL integration test**.
- The hosted resource server needs a separate OAuth authorization server and user consent; this repository currently contains only JWT validation, not an issuer.
- Code review and reflection journals remain on a single mounted volume, not in PostgreSQL, and require separate retention/export/privacy controls before production.
- Supermemory is a semantic companion, not authoritative progress database.
- Only run migrations after the PostgreSQL cost and security review has been approved.

No database creation, migration, credential provisioning or production deployment is implied by this document.
