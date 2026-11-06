/**
 * `verify deploy <ref>` — the third verify subcommand (GH-225 F-6, DEC-10).
 *
 * Deterministic target resolution, one bounded trace read, the closed
 * verified/unknown/failed taxonomy, and classified-error negatives with the
 * declared reason-to-identity map. The handler returns data or one classified
 * failure and never writes a stream.
 */
import {
  deployDecisiveEvidence,
  evaluateDeploy,
  projectDeployReport,
  renderStepEvidence,
} from "@delivery-os/core";
import {
  DEPLOY_MAX_ARTIFACTS,
  DEPLOY_MAX_EXPECTED_ARTIFACTS,
  DEPLOY_MAX_EXPECTED_STEPS,
  DEPLOY_MAX_HUMAN_BYTES,
  DEPLOY_MAX_HUMAN_LINES,
  DEPLOY_MAX_NAME_CHARS,
  type DeployExpectationSet,
  type DeployReport,
  type DeployTargetCandidate,
  type DeployTrace,
} from "@delivery-os/core/contracts";
import type { CommandHandler } from "../index.js";
import { renderDeployHuman } from "../output/deploy-text.js";

/** The deterministic target resolution outcome. */
export type DeployResolveOutcome =
  | {
      readonly ok: true;
      readonly target: DeployTargetCandidate;
      readonly expectation?: DeployExpectationSet;
    }
  | { readonly ok: false; readonly kind: "no-target" }
  | { readonly ok: false; readonly kind: "fault"; readonly code: string };

/** The one bounded trace read outcome. */
export type DeployTraceOutcome =
  | { readonly ok: true; readonly trace: DeployTrace }
  | { readonly ok: false; readonly code: string };

/** Everything the deploy surface reads, injected by the edge. */
export type VerifyDeployRuntime = {
  readonly resolve: (changeRef: string) => Promise<DeployResolveOutcome>;
  readonly readTrace: (target: DeployTargetCandidate) => Promise<DeployTraceOutcome>;
};

type DeployFailure = { readonly ok: false; readonly error: Record<string, unknown> };
type DeploySuccess = { readonly ok: true; readonly data: DeployReport };

const GRAMMAR_SUMMARY = "verdict=unknown; evidence=invalid-invocation";

const failure = (
  kind: "input" | "verify" | "provider",
  code: string,
  summary: string,
): DeployFailure => ({
  ok: false,
  error: { kind, code, summary },
});

const clamp = (value: string, maximum: number): string =>
  value.length > maximum ? value.slice(0, maximum) : value;

/** One bounded, explicitly-marked name list (NFR-4: every drop is a `+N`). */
const nameListText = (values: readonly string[], maximum: number): string => {
  const shown = values.slice(0, maximum).map((value) => clamp(value, DEPLOY_MAX_NAME_CHARS));
  const omitted = values.length - shown.length;
  return omitted > 0 ? `${shown.join(",")} +${omitted}` : shown.join(",");
};

const expectationText = (expectation: DeployExpectationSet | undefined): string => {
  if (expectation === undefined) return "none";
  const steps = nameListText(expectation.steps, DEPLOY_MAX_EXPECTED_STEPS);
  const artifacts = nameListText(expectation.artifacts, DEPLOY_MAX_EXPECTED_ARTIFACTS);
  return `${expectation.source}:steps=${expectation.steps.length === 0 ? "-" : steps}:artifacts=${expectation.artifacts.length === 0 ? "-" : artifacts}`;
};

const remediationFor = (code: string): string =>
  code === "verify.deploy.status-stale"
    ? "Read the deploy job's execution trace; a status field alone is not evidence."
    : code === "verify.deploy.trace-failed"
      ? "Resolve the named failing deploy step and re-run the deployment."
      : "Produce a deploy trace whose declared steps executed and artifacts exist.";

