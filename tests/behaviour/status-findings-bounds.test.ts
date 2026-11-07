/**
 * TC-ATT-007 / 008 — member cap, exact counts, deduplication, and the
 * defensive findings-per-section cap at the pure aggregation layer.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  STATUS_DORMANT_FINDING_CODES,
  STATUS_FINDING_CODES,
  STATUS_FINDING_REGISTRY,
  STATUS_MAX_FINDING_MEMBERS,
  STATUS_MAX_FINDINGS_PER_SECTION,
  STATUS_SECTION_ORDER,
  type StatusFacts,
} from "../../packages/core/src/contracts/index";
import { aggregateStatus, evaluateStatusFindings } from "../../packages/core/src/domain/index";
import {
  ASSERTIONS_AVAILABLE,
  baseFacts,
  deliveryRequestRead,
  failedRun,
  makeDeliveryRequest,
  makeWorkItem,
  pipelineRunRead,
  primaryRepository,
  REVIEWS_AVAILABLE,
  sectionById,
  workItemRead,
} from "../fixtures/status/harness";

const ROOT = process.cwd();
const BOUNDS = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/status/matrix/bounds/members.json"), "utf8"),
) as {
  readonly memberCases: readonly number[];
  readonly repeatedIdentity: { readonly entityIds: readonly string[] };
};

const ciFacts = (count: number, entityIds?: readonly string[]): StatusFacts =>
  baseFacts({
    repository: primaryRepository(),
    ci: pipelineRunRead(
      entityIds === undefined
        ? Array.from({ length: count }, (_, index) => failedRun(String(700 + index)))
        : entityIds.map(failedRun),
    ),
  });

const ciFinding = (facts: StatusFacts) => {
  const section = sectionById(aggregateStatus(facts).sections, "ci");
  return { section, finding: section.findings?.[0] };
};

describe("TC-ATT-007 member cap and exact counts", () => {
  test("7 and 8 unique members are under cap with no truncation", () => {
    for (const count of BOUNDS.memberCases.filter((value) => value <= 8)) {
      const { section, finding } = ciFinding(ciFacts(count));
      expect(finding?.count).toBe(count);
      expect(finding?.members).toHaveLength(count);
      expect(new Set(finding?.members).size).toBe(count);
      expect(finding?.evidenceRef).toBe(String(699 + count));
      expect(section.truncated).toBe(false);
      expect(section.counts.omitted).toBe(0);
    }
  });

  test("9, 12, and 20 observations keep the exact count and cap members at 8", () => {
    for (const count of BOUNDS.memberCases.filter((value) => value > 8)) {
      const { section, finding } = ciFinding(ciFacts(count));
      expect(finding?.count).toBe(count);
      expect(finding?.members).toHaveLength(STATUS_MAX_FINDING_MEMBERS);
      expect(section.truncated).toBe(true);
      expect(section.counts.omitted).toBe(count - STATUS_MAX_FINDING_MEMBERS);
    }
  });

  test("a repeated identity is deduplicated while the exact count survives", () => {
    const ids = BOUNDS.repeatedIdentity.entityIds;
    const { finding } = ciFinding(ciFacts(ids.length, ids));
    expect(finding?.count).toBe(10);
    expect(finding?.members).toHaveLength(8);
    expect(finding?.members.filter((member) => member === "700")).toHaveLength(1);
    expect(finding?.members).toEqual(["707", "706", "705", "704", "703", "702", "701", "700"]);
    expect(finding?.evidenceRef).toBe("707");
  });

  test("a second under-cap code does not mark the first code's drop", () => {
    const facts = baseFacts({
      tracker: workItemRead(
        [
          ...Array.from({ length: 9 }, (_, index) =>
            makeWorkItem({
              entityId: `GH-${100 + index}`,
              labels: ["hand-back"],
              updatedAt: "2026-09-01T00:00:00Z",
            }),
          ),
          ...Array.from({ length: 3 }, (_, index) =>
            makeWorkItem({
              entityId: `GH-${300 + index}`,
              updatedAt: "2026-09-01T00:00:00Z",
            }),
          ),
        ],
        ASSERTIONS_AVAILABLE,
      ),
    });
    const tracker = sectionById(aggregateStatus(facts).sections, "tracker");
    const escalated = tracker.findings?.find(
      (finding) => finding.code === "tracker.owner-gate-escalated",
    );
    const stalled = tracker.findings?.find((finding) => finding.code === "tracker.stalled-ticket");
    expect(escalated?.count).toBe(9);
    expect(escalated?.members).toHaveLength(8);
    expect(stalled?.count).toBeGreaterThanOrEqual(3);
  });

  test("truncation is deterministic across repeats", () => {
    const first = ciFinding(ciFacts(20));
    const second = ciFinding(ciFacts(20));
    expect(second.finding).toEqual(first.finding);
  });

  test("a cap-removed control renders all 20 members, proving the assertion reads the cap", () => {
    const observations = Array.from({ length: 20 }, (_, index) => ({
      code: "ci.red-on-main",
      member: String(700 + index),
    }));
    const uncapped = evaluateStatusFindings(observations, STATUS_FINDING_REGISTRY, {
      findings: STATUS_MAX_FINDINGS_PER_SECTION,
      members: 99,
    });
    expect(uncapped.findings[0]?.members).toHaveLength(20);
    const capped = evaluateStatusFindings(observations);
    expect(capped.findings[0]?.members).toHaveLength(STATUS_MAX_FINDING_MEMBERS);
  });
});

const sevenCodeFacts = (): StatusFacts =>
  baseFacts({
    tracker: workItemRead(
      [
        makeWorkItem({
          entityId: "GH-100",
          labels: ["hand-back", "epic:x", "points:1"],
          milestone: "Sprint 1",
          updatedAt: "2026-09-01T00:00:00Z",
        }),
        makeWorkItem({
          entityId: "GH-101",
          labels: ["epic:x", "points:1"],
          milestone: "Sprint 1",
          updatedAt: "2026-09-01T00:00:00Z",
        }),
        makeWorkItem({
          entityId: "GH-102",
          title: "",
          labels: ["epic:x", "points:1"],
          milestone: "Sprint 1",
        }),
        makeWorkItem({ entityId: "GH-103", title: "No labels", labels: [] }),
        makeWorkItem({
          entityId: "GH-104",
          title: "No epic",
          labels: ["bug", "points:1"],
          milestone: "Sprint 1",
        }),
        makeWorkItem({
          entityId: "GH-105",
          title: "No points",
          labels: ["epic:x"],
          milestone: "Sprint 1",
        }),
        makeWorkItem({ entityId: "GH-106", title: "No sprint", labels: ["epic:x", "points:1"] }),
      ],
      ASSERTIONS_AVAILABLE,
    ),
  });

describe("TC-ATT-008 defensive findings cap", () => {
  test("the production registry's reachable maximum per section is 7/1/0/1/0/0/0", () => {
    const reachable = STATUS_SECTION_ORDER.map(
      (id) =>
        STATUS_FINDING_CODES.filter(
          (code) =>
            STATUS_FINDING_REGISTRY[code].surface === id &&
            !(STATUS_DORMANT_FINDING_CODES as readonly string[]).includes(code),
        ).length,
    );
    expect(reachable).toEqual([7, 0, 1, 0, 0, 1, 0, 0, 0]);
    expect(STATUS_MAX_FINDINGS_PER_SECTION).toBe(8);
  });

  test("an injected ten-code registry retains exactly eight findings in rank order", () => {
    const registry = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [
        `test.code-${index}`,
        { severity: index === 9 ? "high" : ("low" as const) },
      ]),
    );
    const observations = Object.keys(registry).map((code) => ({ code, member: code }));
    const evaluation = evaluateStatusFindings(observations, registry);
    expect(evaluation.findings).toHaveLength(8);
    expect(evaluation.truncated).toBe(true);
    expect(evaluation.findings[0]?.code).toBe("test.code-9");
    expect(evaluation.findings.map((finding) => finding.code)).toEqual([
      "test.code-9",
      "test.code-0",
      "test.code-1",
      "test.code-2",
      "test.code-3",
      "test.code-4",
      "test.code-5",
      "test.code-6",
    ]);
  });

  test("real input reaches all seven tracker codes without findings truncation", () => {
    const tracker = sectionById(aggregateStatus(sevenCodeFacts()).sections, "tracker");
    const codes = new Set((tracker.findings ?? []).map((finding) => finding.code));
    for (const code of [
      "tracker.owner-gate-escalated",
      "tracker.stalled-ticket",
      "tracker.hygiene.missing-title",
      "tracker.hygiene.missing-labels",
      "tracker.hygiene.epic-membership",
      "tracker.hygiene.story-points",
      "tracker.hygiene.in-sprint",
    ]) {
      expect(codes.has(code as never)).toBe(true);
    }
    expect(tracker.findings).toHaveLength(7);
  });

  test("the test-only registry never leaks into production sources", () => {
    const source = readFileSync(join(ROOT, "packages/core/src/domain/status.ts"), "utf8");
    const contracts = readFileSync(join(ROOT, "packages/core/src/contracts/status.ts"), "utf8");
    expect(source).not.toContain("test.code-");
    expect(contracts).not.toContain("test.code-");
    expect(Object.keys(STATUS_FINDING_REGISTRY)).toHaveLength(10);
  });
});

describe("TC-ATT-025 ready-to-merge item cap and truncation", () => {
  const readyFacts = (count: number, approvedAt?: number) =>
    baseFacts({
      changes: deliveryRequestRead(
        Array.from({ length: count }, (_, index) =>
          makeDeliveryRequest({
            entityId: String(100 + index),
            reviewState: index === approvedAt ? "approved" : "open",
          }),
        ),
        REVIEWS_AVAILABLE,
      ),
    });

  const readySection = (facts: StatusFacts) =>
    sectionById(aggregateStatus(facts).sections, "ready-to-merge");

  test("7 and 8 items are under cap; 9 and 12 drop with omitted", () => {
    for (const count of [7, 8]) {
      const section = readySection(readyFacts(count));
      expect(section.items).toHaveLength(count);
      expect(section.truncated).toBe(false);
      expect(section.counts.omitted).toBe(0);
    }
    for (const count of [9, 12]) {
      const section = readySection(readyFacts(count));
      expect(section.items).toHaveLength(8);
      expect(section.truncated).toBe(true);
      expect(section.counts.omitted).toBe(count - 8);
    }
  });

  test("a merge-ready item last in source order is never dropped for review-pending", () => {
    const section = readySection(readyFacts(12, 8));
    const items = (section.items ?? []) as Array<{ ref: string; class: string }>;
    expect(items[0]).toMatchObject({ ref: "108", class: "merge-ready" });
    expect(items.filter((item) => item.class === "merge-ready")).toHaveLength(1);
    expect(items.map((item) => item.ref)).toEqual([
      "108",
      "100",
      "101",
      "102",
      "103",
      "104",
      "105",
      "106",
    ]);
  });

  test("nine merge-ready items disclose the drop through omitted", () => {
    const facts = baseFacts({
      changes: deliveryRequestRead(
        Array.from({ length: 9 }, (_, index) =>
          makeDeliveryRequest({
            entityId: String(200 + index),
            reviewState: "approved",
          }),
        ),
        REVIEWS_AVAILABLE,
      ),
    });
    const section = readySection(facts);
    expect(section.items).toHaveLength(8);
    expect(section.counts.omitted).toBe(1);
    expect(section.truncated).toBe(true);
  });

  test("truncation is deterministic across repeats", () => {
    const first = readySection(readyFacts(12, 8));
    const second = readySection(readyFacts(12, 8));
    expect(second).toEqual(first);
  });
});
