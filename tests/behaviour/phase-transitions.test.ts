/**
 * TC-PHASE-001 (rows 1 and 3), TC-PHASE-002 (row 4), TC-PHASE-004 (row 9),
 * and TC-PHASE-009's command-level re-assertion. Every landing asserts the exit
 * code, the exact ledger delta, the document change, and the evidence together.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import {
  CANONICAL_PHASE_IDS,
  PM_NOTES_REQUIRED_PHASES_BY_VARIANT,
} from "../../packages/core/src/contracts/index";
import {
  PHASE_REF,
  type PhaseHarness,
  type PhaseRun,
  withoutPhase,
  withPhaseHarness,
} from "./phase-support";
import { documentOf, entryOf, parsePmNotes, phasesOf } from "./pm-notes-lint-support";

const ROOT = process.cwd();
const FULL = readFileSync(join(ROOT, "tests/fixtures/phase/full-open.yaml"), "utf8");
const LITE = readFileSync(join(ROOT, "tests/fixtures/phase/lite-open.yaml"), "utf8");

const dataOf = (run: PhaseRun): Record<string, unknown> => {
  const data = run.envelope?.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("expected success data");
  }
  return data as Record<string, unknown>;
};

const evidenceOf = (run: PhaseRun): Record<string, unknown> => {
  const evidence = dataOf(run).evidence;
  if (typeof evidence !== "object" || evidence === null || Array.isArray(evidence)) {
    throw new Error("expected evidence");
  }
  return evidence as Record<string, unknown>;
};

const errorCodeOf = (run: PhaseRun): unknown => {
  const error = run.envelope?.error;
  return typeof error === "object" && error !== null
    ? (error as { readonly code?: unknown }).code
    : undefined;
};

const documentValue = (text: string): Record<string, unknown> =>
  documentOf(parsePmNotes(text, "target"));

const landingCount = (harness: PhaseHarness): number => harness.transitionPayloads().length;

const complete = (harness: PhaseHarness, phase: string) =>
  harness.run(["complete", PHASE_REF, phase]);

const reopen = (harness: PhaseHarness, phase: string, reason: string) =>
  harness.run(["reopen", PHASE_REF, phase, reason]);

describe("TC-PHASE-001 rows 1 and 3: complete landing and re-completion", () => {
  test("row 1 lands one record, completes the entry, and preserves opaque extras", async () => {
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const run = await complete(harness, "delivery");
        expect(run.exitCode).toBe(0);
        const data = dataOf(run);
        expect(data).toMatchObject({ outcome: "landed", operation: "complete", phase: "delivery" });
        expect(evidenceOf(run)).toMatchObject({ outcome: "landed" });

        const payloads = harness.transitionPayloads();
        expect(payloads).toHaveLength(1);
        expect(payloads[0]).toMatchObject({
          changeRef: PHASE_REF,
          phaseId: "delivery",
          operation: "complete",
          outcome: "landed",
          timestamp: data.timestamp,
        });
        expect(payloads[0]?.["reason"]).toBeUndefined();

        const entry = entryOf(documentValue(harness.targetText()), "delivery");
        expect(entry.completed).toBe(data.timestamp);
        expect(entry.started).toBeNull();
        expect(entry.commits).toEqual([]);
        expect(entry.reopened).toBeNull();

        const projection = harness.projectionContent();
        expect(projection).toMatchObject({
          changeRef: PHASE_REF,
          phases: { delivery: { completed: data.timestamp } },
        });
      },
      "row1",
    );
  });

  test("row 3 re-completion after reopen lands a new record with a new timestamp", async () => {
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const first = await complete(harness, "delivery");
        const firstTimestamp = dataOf(first).timestamp;
        const reopened = await reopen(harness, "delivery", "review reopened delivery");
        expect(reopened.exitCode).toBe(0);
        expect(landingCount(harness)).toBe(2);
        const second = await complete(harness, "delivery");
        expect(second.exitCode).toBe(0);
        expect(landingCount(harness)).toBe(3);
        const secondTimestamp = dataOf(second).timestamp;
        expect(secondTimestamp).not.toBe(firstTimestamp);

        const payloads = harness.transitionPayloads();
        expect(payloads[1]).toMatchObject({ operation: "reopen", phaseId: "delivery" });
        expect(payloads[2]).toMatchObject({
          operation: "complete",
          phaseId: "delivery",
          timestamp: secondTimestamp,
        });
        expect(entryOf(documentValue(harness.targetText()), "delivery").completed).toBe(
          secondTimestamp,
        );
      },
      "row3",
    );
  });
});

describe("TC-PHASE-002 row 4: reopen landing", () => {
  test("a completed phase reopens with the exact reason in record and evidence", async () => {
    await withPhaseHarness(
      FULL,
      async (harness) => {
        await complete(harness, "delivery");
        const reason = "reopened because review findings arrived";
        const run = await reopen(harness, "delivery", reason);
        expect(run.exitCode).toBe(0);
        const data = dataOf(run);
        expect(data).toMatchObject({
          outcome: "landed",
          operation: "reopen",
          phase: "delivery",
          reason,
        });
        expect(evidenceOf(run)).toMatchObject({ outcome: "landed", reason });

        const payloads = harness.transitionPayloads();
        expect(payloads).toHaveLength(2);
        expect(payloads[1]).toMatchObject({ operation: "reopen", reason });
        expect(entryOf(documentValue(harness.targetText()), "delivery").completed).toBeNull();
        expect(harness.projectionContent()).toMatchObject({
          phases: { delivery: { completed: null } },
        });
      },
      "row4",
    );
  });
});

describe("TC-PHASE-004 row 9: absent canonical phase entry creation", () => {
  test("completing an absent required phase creates a valid entry and lands", async () => {
    await withPhaseHarness(
      withoutPhase(FULL, "review_fix"),
      async (harness) => {
        const before = documentValue(harness.targetText());
        expect(Object.hasOwn(before.phases as Record<string, unknown>, "review_fix")).toBe(false);
        const run = await complete(harness, "review_fix");
        expect(run.exitCode).toBe(0);
        const data = dataOf(run);
        expect(data.outcome).toBe("landed");
        // Row 9 asserts the outside-required-set shape is absent; earlier-open
        // advisories (row 6) may still apply to this landing.
        expect(data.advisory ?? {}).not.toMatchObject({ class: "outside-required-set" });
        const entry = entryOf(documentValue(harness.targetText()), "review_fix");
        expect(entry.started).toBe(data.timestamp);
        expect(entry.completed).toBe(data.timestamp);
        expect(landingCount(harness)).toBe(1);
      },
      "row9-required",
    );
  });

  test("completing an absent canonical phase outside the lite set lands with the advisory", async () => {
    await withPhaseHarness(
      LITE,
      async (harness) => {
        const run = await complete(harness, "test_planning");
        expect(run.exitCode).toBe(0);
        const data = dataOf(run);
        expect(data.outcome).toBe("landed");
        expect(data.advisory).toEqual({
          class: "outside-required-set",
          phase: "test_planning",
          variant: "lite",
        });
        expect(data.advisory).not.toHaveProperty("phases");
        const entry = entryOf(documentValue(harness.targetText()), "test_planning");
        expect(entry.started).toBe(data.timestamp);
        expect(entry.completed).toBe(data.timestamp);
        expect(landingCount(harness)).toBe(1);
      },
      "row9-lite",
    );
  });

  test("an unrelated missing required phase still blocks and lands nothing", async () => {
    const incomplete = withoutPhase(withoutPhase(FULL, "review_fix"), "dor_check");
    await withPhaseHarness(
      incomplete,
      async (harness) => {
        const before = harness.targetText();
        const run = await complete(harness, "review_fix");
        expect(run.exitCode).toBe(1);
        expect(errorCodeOf(run)).toBe("lint.phases.incomplete");
        expect(harness.rawLedgerLines()).toEqual([]);
        expect(harness.targetText()).toBe(before);
        expect(run.envelope?.data).toBeUndefined();
      },
      "row9-block",
    );
  });
});

const COMPLETED_ENTRY = {
  started: "2026-10-31T02:00:00Z",
  completed: "2026-10-31T02:05:00Z",
};
const OPEN_ENTRY = { started: null, completed: null };

/**
 * Complete every phase of the effective variant that precedes `dod_check`,
 * except the explicitly open ones. `dod_check` stays open as the target.
 */
