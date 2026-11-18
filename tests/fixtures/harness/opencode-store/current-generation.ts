/**
 * The observed CURRENT store generation (`session_v2` / `session_message`),
 * recorded from DM-10 / Appendix C (GH-335).
 *
 * Column inventory matches the installed harness: the session row carries the
 * version, agent, a structured model object, cost, the five token classes, and
 * the timestamp pair; the message row carries a JSON `data` document with the
 * assistant usage facts and the switch events. There is no work-item column, no
 * separate harness-version column, and no per-message token/agent/model column.
 */

export const CURRENT_SESSION_DDL = `CREATE TABLE session_v2 (
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
CREATE INDEX current_session_parent ON session_v2(parent_id);`;

export const CURRENT_MESSAGE_DDL = `CREATE TABLE session_message (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  seq INTEGER NOT NULL,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX current_message_session ON session_message(session_id, seq);`;

export const CURRENT_PART_DDL = `CREATE TABLE session_part (
  message_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  type TEXT NOT NULL,
  call_id TEXT,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (message_id, ordinal)
);`;

export const CURRENT_TABLES = ["session_v2", "session_message", "session_part"] as const;
