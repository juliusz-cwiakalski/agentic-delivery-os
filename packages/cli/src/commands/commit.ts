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
  CANONICAL_PHASE_IDS,
  type CommitEnvelopeData,
  type CommitPlanPhaseContext,
  type CommitRefSource,
  type CommitSessionFacts,
  type CommitTransport,
  type CommitTransportAvailability,
  type StateJsonValue,
} from "@delivery-os/core/contracts";
import {
  resolveCommitSkeleton,
  type CommitActOutcome,
  type CommitActRequest,
  type CommitTransportPorts,
} from "@delivery-os/core";
import type { CommandDefinition } from "../index.js";
import {
  type PhaseCommitExtension,
  type PhaseCommandRuntime,
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
const dataFor = (input: {
  readonly changeRef: string;
  readonly act: Extract<CommitActOutcome, { kind: "landed" | "dry-run" }>;
  readonly atomic: boolean;
  readonly ledgerTransition?: StateJsonValue;
  readonly degradedScope?: boolean;
}): CommitEnvelopeData => ({
  changeRef: input.changeRef,
  subject: input.act.message.subject,
  ...(input.act.message.body === undefined ? {} : { body: input.act.message.body }),
  stagedFiles: input.act.staging.include.map((entry) => entry.path),
  excluded: exclusionsOf(input.act),
  ...(input.act.commitSha === undefined ? {} : { commitSha: input.act.commitSha }),
  messageSource: input.act.messageSource,
  transport: input.act.transport,
  atomic: input.atomic,
  ...(input.ledgerTransition === undefined ? {} : { ledgerTransition: input.ledgerTransition }),
  ...(input.act.kind === "dry-run" ? { dryRun: true } : {}),
  safety: input.act.safety,
  telemetry: input.act.telemetry,
  ...(input.degradedScope === true ? { degradedScope: "plan-absent" } : {}),
});

const phaseContextOf = (
  context: CommitContext,
  phaseId: string | undefined,
): CommitPlanPhaseContext | undefined =>
  phaseId === undefined
    ? context.phases[0]
    : (context.phases.find((entry) => entry.phaseId === phaseId) ?? context.phases[0]);

/** Build the commit command definition over the injected runtime. */
export const createCommitCommandDefinition = (runtime: CommitCommandRuntime): CommandDefinition => ({
  positionals: { max: 1 },
  flags: ["--dry-run"],
  requiresValue: ["--phase"],
  humanSuccess: true,
  handler: async ({ positionals, flags }) => {
    const facts = runtime.sessionFacts();
    if (facts.insideDeliverySession) {
      return {
        error: {
          kind: "commit",
          code: "commit.session.context-refused",
          summary: "the commit primitive is invoked from outside a delivery session",
        },
      };
    }

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
    const degradedScope = !context.planPresent;

    if (phaseIdFlag !== undefined && runtime.phase !== undefined && !dryRun) {
      const completed = await runPhaseCompleteForCommit(
        runtime.phase.runtime,
        runtime.phase.extension,
        { changeRef, phaseId: phaseIdFlag, noCommit: false },
      );
      if (!completed.ok) return { error: completed.error };
      const data = completed.data;
      if (data.outcome === "landed" && typeof data.subject === "string") {
        return {
          data: {
            changeRef,
            subject: data.subject,
            ...(typeof data.body === "string" ? { body: data.body } : {}),
            stagedFiles: Array.isArray(data.stagedFiles) ? data.stagedFiles : [],
            excluded: (data.excluded as CommitEnvelopeData["excluded"]) ?? {
              forbiddenPaths: [],
              oversizedBinaries: [],
              untrackedNotStaged: [],
              noiseStripped: [],
              scopeDrift: [],
            },
            ...(typeof data.commitSha === "string" ? { commitSha: data.commitSha } : {}),
            messageSource: (data.messageSource as CommitEnvelopeData["messageSource"]) ?? "template",
            transport: (data.transport as CommitTransport) ?? "none",
            atomic: true,
            ledgerTransition: {
              phase: phaseIdFlag,
              timestamp: typeof data.timestamp === "string" ? data.timestamp : "",
            },
            safety: (data.safety as CommitEnvelopeData["safety"]) ?? {
              completed: true,
              findings: [],
            },
            telemetry: (data.telemetry as CommitEnvelopeData["telemetry"]) ?? { emitted: false },
          } satisfies CommitEnvelopeData,
        };
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
        ? context.phases.flatMap((entry) => entry.declaredScopePaths)
        : (planPhase?.declaredScopePaths ?? []);
    const scopeSource =
      phaseIdFlag === undefined
        ? context.planPresent
          ? "plan-union"
          : "plan-absent"
        : context.planPresent
          ? "plan-phase"
          : "plan-absent";
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
