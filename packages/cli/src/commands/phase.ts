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
  type CommitIntentBasis,
  type CommitPlanPhaseContext,
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
import {
  classifyCommitDelta,
  type CommitActOutcome,
  type CommitActRequest,
  resolveCommitSkeleton,
} from "@delivery-os/core";
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
  readonly commitIntent?: "atomic" | "record-only";
  readonly commitIntentBasis?: CommitIntentBasis;
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

/** The durable commit evidence a re-run reads for convergence (DEC-7). */
export type PhaseCommitEvidence = {
  readonly recordPresent: boolean;
  readonly recordIntent?: "atomic" | "record-only";
  readonly recordBasis?: CommitIntentBasis;
  readonly transitionId?: string;
  readonly commitPresent: boolean;
  readonly commitSha?: string;
};

/** The plan-phase declaration read for the skeleton and staging scope. */
export type PhasePlanRead = {
  readonly planPresent: boolean;
  readonly planPhase?: CommitPlanPhaseContext;
};

/**
 * The injected atomic-completion seam (GH-227 F-6/F-7).
 *
 * The runtime edge binds the git, safety, commitlint, transport, telemetry, and
 * clock ports; the phase command owns grammar, idempotency, staging edits, and
 * the durable transition append.
 */
export type PhaseCommitExtension = {
  readonly phaseCommit: boolean;
  readonly readPlanPhase: (changeRef: string, phaseId: string) => PhasePlanRead;
  readonly readEvidence: (
    changeRef: string,
    phaseId: string,
  ) => PhaseCommitEvidence | Promise<PhaseCommitEvidence>;
  readonly currentHead: () => Promise<string | undefined>;
  readonly runAct: (request: CommitActRequest) => Promise<CommitActOutcome>;
};

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
  /** Present when the edge wires the default-on atomic completion (GH-227). */
  readonly commit?: PhaseCommitExtension;
  /** Injected delivery-session facts for the shared guard (DEC-6). */
  readonly sessionFacts?: () => { readonly insideDeliverySession: boolean; readonly sessionId?: string };
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether the staged document declares the phase completed (timestamp present). */
const stagedCompleted = (value: unknown, phaseId: string): boolean => {
  if (!isRecord(value) || !isRecord(value.phases)) return false;
  const entry = value.phases[phaseId];
  return isRecord(entry) && typeof entry.completed === "string";
};

/**
 * Matrix row 6: name the still-open phases that precede the target in the
 * effective variant's required order (C-4, PIN-4). Completion is read from the
 * post-transition document, so a reopened phase is open again; the advisory is
 * never a one-time snapshot and never names a phase outside the effective set.
 */
const earlierOpenPhases = (
  variant: PmNotesVariant,
  phaseId: string,
  value: unknown,
): readonly string[] => {
  const required = requiredPhasesFor(variant);
  const ordered: readonly string[] = CANONICAL_PHASE_IDS.filter((candidate) =>
    required.includes(candidate),
  );
  const targetIndex = ordered.indexOf(phaseId);
  if (targetIndex <= 0) return [];
  return ordered.slice(0, targetIndex).filter((candidate) => !stagedCompleted(value, candidate));
};

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

