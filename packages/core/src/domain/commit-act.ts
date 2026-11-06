/**
 * The single shared commit act (GH-227 F-6, F-7, DEC-8, DEC-9).
 *
 * Ordering is binding: compute the staging set, run the deterministic safety
 * pass, build the bundle only from scanned content, select a transport, make
 * the constrained call(s), validate, stage precisely, then create the commit
 * object. For an atomic completion the transition append follows the commit
 * object and a failed append restores both sides. Telemetry is emitted last and
 * never gates a landed commit. All I/O, time, and state are injected ports.
 */
import {
  COMMIT_MAX_OUTPUT_TOKENS,
  COMMIT_TEMPERATURE,
  type CommitEnvelopeData,
  type CommitErrorCode,
  type CommitGitPort,
  type CommitlintPort,
  type CommitMessageDraft,
  type CommitMessageSource,
  type CommitSafetyPort,
  type CommitScopeSource,
  type CommitSkeleton,
  type CommitStagingPlan,
  type CommitTelemetryRecord,
  type CommitTokenSpend,
  type CommitTransport,
  type CommitTransportAvailability,
  type CommitTransportRequest,
} from "#contracts";
import { buildCommitBundle } from "./commit-bundle.js";
import {
  renderCommitMessage,
  sanitizeCommitMessage,
  templateCommitMessage,
  validateCommitMessage,
} from "./commit-message.js";
import { classifyCommitSafety, findingClasses } from "./commit-safety.js";
import { computeStagingPlan } from "./commit-staging.js";
import { type CommitTransportPorts, generateCommitMessage } from "./commit-transport.js";

/** The staging scope the act computes against. */
export type CommitActScope = {
  readonly paths: readonly string[];
  readonly source: CommitScopeSource;
};

/** One act request; every fact is resolved before the call. */
export type CommitActRequest = {
  readonly mode: "standalone" | "phase";
  readonly skeleton: CommitSkeleton;
  readonly scope: CommitActScope;
  readonly planSummary?: string;
  readonly requiresBody: boolean;
  readonly dryRun: boolean;
  readonly baselineHead: string;
  /** Present when an existing transition is the durable identity (convergence). */
  readonly existingTransitionId?: string;
  /**
   * The phase record append; its failure aborts the whole act. The landed
   * commit SHA is passed so the record itself carries durable commit evidence
   * (the append follows commit-object creation, so the SHA is known here).
   */
  readonly appendTransition?: (details: {
    readonly commitSha: string;
  }) => Promise<
    | { readonly ok: true; readonly transitionId: string }
    | { readonly ok: false; readonly detail: string }
  >;
};

/** The injected seams; every one is a port, never a concrete implementation. */
export type CommitActPorts = {
  readonly git: CommitGitPort;
  readonly safety: CommitSafetyPort;
  readonly commitlint: CommitlintPort;
  readonly transports: CommitTransportPorts;
  readonly availability: CommitTransportAvailability;
  readonly appendTelemetry: (
    record: CommitTelemetryRecord,
  ) => Promise<{ readonly ok: true } | { readonly ok: false; readonly detail: string }>;
  readonly nowIso: () => string;
};

/** The envelope exclusion disclosure shape (DM-2). */
export type CommitExcluded = CommitEnvelopeData["excluded"];

const excludedOf = (staging: CommitStagingPlan, noise: readonly string[]): CommitExcluded => ({
  forbiddenPaths: staging.excluded
    .filter((entry) => entry.kind === "forbidden-path")
    .map((entry) => entry.path),
  oversizedBinaries: staging.excluded
    .filter((entry) => entry.kind === "oversized-binary")
    .map((entry) => entry.path),
  untrackedNotStaged: [...staging.untrackedNotStaged],
  noiseStripped: [...noise],
  scopeDrift: [...staging.scopeDrift],
});

/** The landed/dry-run success shape the command surfaces consume. */
export type CommitActSuccess = {
  readonly kind: "landed" | "dry-run";
  readonly staging: CommitStagingPlan;
  readonly excluded: CommitExcluded;
  readonly message: CommitMessageDraft;
  readonly messageSource: CommitMessageSource;
  readonly transport: CommitTransport;
  readonly tokenSpend: CommitTokenSpend;
  readonly failover: readonly { readonly transport: CommitTransport; readonly reason: string }[];
  readonly commitSha?: string;
  readonly transitionId?: string;
  readonly safety: CommitEnvelopeData["safety"];
  readonly telemetry: CommitEnvelopeData["telemetry"];
};

