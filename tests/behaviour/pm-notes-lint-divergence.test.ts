/**
 * TC-F5-004..006 — the both-target lint detects a mirror divergence and never
 * repairs it (F-5, API-5, TDR-0044 §4/§5).
 *
 * Each case pairs a parsed pm-notes document with the verified fold the ledger
 * would produce. The rule is scoped to phases the ledger has history for and to
 * the `completed` field only: a null and a timestamp are different facts, a
 * ledger-less phase and a document-only completion are not flagged.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { LintCommandRuntime, LintRegistryRead } from "../../packages/cli/src/commands/lint";
import {
  CANONICAL_PHASE_IDS,
  DIVERGENT_VALUE_BOUND,
  type PhaseStateProjection,
  type PhaseTransitionRecord,
} from "../../packages/core/src/contracts/index";
import {
  classifyVerifyChange,
  classifyVerifyDocument,
  firstPhaseDivergence,
} from "../../packages/core/src/domain/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { divergencePair } from "../fixtures/lint/divergence";
import {
  completionRecord,
  type PhaseEntry,
  phaseNotesValue,
  REOPENED_AT,
  reopenRecord,
  T1,
  T2,
} from "../fixtures/phase/history";
import { runLint, runtimeForValue } from "./pm-notes-lint-command-support";

/** The change ref the delivered lint harness materialises its fixture under. */
const REF = "GH-179";
const PHASE = "delivery";
const OTHER = "specification";

/** Re-home a fixture history onto the harness's change ref. */
const withRef = (transitions: readonly PhaseTransitionRecord[]): readonly PhaseTransitionRecord[] =>
  transitions.map((record) => ({ ...record, changeRef: REF }));

/** Pair a document with the fold of the given history for the harness's ref. */
const pairOf = (
  entries: Readonly<Partial<Record<string, PhaseEntry>>>,
  transitions: readonly PhaseTransitionRecord[],
): { readonly document: unknown; readonly fold: PhaseStateProjection } =>
  divergencePair(entries, withRef(transitions), REF);

/** A registry read exposing the given fold; the delivered fields stay constant. */
const registryWith =
  (fold: PhaseStateProjection): (() => LintRegistryRead) =>
  () => ({
    ok: true,
    verifiedEmpty: false,
    recordCount: 1,
    verification: ["verified"],
    projection: { present: true },
    fold,
  });

/** Every canonical phase completed at T1 except the named one, left open. */
const completedExcept = (openPhaseId: string): Record<string, PhaseEntry> =>
  Object.fromEntries(
    CANONICAL_PHASE_IDS.map((phaseId) => [
      phaseId,
      phaseId === openPhaseId ? { started: null, completed: null } : { started: T1, completed: T1 },
    ]),
  );

const errorOf = (envelope: Record<string, unknown> | undefined): Record<string, unknown> => {
  const error = envelope?.error;
  if (typeof error !== "object" || error === null || Array.isArray(error)) {
    throw new Error("expected a failure envelope");
  }
  return error as Record<string, unknown>;
};

const dataOf = (envelope: Record<string, unknown> | undefined): Record<string, unknown> => {
  const data = envelope?.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("expected a success envelope");
  }
  return data as Record<string, unknown>;
};

const divergenceEvidence = (
  envelope: Record<string, unknown> | undefined,
): { readonly compared?: unknown; readonly findings?: unknown } => {
  const divergence = dataOf(envelope).divergence;
  return typeof divergence === "object" && divergence !== null
    ? (divergence as { readonly compared?: unknown; readonly findings?: unknown })
    : {};
};

const occurrences = (text: string, needle: string): number => text.split(needle).length - 1;

