-- Coding coach migration 001: owner-isolated, append-only evidence and snapshot.
-- Run using a migration role separate from the ordinary application DB role.
-- Application connections MUST be a non-superuser role without BYPASSRLS.
CREATE TABLE IF NOT EXISTS coding_learning_snapshot (
  owner_subject TEXT PRIMARY KEY,
  snapshot JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owner_subject_size CHECK (length(owner_subject) BETWEEN 8 AND 200)
);
CREATE TABLE IF NOT EXISTS coding_learning_event (
  owner_subject TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_subject, event_id),
  FOREIGN KEY (owner_subject) REFERENCES coding_learning_snapshot(owner_subject) ON DELETE CASCADE,
  CONSTRAINT event_id_size CHECK (length(event_id) BETWEEN 1 AND 240)
);
CREATE INDEX IF NOT EXISTS coding_learning_event_time ON coding_learning_event(owner_subject, observed_at DESC);
ALTER TABLE coding_learning_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_learning_snapshot FORCE ROW LEVEL SECURITY;
ALTER TABLE coding_learning_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_learning_event FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS coding_snapshot_owner ON coding_learning_snapshot;
CREATE POLICY coding_snapshot_owner ON coding_learning_snapshot
  USING (owner_subject = current_setting('app.owner_subject', true))
  WITH CHECK (owner_subject = current_setting('app.owner_subject', true));
DROP POLICY IF EXISTS coding_events_owner ON coding_learning_event;
CREATE POLICY coding_events_owner ON coding_learning_event
  USING (owner_subject = current_setting('app.owner_subject', true))
  WITH CHECK (owner_subject = current_setting('app.owner_subject', true));
-- Do NOT GRANT database/table ownership or BYPASSRLS to the API's runtime role.
-- The API role only needs SELECT, INSERT and UPDATE; DELETE is reserved for audited account deletion.
