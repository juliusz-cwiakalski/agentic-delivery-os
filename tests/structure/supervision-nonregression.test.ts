/**
 * TC-SUP-053 — the delivered lock, lease, single-flight, and supervise-only
 * composition are unchanged (GH-295 AC-F6-1, NG-6, DEC-3).
 *
 * The case asserts the current tree: the supervise composition is a pure
 * reader/append surface with no lane composition, the delivered constants keep
 * their values, and the delivered suites carry no supervision coupling.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DAEMON_DEFAULT_LOCK_STALENESS_MS,
  DAEMON_START_MODES,
  QUEUE_DEFAULT_LEASE_TTL_MS,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const PRODUCTION = "packages/cli/src/production.ts";

const superviseComposition = (): string => {
  const text = readFileSync(join(ROOT, PRODUCTION), "utf8");
  const start = text.indexOf("      supervise: {");
  expect(start).toBeGreaterThan(-1);
  const end = text.indexOf("      // The taxonomy reference surface", start);
  return text.slice(start, end === -1 ? start + 6_000 : end);
};

describe("TC-SUP-053 the supervise composition stays supervise-only", () => {
  test("no lane composition is granted to the battery", () => {
    const block = superviseComposition();
    for (const marker of [
      "LaneExecutorPort",
      "laneComposition",
      "createLaneExecutor",
      "startLane",
    ]) {
      expect(block, marker).not.toContain(marker);
    }
    expect(block).toContain("createStateSupervisionReadPort");
    expect(block).toContain("createStateSupervisionWritePort");
  });

  test("the daemon's production composition still declares the supervise-only mode", () => {
    expect([...DAEMON_START_MODES]).toContain("supervise-only");
    const compose = readFileSync(join(ROOT, "packages/cli/src/daemon-compose.ts"), "utf8");
    expect(compose).toContain("supervise-only");
    // The battery composition grants no lane executor to the daemon family.
    const production = readFileSync(join(ROOT, PRODUCTION), "utf8");
    expect(production).not.toContain("executor: supervise");
  });

  test("the delivered lock, staleness, and lease constants keep their values", () => {
    expect(DAEMON_DEFAULT_LOCK_STALENESS_MS).toBe(30_000);
    expect(QUEUE_DEFAULT_LEASE_TTL_MS).toBe(90_000);
  });

  test("the delivered daemon, coordinator, and queue suites carry no battery coupling", () => {
    for (const file of [
      "tests/behaviour/daemon-single-flight.test.ts",
      "tests/behaviour/daemon-lock.test.ts",
      "tests/behaviour/coordinator-instance-lease.test.ts",
      "tests/structure/daemon-production-composition.test.ts",
    ]) {
      expect(existsSync(join(ROOT, file)), file).toBe(true);
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const marker of [
        "createStateSupervision",
        "runSupervisionBattery",
        "delivery.supervision.v1",
      ]) {
        expect(text, `${file}: ${marker}`).not.toContain(marker);
      }
    }
  });
});