describe("TC-F5-004 a hand-edited completion yields exactly one lint.phases.divergent", () => {
  test("the finding names the phase and both bounded values at exit 1", async () => {
    const pair = pairOf({ [PHASE]: { started: T1, completed: T1 } }, [completionRecord(PHASE, T2)]);
    const fixture = runtimeForValue(pair.document, registryWith(pair.fold));
    try {
      const run = await runLint(fixture.runtime, [REF, "--pm-notes", "--registry"]);
      expect(run.exitCode).toBe(1);
      expect(run.envelope === undefined ? [] : assertEnvelopeContract(run.envelope)).toEqual([]);
      const error = errorOf(run.envelope);
      expect(error.code).toBe("lint.phases.divergent");
      expect(error.category).toBe("user");
      expect(error.retryable).toBe(false);
      expect(error.consequence).toBe("not_landed");
      expect(error.remediationHint).toContain("ledger is the truth");
      const summary = String(error.summary);
      expect(summary).toContain(`phases.${PHASE}.completed`);
      expect(summary).toContain(`document=${T1}`);
      expect(summary).toContain(`fold=${T2}`);
      expect(summary).toContain("re-derive the document from phase list");
      // Exactly one finding of that identity, and no success payload beside it.
      expect(run.envelope?.data).toBeUndefined();
      expect(occurrences(JSON.stringify(run.envelope), "lint.phases.divergent")).toBe(1);
    } finally {
      fixture.cleanup();
    }
  });

  test("an unchanged pair produces no finding and reports the compared count", async () => {
    const pair = pairOf({ [PHASE]: { started: T1, completed: T2 } }, [completionRecord(PHASE, T2)]);
    const fixture = runtimeForValue(pair.document, registryWith(pair.fold));
    try {
      const run = await runLint(fixture.runtime, [REF, "--pm-notes", "--registry"]);
      expect(run.exitCode).toBe(0);
      expect(run.envelope?.error).toBeUndefined();
      expect(divergenceEvidence(run.envelope)).toEqual({ compared: 1, findings: 0 });
    } finally {
      fixture.cleanup();
    }
  });

  test("a null document value and a timestamp fold are different facts", async () => {
    const pair = pairOf({ [PHASE]: { started: T1, completed: null } }, [
      completionRecord(PHASE, T2),
    ]);
    const fixture = runtimeForValue(pair.document, registryWith(pair.fold));
    try {
      const run = await runLint(fixture.runtime, [REF, "--pm-notes", "--registry"]);
      expect(run.exitCode).toBe(1);
      const summary = String(errorOf(run.envelope).summary);
      expect(summary).toContain("document=null");
      expect(summary).toContain(`fold=${T2}`);
    } finally {
      fixture.cleanup();
    }
  });

  test("a completed-then-reopened ledger compares against the cleared fold value", async () => {
    // complete(T1) → reopen: the fold's completion is null, the document claims T1.
    const pair = pairOf({ [PHASE]: { started: T1, completed: T1 } }, [
      completionRecord(PHASE, T1),
      reopenRecord(PHASE, REOPENED_AT),
    ]);
    const fixture = runtimeForValue(pair.document, registryWith(pair.fold));
    try {
      const run = await runLint(fixture.runtime, [REF, "--pm-notes", "--registry"]);
      expect(run.exitCode).toBe(1);
      const summary = String(errorOf(run.envelope).summary);
      expect(summary).toContain(`document=${T1}`);
      expect(summary).toContain("fold=null");
    } finally {
      fixture.cleanup();
    }
  });
});

describe("TC-F5-005 a ledger-less phase and a document-only completion are not flagged", () => {
  test("a document-only completion produces no finding", async () => {
    const pair = pairOf({ [PHASE]: { started: T1, completed: T1 } }, []);
    const fixture = runtimeForValue(pair.document, registryWith(pair.fold));
    try {
      const run = await runLint(fixture.runtime, [REF, "--pm-notes", "--registry"]);
      expect(run.exitCode).toBe(0);
      expect(run.envelope?.error).toBeUndefined();
      expect(divergenceEvidence(run.envelope)).toEqual({ compared: 0, findings: 0 });
    } finally {
      fixture.cleanup();
    }
  });

  test("a ledger-less phase is excluded while a paired divergence is flagged", async () => {
    const pair = pairOf(
      {
        [OTHER]: { started: T1, completed: T1 },
        [PHASE]: { started: T1, completed: T1 },
      },
      [completionRecord(PHASE, T2)],
    );
    const fixture = runtimeForValue(pair.document, registryWith(pair.fold));
    try {
      const run = await runLint(fixture.runtime, [REF, "--pm-notes", "--registry"]);
      expect(run.exitCode).toBe(1);
      const summary = String(errorOf(run.envelope).summary);
      // The paired positive names the ledger-backed phase, never the excluded one.
      expect(summary).toContain(`phases.${PHASE}.completed`);
      expect(summary).not.toContain(OTHER);
    } finally {
      fixture.cleanup();
    }
  });

  test("verify change keeps its delivered precedence for the same folder", async () => {
    // A document completion with no ledger transition is verify's declaration
    // question: the registry wins, so the phase is still missing.
    const declaredOnly = pairOf(completedExcept(PHASE), []);
    const classified = classifyVerifyDocument({ ok: true, value: declaredOnly.document });
    if (!classified.ok) throw new Error("the fixture document is not valid");
    const incomplete = classifyVerifyChange({
      changeRef: REF,
      document: classified,
      registry: {
        ok: true,
        present: false,
        verifiedEmpty: true,
        transitions: [],
        recordCount: 0,
      },
    });
    expect(incomplete.ok).toBe(false);
    if (incomplete.ok) throw new Error("expected the delivered incomplete verdict");
    expect(incomplete.code).toBe("verify.ledger.incomplete");
    expect(incomplete.summary).toContain(PHASE);

    // The same declaration plus the ledger transition finalizes, and the verdict
    // never resolves through the divergence identity.
    const withLedger = classifyVerifyChange({
      changeRef: REF,
      document: classified,
      registry: {
        ok: true,
        present: true,
        verifiedEmpty: false,
        transitions: [completionRecord(PHASE, T2)],
        recordCount: 1,
      },
    });
    expect(withLedger.ok).toBe(true);
    if (!withLedger.ok) throw new Error(`expected finished, got ${withLedger.code}`);
    expect(withLedger.data.result).toBe("finished");
    expect(withLedger.data.missingPhases).toEqual([]);
    expect(JSON.stringify(withLedger)).not.toContain("lint.phases.divergent");
  });
});

