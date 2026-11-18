/**
 * The observed LEGACY store generation (`session` / `message` / `part`),
 * recorded from DM-10 / Appendix C (GH-335).
 *
 * The legacy tables carry the same readable facts under their own names. The
 * legacy `message` row has no `type` column and the legacy `part` row has no
 * `tool` column, so tool counts are absent with a warning rather than invented.
 */

export const LEGACY_SESSION_DDL = `CREATE TABLE session (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  version TEXT,
  agent TEXT,
  model TEXT,
  cost REAL DEFAULT 0 NOT NULL,
  tokens_input INTEGER DEFAULT 0 NOT NULL,
  tokens_output INTEGER DEFAULT 0 NOT NULL,
  tokens_reasoning INTEGER DEFAULT 0 NOT NULL,
  tokens_cache_read INTEGER DEFAULT 0 NOT NULL,
  tokens_cache_write INTEGER DEFAULT 0 NOT NULL,
  time_created INTEGER,
  time_updated INTEGER
);
CREATE INDEX legacy_session_parent ON session(parent_id);`;

export const LEGACY_MESSAGE_DDL = `CREATE TABLE message (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX legacy_message_session ON message(session_id, time_created);`;

export const LEGACY_PART_DDL = `CREATE TABLE part (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX legacy_part_session ON part(session_id);`;

export const LEGACY_TABLES = ["session", "message", "part"] as const;
