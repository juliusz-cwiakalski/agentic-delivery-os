/**
 * `phase` command — the only schema-validated write path for phase state
 * (GH-179 C-4, D4).
 *
 * Grammar is validated first: a missing/empty reopen reason or a phase id
 * outside the canonical vocabulary rejects with `input.value.rejected` before
 * target resolution, state inspection, or mutation. A mutating invocation then
 * stages the entry edit in memory, lints the staged document, decides
 * idempotency from the verified registry ledger fold, and only on a landing
 * appends one transition, writes the document, and replaces the projection.
 * Handlers return data or errors; the CLI edge owns streams, rendering, and
 * exit codes.
 */
import { lintPmNotes, type PmNotesLintFinding } from "@delivery-os/core";
import {
  CANONICAL_PHASE_IDS,
  type PhaseStateProjection,
  type PhaseTransitionOperation,
  type PhaseTransitionRecord,
  PM_NOTES_REQUIRED_PHASES_BY_VARIANT,
  type PmNotesParseFailure,
  type PmNotesVariant,
  REGISTRY_SCHEMA_VERSION,
  type StateFailure,
  type StateReadEvidence,
  type StateResult,
} from "@delivery-os/core/contracts";
import { foldPhaseState } from "@delivery-os/core/state";
import type { CommandDefinition } from "../index.js";

/** A pm-notes target read at the edge: text plus values, absence, or a failure. */
export type PhasePmNotesRead =
  | { readonly ok: true; readonly file: string; readonly text: string; readonly value: unknown }
  | { readonly ok: false; readonly reason: "missing" }
  | {
      readonly ok: false;
      readonly reason: "malformed";
      readonly file: string;
      readonly parseFailure: PmNotesParseFailure;
    };

/** A staged document edit; nothing has been written. */
export type PhaseStagedEntry =
  | { readonly ok: true; readonly value: unknown; readonly text: string }
  | { readonly ok: false; readonly parseFailure: PmNotesParseFailure };

/** A verified registry read: history plus the state layer's evidence. */
export type PhaseRegistryRead =
  | {
      readonly ok: true;
      readonly verifiedEmpty: boolean;
      readonly transitions: readonly PhaseTransitionRecord[];
      readonly evidence: StateReadEvidence;
    }
  | { readonly ok: false; readonly error: StateFailure };

export type PhaseTransitionWrite = {
  readonly changeRef: string;
  readonly phaseId: string;
  readonly operation: PhaseTransitionOperation;
  readonly timestamp: string;
  readonly fenceToken: string;
  readonly reason?: string;
};

export type PhaseTransitionWriteOutcome = {
  readonly record: PhaseTransitionRecord;
  readonly transitions: readonly PhaseTransitionRecord[];
  readonly fenceReleased: boolean;
};

export type PhaseProjectionWrite = {
  readonly changeRef: string;
  readonly transitions: readonly PhaseTransitionRecord[];
  readonly fenceToken: string;
};

export type PhaseProjectionWriteOutcome = {
  readonly projection: PhaseStateProjection;
  readonly fenceReleased: boolean;
};

export type PhaseWriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/** Everything the phase surface touches; all I/O, time, and state are injected. */
export type PhaseCommandRuntime = {
  readonly readPmNotes: (changeRef: string) => PhasePmNotesRead;
  readonly stageEntry: (
    text: string,
    edit: {
      readonly phaseId: string;
      readonly operation: PhaseTransitionOperation;
      readonly timestamp: string;
    },
  ) => PhaseStagedEntry;
  readonly readRegistry: (changeRef: string) => PhaseRegistryRead;
  readonly appendTransition: (
    request: PhaseTransitionWrite,
  ) => StateResult<PhaseTransitionWriteOutcome>;
  readonly replaceProjection: (
    request: PhaseProjectionWrite,
  ) => StateResult<PhaseProjectionWriteOutcome>;
  readonly writePmNotes: (file: string, text: string) => PhaseWriteResult;
  readonly nowIso: () => string;
  readonly newFenceToken: () => string;
};