describe("TC-F5-008 the corpus sweep has no exclusion mechanism", () => {
  test("the rule consults no exclusion list and no corpus manifest", () => {
    const source = readFileSync(
      join(process.cwd(), "packages/core/src/domain/pm-notes-lint.ts"),
      "utf8",
    );
    // A finding is suppressed only by the declared scope (no ledger history) and
    // never by a list: the corpus manifest is a GH-179 pm-notes boundary, not an
    // input here.
    expect(source).not.toContain("corpus-exclusions");
    expect(source).not.toContain("exclude");
    expect(source).toContain("if (folded === undefined) continue;");
  });
});

describe("TC-F5-006 detection writes nothing and replays identically", () => {
  test("zero writes, fences, appends, tracker reads and clock reads; two runs agree", async () => {
    const pair = pairOf({ [PHASE]: { started: T1, completed: T1 } }, [completionRecord(PHASE, T2)]);
    const fixture = runtimeForValue(pair.document, registryWith(pair.fold));
    const counters = {
      pmNotesReads: 0,
      registryReads: 0,
      documentWrites: 0,
      appends: 0,
      fences: 0,
      trackerReads: 0,
      clockReads: 0,
    };
    const trap = (name: keyof typeof counters) => () => {
      counters[name] += 1;
      throw new Error(`detection reached ${String(name)}`);
    };
    const base = fixture.runtime;
    const counting = {
      ...base,
      readPmNotes: (changeRef: string) => {
        counters.pmNotesReads += 1;
        return base.readPmNotes(changeRef);
      },
      readRegistry: (changeRef: string) => {
        counters.registryReads += 1;
        return base.readRegistry(changeRef);
      },
      writePmNotes: trap("documentWrites"),
      appendTransition: trap("appends"),
      newFenceToken: trap("fences"),
      readTracker: trap("trackerReads"),
      nowIso: trap("clockReads"),
    } as unknown as LintCommandRuntime;
    const beforeFiles = readdirSync(fixture.root, { recursive: true }).sort();
    const beforeBytes = readFileSync(fixture.target, "utf8");
    try {
      const first = await runLint(counting, [REF, "--pm-notes", "--registry"]);
      const second = await runLint(counting, [REF, "--pm-notes", "--registry"]);
      expect(first.exitCode).toBe(1);
      expect(second.exitCode).toBe(1);
      expect(errorOf(first.envelope)).toEqual(errorOf(second.envelope));
      expect(counters.pmNotesReads).toBe(2);
      expect(counters.registryReads).toBe(2);
      expect(counters.documentWrites).toBe(0);
      expect(counters.appends).toBe(0);
      expect(counters.fences).toBe(0);
      expect(counters.trackerReads).toBe(0);
      expect(counters.clockReads).toBe(0);
      expect(readFileSync(fixture.target, "utf8")).toBe(beforeBytes);
      expect(readdirSync(fixture.root, { recursive: true }).sort()).toEqual(beforeFiles);
    } finally {
      fixture.cleanup();
    }
  });

  test("the comparison itself is pure and idempotent over the same inputs", () => {
    const pair = pairOf({ [PHASE]: { started: T1, completed: T1 } }, [completionRecord(PHASE, T2)]);
    const snapshot = JSON.stringify(pair.fold);
    const first = firstPhaseDivergence(pair.document, pair.fold);
    const second = firstPhaseDivergence(pair.document, pair.fold);
    expect(first).toEqual(second);
    expect(first).toEqual({
      phaseId: PHASE,
      documentCompleted: T1,
      foldCompleted: T2,
    });
    expect(JSON.stringify(pair.fold)).toBe(snapshot);

    // The canonical phase order decides which divergence is first, not map order.
    const twoPhases = pairOf(
      {
        [OTHER]: { started: T1, completed: T1 },
        [PHASE]: { started: T1, completed: T1 },
      },
      [completionRecord(PHASE, T2), completionRecord(OTHER, T2)],
    );
    expect(firstPhaseDivergence(twoPhases.document, twoPhases.fold)?.phaseId).toBe(OTHER);
  });

  test("a fold value beyond the declared bound is truncated in the finding", async () => {
    const long = `${T2}${"x".repeat(DIVERGENT_VALUE_BOUND + 10)}`;
    const fold: PhaseStateProjection = {
      schemaVersion: "delivery.registry.v1",
      changeRef: REF,
      phases: { [PHASE]: { started: T1, completed: long } },
    };
    const fixture = runtimeForValue(
      phaseNotesValue({ [PHASE]: { started: T1, completed: T1 } }),
      registryWith(fold),
    );
    try {
      const run = await runLint(fixture.runtime, [REF, "--pm-notes", "--registry"]);
      expect(run.exitCode).toBe(1);
      const summary = String(errorOf(run.envelope).summary);
      expect(summary).toContain(`fold=${long.slice(0, DIVERGENT_VALUE_BOUND)}…`);
      expect(summary).not.toContain(long);
    } finally {
      fixture.cleanup();
    }
  });
});
