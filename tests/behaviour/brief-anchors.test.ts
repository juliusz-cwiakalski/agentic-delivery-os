/**
 * TC-BRIEF-007 / TC-BRIEF-008 — ready-to-merge appears only from observed
 * approval on a non-draft open pull request and cites digest evidence; owner
 * ages derive only from parseable provider-native timestamps under the digest's
 * parse-and-floor rule, and no SLA state is ever fabricated.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { projectBrief, renderBriefHuman } from "../../packages/core/src/domain/index";
import {
  ALL_AVAILABLE,
  baseFacts,
  DAY_MS,
  deliveryRequestRead,
  failedDeliveryRequestRead,
  GITHUB_SLICE_AVAILABILITY,
  makeDeliveryRequest,
  makeWorkItem,
  NOW_MS,
  REVIEWS_AVAILABLE,
  REVIEWS_UNAVAILABLE,
  repository,
  unavailableBinding,
  workItemRead,
} from "../fixtures/brief/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const approved = (count: number) =>
  deliveryRequestRead(
    Array.from({ length: count }, (_, index) =>
      makeDeliveryRequest({
        entityId: String(500 + index),
        reviewState: "approved",
      }),
    ),
    REVIEWS_AVAILABLE,
  );

const readyGroup = (facts: ReturnType<typeof baseFacts>) => {
  const anchor = projectBrief(facts).anchors.find((entry) => entry.group === "ready-to-merge");
  if (anchor === undefined) throw new Error("ready group missing");
  return anchor;
};

const ownerGroup = (facts: ReturnType<typeof baseFacts>) => {
  const anchor = projectBrief(facts).anchors.find((entry) => entry.group === "owner-gate-ages");
  if (anchor === undefined) throw new Error("owner group missing");
  return anchor;
};

const collectKeys = (value: unknown, keys = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, keys);
  } else if (typeof value === "object" && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      keys.add(key);
      collectKeys(entry, keys);
    }
  }
  return keys;
};

describe("TC-BRIEF-007 ready-to-merge anchors", () => {
  test("observed approval and non-draft produce ranked actions with digest evidence", () => {
    const group = readyGroup(baseFacts({ changes: approved(2) }));
    expect(group.state).toBe("observed");
    expect(group.items.map((item) => item.identity)).toEqual(["500", "501"]);
    for (const action of group.items) {
      expect(action.evidence).toEqual({
        kind: "pull-request",
        deliveryState: "approved",
        draft: false,
        reviewState: "observed",
      });
    }
  });

  test("the payload carries no verdict, authorization, gate, or safe-to-merge field", () => {
    const keys = collectKeys(projectBrief(baseFacts({ changes: approved(1) })));
    for (const forbidden of ["verdict", "authorized", "authorization", "gate", "safeToMerge"]) {
      expect(keys.has(forbidden), forbidden).toBe(false);
    }
  });

  test("draft, changes-requested, open, merged, and closed states never produce an action", () => {
    for (const state of ["draft", "changes-requested", "open", "merged", "closed"] as const) {
      const facts = baseFacts({
        changes: deliveryRequestRead(
          [makeDeliveryRequest({ entityId: "601", reviewState: state })],
          REVIEWS_AVAILABLE,
        ),
      });
      expect(readyGroup(facts).items, state).toEqual([]);
    }
  });

  test("an unknown item review signal never produces an action", () => {
    const facts = baseFacts({
      changes: deliveryRequestRead(
        [makeDeliveryRequest({ entityId: "501", reviewState: "approved" })],
        REVIEWS_UNAVAILABLE,
      ),
    });
    const group = readyGroup(facts);
    expect(group.items).toEqual([]);
    expect(group.state).toBe("degraded");
  });

  test("a failed pull-request read and an unavailable binding never produce an action", () => {
    expect(readyGroup(baseFacts({ changes: failedDeliveryRequestRead() })).items).toEqual([]);
    const bindingFacts = baseFacts({ repository: repository({ binding: unavailableBinding() }) });
    expect(readyGroup(bindingFacts).items).toEqual([]);
    expect(readyGroup(bindingFacts).state).toBe("degraded");
  });

  test("an approved pull request dropped by the cap is not claimed, and its in-cap twin is", () => {
    const above = readyGroup(baseFacts({ changes: approved(9) }));
    expect(above.items).toHaveLength(8);
    expect(above.items.map((item) => item.identity)).not.toContain("508");
    expect(above.truncated).toBe(true);
    expect(above.omitted).toBe(1);

    const atCap = readyGroup(baseFacts({ changes: approved(8) }));
    expect(atCap.items).toHaveLength(8);
    expect(atCap.items.map((item) => item.identity)).toContain("507");
  });

  test("a verified-empty observed surface is observed and explicitly empty", () => {
    const facts = baseFacts({ changes: deliveryRequestRead([]) });
    const group = readyGroup(facts);
    expect(group.state).toBe("observed");
    expect(group.items).toEqual([]);
    const human = renderBriefHuman(projectBrief(facts), SYNTHETIC_BRAND);
    expect(human).toContain("none approved");
    expect(human).not.toMatch(/\b(clear|green|available)\b/);
  });

  test("the queue-ready classification is not imported or duplicated", () => {
    const source = readFileSync("packages/core/src/domain/brief.ts", "utf8");
    expect(source).not.toContain("queue-ready");
    expect(source).not.toContain("merge-ready");
  });
});

describe("TC-BRIEF-008 owner-gate age anchors", () => {
  const handBack = (entityId: string, updatedAt?: string) =>
    makeWorkItem({
      entityId,
      title: `Hand back ${entityId}`,
      labels: ["hand-back"],
      ...(updatedAt === undefined ? {} : { updatedAt }),
    });

  test("a parseable timestamp renders the parse-and-floor age", () => {
    const facts = baseFacts({
      tracker: workItemRead([handBack("GH-101", "2026-10-30T00:00:00Z")]),
    });
    const group = ownerGroup(facts);
    expect(group.items).toHaveLength(1);
    const action = group.items[0];
    if (action === undefined) throw new Error("action missing");
    expect(action.evidence).toEqual({
      kind: "owner-hand-back",
      ageState: "observed",
      ageDays: Math.floor((NOW_MS - Date.parse("2026-10-30T00:00:00Z")) / DAY_MS),
    });
  });

  test("absent, unparseable, and future timestamps stay unknown, never zero", () => {
    const facts = baseFacts({
      tracker: workItemRead([
        handBack("GH-102"),
        handBack("GH-103", "not-a-date"),
        handBack("GH-104", "2026-12-01T00:00:00Z"),
      ]),
    });
    const group = ownerGroup(facts);
    expect(group.state).toBe("observed");
    for (const action of group.items) {
      expect(action.evidence).toEqual({ kind: "owner-hand-back", ageState: "unknown" });
    }
    const human = renderBriefHuman(projectBrief(facts), SYNTHETIC_BRAND);
    expect(human).toContain("age unknown");
    expect(human).not.toMatch(/age 0d|0d,/);
  });

  test("the family unavailable case has zero ages and an unavailable state", () => {
    const facts = baseFacts({
      tracker: workItemRead([], {
        ownerHandBacks: "unavailable",
        blockedDependencies: "unavailable",
        stalls: "available",
        hygiene: "available",
      }),
    });
    const group = ownerGroup(facts);
    expect(group.state).toBe("unavailable");
    expect(group.items).toEqual([]);
  });

  test("the observed-empty family is observed and empty", () => {
    const group = ownerGroup(baseFacts({ tracker: workItemRead([], ALL_AVAILABLE) }));
    expect(group.state).toBe("observed");
    expect(group.items).toEqual([]);
  });

  test("the 4-per-family cap is respected and the omitted items are not claimed", () => {
    const facts = baseFacts({
      tracker: workItemRead([
        handBack("GH-201", "2026-10-30T00:00:00Z"),
        handBack("GH-202", "2026-10-29T00:00:00Z"),
        handBack("GH-203", "2026-10-28T00:00:00Z"),
        handBack("GH-204", "2026-10-27T00:00:00Z"),
        handBack("GH-205", "2026-10-26T00:00:00Z"),
        handBack("GH-206", "2026-10-25T00:00:00Z"),
      ]),
    });
    const group = ownerGroup(facts);
    expect(group.items).toHaveLength(4);
    expect(group.omitted).toBe(2);
    expect(group.truncated).toBe(true);
    expect(group.items.map((item) => item.identity)).not.toContain("GH-202");
  });

  test("no SLA, escalation, or expiry token appears in the payload or human text", () => {
    const facts = baseFacts({
      tracker: workItemRead([handBack("GH-101", "2026-10-30T00:00:00Z")]),
    });
    const brief = projectBrief(facts);
    const text = `${JSON.stringify(brief)}\n${renderBriefHuman(brief, SYNTHETIC_BRAND)}`;
    for (const token of ["slaState", "escalated", "overdue", "breached", "expiresAt"]) {
      expect(text.includes(token), token).toBe(false);
    }
    expect(brief.placeholders.some((entry) => entry.capability === "gate-sla-states")).toBe(true);
  });

  test("degraded tracker from another family never fabricates owner ages", () => {
    const facts = baseFacts({ tracker: workItemRead([], GITHUB_SLICE_AVAILABILITY) });
    const group = ownerGroup(facts);
    expect(group.state).toBe("degraded");
    expect(group.items).toEqual([]);
  });
});