type TargetFailure = { readonly ok: false; readonly error: Record<string, unknown> };
type TargetSuccess = { readonly ok: true; readonly data: Record<string, unknown> };

type Grammar =
  | { readonly kind: "list"; readonly changeRef: string }
  | {
      readonly kind: "complete";
      readonly changeRef: string;
      readonly phaseId: string;
    }
  | {
      readonly kind: "reopen";
      readonly changeRef: string;
      readonly phaseId: string;
      readonly reason: string;
    };

const isCanonicalPhase = (phaseId: string): boolean =>
  (CANONICAL_PHASE_IDS as readonly string[]).includes(phaseId);

const invocationError = (summary: string): TargetFailure => ({
  ok: false,
  error: { kind: "input", code: "input.value.rejected", summary },
});

/** Grammar runs before any runtime call (D4, rows 7-8). */
const grammarOf = (positionals: readonly string[]): Grammar | TargetFailure => {
  const [subcommand, changeRef, phaseId, reason, ...extra] = positionals;
  if (subcommand === undefined) return invocationError("phase requires a subcommand");
  if (changeRef === undefined) return invocationError(`phase ${subcommand} requires a change ref`);
  if (extra.length > 0) return invocationError(`unexpected argument "${extra[0] as string}"`);
  if (subcommand === "list") {
    if (phaseId !== undefined) return invocationError("phase list takes exactly one change ref");
    return { kind: "list", changeRef };
  }
  if (subcommand !== "complete" && subcommand !== "reopen") {
    return invocationError(`unknown phase subcommand "${subcommand}"`);
  }
  if (phaseId === undefined) return invocationError(`phase ${subcommand} requires a phase id`);
  if (!isCanonicalPhase(phaseId)) {
    return invocationError(`phase "${phaseId}" is not one of the canonical lifecycle phases`);
  }
  if (subcommand === "complete") {
    if (reason !== undefined) return invocationError("phase complete takes no reason");
    return { kind: "complete", changeRef, phaseId };
  }
  if (reason === undefined || reason.trim().length === 0) {
    return invocationError("phase reopen requires a non-empty reason");
  }
  return { kind: "reopen", changeRef, phaseId, reason };
};

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

const lintFailure = (finding: PmNotesLintFinding): TargetFailure => ({
  ok: false,
  error: {
    kind: "lint",
    code: finding.code,
    summary: `${finding.detail} (at ${locationText(finding)})`,
  },
});

const stateFailure = (error: StateFailure): TargetFailure => ({
  ok: false,
  error: { ...error },
});

const internalFailure = (message: string): TargetFailure => ({
  ok: false,
  error: { kind: "fallback", summary: message },
});

const targetFailure = (read: PhasePmNotesRead): TargetFailure | undefined => {
  if (read.ok) return undefined;
  if (read.reason === "missing") {
    return {
      ok: false,
      error: {
        kind: "lint",
        code: "lint.target.missing",
        summary: "pm-notes target is missing for the named change ref",
      },
    };
  }
  const verdict = lintPmNotes({ ok: false, parseFailure: read.parseFailure });
  return verdict.ok
    ? internalFailure("pm-notes target is not parseable")
    : lintFailure(verdict.finding);
};

const requiredPhasesFor = (variant: PmNotesVariant): readonly string[] =>
  PM_NOTES_REQUIRED_PHASES_BY_VARIANT[variant];

const listTarget = (
  runtime: PhaseCommandRuntime,
  changeRef: string,
): TargetSuccess | TargetFailure => {
  const registry = runtime.readRegistry(changeRef);
  if (!registry.ok) return stateFailure(registry.error);
  const projection = foldPhaseState(changeRef, registry.transitions);
  return {
    ok: true,
    data: {
      ...projection,
      schemaVersion: REGISTRY_SCHEMA_VERSION,
      verifiedEmpty: registry.verifiedEmpty,
      evidence: {
        class: registry.verifiedEmpty ? "verified-empty" : "verified",
        target: "registry",
        recordCount: registry.evidence.recordCount,
        verification: registry.evidence.verification,
      },
    },
  };
};