const completeWithCommit = async (
  runtime: PhaseCommandRuntime,
  extension: PhaseCommitExtension,
  input: {
    readonly changeRef: string;
    readonly phaseId: string;
    readonly timestamp: string;
    readonly read: Extract<PhasePmNotesRead, { ok: true }>;
    readonly staged: Extract<PhaseStagedEntry, { ok: true }>;
    readonly variant: PmNotesVariant;
    readonly registry: PhaseRegistryRead & { ok: true };
    readonly noCommit: boolean;
    readonly dryRun: boolean;
    readonly advisory: Record<string, unknown> | undefined;
  },
): Promise<TargetSuccess | TargetFailure> => {
  const { changeRef, phaseId, timestamp, read, staged, variant, registry, advisory } = input;
  const plan = extension.readPlanPhase(changeRef, phaseId);
  const scopePaths = plan.planPhase?.declaredScopePaths ?? [];
  const skeleton = resolveCommitSkeleton({
    ref: changeRef,
    refSource: "argument",
    phaseId,
    ...(plan.planPhase === undefined ? {} : { planPhase: plan.planPhase }),
  });
  const scopeSource = plan.planPresent ? "plan-phase" : "plan-absent";
  const actScope = { paths: scopePaths, source: scopeSource } as const;
  const evidence = await extension.readEvidence(changeRef, phaseId);
  const delta = classifyCommitDelta({
    recordPresent: evidence.recordPresent,
    ...(evidence.recordIntent === undefined ? {} : { recordIntent: evidence.recordIntent }),
    ...(evidence.recordBasis === undefined ? {} : { recordBasis: evidence.recordBasis }),
    ...(evidence.transitionId === undefined ? {} : { recordTransitionId: evidence.transitionId }),
    commitPresent: evidence.commitPresent,
    ...(evidence.commitSha === undefined ? {} : { commitSha: evidence.commitSha }),
  });

  const writeDocument = (): TargetFailure | undefined => {
    const written = runtime.writePmNotes(read.file, staged.text);
    return written.ok ? undefined : internalFailure(written.message);
  };
  const replaceProjection = (
    transitions: readonly PhaseTransitionRecord[],
  ): TargetFailure | undefined => {
    const replaced = runtime.replaceProjection({
      changeRef,
      transitions,
      fenceToken: runtime.newFenceToken(),
    });
    return replaced.ok ? undefined : stateFailure(replaced.error);
  };

  const base = {
    changeRef,
    phase: phaseId,
    operation: "complete",
    timestamp,
    variant,
    ...(advisory === undefined ? {} : { advisory }),
  } as const;

  const recordOnly = (
    basis: CommitIntentBasis,
  ): TargetSuccess | TargetFailure => {
    if (input.dryRun) {
      return {
        ok: true,
        data: {
          ...base,
          outcome: "landed",
          atomic: false,
          commitSkipped: basis,
          dryRun: true,
          evidence: { outcome: "landed", basis },
        },
      };
    }
    const appended = runtime.appendTransition({
      changeRef,
      phaseId,
      operation: "complete",
      timestamp,
      fenceToken: runtime.newFenceToken(),
      commitIntent: "record-only",
      commitIntentBasis: basis,
    });
    if (!appended.ok) return stateFailure(appended.error);
    const written = writeDocument();
    if (written !== undefined) return written;
    const projected = replaceProjection(appended.value.transitions);
    if (projected !== undefined) return projected;
    return {
      ok: true,
      data: {
        ...base,
        outcome: "landed",
        atomic: false,
        commitSkipped: basis,
        evidence: { outcome: "landed", basis },
      },
    };
  };

  if (delta.state === "record-record-only") {
    const basis = delta.basis ?? "skipped-no-pending-work";
    return {
      ok: true,
      data: {
        ...base,
        outcome: "no-op",
        atomic: false,
        commitSkipped: basis,
        reconciliation: { completed: "intentional-no-op", basis },
        evidence: { outcome: "no-op", basis, reconciliation: "intentional-no-op" },
      },
    };
  }

  if (delta.state === "both") {
    const completedAt = registry.transitions.find(
      (record) => record.phaseId === phaseId && record.operation === "complete",
    )?.timestamp;
    return {
      ok: true,
      data: {
        ...base,
        outcome: "no-op",
        atomic: true,
        commitSkipped: "no-op",
        reconciliation: {
          completed: "existing-completion",
          ...(evidence.commitSha === undefined ? {} : { detail: evidence.commitSha }),
        },
        evidence: {
          outcome: "no-op",
          basis: "already-completed",
          ...(completedAt === undefined ? {} : { completedAt }),
          commitSkipped: "no-op",
        },
      },
    };
  }

  if (delta.state === "commit-without-record") {
    if (input.dryRun) {
      return {
        ok: true,
        data: {
          ...base,
          outcome: "landed",
          atomic: true,
          commitSha: delta.commitSha,
          reconciliation: { completed: "transition" },
          dryRun: true,
          evidence: { outcome: "landed", reconciliation: "transition" },
        },
      };
    }
    const appended = runtime.appendTransition({
      changeRef,
      phaseId,
      operation: "complete",
      timestamp,
      fenceToken: runtime.newFenceToken(),
      commitIntent: "atomic",
    });
    if (!appended.ok) return stateFailure(appended.error);
    const written = writeDocument();
    if (written !== undefined) return written;
    const projected = replaceProjection(appended.value.transitions);
    if (projected !== undefined) return projected;
    return {
      ok: true,
      data: {
        ...base,
        outcome: "landed",
        atomic: true,
        commitSha: delta.commitSha,
        reconciliation: { completed: "transition" },
        evidence: { outcome: "landed", reconciliation: "transition" },
      },
    };
  }

  if (delta.state === "record-atomic-without-commit") {
    const baselineHead = (await extension.currentHead()) ?? "";
    const act = await extension.runAct({
      mode: "phase",
      skeleton,
      scope: actScope,
      ...(plan.planPhase?.summary === undefined ? {} : { planSummary: plan.planPhase.summary }),
      requiresBody: false,
      dryRun: input.dryRun,
      baselineHead,
      ...(delta.transitionId === undefined
        ? {}
        : { existingTransitionId: delta.transitionId }),
    });
    if (act.kind === "failure") return actFailure(act);
    if (act.kind === "no-pending-work") {
      return {
        ok: true,
        data: {
          ...base,
          outcome: "no-op",
          atomic: false,
          commitSkipped: "interrupted-atomic-no-pending-work",
          reconciliation: { completed: "intentional-no-op" },
          evidence: { outcome: "no-op", basis: "interrupted-atomic-no-pending-work" },
        },
      };
    }
    if (!input.dryRun) {
      // The record already landed; complete the document with the stored
      // transition timestamp so the projection fold stays byte-stable.
      const convergence = runtime.stageEntry(read.text, {
        phaseId,
        operation: "complete",
        timestamp: evidence.transitionId ?? timestamp,
      });
      if (!convergence.ok) return internalFailure("convergence document is not parseable");
      const writtenDoc = runtime.writePmNotes(read.file, convergence.text);
      if (!writtenDoc.ok) return internalFailure(writtenDoc.message);
      const projected = replaceProjection(registry.transitions);
      if (projected !== undefined) return projected;
    }
    return {
      ok: true,
      data: {
        ...base,
        outcome: "landed",
        atomic: true,
        ...(act.commitSha === undefined ? {} : { commitSha: act.commitSha }),
        reconciliation: { completed: "commit" },
        ...(input.dryRun ? { dryRun: true } : {}),
        evidence: { outcome: "landed", reconciliation: "commit" },
        commit: {
          subject: act.message.subject,
          stagedFiles: act.staging.include.map((entry) => entry.path),
          excluded: act.excluded,
          messageSource: act.messageSource,
          transport: act.transport,
          safety: act.safety,
          telemetry: act.telemetry,
        },
      },
    };
  }

  // Neither landed: the normal path (or a record-only opt-out).
  if (input.noCommit || !extension.phaseCommit) {
    return recordOnly(input.noCommit ? "opt-out-flag" : "config-disabled");
  }

  const baselineHead = (await extension.currentHead()) ?? "";
  let appendedTransitions: readonly PhaseTransitionRecord[] = registry.transitions;
  const act = await extension.runAct({
    mode: "phase",
    skeleton,
    scope: actScope,
    ...(plan.planPhase?.summary === undefined ? {} : { planSummary: plan.planPhase.summary }),
    requiresBody: false,
    dryRun: input.dryRun,
    baselineHead,
    appendTransition: async () => {
      const appended = runtime.appendTransition({
        changeRef,
        phaseId,
        operation: "complete",
        timestamp,
        fenceToken: runtime.newFenceToken(),
        commitIntent: "atomic",
      });
      if (!appended.ok) {
        return { ok: false, detail: appended.error.code };
      }
      appendedTransitions = appended.value.transitions;
      return { ok: true, transitionId: appended.value.record.timestamp };
    },
  });
  if (act.kind === "failure") return actFailure(act);
  if (act.kind === "no-pending-work") {
    return recordOnly("skipped-no-pending-work");
  }
  if (input.dryRun) {
    return {
      ok: true,
      data: {
        ...base,
        outcome: "landed",
        atomic: true,
        dryRun: true,
        subject: act.message.subject,
        ...(act.message.body === undefined ? {} : { body: act.message.body }),
        stagedFiles: act.staging.include.map((entry) => entry.path),
        excluded: act.excluded,
        messageSource: act.messageSource,
        transport: act.transport,
        evidence: { outcome: "landed" },
      },
    };
  }
  const written = writeDocument();
  if (written !== undefined) return written;
  const projected = replaceProjection(appendedTransitions);
  if (projected !== undefined) return projected;
  return {
    ok: true,
    data: {
      ...base,
      outcome: "landed",
      atomic: true,
      ...(act.commitSha === undefined ? {} : { commitSha: act.commitSha }),
      subject: act.message.subject,
      ...(act.message.body === undefined ? {} : { body: act.message.body }),
      stagedFiles: act.staging.include.map((entry) => entry.path),
      excluded: act.excluded,
      messageSource: act.messageSource,
      transport: act.transport,
      safety: act.safety,
      telemetry: act.telemetry,
      evidence: { outcome: "landed" },
    },
  };
};

