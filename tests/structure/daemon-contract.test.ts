/**
 * TC-VOCAB-001 / TC-VOCAB-006 / TC-VOCAB-007 / TC-CONFIG-001 (contract half) —
 * the seven daemon record kinds, their schemas and keys, the closed sets, the
 * bounds, and the additive daemon/poll configuration branches are declared once.
 */
import { describe, expect, test } from "bun:test";
import {
  COMMAND_RECEIPT_KEY_PREFIX,
  COMMAND_RECEIPT_PAYLOAD_SCHEMA,
  COMMAND_RECEIPT_RECORD_KIND,
  DAEMON_HEARTBEAT_PAYLOAD_SCHEMA,
  DAEMON_HEARTBEAT_RECORD_KEY,
  DAEMON_HEARTBEAT_RECORD_KIND,
  DAEMON_INSTANCE_PAYLOAD_SCHEMA,
  DAEMON_INSTANCE_RECORD_KEY,
  DAEMON_INSTANCE_RECORD_KIND,
  DAEMON_LANE_KEY_PREFIX,
  DAEMON_LANE_PAYLOAD_SCHEMA,
  DAEMON_LANE_RECORD_KIND,
  DAEMON_LANE_STATES,
  DAEMON_MAX_FRAME_BYTES,
  DAEMON_MAX_HUMAN_BYTES,
  DAEMON_MAX_HUMAN_LINES,
  DAEMON_MAX_STATUS_BYTES,
  DAEMON_MAX_STATUS_LANES,
  DAEMON_PREEMPTION_KEY_PREFIX,
  DAEMON_PREEMPTION_PAYLOAD_SCHEMA,
  DAEMON_PREEMPTION_RECORD_KIND,
  DAEMON_RECONCILIATION_KEY_PREFIX,
  DAEMON_RECONCILIATION_PAYLOAD_SCHEMA,
  DAEMON_RECONCILIATION_RECORD_KIND,
  DAEMON_SCOPE_DIGEST_LENGTH,
  OUTBOX_EFFECT_KEY_PREFIX,
  OUTBOX_EFFECT_PAYLOAD_SCHEMA,
  OUTBOX_EFFECT_RECORD_KIND,
  QUEUE_LANE_STATES,
  STATE_SCHEMA_VERSION,
} from "../../packages/core/src/contracts/index";
import { PRODUCTION_CATALOG } from "../../packages/core/src/config/index";

const RECORDS = [
  [DAEMON_INSTANCE_RECORD_KIND, DAEMON_INSTANCE_PAYLOAD_SCHEMA, DAEMON_INSTANCE_RECORD_KEY],
  [DAEMON_HEARTBEAT_RECORD_KIND, DAEMON_HEARTBEAT_PAYLOAD_SCHEMA, DAEMON_HEARTBEAT_RECORD_KEY],
  [DAEMON_LANE_RECORD_KIND, DAEMON_LANE_PAYLOAD_SCHEMA, DAEMON_LANE_KEY_PREFIX],
  [
    DAEMON_RECONCILIATION_RECORD_KIND,
    DAEMON_RECONCILIATION_PAYLOAD_SCHEMA,
    DAEMON_RECONCILIATION_KEY_PREFIX,
  ],
  [DAEMON_PREEMPTION_RECORD_KIND, DAEMON_PREEMPTION_PAYLOAD_SCHEMA, DAEMON_PREEMPTION_KEY_PREFIX],
  [COMMAND_RECEIPT_RECORD_KIND, COMMAND_RECEIPT_PAYLOAD_SCHEMA, COMMAND_RECEIPT_KEY_PREFIX],
  [OUTBOX_EFFECT_RECORD_KIND, OUTBOX_EFFECT_PAYLOAD_SCHEMA, OUTBOX_EFFECT_KEY_PREFIX],
] as const;

describe("GH-238 daemon contract declarations", () => {
  test("seven record kinds have distinct schemas and store-scoped keys", () => {
    expect(RECORDS).toHaveLength(7);
    expect(new Set(RECORDS.map((record) => record[0])).size).toBe(7);
    expect(new Set(RECORDS.map((record) => record[1])).size).toBe(7);
    expect(new Set(RECORDS.map((record) => record[2])).size).toBe(7);
    for (const [, schema] of RECORDS) expect(schema.startsWith("delivery.")).toBe(true);
  });

  test("the daemon execution set is a separately declared set, never a redefinition", () => {
    expect(DAEMON_LANE_STATES).not.toEqual(QUEUE_LANE_STATES);
    expect(DAEMON_LANE_STATES).toContain("detached");
    expect(QUEUE_LANE_STATES as readonly string[]).not.toContain("detached");
  });

  test("the store schema version is untouched by the additive kinds", () => {
    expect(STATE_SCHEMA_VERSION).toBe("delivery.state.v1");
  });

  test("the declared bounds match Appendix J", () => {
    expect(DAEMON_MAX_FRAME_BYTES).toBe(65_536);
    expect(DAEMON_MAX_STATUS_LANES).toBe(200);
    expect(DAEMON_MAX_STATUS_BYTES).toBe(65_536);
    expect(DAEMON_MAX_HUMAN_LINES).toBe(40);
    expect(DAEMON_MAX_HUMAN_BYTES).toBe(8_192);
    expect(DAEMON_SCOPE_DIGEST_LENGTH).toBe(16);
  });

  test("the daemon and poll branches are additive production catalog branches", () => {
    expect(Object.keys(PRODUCTION_CATALOG)).toContain("daemon");
    expect(Object.keys(PRODUCTION_CATALOG)).toContain("poll");
    const daemon = PRODUCTION_CATALOG.daemon;
    if (daemon.type !== "object") throw new Error("daemon branch must be an object");
    expect(Object.keys(daemon.fields).sort()).toEqual([
      "frame-max-bytes",
      "heartbeat-cycle",
      "heartbeat-interval",
      "lock-staleness",
      "poll-interval",
      "reconcile-max-lanes",
      "response-timeout",
      "socket-path",
      "subscription-buffer",
      "transport",
      "watch-poll-interval",
    ]);
    expect(PRODUCTION_CATALOG.poll.type).toBe("record");
  });
});

import type { CommitGitPort } from "../../packages/core/src/contracts/index";
type HasLogSince = "logSince" extends keyof CommitGitPort ? true : false;
const logSinceIsDeclared: HasLogSince = true;
void logSinceIsDeclared;