const refusalSummary = (
  code: string,
  context: {
    readonly reason?: string;
    readonly verdict: "unknown" | "failed";
    readonly trace: DeployTrace;
    readonly expectation?: DeployExpectationSet;
    readonly failedStep?: string;
    readonly missingSteps?: readonly string[];
  },
): string => {
  const lines: string[] = [];
  lines.push(
    context.reason === undefined
      ? `verdict=${context.verdict}`
      : `verdict=${context.verdict}; reason=${context.reason}`,
  );
  lines.push(
    `evidence=${context.trace.located ? `steps=${context.trace.steps.length}` : "no-trace"}`,
  );
  if (context.trace.status !== undefined) {
    lines.push(
      `status=${clamp(context.trace.status, DEPLOY_MAX_NAME_CHARS)} (disqualified as evidence)`,
    );
  }
  lines.push(`expectation=${expectationText(context.expectation)}`);
  if (context.failedStep !== undefined)
    lines.push(`failed-step=${clamp(context.failedStep, DEPLOY_MAX_NAME_CHARS)}`);
  if (context.missingSteps !== undefined && context.missingSteps.length > 0) {
    lines.push(`missing-steps=${nameListText(context.missingSteps, DEPLOY_MAX_EXPECTED_STEPS)}`);
  }
  if (context.trace.steps.length > 0) {
    lines.push(`observed=${renderStepEvidence(context.trace.steps)}`);
  }
  if (context.trace.artifacts.length > 0) {
    lines.push(
      `artifacts=${nameListText(
        context.trace.artifacts.map((artifact) => artifact.name),
        DEPLOY_MAX_ARTIFACTS,
      )}`,
    );
  }
  lines.push(`remediation=${remediationFor(code)}`);
  const bounded = lines.slice(0, DEPLOY_MAX_HUMAN_LINES);
  let text = bounded.join("\n");
  if (text.length > DEPLOY_MAX_HUMAN_BYTES) text = text.slice(0, DEPLOY_MAX_HUMAN_BYTES);
  return text;
};

/** Build the `deploy` subcommand handler over the injected reads. */
export const createVerifyDeployHandler = (runtime: VerifyDeployRuntime): CommandHandler => {
  return async (invocation) => {
    const ref = invocation.positionals[1];
    if (
      invocation.positionals.length !== 2 ||
      invocation.positionals[0] !== "deploy" ||
      ref === undefined ||
      ref.length === 0
    ) {
      return failure("input", "input.value.rejected", `${GRAMMAR_SUMMARY}; result=failed`);
    }
    const resolved = await runtime.resolve(ref);
    if (!resolved.ok && resolved.kind === "fault") {
      return failure(
        "provider",
        resolved.code,
        `verdict=-; evidence=read-fault; remediation=restore the provider read`,
      );
    }
    if (!resolved.ok) {
      const trace: DeployTrace = {
        jobId: "-",
        pipelineName: "-",
        located: false,
        steps: [],
        artifacts: [],
      };
      return failure(
        "verify",
        "verify.deploy.trace-missing",
        refusalSummary("verify.deploy.trace-missing", {
          verdict: "unknown",
          reason: "pipeline-created-never-ran",
          trace,
        }),
      );
    }
    const traceRead = await runtime.readTrace(resolved.target);
    if (!traceRead.ok) {
      return failure(
        "provider",
        traceRead.code,
        "verdict=-; evidence=trace-read-fault; remediation=restore the provider read",
      );
    }
    const evaluation = evaluateDeploy({
      expectation: resolved.expectation,
      trace: traceRead.trace,
    });
    if (evaluation.verdict === "verified") {
      const data = projectDeployReport(ref, evaluation);
      return { ok: true, data } satisfies DeploySuccess;
    }
    const decisive = deployDecisiveEvidence(evaluation, resolved.expectation);
    return failure(
      "verify",
      evaluation.code,
      refusalSummary(evaluation.code, {
        verdict: evaluation.verdict,
        ...(evaluation.verdict === "unknown" ? { reason: evaluation.reason } : {}),
        trace: evaluation.trace,
        ...(resolved.expectation === undefined ? {} : { expectation: resolved.expectation }),
        ...(decisive.failedStep === undefined ? {} : { failedStep: decisive.failedStep }),
        ...(decisive.missingSteps.length === 0 ? {} : { missingSteps: decisive.missingSteps }),
      }),
    );
  };
};

/** Recognise a verified deploy report. */
export const isDeployReport = (data: unknown): data is DeployReport =>
  typeof data === "object" &&
  data !== null &&
  !Array.isArray(data) &&
  (data as { readonly verdict?: unknown }).verdict === "verified";

export { renderDeployHuman };
