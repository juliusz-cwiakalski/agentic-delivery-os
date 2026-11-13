/**
 * TC-TELEMETRY-018 — a non-opencode delivery folds its delivered
 * closeout-captured v1 records with classified degradation for the missing
 * lane/per-step detail and names the closeout-capture basis. Absence stays
 * reserved for a selection with no records of either plane (DEC-4, matrix S-03).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { computeSpendReport } from "../../packages/core/src/domain/spend";
import { readSpendLedger } from "../../packages/core/src/state/index";
import {
  foldTelemetryStore,
  makeStepRecord,
  makeV1Record,
  removeRoot,
  SESSION_A,
  SESSION_B,
  TELEMETRY_REF,
  tokens,
} from "../fixtures/telemetry";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const fold = (seed: Parameters<typeof foldTelemetryStore>[0], label: string) => {
  const seeded = foldTelemetryStore(seed, label);
  roots.push(seeded.root);
  return seeded;
};

describe("TC-TELEMETRY-018 non-opencode fold basis", () => {
  test("a Claude Code delivery renders from its v1 records, never as absence", () => {
    const seeded = fold(
      {
        v1: [
          makeV1Record({
            harnessKind: "claude-code",
            sessionId: SESSION_A,
            tokens: tokens({ input: 40, output: 10 }),
            calls: 3,
          }),
        ],
      },
      "dec4-claude",
    );
    expect(seeded.fold?.ok).toBe(true);
    if (seeded.fold === undefined || !seeded.fold.ok) return;
    expect(seeded.fold.data.tokensByClass.input).toBe(40);
    expect(seeded.fold.data.reconciliation.basis).toBe("closeout-capture");
    expect(seeded.fold.data.telemetryState).toBe("present");
  });

  test("the missing lane and per-step detail are disclosed, not invented", () => {
    const seeded = fold(
      { v1: [makeV1Record({ harnessKind: "claude-code", tokens: tokens({ input: 40 }) })] },
      "dec4-degradation",
    );
    if (seeded.fold === undefined || !seeded.fold.ok) return;
    const lanes = seeded.fold.data.breakdowns.lane;
    expect(lanes).toHaveLength(1);
    expect(lanes[0]?.value).toBeNull();
    // Closeout capture has no per-step records: the basis names the coarseness.
    expect(seeded.read.ok && seeded.read.value.steps).toEqual([]);
    expect(seeded.fold.data.reconciliation.basis).toBe("closeout-capture");
  });

  test("absence is reserved for a selection with no records of either plane", () => {
    const absent = fold({}, "dec4-absent");
    expect(absent.read.ok).toBe(true);
    if (!absent.read.ok) return;
    expect(absent.read.value.verifiedEmpty).toBe(true);
    const folded = computeSpendReport(absent.read.value, { workItemRef: TELEMETRY_REF });
    expect(folded.ok).toBe(false);
    if (folded.ok) return;
    expect(folded.absence.code).toBe("spend.telemetry-absent");
  });

  test("the paired present control renders beside the absence (non-vacuity)", () => {
    const present = fold(
      { v1: [makeV1Record({ harnessKind: "claude-code", tokens: tokens({ input: 1 }) })] },
      "dec4-present",
    );
    expect(present.fold?.ok).toBe(true);
    const absent = fold({}, "dec4-absent-control");
    expect(absent.fold?.ok).toBe(false);
    expect(present.read.ok && present.read.value.verifiedEmpty).toBe(false);
  });

  test("a mixed store keeps both planes and names the combination", () => {
    const seeded = fold(
      {
        v1: [
          makeV1Record({
            harnessKind: "claude-code",
            sessionId: SESSION_B,
            tokens: tokens({ input: 5 }),
          }),
        ],
        steps: [makeStepRecord({ sessionId: SESSION_A, tokens: tokens({ input: 7 }) })],
      },
      "dec4-mixed",
    );
    if (seeded.fold === undefined || !seeded.fold.ok) return;
    expect(seeded.fold.data.reconciliation.basis).toBe("combined");
    expect(seeded.fold.data.tokensByClass.input).toBe(12);
    // Two sessions, one baseline-less: the disclosure names the gap.
    expect(seeded.fold.data.reconciliation.excludedBaselineSessions).toBe(1);
    expect(
      seeded.fold.warnings.some((warning) => warning.startsWith("baseline-session-excluded")),
    ).toBe(true);
  });

  test("the read composes the same families for every harness kind", () => {
    const seeded = fold(
      {
        v1: [
          makeV1Record({ harnessKind: "claude-code", sessionId: SESSION_A }),
          makeV1Record({ harnessKind: "opencode", sessionId: SESSION_B }),
        ],
      },
      "dec4-kinds",
    );
    expect(seeded.read.ok).toBe(true);
    if (!seeded.read.ok) return;
    const kinds = seeded.read.value.records.map((record) => record.harnessKind).sort();
    expect(kinds).toEqual(["claude-code", "opencode"]);
    expect(readSpendLedger(seeded.store, TELEMETRY_REF).ok).toBe(true);
  });
});
