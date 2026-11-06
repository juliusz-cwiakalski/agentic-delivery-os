/**
 * TC-ATT-014 / 015 — owner-gate age, slaState, the grouped escalated finding,
 * the tracker gates fragment, and the two declared unknown-age markers.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OWNER_GATE_SLA_COMPARATOR,
  OWNER_GATE_SLA_ESCALATION_THRESHOLD_MS,
  OWNER_GATE_UNKNOWN_AGE_REASONS,
  type StatusFacts,
  type StatusTrackerFamily,
  type WorkItem,
} from "../../packages/core/src/contracts/index";
import { aggregateStatus, renderStatusHuman } from "../../packages/core/src/domain/index";
import {
  ALL_AVAILABLE,
  baseFacts,
  makeWorkItem,
  NOW_MS,
  sectionById,
  workItemRead,
} from "../fixtures/status/harness";

const ROOT = process.cwd();
const HOUR = 3_600_000;

const handBackFacts = (updatedAt: string | null | undefined, nowMs = NOW_MS): StatusFacts => {
  const item = makeWorkItem({ entityId: "GH-1", labels: ["hand-back"] });
  const withActivity =
    updatedAt === undefined ? item : ({ ...item, updatedAt } as unknown as WorkItem);
  return baseFacts({
    nowMs,
    nowIso: new Date(nowMs).toISOString(),
    tracker: workItemRead([withActivity], ALL_AVAILABLE),
  });
};

const handBacks = (facts: StatusFacts): StatusTrackerFamily => {
  const family = sectionById(aggregateStatus(facts).sections, "tracker").families?.find(
    (entry) => entry.family === "ownerHandBacks",
  );
  if (family === undefined) throw new Error("hand-backs missing");
  return family;
};

const at = (msAgo: number): string => new Date(NOW_MS - msAgo).toISOString();

const tracker = (facts: StatusFacts) => sectionById(aggregateStatus(facts).sections, "tracker");

describe("TC-ATT-014 owner-gate ages and the escalated finding", () => {
  test("a 26 h hand-back carries its observed age and escalated state", () => {
    const facts = handBackFacts(at(26 * HOUR));
    const item = handBacks(facts).items[0];
    expect(item?.age).toBe(26 * HOUR);
    expect(item?.slaState).toBe("escalated");
    expect(item?.ageUnknownReason).toBeUndefined();
    const finding = tracker(facts).findings?.find(
      (entry) => entry.code === "tracker.owner-gate-escalated",
    );
    expect(finding).toMatchObject({ severity: "high", count: 1, members: ["GH-1"] });
    expect(finding?.evidenceRef).toBe("GH-1");
    const human = renderStatusHuman(aggregateStatus(facts), {
      binaryName: "example-product",
    } as never);
    expect(human).toContain("gates 1 escalated");
  });

  test("the T-1/T/T+1 boundary reads the imported comparator and threshold", () => {
    expect(OWNER_GATE_SLA_COMPARATOR).toBe(">=");
    const boundary = handBackFacts(at(OWNER_GATE_SLA_ESCALATION_THRESHOLD_MS));
    expect(handBacks(boundary).items[0]?.slaState).toBe("escalated");
    const before = handBackFacts(at(OWNER_GATE_SLA_ESCALATION_THRESHOLD_MS - 1));
    expect(handBacks(before).items[0]?.slaState).toBe("fresh");
    const after = handBackFacts(at(OWNER_GATE_SLA_ESCALATION_THRESHOLD_MS + 1));
    expect(handBacks(after).items[0]?.slaState).toBe("escalated");
  });

  test("three escalated hand-backs group into one finding in rank order", () => {
    const facts = baseFacts({
      tracker: workItemRead(
        [
          makeWorkItem({ entityId: "GH-3", labels: ["hand-back"], updatedAt: at(26 * HOUR) }),
          makeWorkItem({ entityId: "GH-1", labels: ["hand-back"], updatedAt: at(30 * HOUR) }),
          makeWorkItem({ entityId: "GH-2", labels: ["hand-back"], updatedAt: at(28 * HOUR) }),
        ],
        ALL_AVAILABLE,
      ),
    });
    const finding = tracker(facts).findings?.find(
      (entry) => entry.code === "tracker.owner-gate-escalated",
    );
    expect(finding?.count).toBe(3);
    expect(finding?.members).toEqual(["GH-1", "GH-2", "GH-3"]);
  });

  test("a fresh hand-back emits no marker and no finding", () => {
    const fresh = handBackFacts(at(HOUR));
    expect(handBacks(fresh).items[0]?.slaState).toBe("fresh");
    expect(tracker(fresh).findings ?? []).toEqual([]);
  });

  test("the digest never fabricates a default or writes an authority claim", () => {
    const text = JSON.stringify(aggregateStatus(handBackFacts(at(96 * HOUR))));
    expect(text).not.toContain("owner-review-first");
    expect(text).not.toContain("waivedBy");
    expect(text).not.toContain("default-applied");
  });

  test("thresholds and markers are imported by reference, not duplicated", () => {
    const source = readFileSync(join(ROOT, "packages/core/src/domain/status.ts"), "utf8");
    expect(source).toContain("OWNER_GATE_SLA_POLICY");
    expect(source).toContain("evaluateOwnerGateSla");
    expect(source).not.toContain("259_200_000");
    expect(source).not.toContain("259200000");
    expect(source).not.toContain("owner-review-first");
  });
});

describe("TC-ATT-015 unknown gate age is declared and escalated", () => {
  test("absent variants carry the absent marker, escalated, and never zero", () => {
    const absentValues: Array<string | null | undefined> = [undefined, null, "", "   "];
    for (const value of absentValues) {
      const facts = handBackFacts(value);
      const item = handBacks(facts).items[0];
      expect(item?.age).toBeNull();
      expect(item?.ageUnknownReason).toBe("activity-timestamp-absent");
      expect(item?.slaState).toBe("escalated");
      expect(item?.age).not.toBe(0);
      expect(JSON.stringify(aggregateStatus(facts))).not.toContain('"age":0');
    }
  });

  test("unparseable variants carry the distinct unparseable marker", () => {
    for (const value of ["not-a-date", "2026-13-45T99:99:99Z", "yesterday"]) {
      const facts = handBackFacts(value);
      const item = handBacks(facts).items[0];
      expect(item?.age).toBeNull();
      expect(item?.ageUnknownReason).toBe("activity-timestamp-unparseable");
      expect(item?.slaState).toBe("escalated");
    }
    expect(OWNER_GATE_UNKNOWN_AGE_REASONS).toEqual([
      "activity-timestamp-absent",
      "activity-timestamp-unparseable",
    ]);
  });

  test("unknown-age items are counted by the finding and never render fresh", () => {
    const facts = handBackFacts(undefined);
    const finding = tracker(facts).findings?.find(
      (entry) => entry.code === "tracker.owner-gate-escalated",
    );
    expect(finding?.members).toEqual(["GH-1"]);
    const human = renderStatusHuman(aggregateStatus(facts), {
      binaryName: "example-product",
    } as never);
    expect(human).toContain("gates 1 escalated");
    expect(human).not.toContain("0h");
    expect(human).not.toContain("fresh");
  });

  test("a real zero age is fresh, not unknown", () => {
    const zero = handBackFacts(at(0));
    const item = handBacks(zero).items[0];
    expect(item?.age).toBe(0);
    expect(item?.slaState).toBe("fresh");
    expect(item?.ageUnknownReason).toBeUndefined();
  });

  test("advancing the clock never makes an absent timestamp parseable", () => {
    const now = NOW_MS;
    const facts = handBackFacts(undefined, now);
    const advanced = handBackFacts(undefined, now + 90 * 86_400_000);
    expect(handBacks(advanced).items[0]?.ageUnknownReason).toBe("activity-timestamp-absent");
    expect(handBacks(advanced).items[0]?.slaState).toBe("escalated");
    expect(handBacks(facts).items[0]?.age).toBeNull();
  });

  test("absent and unparseable markers never collapse", () => {
    const facts = baseFacts({
      tracker: workItemRead(
        [
          makeWorkItem({ entityId: "GH-1", labels: ["hand-back"] }),
          makeWorkItem({
            entityId: "GH-2",
            labels: ["hand-back"],
            updatedAt: "not-a-date",
          }),
        ],
        ALL_AVAILABLE,
      ),
    });
    const reasons = handBacks(facts).items.map((item) => item.ageUnknownReason);
    expect(reasons).toContain("activity-timestamp-absent");
    expect(reasons).toContain("activity-timestamp-unparseable");
    expect(new Set(reasons).size).toBe(2);
  });
});