/** A completion with no stageable pending work: the transition lands alone. */
export type CommitActNoPending = {
  readonly kind: "no-pending-work";
  readonly staging: CommitStagingPlan;
  readonly excluded: CommitExcluded;
};

/** A classified act failure; nothing has landed on the clean-abort path. */
export type CommitActFailure = {
  readonly kind: "failure";
  readonly code: CommitErrorCode;
  readonly detail?: string;
  readonly findings?: readonly string[];
  readonly excluded?: CommitExcluded;
};

export type CommitActOutcome = CommitActSuccess | CommitActNoPending | CommitActFailure;

const zeroSpend = (): CommitTokenSpend => ({ inputTokens: 0, outputTokens: 0 });

const addSpend = (left: CommitTokenSpend, right: CommitTokenSpend): CommitTokenSpend => ({
  inputTokens: left.inputTokens + right.inputTokens,
  outputTokens: left.outputTokens + right.outputTokens,
});

const distinctAreas = (staging: CommitStagingPlan): number =>
  new Set(staging.include.map((entry) => entry.path.split("/")[0] ?? entry.path)).size;

/**
 * Resolve the message through at most two model calls, then the template.
 * A template that still violates repo commitlint is `commit.commitlint-failed`.
 */
const resolveMessage = async (
  request: CommitActRequest,
  ports: CommitActPorts,
  bundle: ReturnType<typeof buildCommitBundle>["bundle"],
  staging: CommitStagingPlan,
  topPath: string | undefined,
): Promise<
  | {
      readonly ok: true;
      readonly message: CommitMessageDraft;
      readonly source: CommitMessageSource;
      readonly transport: CommitTransport;
      readonly tokenSpend: CommitTokenSpend;
      readonly failover: readonly {
        readonly transport: CommitTransport;
        readonly reason: string;
      }[];
    }
  | {
      readonly ok: false;
      readonly code: "commit.commitlint-failed";
      readonly detail: string;
    }
> => {
  const requiresBody = request.requiresBody || distinctAreas(staging) > 1;
  let spend = zeroSpend();
  let failover: { transport: CommitTransport; reason: string }[] = [];
  let feedback: readonly string[] = [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const transportRequest: CommitTransportRequest = {
      skeleton: request.skeleton,
      bundle,
      temperature: COMMIT_TEMPERATURE,
      maxOutputTokens: COMMIT_MAX_OUTPUT_TOKENS,
      schemaId: "delivery.commit.message.v1",
      ...(feedback.length === 0 ? {} : { validationErrors: feedback }),
    };
    const generated = await generateCommitMessage({
      request: transportRequest,
      ports: ports.transports,
      availability: ports.availability,
    });
    failover = [...generated.failover];
    if (generated.source === "template") break;
    spend = addSpend(spend, generated.tokenSpend);
    const sanitized = sanitizeCommitMessage(generated.message, request.skeleton);
    const lint = await ports.commitlint.check(sanitized);
    const validation = validateCommitMessage({
      draft: sanitized,
      skeleton: request.skeleton,
      requiresBody,
      commitlint: lint,
    });
    if (validation.valid) {
      return {
        ok: true,
        message: sanitized,
        source: "model",
        transport: generated.transport,
        tokenSpend: spend,
        failover,
      };
    }
    feedback = validation.errors;
  }

  const template = templateCommitMessage({
    skeleton: request.skeleton,
    ...(request.planSummary === undefined ? {} : { planSummary: request.planSummary }),
    ...(topPath === undefined ? {} : { topPath }),
  });
  const lint = await ports.commitlint.check(template);
  const templateValidation = validateCommitMessage({
    draft: template,
    skeleton: request.skeleton,
    requiresBody: false,
    commitlint: lint,
  });
  if (!templateValidation.valid) {
    return {
      ok: false,
      code: "commit.commitlint-failed",
      detail: templateValidation.errors.join("; "),
    };
  }
  return {
    ok: true,
    message: template,
    source: "template",
    transport: "none",
    tokenSpend: spend,
    failover,
  };
};

