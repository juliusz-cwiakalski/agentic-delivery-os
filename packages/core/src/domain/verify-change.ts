/**
 * Pure verify-change classification (GH-177 C-2, C-3, C-6, C-7, PIN-5).
 *
 * Two pinned stages: document classification reuses `lintPmNotes` unchanged and
 * decides every terminal document finding; the final classification merges the
 * declaration with the folded `phase.transition` history per required phase.
 * The module performs no I/O, invokes no parser, reads no clock/environment,
 * and keeps the registry fold semantics identical to `foldPhaseState`.
 */
import {
  ERROR_TABLE,
  type ErrorTableEntry,
  type PhaseTransitionRecord,
  PM_NOTES_REQUIRED_PHASES_BY_VARIANT,
  type PmNotesLintCode,
  type PmNotesParseOutcome,
  type PmNotesVariant,
  type StateFailure,
} from "#contracts";
import { lintPmNotes, type PmNotesLintFinding } from "./pm-notes-lint.js";

/** A verified document ready for the registry merge. */
export type VerifyDocumentReady = {
  readonly ok: true;
  readonly variant: PmNotesVariant;
  readonly requiredPhases: readonly string[];
  readonly declaredCompleted: readonly string[];
  readonly absentRequired: readonly string[];
};

/** The domain kind a classified verify failure belongs to. */
export type VerifyFailureKind = "lint" | "verify" | "state";

/** A classified verify failure: the exact identity and the C-6 summary. */
export type VerifyFailure = {
  readonly ok: false;
  readonly kind: VerifyFailureKind;
  readonly code: string;
  readonly summary: string;
};

/** Stage 1: document values or a terminal (or absence-only) classification. */
export type VerifyDocumentClassification = VerifyDocumentReady | VerifyFailure;

/** The registry facts the final stage consumes; a failure is classified. */
export type VerifyRegistryEvidence =
  | {
      readonly ok: true;
      readonly present: boolean;
      readonly verifiedEmpty: boolean;
      readonly transitions: readonly PhaseTransitionRecord[];
      readonly recordCount: number;
    }
  | { readonly ok: false; readonly error: StateFailure };

/** The structured success tuple (C-6). */
export type VerifyEvidence = {
  readonly declaration: {
    readonly completedCount: number;
    readonly requiredCount: number;
  };
  readonly registry: {
    readonly present: boolean;
    readonly verifiedEmpty: boolean;
    readonly recordCount: number;
    readonly transitionCount: number;
    readonly overlaidPhases: readonly string[];
  };
};

/** The success `data` payload: only `finished` ever yields one (C-6, D12). */
export type VerifyChangeSuccessData = {
  readonly changeRef: string;
  readonly target: "change";
  readonly result: "finished";
  readonly variant: PmNotesVariant;
  readonly requiredPhases: readonly string[];
  readonly completedPhases: readonly string[];
  readonly missingPhases: readonly string[];
  readonly evidence: VerifyEvidence;
};

/** The final verdict: one success payload or one classified failure. */
export type VerifyChangeVerdict =
  | { readonly ok: true; readonly data: VerifyChangeSuccessData }
  | VerifyFailure;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

const locationText = (finding: PmNotesLintFinding): string => {
  const { location } = finding;
  switch (location.kind) {
    case "document":
      return "document";
    case "top-level":
      return location.key;
    case "phase":
      return `phases.${location.phaseId}${location.field === undefined ? "" : `.${location.field}`}`;
    case "collection": {
      const base = `${location.collection}[${location.index}]`;
      return location.field === undefined ? base : `${base}.${location.field}`;
    }
  }
};

const findingDetail = (finding: PmNotesLintFinding): string | undefined => {
  if (finding.code !== "lint.notes.malformed" && finding.code !== "lint.keys.missing") {
    return undefined;
  }
  const detail = collapse(`${finding.detail} (at ${locationText(finding)})`);
  return detail.length === 0 ? undefined : detail;
};

/**
 * Build the deterministic C-6 summary. `missing` is rendered in the caller's
 * required-set order; `detail` is optional and absent for partial outcomes.
 */
export const formatVerifySummary = (
  result: "finished" | "partial" | "failed" | "state-unverified",
  variant: string,
  missing: readonly string[],
  detail?: string,
): string => {
  const missingText = missing.length === 0 ? "-" : missing.join(",");
  const base = `result=${result}; variant=${variant}; missing=${missingText}`;
  return detail === undefined ? base : `${base}; detail=${detail}`;
};

const rowFor = (code: string): ErrorTableEntry | undefined =>
  (ERROR_TABLE as readonly ErrorTableEntry[]).find((entry) => entry.code === code);

const failureOf = (finding: PmNotesLintFinding): VerifyFailure => ({
  ok: false,
  kind: "lint",
  code: finding.code,
  summary: formatVerifySummary("failed", "unknown", [], findingDetail(finding)),
});

const effectiveVariantOf = (value: unknown): PmNotesVariant =>
  isRecord(value) && value.variant === "lite" ? "lite" : "full";

