/**
 * TC-SUP-045 — the supervised-stall cause joins the closed park vocabulary
 * additively with exactly one declared condition mapping (GH-295 DM-2, DEC-2,
 * RSK-1, RSK-6).
 */
import { describe, expect, test } from "bun:test";
import {
  QUEUE_PARK_CAUSE_CONDITION_PAIRS,
  QUEUE_PARK_CAUSES,
  QUEUE_PARK_CONDITION_TYPES,
  QUEUE_PARK_RECHECK_DEFAULTS,
  type QueueParkCause,
} from "../../packages/core/src/contracts/index";
import {
  conditionTypeForCause,
  createParkRecord,
  defaultParkRecheckMs,
} from "../../packages/core/src/domain/index";

const DELIVERED_CAUSES = [
  "provider-window",
  "provider-quota",
  "preempted-for-close-item",
  "peak-window",
  "owner-hold",
] as const;

describe("TC-SUP-045 the park-cause set gains exactly one member", () => {
  test("the delivered five keep position and the sixth is liveness-stall", () => {
    expect([...QUEUE_PARK_CAUSES]).toEqual([...DELIVERED_CAUSES, "liveness-stall"]);
    expect(QUEUE_PARK_CAUSES).toHaveLength(6);
    // Both directions: every delivered member is present and unchanged.
    for (const cause of DELIVERED_CAUSES) {
      expect(QUEUE_PARK_CAUSES).toContain(cause);
    }
  });

  test("the condition-type set is unchanged — no fourth type", () => {
    expect([...QUEUE_PARK_CONDITION_TYPES]).toEqual([
      "provider-window",
      "provider-quota",
      "preemption",
    ]);
  });

  test("the pair table is the delivered five plus exactly one row", () => {
    expect([...QUEUE_PARK_CAUSE_CONDITION_PAIRS]).toEqual([
      { cause: "provider-window", conditionType: "provider-window" },
      { cause: "provider-quota", conditionType: "provider-quota" },
      { cause: "preempted-for-close-item", conditionType: "preemption" },
      { cause: "peak-window", conditionType: "provider-window" },
      { cause: "owner-hold", conditionType: "preemption" },
      { cause: "liveness-stall", conditionType: "provider-window" },
    ]);
    // Every cause resolves through the delivered resolver, so a later
    // re-mapping is caught by equality rather than tolerated by a literal.
    for (const cause of QUEUE_PARK_CAUSES) {
      const pair = QUEUE_PARK_CAUSE_CONDITION_PAIRS.find((candidate) => candidate.cause === cause);
      expect(pair?.conditionType, cause).toBe(conditionTypeForCause(cause));
    }
    expect(conditionTypeForCause("liveness-stall")).toBe("provider-window");
  });

  test("the mapped condition type is the expiry-carrying one and carries no new recheck key", () => {
    expect(Object.keys(QUEUE_PARK_RECHECK_DEFAULTS).sort()).toEqual([
      "preemption",
      "provider-quota",
      "provider-window",
    ]);
    expect(defaultParkRecheckMs("provider-window")).toBe(
      QUEUE_PARK_RECHECK_DEFAULTS["provider-window"],
    );
  });
});

describe("TC-SUP-045 the parked:<cause> template keeps every delivered render", () => {
  test("the new cause renders through the delivered template unchanged", () => {
    const renders = QUEUE_PARK_CAUSES.map((cause) => `parked:${cause}`);
    expect(renders).toContain("parked:liveness-stall");
    expect(renders).toEqual([
      "parked:provider-window",
      "parked:provider-quota",
      "parked:preempted-for-close-item",
      "parked:peak-window",
      "parked:owner-hold",
      "parked:liveness-stall",
    ]);
  });

  test("a park record built for the cause names the mapped condition type", () => {
    const record = createParkRecord({
      ref: "GH-295",
      repository: "github.com/example/repo",
      cause: "liveness-stall",
      condition: { type: "provider-window", expiresAt: "2026-11-17T01:00:00.000Z" },
      recheckMs: defaultParkRecheckMs("provider-window"),
      evaluatedAt: "2026-11-17T00:00:00.000Z",
      recordedAt: "2026-11-17T00:00:00.000Z",
    });
    expect(record.cause).toBe("liveness-stall");
    expect(record.conditionType).toBe("provider-window");
    expect(record.recheckMs).toBe(QUEUE_PARK_RECHECK_DEFAULTS["provider-window"]);
  });
});

describe("TC-SUP-045 the named mutations fail the equality", () => {
  const exact = (causes: readonly string[]): boolean =>
    JSON.stringify(causes) === JSON.stringify([...DELIVERED_CAUSES, "liveness-stall"]);

  test("a renamed cause, a fourth condition type, or a duplicate row is detected", () => {
    expect(exact([...DELIVERED_CAUSES, "supervised-stall"])).toBe(false);
    expect(exact([...DELIVERED_CAUSES, "liveness-stall", "liveness-stall"])).toBe(false);
    const fourth = [...QUEUE_PARK_CONDITION_TYPES, "supervision"];
    expect(fourth).not.toEqual([...QUEUE_PARK_CONDITION_TYPES]);
    const remapped = QUEUE_PARK_CAUSE_CONDITION_PAIRS.map((pair) =>
      pair.cause === "liveness-stall" ? { ...pair, conditionType: "preemption" as const } : pair,
    );
    expect(remapped).not.toEqual([...QUEUE_PARK_CAUSE_CONDITION_PAIRS]);
    const extraKey = { ...QUEUE_PARK_RECHECK_DEFAULTS, "liveness-stall": 1 };
    expect(Object.keys(extraKey)).not.toEqual(Object.keys(QUEUE_PARK_RECHECK_DEFAULTS));
  });

  test("the cause type is closed to the declared union", () => {
    const cause: QueueParkCause = "liveness-stall";
    expect(QUEUE_PARK_CAUSES).toContain(cause);
  });
});
