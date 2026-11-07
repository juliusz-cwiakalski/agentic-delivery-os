/**
 * TC-ATT-016 / 017 — parked conditions under the detail cap and the grouped
 * `parked.stale-no-condition` finding with both negative controls.
 */
import { describe, expect, test } from "bun:test";
import {
  STATUS_MAX_DETAIL_CHARS,
  type StatusFacts,
  type StatusParkedWorkEntry,
} from "../../packages/core/src/contracts/index";
import { aggregateStatus, renderStatusHuman } from "../../packages/core/src/domain/index";
import {
  baseFacts,
  localContext,
  malformedLocalContext,
  missingLocalContext,
  NOW_MS,
  sectionById,
} from "../fixtures/status/harness";

const parkedFacts = (entries: readonly StatusParkedWorkEntry[]): StatusFacts =>
  baseFacts({ localContext: localContext({ parkedChanges: entries }) });

const parkedOf = (facts: StatusFacts) =>
  sectionById(aggregateStatus(facts).sections, "parked-work");

const parkedFinding = (facts: StatusFacts) =>
  parkedOf(facts).findings?.find((finding) => finding.code === "parked.stale-no-condition");

const at = (msAgo: number): string => new Date(NOW_MS - msAgo).toISOString();

const byteLength = (value: string): number => Buffer.byteLength(value, "utf8");

describe("TC-ATT-016 parked conditions are projected within the detail cap", () => {
  test("a recorded condition is projected verbatim", () => {
    const facts = parkedFacts([
      { workItemRef: "GH-1", condition: "waiting for review", parkedAt: at(0) },
    ]);
    expect(parkedOf(facts).items?.[0]).toMatchObject({ condition: "waiting for review" });
  });

  test("an over-cap condition is bounded multibyte-safely", () => {
    const long = "x".repeat(200);
    const facts = parkedFacts([{ workItemRef: "GH-1", condition: long, parkedAt: at(0) }]);
    const condition = parkedOf(facts).items?.[0]?.condition ?? "";
    expect(Array.from(condition).length).toBeLessThanOrEqual(STATUS_MAX_DETAIL_CHARS);
    expect(byteLength(condition)).toBeLessThanOrEqual(STATUS_MAX_DETAIL_CHARS);
    expect(condition).toBe("x".repeat(160));

    const multibyte = "é".repeat(100);
    const accentFacts = parkedFacts([
      { workItemRef: "GH-2", condition: multibyte, parkedAt: at(0) },
    ]);
    const accent = parkedOf(accentFacts).items?.[0]?.condition ?? "";
    expect(byteLength(accent)).toBeLessThanOrEqual(STATUS_MAX_DETAIL_CHARS);
    expect(accent).not.toContain("\uFFFD");
    expect(Array.from(accent).some((character) => character === "�")).toBe(false);
  });

  test("absence is absent, never an empty or invented condition", () => {
    const facts = parkedFacts([{ workItemRef: "GH-1", parkedAt: at(0) }]);
    const item = parkedOf(facts).items?.[0];
    expect(item?.condition).toBeUndefined();
    expect(JSON.stringify(item)).not.toContain('"condition":""');
  });

  test("free-form notes and undeclared keys never project", () => {
    const entry = {
      workItemRef: "GH-1",
      parkedAt: at(0),
      notes: "planted-status-notes-canary",
      extra: "planted-status-extra-canary",
    } as unknown as StatusParkedWorkEntry;
    const facts = parkedFacts([entry]);
    const serialized = JSON.stringify(aggregateStatus(facts));
    const human = renderStatusHuman(aggregateStatus(facts), {
      binaryName: "example-product",
    } as never);
    for (const canary of ["planted-status-notes-canary", "planted-status-extra-canary"]) {
      expect(serialized).not.toContain(canary);
      expect(human).not.toContain(canary);
    }
  });

  test("the pre-change fields are unchanged and condition is the only additive field", () => {
    const facts = parkedFacts([
      {
        workItemRef: "GH-1",
        branch: "feat/GH-1/x",
        changeFolder: "doc/changes/GH-1",
        reason: "waiting",
        parkedAt: at(86_400_000),
        condition: "unpark when reviewed",
      },
    ]);
    expect(parkedOf(facts).items?.[0]).toMatchObject({
      workItemRef: "GH-1",
      branch: "feat/GH-1/x",
      changeFolder: "doc/changes/GH-1",
      reason: "waiting",
      condition: "unpark when reviewed",
      itemState: "observed",
    });
    expect(parkedOf(facts).items?.[0]?.ageDays).toBe(1);
  });

  test("the human parked line never carries the condition", () => {
    const facts = parkedFacts([
      { workItemRef: "GH-1", condition: "planted-status-condition-canary", parkedAt: at(0) },
    ]);
    const human = renderStatusHuman(aggregateStatus(facts), {
      binaryName: "example-product",
    } as never);
    const line = human.split("\n").find((entry) => entry.startsWith("parked"));
    expect(line).toBe("parked     observed  1 parked changes (git-ignored local state)");
    expect(human).not.toContain("planted-status-condition-canary");
  });

  test("malformed, missing, and empty contexts behave as shipped", () => {
    expect(parkedOf(baseFacts({ localContext: malformedLocalContext() })).state).toBe("unknown");
    expect(parkedOf(baseFacts({ localContext: missingLocalContext() })).state).toBe("unavailable");
    const empty = parkedOf(baseFacts({ localContext: localContext({}) }));
    expect(empty.state).toBe("observed");
    expect(empty.items).toEqual([]);
    expect(empty.findings ?? []).toEqual([]);
  });
});