const declaredCompletedOf = (value: unknown, requiredPhases: readonly string[]): string[] => {
  if (!isRecord(value) || !isRecord(value.phases)) return [];
  const phases = value.phases;
  return requiredPhases.filter((phaseId) => {
    const entry = phases[phaseId];
    return isRecord(entry) && typeof entry.completed === "string";
  });
};

/**
 * Stage 1 — classify the parsed document. Terminal findings (parse, keys,
 * value types, unknown variant) stop here; a required-phase-presence finding is
 * recorded and the caller proceeds to the registry read (C-7).
 */
export const classifyVerifyDocument = (
  input: PmNotesParseOutcome,
): VerifyDocumentClassification => {
  const verdict = lintPmNotes(input);
  if (!verdict.ok) {
    const finding = verdict.finding;
    if (finding.code === "lint.phases.incomplete") {
      if (!input.ok) return failureOf(finding);
      const variant = effectiveVariantOf(input.value);
      return {
        ok: true,
        variant,
        requiredPhases: PM_NOTES_REQUIRED_PHASES_BY_VARIANT[variant],
        declaredCompleted: declaredCompletedOf(
          input.value,
          PM_NOTES_REQUIRED_PHASES_BY_VARIANT[variant],
        ),
        absentRequired: [...finding.offenders],
      };
    }
    return failureOf(finding);
  }
  if (!input.ok) {
    return {
      ok: false,
      kind: "lint",
      code: "lint.notes.malformed",
      summary: formatVerifySummary("failed", "unknown", []),
    };
  }
  const requiredPhases = PM_NOTES_REQUIRED_PHASES_BY_VARIANT[verdict.variant];
  return {
    ok: true,
    variant: verdict.variant,
    requiredPhases,
    declaredCompleted: declaredCompletedOf(input.value, requiredPhases),
    absentRequired: [],
  };
};

/** One folded phase entry, matching `foldPhaseState` semantics exactly. */
type FoldedPhase = { readonly started: string; readonly completed: string | null };

const foldTransitions = (
  transitions: readonly PhaseTransitionRecord[],
): Map<string, FoldedPhase> => {
  const phases = new Map<string, FoldedPhase>();
  for (const transition of transitions) {
    const previous = phases.get(transition.phaseId);
    if (transition.operation === "complete") {
      phases.set(transition.phaseId, {
        started: previous?.started ?? transition.timestamp,
        completed: transition.timestamp,
      });
      continue;
    }
    if (previous !== undefined) {
      phases.set(transition.phaseId, { started: previous.started, completed: null });
    }
  }
  return phases;
};

const stateFailureOf = (variant: PmNotesVariant, error: StateFailure): VerifyFailure => {
  const row = rowFor(error.code);
  const token = row?.category === "platform" ? "state-unverified" : "failed";
  const detail = row?.summary === undefined ? undefined : collapse(row.summary);
  return {
    ok: false,
    kind: "state",
    code: error.code,
    summary: formatVerifySummary(token, variant, [], detail),
  };
};

/**
 * Stage 2 — final classification over registry facts. Registry evidence
 * overrides the declaration for every phase it mentioned; absent evidence is
 * never negative evidence; absence precedence selects `lint.phases.incomplete`
 * before `verify.ledger.incomplete` (C-3, C-7).
 */
export const classifyVerifyChange = (input: {
  readonly changeRef: string;
  readonly document: VerifyDocumentReady;
  readonly registry: VerifyRegistryEvidence;
}): VerifyChangeVerdict => {
  const { document } = input;
  if (!input.registry.ok) return stateFailureOf(document.variant, input.registry.error);

  const folded = foldTransitions(input.registry.transitions);
  const overlaidPhases = document.requiredPhases.filter((phaseId) => folded.has(phaseId));
  const completedPhases = document.requiredPhases.filter((phaseId) => {
    const foldedPhase = folded.get(phaseId);
    if (foldedPhase !== undefined) return foldedPhase.completed !== null;
    return document.declaredCompleted.includes(phaseId);
  });
  const completed = new Set(completedPhases);
  const missingPhases = document.requiredPhases.filter((phaseId) => !completed.has(phaseId));
  const stillAbsent = document.absentRequired.filter((phaseId) => !folded.has(phaseId));

  const evidence: VerifyEvidence = {
    declaration: {
      completedCount: document.declaredCompleted.length,
      requiredCount: document.requiredPhases.length,
    },
    registry: {
      present: input.registry.present,
      verifiedEmpty: input.registry.verifiedEmpty,
      recordCount: input.registry.recordCount,
      transitionCount: input.registry.transitions.length,
      overlaidPhases,
    },
  };

  if (missingPhases.length === 0) {
    return {
      ok: true,
      data: {
        changeRef: input.changeRef,
        target: "change",
        result: "finished",
        variant: document.variant,
        requiredPhases: [...document.requiredPhases],
        completedPhases,
        missingPhases: [],
        evidence,
      },
    };
  }

  const code = stillAbsent.length > 0 ? "lint.phases.incomplete" : "verify.ledger.incomplete";
  return {
    ok: false,
    kind: code.startsWith("verify.") ? "verify" : "lint",
    code,
    summary: formatVerifySummary("partial", document.variant, missingPhases),
  };
};

/** Re-exported so callers can name the reused lint identity type. */
export type { PmNotesLintCode };
