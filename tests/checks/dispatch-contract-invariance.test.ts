/**
 * TC-TRACKER-004 (no-key half) and the start of TC-CONTRACT-001 — the closed
 * dispatch contract surface (GH-347 AC-F4-4, NFR-3, NFR-11).
 *
 * The ladder is declared policy: no configuration key is added for it, and the
 * four consumed defaults are unchanged. The taxonomy, projections, exits, the
 * dispatch/queue error rows, and the attempt-record schema version are pinned
 * against the delivered baseline. Phase 7 extends the same file with
 * CONTRACT-001's full closed-surface pin.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DELIVERY_RESULT_TAXONOMY,
  DELIVERY_RESULT_TOKENS,
  DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
  ERROR_TABLE,
} from "../../packages/core/src/contracts/index";
import { LANE_BRANCH, PRODUCTION_CATALOG, resolveConfig } from "../../packages/core/src/index";

const ROOT = process.cwd();

const exitOf = (token: string): number | undefined => {
  const row = DELIVERY_RESULT_TAXONOMY.find((entry) => entry.token === token);
  if (row === undefined) return undefined;
  return row.projectionClass === "success"
    ? 0
    : row.projectionClass === "user-validation"
      ? 1
      : 2;
};

describe("TC-TRACKER-004 the ladder adds no configuration key", () => {
  test("the lane branch carries exactly the two delivered keys", () => {
    expect(Object.keys(LANE_BRANCH.fields)).toEqual(["liveness-interval", "restart-budget"]);
    for (const forbidden of ["tracker", "ladder", "attempts", "base-ms", "cap-ms"]) {
      expect(Object.keys(LANE_BRANCH.fields)).not.toContain(forbidden);
    }
  });

  test("no terminate-grace or ladder key enters the production catalog", () => {
    const serialized = JSON.stringify(PRODUCTION_CATALOG);
    for (const forbidden of [
      "terminate-grace",
      "tracker-ladder",
      "claim-fence",
      "ladder-attempts",
    ]) {
      expect(serialized, forbidden).not.toContain(forbidden);
    }
  });

  test("the four consumed defaults are unchanged", () => {
    const resolved = resolveConfig({ sources: [] });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const values = resolved.value.values as Readonly<Record<string, unknown>>;
    const branch = (name: string): Readonly<Record<string, unknown>> =>
      (values[name] ?? {}) as Readonly<Record<string, unknown>>;
    expect(branch("lane")["liveness-interval"]).toBe(30000);
    expect(branch("lane")["restart-budget"]).toBe(3);
    expect(branch("coordinator")["kill-grace"]).toBe(20000);
    expect(branch("queue")["lease-ttl"]).toBe(90000);
  });

  test("the ladder module resolves no ambient timer", () => {
    const source = readFileSync(join(ROOT, "packages/core/src/domain/dispatch-tracker.ts"), "utf8");
    for (const marker of ["setTimeout", "setInterval", "node:timers", "Bun.sleep"]) {
      expect(source).not.toContain(marker);
    }
  });
});

describe("TC-CONTRACT-001 the closed dispatch surface is unchanged", () => {
  test("the eleven tokens and their order are the delivered baseline", () => {
    expect([...DELIVERY_RESULT_TOKENS]).toEqual([
      "merged",
      "blocked",
      "pr-open",
      "pr-open-unverified",
      "failed",
      "finished",
      "max-restarts",
      "state-unverified",
      "partial",
      "noop-lane-permission",
      "noop-lane-nothing-to-do",
    ]);
    expect(DELIVERY_RESULT_TAXONOMY).toHaveLength(11);
  });

  test("state-unverified is exit 2 and partial is exit 1", () => {
    expect(exitOf("state-unverified")).toBe(2);
    expect(exitOf("partial")).toBe(1);
    expect(exitOf("max-restarts")).toBe(1);
    expect(exitOf("blocked")).toBe(0);
    expect(exitOf("pr-open")).toBe(0);
  });

  test("the dispatch and queue error rows are the delivered closed sets", () => {
    const codes = (prefix: string): readonly string[] =>
      ERROR_TABLE.filter((row) => row.code.startsWith(prefix))
        .map((row) => row.code)
        .sort();
    expect(codes("dispatch.")).toEqual([
      "dispatch.restart-budget-exceeded",
      "dispatch.resume-uneconomical",
      "dispatch.session.spawn-failed",
      "dispatch.state-unverified",
    ]);
    expect(codes("queue.")).toEqual([
      "queue.dependency-cycle",
      "queue.entry.unobserved",
      "queue.lease-conflict",
      "queue.park-condition-stuck",
      "queue.precondition.unmet",
      "queue.reason-missing",
      "queue.single-flight",
    ]);
  });

  test("the attempt-record schema version is unchanged", () => {
    expect(DISPATCH_ATTEMPT_PAYLOAD_SCHEMA).toBe("delivery.dispatch.attempt.v1");
  });
});
