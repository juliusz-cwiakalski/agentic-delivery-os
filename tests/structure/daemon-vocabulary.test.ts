/**
 * TC-VOCAB-002 / TC-VOCAB-007 — the daemon error family is exactly eight rows,
 * projects through the delivered taxonomy, and leaves the collector-id set alone.
 */
import { describe, expect, test } from "bun:test";
import { classifyThrown } from "../../packages/cli/src/classify";
import {
  BOARD_COLLECTOR_IDS,
  DAEMON_DEGRADATION_MARKERS,
  DAEMON_INSTANCE_OPERATIONS,
  DAEMON_LANE_CLASSIFICATIONS,
  DAEMON_LANE_STATES,
  DAEMON_PREEMPTION_STATES,
  DAEMON_SUPERVISOR_KINDS,
  DOMAIN_KINDS,
  ERROR_TABLE,
} from "../../packages/core/src/contracts/index";

const DAEMON_ROWS = [
  ["daemon.already-running", "user", false, "user-validation"],
  ["daemon.takeover-refused", "transient", true, "user-validation"],
  ["daemon.heartbeat-stale", "platform", true, "platform-provider"],
  ["daemon.state-recovery-failed", "platform", true, "platform-provider"],
  ["daemon.protocol.unsupported", "user", false, "user-validation"],
  ["daemon.socket-unreachable", "platform", true, "platform-provider"],
  ["daemon.subscriber-degraded", "transient", true, "platform-provider"],
  ["daemon.supervisor-unsupported", "platform", false, "platform-provider"],
] as const;

describe("GH-238 daemon error family", () => {
  test("the daemon kind carries exactly the eight declared rows", () => {
    expect(DOMAIN_KINDS).toContain("daemon");
    const rows = ERROR_TABLE.filter((entry) => entry.domainKind === "daemon");
    expect(rows).toHaveLength(8);
    expect(rows.map((entry) => entry.code).sort()).toEqual(DAEMON_ROWS.map((row) => row[0]).sort());
  });

  test("every row keeps the declared category, retryability, and projection", () => {
    for (const [code, category, retryable, projection] of DAEMON_ROWS) {
      const row = ERROR_TABLE.find((entry) => entry.code === code);
      expect(row).toBeDefined();
      expect(row?.category).toBe(category);
      expect(row?.retryable).toBe(retryable);
      expect(row?.projectionClass).toBe(projection);
      expect(row?.consequence).toBe("not_landed");
      const classified = classifyThrown({ kind: "daemon", code });
      expect(classified.code).toBe(code);
      expect(classified.projectionClass).toBe(projection);
    }
  });

  test("the collector-id set is unchanged", () => {
    expect(BOARD_COLLECTOR_IDS).toEqual(["tracker", "lanes"]);
  });

  test("the closed daemon sets are exactly declared and closed", () => {
    expect(DAEMON_INSTANCE_OPERATIONS).toEqual([
      "acquired",
      "taken-over",
      "released",
      "immediate-stop",
    ]);
    expect(DAEMON_LANE_STATES).toEqual([
      "delivering",
      "detached",
      "completed",
      "failed",
      "preempted",
    ]);
    expect(DAEMON_LANE_CLASSIFICATIONS).toEqual(["alive", "interrupted", "crashed"]);
    expect(DAEMON_PREEMPTION_STATES).toEqual(["pending", "applied", "withdrawn"]);
    expect(DAEMON_SUPERVISOR_KINDS).toEqual(["systemd-user", "launchd", "windows-service"]);
    expect(DAEMON_DEGRADATION_MARKERS).toContain("daemon-unreachable");
  });
});