/** Execute the single shared commit act. */
export const runCommitAct = async (
  request: CommitActRequest,
  ports: CommitActPorts,
): Promise<CommitActOutcome> => {
  const tree = await ports.git.readTree();
  const staging = computeStagingPlan({
    files: tree.files,
    scopePaths: request.scope.paths,
    scopeSource: request.scope.source,
  });

  if (staging.include.length === 0) {
    if (request.mode === "phase") {
      return { kind: "no-pending-work", staging, excluded: excludedOf(staging, []) };
    }
    return {
      kind: "failure",
      code: "commit.staging-blocked-untracked",
      excluded: excludedOf(staging, []),
    };
  }

  const safetyOutcome = await ports.safety.scan(
    staging.include.map((entry) => ({ path: entry.path })),
  );
  const safety = classifyCommitSafety(safetyOutcome);
  if (!safety.ok) {
    if (safety.code === "commit.safety.scan-unavailable") {
      return { kind: "failure", code: safety.code, detail: safety.detail };
    }
    return {
      kind: "failure",
      code: safety.code,
      findings: findingClasses(safety.findings),
    };
  }

  const bundleResult = buildCommitBundle({
    skeleton: request.skeleton,
    ...(request.planSummary === undefined ? {} : { planSummary: request.planSummary }),
    files: tree.files,
    staging,
    lastCommitSubjects: tree.lastCommitSubjects,
  });
  const excluded = excludedOf(staging, bundleResult.noiseStripped);
  const topPath = staging.include[0]?.path;
  const resolved = await resolveMessage(request, ports, bundleResult.bundle, staging, topPath);
  if (!resolved.ok) {
    return { kind: "failure", code: resolved.code, detail: resolved.detail, excluded };
  }

  const successBase = {
    staging,
    excluded,
    message: resolved.message,
    messageSource: resolved.source,
    transport: resolved.transport,
    tokenSpend: resolved.tokenSpend,
    failover: resolved.failover,
    safety: { completed: true, findings: findingClasses(safety.findings) },
  } as const;

  if (request.dryRun) {
    return {
      kind: "dry-run",
      ...successBase,
      telemetry: { emitted: false },
    };
  }

  const staged = await ports.git.stage(staging.include.map((entry) => entry.path));
  if (!staged) {
    return { kind: "failure", code: "commit.atomic-abort", detail: "staging failed", excluded };
  }
  const committed = await ports.git.commit(resolved.message);
  if (!committed.ok) {
    await ports.git.resetTo(request.baselineHead);
    return { kind: "failure", code: "commit.atomic-abort", detail: committed.detail, excluded };
  }

  let transitionId = request.existingTransitionId;
  if (request.appendTransition !== undefined) {
    const appended = await request.appendTransition({ commitSha: committed.sha });
    if (!appended.ok) {
      await ports.git.resetTo(request.baselineHead);
      return { kind: "failure", code: "commit.atomic-abort", detail: appended.detail, excluded };
    }
    transitionId = appended.transitionId;
  }

  const telemetryRecord: CommitTelemetryRecord = {
    schemaId: "delivery.commit.telemetry.v1",
    changeRef: request.skeleton.ref,
    ...(request.mode === "phase" && request.skeleton.phaseId !== undefined
      ? { phaseId: request.skeleton.phaseId }
      : {}),
    commitSha: committed.sha,
    messageSource: resolved.source,
    transport: resolved.transport,
    tokenSpend: resolved.tokenSpend,
    landedAt: ports.nowIso(),
    ...(transitionId === undefined ? {} : { transitionId }),
    ...(resolved.failover.length === 0 ? {} : { failover: resolved.failover }),
  };
  const emitted = await ports.appendTelemetry(telemetryRecord);
  return {
    kind: "landed",
    ...successBase,
    commitSha: committed.sha,
    ...(transitionId === undefined ? {} : { transitionId }),
    telemetry: emitted.ok ? { emitted: true } : { emitted: false, detail: emitted.detail },
  };
};

/** Render the git message from an act result's message (thin, deterministic). */
export const messageText = (message: CommitMessageDraft): string => renderCommitMessage(message);