const actFailure = (act: Extract<CommitActOutcome, { kind: "failure" }>): TargetFailure => ({
  ok: false,
  error: {
    kind: "commit",
    code: act.code,
    ...(act.detail === undefined ? {} : { summary: act.detail }),
    ...(act.findings === undefined ? {} : { findings: act.findings }),
    ...(act.excluded === undefined ? {} : { excluded: act.excluded }),
  },
});

const transitionTarget = async (
  runtime: PhaseCommandRuntime,
  grammar: Extract<Grammar, { kind: "complete" | "reopen" }>,
  noCommit: boolean,
): Promise<TargetSuccess | TargetFailure> => {
  const { changeRef, phaseId, kind } = grammar;
  if (kind === "complete" && runtime.sessionFacts?.().insideDeliverySession === true) {
    return {
      ok: false,
      error: {
        kind: "commit",
        code: "commit.session.context-refused",
        summary: "the commit primitive is invoked from outside a delivery session",
      },
    };
  }
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

  if (kind === "complete" && runtime.commit !== undefined) {
    return completeWithCommit(runtime, runtime.commit, {
      changeRef,
      phaseId,
      timestamp,
      read,
      staged,
      variant: verdict.variant,
      registry,
      noCommit,
      dryRun: false,
      advisory:
        kind === "complete" && !requiredPhasesFor(verdict.variant).includes(phaseId)
          ? { class: "outside-required-set", phase: phaseId, variant: verdict.variant }
          : kind === "complete" &&
              earlierOpenPhases(verdict.variant, phaseId, staged.value).length > 0
            ? {
                class: "earlier-open",
                phases: earlierOpenPhases(verdict.variant, phaseId, staged.value),
              }
            : undefined,
    });
  }

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

  const inRequiredSet = requiredPhasesFor(verdict.variant).includes(phaseId);
  const earlierOpen = earlierOpenPhases(verdict.variant, phaseId, staged.value);
  const advisory =
    kind === "complete" && !inRequiredSet
      ? { class: "outside-required-set", phase: phaseId, variant: verdict.variant }
      : kind === "complete" && earlierOpen.length > 0
        ? { class: "earlier-open", phases: earlierOpen }
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
 * Run one phase completion through the shared atomic path for the `commit
 * --phase` surface. The caller maps the returned phase data to DM-2.
 */
export const runPhaseCompleteForCommit = async (
  runtime: PhaseCommandRuntime,
  extension: PhaseCommitExtension,
  input: { readonly changeRef: string; readonly phaseId: string; readonly noCommit: boolean },
): Promise<TargetSuccess | TargetFailure> =>
  transitionTarget(
    runtime.commit === undefined ? { ...runtime, commit: extension } : runtime,
    { kind: "complete", changeRef: input.changeRef, phaseId: input.phaseId },
    input.noCommit,
  );

/**
 * Build the phase command definition. `positionals.max` is the widest shape
 * (`reopen`); narrower subcommand shapes are checked by the grammar.
 */
export const createPhaseCommandDefinition = (runtime: PhaseCommandRuntime): CommandDefinition => ({
  positionals: { max: 4 },
  flags: ["--no-commit"],
  humanSuccess: true,
  handler: async ({ positionals, flags }) => {
    const grammar = grammarOf(positionals);
    if ("ok" in grammar) return { error: grammar.error };
    const result =
      grammar.kind === "list"
        ? listTarget(runtime, grammar.changeRef)
        : await transitionTarget(runtime, grammar, flags["--no-commit"] === true);
    return result.ok ? { data: result.data } : { error: result.error };
  },
});