describe("TC-ATT-017 parked.stale-no-condition grouping", () => {
  const stalePopulation = (): readonly StatusParkedWorkEntry[] => [
    { workItemRef: "GH-901", reason: "waiting" },
    { workItemRef: "GH-902", changeFolder: "doc/GH-902", reason: "waiting" },
    { branch: "feat/GH-903/x", changeFolder: "doc/GH-903", reason: "waiting" },
    { workItemRef: "GH-904", condition: "waiting for design" },
    { workItemRef: "GH-905", parkedAt: at(30 * 86_400_000), reason: "waiting" },
  ];

  test("three unknown-age conditionless entries group into one finding", () => {
    const facts = parkedFacts(stalePopulation());
    const finding = parkedFinding(facts);
    expect(finding).toMatchObject({ severity: "low", count: 3 });
    expect(finding?.members).toEqual([
      "GH-901",
      "GH-902",
      "parked:doc/GH-903|feat/GH-903/x|waiting",
    ]);
    expect(finding?.evidenceRef).toBe("GH-901");
  });

  test("a condition and a parseable age are both negative controls", () => {
    const withCondition = parkedFacts([
      { workItemRef: "GH-1", condition: "waiting", reason: "waiting" },
    ]);
    expect(parkedFinding(withCondition)).toBeUndefined();
    const withAge = parkedFacts([
      { workItemRef: "GH-2", parkedAt: at(30 * 86_400_000), reason: "waiting" },
    ]);
    expect(parkedFinding(withAge)).toBeUndefined();
  });

  test("all unknown-age entries with conditions yield no finding", () => {
    const facts = parkedFacts([
      { workItemRef: "GH-1", condition: "a" },
      { workItemRef: "GH-2", condition: "b" },
    ]);
    expect(parkedFinding(facts)).toBeUndefined();
  });

  test("empty, unavailable, and unknown sections never emit the finding", () => {
    expect(parkedFinding(baseFacts({ localContext: localContext({}) }))).toBeUndefined();
    expect(parkedFinding(baseFacts({ localContext: missingLocalContext() }))).toBeUndefined();
    expect(parkedFinding(baseFacts({ localContext: malformedLocalContext() }))).toBeUndefined();
  });

  test("advancing the clock keeps an absent timestamp unknown", () => {
    const facts = parkedFacts([{ workItemRef: "GH-1", reason: "waiting" }]);
    expect(parkedFinding(facts)?.count).toBe(1);
    const later = parkedFacts([{ workItemRef: "GH-1", reason: "waiting" }]);
    expect(parkedFinding(later)?.members).toEqual(["GH-1"]);
  });

  test("the human attention line never lists a member identity", () => {
    const facts = parkedFacts(stalePopulation());
    const human = renderStatusHuman(aggregateStatus(facts), {
      binaryName: "example-product",
    } as never);
    expect(human).toContain("parked.stale-no-condition×3");
    expect(human).not.toContain("GH-901");
    expect(human).not.toContain("GH-902");
  });
});