const outOfOrderFixture = (
  base: string,
  variant: "full" | "lite",
  openEarlier: readonly string[],
): string => {
  const document = documentOf(parsePmNotes(base, "target"));
  const phases: Record<string, unknown> = { ...phasesOf(document) };
  const required: readonly string[] = PM_NOTES_REQUIRED_PHASES_BY_VARIANT[variant];
  const ordered: readonly string[] = CANONICAL_PHASE_IDS.filter((candidate) =>
    required.includes(candidate),
  );
  const targetIndex = ordered.indexOf("dod_check");
  for (const phaseId of ordered.slice(0, targetIndex)) {
    phases[phaseId] = openEarlier.includes(phaseId) ? { ...OPEN_ENTRY } : { ...COMPLETED_ENTRY };
  }
  phases.dod_check = { ...OPEN_ENTRY };
  if (variant === "lite") {
    // Canonical but outside the pinned LITE set: an open opaque phase that the
    // advisory must never name.
    phases.test_planning = { ...OPEN_ENTRY };
  }
  return stringify({ ...document, phases });
};

describe("TC-PHASE-003 row 6: out-of-order completion advisory", () => {
  test("a later completion lands and names the earlier open phase of the full set", async () => {
    await withPhaseHarness(
      outOfOrderFixture(FULL, "full", ["quality_gates"]),
      async (harness) => {
        const run = await complete(harness, "dod_check");
        expect(run.exitCode).toBe(0);
        const data = dataOf(run);
        expect(data).toMatchObject({
          outcome: "landed",
          operation: "complete",
          phase: "dod_check",
        });
        expect(data.advisory).toEqual({ class: "earlier-open", phases: ["quality_gates"] });
        expect(landingCount(harness)).toBe(1);
      },
      "row6-full",
    );
  });

  test("the advisory follows current state: a reopened earlier phase is named again", async () => {
    await withPhaseHarness(
      outOfOrderFixture(FULL, "full", []),
      async (harness) => {
        const completed = await complete(harness, "quality_gates");
        expect(completed.exitCode).toBe(0);
        expect(dataOf(completed).advisory).toBeUndefined();
        const reopened = await reopen(harness, "quality_gates", "gate reopened for a fix");
        expect(reopened.exitCode).toBe(0);
        const run = await complete(harness, "dod_check");
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).advisory).toEqual({
          class: "earlier-open",
          phases: ["quality_gates"],
        });
        expect(landingCount(harness)).toBe(3);
      },
      "row6-reopened",
    );
  });

  test("the ordered control lands with no advisory", async () => {
    await withPhaseHarness(
      outOfOrderFixture(FULL, "full", []),
      async (harness) => {
        const run = await complete(harness, "dod_check");
        expect(run.exitCode).toBe(0);
        const data = dataOf(run);
        expect(data.outcome).toBe("landed");
        expect(data.advisory).toBeUndefined();
        expect(landingCount(harness)).toBe(1);
      },
      "row6-ordered",
    );
  });

  test("a lite advisory names only earlier open phases of the pinned set", async () => {
    await withPhaseHarness(
      outOfOrderFixture(LITE, "lite", ["quality_gates"]),
      async (harness) => {
        const run = await complete(harness, "dod_check");
        expect(run.exitCode).toBe(0);
        const data = dataOf(run);
        expect(data.variant).toBe("lite");
        expect(data.advisory).toEqual({ class: "earlier-open", phases: ["quality_gates"] });
        const phases = (data.advisory as { readonly phases: readonly string[] }).phases;
        expect(phases).not.toContain("test_planning");
        expect(landingCount(harness)).toBe(1);
      },
      "row6-lite",
    );
  });
});