const noOp = (
  basis: "already-completed" | "not-completed",
  changeRef: string,
  phaseId: string,
  extra: Record<string, unknown>,
): TargetSuccess => ({
  ok: true,
  data: {
    changeRef,
    phase: phaseId,
    outcome: "no-op",
    evidence: { outcome: "no-op", basis, phase: phaseId, ...extra },
  },
});

const transitionTarget = (
  runtime: PhaseCommandRuntime,
  grammar: Extract<Grammar, { kind: "complete" | "reopen" }>,
): TargetSuccess | TargetFailure => {
  const { changeRef, phaseId, kind } = grammar;
  const read = runtime.readPmNotes(changeRef);
  if (!read.ok) return targetFailure(read) ?? internalFailure("target read");

  const timestamp = runtime.nowIso();
  const staged = runtime.stageEntry(read.text, { phaseId, operation: kind, timestamp });
  if (!staged.ok) {
    const verdict = lintPmNotes({ ok: false, parseFailure: staged.parseFailure });
    return verdict.ok
      ? internalFailure("staged document is not parseable")
      : lintFailure(verdict.finding);
  }
  const verdict = lintPmNotes({ ok: true, value: staged.value });
  if (!verdict.ok) return lintFailure(verdict.finding);

  const registry = runtime.readRegistry(changeRef);
  if (!registry.ok) return stateFailure(registry.error);
  const folded = foldPhaseState(changeRef, registry.transitions);
  const completed = folded.phases[phaseId]?.completed ?? null;

  if (kind === "complete" && completed !== null) {
    return noOp("already-completed", changeRef, phaseId, { completedAt: completed });
  }
  if (kind === "reopen" && completed === null) {
    return noOp("not-completed", changeRef, phaseId, { reason: grammar.reason });
  }

  const reason = kind === "reopen" ? grammar.reason : undefined;
  const appended = runtime.appendTransition({
    changeRef,
    phaseId,
    operation: kind,
    timestamp,
    fenceToken: runtime.newFenceToken(),
    ...(reason === undefined ? {} : { reason }),
  });
  if (!appended.ok) return stateFailure(appended.error);

  const written = runtime.writePmNotes(read.file, staged.text);
  if (!written.ok) return internalFailure(written.message);

  const replaced = runtime.replaceProjection({
    changeRef,
    transitions: appended.value.transitions,
    fenceToken: runtime.newFenceToken(),
  });
  if (!replaced.ok) return stateFailure(replaced.error);

  const advisory =
    kind === "complete" && !requiredPhasesFor(verdict.variant).includes(phaseId)
      ? { class: "outside-required-set", phase: phaseId, variant: verdict.variant }
      : undefined;

  return {
    ok: true,
    data: {
      changeRef,
      phase: phaseId,
      operation: kind,
      outcome: "landed",
      timestamp,
      variant: verdict.variant,
      ...(reason === undefined ? {} : { reason }),
      ...(advisory === undefined ? {} : { advisory }),
      evidence: {
        outcome: "landed",
        ...(reason === undefined ? {} : { reason }),
      },
    },
  };
};

/**
 * Build the phase command definition. `positionals.max` is the widest shape
 * (`reopen`); narrower subcommand shapes are checked by the grammar.
 */
export const createPhaseCommandDefinition = (runtime: PhaseCommandRuntime): CommandDefinition => ({
  positionals: { max: 4 },
  humanSuccess: true,
  handler: ({ positionals }) => {
    const grammar = grammarOf(positionals);
    if ("ok" in grammar) return { error: grammar.error };
    const result =
      grammar.kind === "list"
        ? listTarget(runtime, grammar.changeRef)
        : transitionTarget(runtime, grammar);
    return result.ok ? { data: result.data } : { error: result.error };
  },
});
