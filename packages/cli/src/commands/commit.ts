/**
 * `commit` command — the commit primitive surface (GH-227 F-1..F-5, DM-2).
 *
 * Grammar and the session-context guard run first; the ref is resolved from the
 * argument, then the branch, then the change folder. The command computes the
 * staging set and skeleton, delegates the single atomic act to the injected
 * runtime, and returns DM-2 data. `--phase` exercises the same atomic
 * record-plus-commit primitive as `phase complete`.
 */

import {
  type CommitActOutcome,
  type CommitActRequest,
  type CommitTransportPorts,
  resolveCommitSkeleton,
  templateCommitMessage,
} from "@delivery-os/core";
import {
  CANONICAL_PHASE_IDS,
  type CommitEnvelopeData,
  type CommitPlanPhaseContext,
  type CommitPlanPhaseKind,
  type CommitRefSource,
  type CommitSessionFacts,
  type CommitTransportAvailability,
  type StateJsonValue,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";
import {
  type PhaseCommandRuntime,
  type PhaseCommitExtension,
  runPhaseCompleteForCommit,
} from "./phase.js";

/** The resolved change context read at the edge. */
export type CommitContext = {
  readonly currentPhaseId?: string;
  readonly planPresent: boolean;
  readonly phases: readonly CommitPlanPhaseContext[];
};

/** The injected commit surface runtime; all I/O and time are ports. */
export type CommitCommandRuntime = {
  readonly sessionFacts: () => CommitSessionFacts;
  /** The repository-relative change folder for the resolved ref, when present. */
  readonly readChangeFolder?: (changeRef: string) => string | undefined;
  readonly resolveRef: () =>
    | { readonly ref: string; readonly refSource: CommitRefSource }
    | undefined
    | Promise<{ readonly ref: string; readonly refSource: CommitRefSource } | undefined>;
  readonly readContext: (changeRef: string) => Promise<CommitContext> | CommitContext;
  readonly runAct: (request: CommitActRequest) => Promise<CommitActOutcome>;
  readonly currentHead: () => Promise<string | undefined>;
  readonly phase?: {
    readonly runtime: PhaseCommandRuntime;
    readonly extension: PhaseCommitExtension;
  };
};

const failure = (summary: string): { readonly error: Record<string, unknown> } => ({
  error: { kind: "input", code: "input.value.rejected", summary },
});

const commitFailure = (
  code: string,
  detail: string | undefined,
  extra: Record<string, unknown> = {},
): { readonly error: Record<string, unknown> } => ({
  error: { kind: "commit", code, ...(detail === undefined ? {} : { summary: detail }), ...extra },
});

const isCanonicalPhase = (phaseId: string): boolean =>
  (CANONICAL_PHASE_IDS as readonly string[]).includes(phaseId);

const REF_PATTERN = /^[A-Z][A-Z0-9]*-\d+$/;

const exclusionsOf = (act: Extract<CommitActOutcome, { kind: "landed" | "dry-run" }>) =>
  act.excluded;

/** The DM-2 success data for a landed or dry-run act. */
const dataFor = (source: {
  readonly changeRef: string;
  readonly act: Extract<CommitActOutcome, { kind: "landed" | "dry-run" }>;
  readonly atomic: boolean;
  readonly ledgerTransition?: StateJsonValue;
  readonly degradedScope?: boolean;
}): CommitEnvelopeData => ({
  changeRef: source.changeRef,
  subject: source.act.message.subject,
  ...(source.act.message.body === undefined ? {} : { body: source.act.message.body }),
  stagedFiles: source.act.staging.include.map((entry) => entry.path),
  excluded: exclusionsOf(source.act),
  ...(source.act.commitSha === undefined ? {} : { commitSha: source.act.commitSha }),
  messageSource: source.act.messageSource,
  transport: source.act.transport,
  atomic: source.atomic,
  ...(source.ledgerTransition === undefined ? {} : { ledgerTransition: source.ledgerTransition }),
  ...(source.act.kind === "dry-run" ? { dryRun: true } : {}),
  safety: source.act.safety,
  telemetry: source.act.telemetry,
  ...(source.degradedScope === true ? { degradedScope: "plan-absent" } : {}),
});

/**
 * The lifecycle vocabulary and the plan schema's phase kinds are different
 * namespaces. `delivery` covers the plan's delivery phases and
 * `delivery_planning` its planning phases; every other lifecycle phase has no
 * declared plan-phase correspondence and therefore degrades honestly instead
 * of impersonating a plan phase.
 */
const LIFECYCLE_PLAN_KINDS: Readonly<Record<string, readonly CommitPlanPhaseKind[]>> = {
  delivery: ["delivery"],
  delivery_planning: ["planning"],
};

/**
 * Resolve the plan-phase declaration for a lifecycle phase. Multiple matching
 * delivery phases contribute their union scope; a numeric phase id still
 * matches by identity for embedded callers.
 */
export const planPhaseForLifecycle = (
  phases: readonly CommitPlanPhaseContext[],
  lifecyclePhaseId: string | undefined,
): CommitPlanPhaseContext | undefined => {
  if (phases.length === 0) return undefined;
  // Undefined id = standalone skeleton donor only: staging scope is the union
  // of every phase, so this first phase supplies message context, not scope.
  if (lifecyclePhaseId === undefined) return phases[0];
  const exact = phases.find((entry) => entry.phaseId === lifecyclePhaseId);
  if (exact !== undefined) return exact;
  const kinds = LIFECYCLE_PLAN_KINDS[lifecyclePhaseId];
  if (kinds === undefined) return undefined;
  const matching = phases.filter((entry) => entry.kind !== undefined && kinds.includes(entry.kind));
  if (matching.length === 0) return undefined;
  if (matching.length === 1) return matching[0];
  const [kind] = kinds;
  const firstSummary = matching[0]?.summary;
  const summary =
    firstSummary !== undefined && matching.every((entry) => entry.summary === firstSummary)
      ? firstSummary
      : undefined;
  return {
    phaseId: lifecyclePhaseId,
    title: lifecyclePhaseId,
    ...(summary === undefined ? {} : { summary }),
    declaredScopePaths: [...new Set(matching.flatMap((entry) => entry.declaredScopePaths))].sort(),
    ...(kind === undefined ? {} : { kind }),
  };
};

const phaseContextOf = (
  context: CommitContext,
  phaseId: string | undefined,
): CommitPlanPhaseContext | undefined => planPhaseForLifecycle(context.phases, phaseId);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isMessageSource = (value: unknown): value is CommitEnvelopeData["messageSource"] =>
  value === "model" || value === "template";

const isTransport = (value: unknown): value is CommitEnvelopeData["transport"] =>
  value === "core-inference" || value === "harness-one-shot" || value === "none";

const excludedFrom = (value: unknown): CommitEnvelopeData["excluded"] | undefined => {
  if (!isRecord(value)) return undefined;
  const { forbiddenPaths, oversizedBinaries, untrackedNotStaged, noiseStripped, scopeDrift } =
    value;
  if (
    !isStringArray(forbiddenPaths) ||
    !isStringArray(oversizedBinaries) ||
    !isStringArray(untrackedNotStaged) ||
    !isStringArray(noiseStripped) ||
    !isStringArray(scopeDrift)
  ) {
    return undefined;
  }
  return { forbiddenPaths, oversizedBinaries, untrackedNotStaged, noiseStripped, scopeDrift };
};

const safetyFrom = (value: unknown): CommitEnvelopeData["safety"] | undefined => {
  if (!isRecord(value)) return undefined;
  if (typeof value.completed !== "boolean" || !isStringArray(value.findings)) return undefined;
  return { completed: value.completed, findings: value.findings };
};

const telemetryFrom = (value: unknown): CommitEnvelopeData["telemetry"] | undefined => {
  if (!isRecord(value)) return undefined;
  if (typeof value.emitted !== "boolean") return undefined;
  if (value.detail !== undefined && typeof value.detail !== "string") return undefined;
  return {
    emitted: value.emitted,
    ...(typeof value.detail === "string" ? { detail: value.detail } : {}),
  };
};

const internalFailure = (summary: string): { readonly error: Record<string, unknown> } => ({
  error: { kind: "fallback", summary },
});

/** Validate the phase completion's landed data into the DM-2 envelope shape. */
const envelopeFromPhase = (
  changeRef: string,
  phase: string,
  data: Record<string, unknown>,
): CommitEnvelopeData | undefined => {
  if (typeof data.subject !== "string" || !isStringArray(data.stagedFiles)) return undefined;
  const excluded = excludedFrom(data.excluded);
  const messageSource = isMessageSource(data.messageSource) ? data.messageSource : undefined;
  const transport = isTransport(data.transport) ? data.transport : undefined;
  const safety = safetyFrom(data.safety);
  const telemetry = telemetryFrom(data.telemetry);
  if (
    excluded === undefined ||
    messageSource === undefined ||
    transport === undefined ||
    safety === undefined ||
    telemetry === undefined
  ) {
    return undefined;
  }
  return {
    changeRef,
    subject: data.subject,
    ...(typeof data.body === "string" ? { body: data.body } : {}),
    stagedFiles: data.stagedFiles,
    excluded,
    ...(typeof data.commitSha === "string" ? { commitSha: data.commitSha } : {}),
    messageSource,
    transport,
    atomic: true,
    ledgerTransition: {
      phase,
      timestamp: typeof data.timestamp === "string" ? data.timestamp : "",
    },
    safety,
    telemetry,
  };
};

/** Build the commit command definition over the injected runtime. */
export const createCommitCommandDefinition = (
  runtime: CommitCommandRuntime,
): CommandDefinition => ({
  positionals: { max: 1 },
  flags: ["--dry-run"],
  requiresValue: ["--phase"],
  humanSuccess: true,
  handler: async ({ positionals, flags }) => {
    const [explicitRef, ...extra] = positionals;
    if (extra.length > 0) return failure(`unexpected argument "${extra[0] as string}"`);
    if (explicitRef !== undefined && !REF_PATTERN.test(explicitRef)) {
      return failure(`"${explicitRef}" is not a work item ref`);
    }
    const phaseFlag = flags["--phase"];
    const phaseIdFlag = typeof phaseFlag === "string" ? phaseFlag : undefined;
    if (phaseIdFlag !== undefined && !isCanonicalPhase(phaseIdFlag)) {
      return failure(`phase "${phaseIdFlag}" is not one of the canonical lifecycle phases`);
    }
    const dryRun = flags["--dry-run"] === true;

    const resolved =
      explicitRef === undefined
        ? await runtime.resolveRef()
        : { ref: explicitRef, refSource: "argument" as const };
    if (resolved === undefined) return failure("no work item ref is resolvable");
    const changeRef = resolved.ref;
    const context = await runtime.readContext(changeRef);
    const phaseId = phaseIdFlag ?? context.currentPhaseId;
    const planPhase = phaseContextOf(context, phaseId);
    const phaseCentric = phaseIdFlag !== undefined;
    const degradedScope = !context.planPresent || (phaseCentric && planPhase === undefined);

    if (phaseIdFlag !== undefined && runtime.phase !== undefined && !dryRun) {
      const completed = await runPhaseCompleteForCommit(
        runtime.phase.runtime,
        runtime.phase.extension,
        { changeRef, phaseId: phaseIdFlag, noCommit: false },
      );
      if (!completed.ok) return { error: completed.error };
      const data = completed.data;
      if (data.outcome === "landed") {
        const envelope = envelopeFromPhase(changeRef, phaseIdFlag, data);
        return envelope === undefined
          ? internalFailure("phase completion returned malformed success data")
          : { data: envelope };
      }
      return {
        data: {
          changeRef,
          subject: "",
          stagedFiles: [],
          excluded: {
            forbiddenPaths: [],
            oversizedBinaries: [],
            untrackedNotStaged: [],
            noiseStripped: [],
            scopeDrift: [],
          },
          messageSource: "template" as const,
          transport: "none" as const,
          atomic: true,
          ledgerTransition: { phase: phaseIdFlag, noOp: true },
          safety: { completed: true, findings: [] },
          telemetry: { emitted: false },
        } satisfies CommitEnvelopeData,
      };
    }

    const scopePaths =
      phaseIdFlag === undefined
        ? context.planPresent
          ? context.phases.flatMap((entry) => entry.declaredScopePaths)
          : [runtime.readChangeFolder?.(changeRef)].filter(
              (entry): entry is string => entry !== undefined,
            )
        : [
            ...(planPhase?.declaredScopePaths ?? []),
            ...[runtime.readChangeFolder?.(changeRef)].filter(
              (entry): entry is string => entry !== undefined,
            ),
          ];
    const scopeSource = !context.planPresent
      ? "plan-absent"
      : phaseCentric
        ? planPhase === undefined
          ? "plan-absent"
          : "plan-phase"
        : "plan-union";
    const skeleton = resolveCommitSkeleton({
      ref: changeRef,
      refSource: resolved.refSource,
      ...(phaseId === undefined ? {} : { phaseId }),
      ...(planPhase === undefined ? {} : { planPhase }),
    });
    const baselineHead = (await runtime.currentHead()) ?? "";
    const act = await runtime.runAct({
      mode: phaseIdFlag === undefined ? "standalone" : "phase",
      skeleton,
      scope: { paths: scopePaths, source: scopeSource },
      ...(planPhase?.summary === undefined ? {} : { planSummary: planPhase.summary }),
      requiresBody: false,
      dryRun,
      baselineHead,
    });
    if (act.kind === "failure") {
      return commitFailure(act.code, act.detail, {
        ...(act.findings === undefined ? {} : { findings: act.findings }),
        ...(act.excluded === undefined ? {} : { excluded: act.excluded }),
      });
    }
    if (act.kind === "no-pending-work") {
      if (dryRun && phaseIdFlag !== undefined) {
        const preview = templateCommitMessage({ skeleton });
        return {
          data: {
            changeRef,
            subject: preview.subject,
            stagedFiles: [],
            excluded: act.excluded,
            messageSource: "template",
            transport: "none",
            atomic: true,
            ledgerTransition: { phase: phaseIdFlag, noOp: true },
            dryRun: true,
            commitSkipped: "skipped-no-pending-work",
            safety: { completed: true, findings: [] },
            telemetry: { emitted: false },
            ...(degradedScope ? { degradedScope: "plan-absent" } : {}),
          } satisfies CommitEnvelopeData,
        };
      }
      return commitFailure("commit.staging-blocked-untracked", undefined, {
        excluded: act.excluded,
      });
    }
    return {
      data: dataFor({
        changeRef,
        act,
        atomic: phaseIdFlag !== undefined,
        ...(phaseIdFlag === undefined
          ? {}
          : { ledgerTransition: { phase: phaseIdFlag, noOp: true } }),
        ...(degradedScope ? { degradedScope: true } : {}),
      }),
    };
  },
});

/** The transport ports the edge binds into the act (documentation anchor). */
export type CommitRuntimePorts = {
  readonly transports: CommitTransportPorts;
  readonly availability: CommitTransportAvailability;
};