describe("TC-PHASE-009 command-level recording and projection", () => {
  test("the ledger is append-only through the command path and list equals the fold", async () => {
    await withPhaseHarness(
      FULL,
      async (harness) => {
        await complete(harness, "delivery");
        const firstPrefix = harness.rawLedgerLines();
        await reopen(harness, "delivery", "reopened via command");
        await complete(harness, "delivery");
        const lines = harness.rawLedgerLines();
        expect(harness.transitionPayloads()).toHaveLength(3);
        expect(lines.length).toBeGreaterThan(firstPrefix.length);
        expect(lines.slice(0, firstPrefix.length)).toEqual(firstPrefix);
        expect(harness.rawLedgerText().startsWith(firstPrefix.join("\n"))).toBe(true);

        const list = await harness.run(["list", PHASE_REF]);
        expect(list.exitCode).toBe(0);
        const data = dataOf(list);
        expect(data.phases).toMatchObject({
          delivery: { completed: harness.transitionPayloads()[2]?.["timestamp"] },
        });
        const landingPayload = harness.transitionPayloads()[2];
        for (const key of ["changeRef", "phaseId", "operation", "timestamp", "outcome"]) {
          expect(Object.hasOwn(landingPayload ?? {}, key)).toBe(true);
        }
      },
      "records",
    );
  });

  test("phase list on an absent registry is verified-empty and mutates nothing", async () => {
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const run = await harness.run(["list", PHASE_REF]);
        expect(run.exitCode).toBe(0);
        const data = dataOf(run);
        expect(data.verifiedEmpty).toBe(true);
        expect(data.phases).toEqual({});
        expect(evidenceOf(run)).toMatchObject({ class: "verified-empty", target: "registry" });
        expect(harness.rawLedgerLines()).toEqual([]);
      },
      "list-empty",
    );
  });
});
