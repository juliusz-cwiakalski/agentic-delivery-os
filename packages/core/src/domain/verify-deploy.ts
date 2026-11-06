/**
 * Pure deploy-trace evaluation (GH-225 F-6, DEC-10, GAP-2, GAP-16).
 *
 * The verdict is `verified` only when the declared expectation set's steps
 * executed successfully and its artifacts are present in the trace evidence. A
 * zero-executed-step pipeline reads `unknown` with
 * `pipeline-created-never-ran`; a status field standing alone or contradicting
 * the trace reads `unknown` with `status-stale`; failed steps read `failed`
 * with the step named. No status field is ever evidence.
 */
import {
  DEPLOY_MAX_ARTIFACTS,
  DEPLOY_MAX_EXPECTED_ARTIFACTS,
  DEPLOY_MAX_EXPECTED_STEPS,
  DEPLOY_MAX_NAME_CHARS,
  DEPLOY_MAX_STEPS,
  DEPLOY_REASON_IDENTITY_MAP,
  type DeployEvaluation,
  type DeployExpectationSet,
  type DeployReport,
  type DeployStepTrace,
  type DeployTrace,
} from "#contracts";

const SUCCESS_STATUS = new Set(["success", "succeeded", "passed", "green", "ok"]);
const FAILURE_STATUS = new Set(["failure", "failed", "red", "error"]);

const clamp = (value: string, maximum: number): string =>
  value.length > maximum ? value.slice(0, maximum) : value;

const normalized = (value: string | undefined): string | undefined =>
  value === undefined ? undefined : value.trim().toLowerCase();

const failedStepName = (trace: DeployTrace): string | undefined =>
  trace.steps.find((step) => step.status === "failed")?.name;

/**
 * Artifact patterns admit `*` wildcards; an exact name matches itself. The
 * comparison is case-sensitive and bounded.
 */
export const artifactMatches = (pattern: string, names: readonly string[]): boolean => {
  if (!pattern.includes("*")) return names.includes(pattern);
  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const matcher = new RegExp(`^${escaped}$`);
  return names.some((name) => matcher.test(name));
};

const missingSteps = (expectation: DeployExpectationSet, trace: DeployTrace): readonly string[] => {
  const executed = new Map(trace.steps.map((step) => [step.name, step.status]));
  return expectation.steps
    .slice(0, DEPLOY_MAX_EXPECTED_STEPS)
    .filter((name) => executed.get(name) !== "succeeded");
};

const missingArtifacts = (
  expectation: DeployExpectationSet,
  trace: DeployTrace,
): readonly string[] => {
  const names = trace.artifacts.map((artifact) => artifact.name);
  return expectation.artifacts
    .slice(0, DEPLOY_MAX_EXPECTED_ARTIFACTS)
    .filter((pattern) => !artifactMatches(pattern, names));
};

/** Evaluate one deploy trace against its declared expectation set. */
export const evaluateDeploy = (input: {
  readonly expectation: DeployExpectationSet | undefined;
  readonly trace: DeployTrace;
}): DeployEvaluation => {
  const { expectation, trace } = input;
  const reasonIdentity = DEPLOY_REASON_IDENTITY_MAP;

  if (!trace.located) {
    const status = normalized(trace.status);
    if (status !== undefined) {
      return {
        verdict: "unknown",
        reason: "status-stale",
        code: "verify.deploy.status-stale",
        trace,
        ...(expectation === undefined ? {} : { expectation }),
      };
    }
    return {
      verdict: "unknown",
      reason: "pipeline-created-never-ran",
      code: reasonIdentity[0].code,
      trace,
      ...(expectation === undefined ? {} : { expectation }),
    };
  }

  if (trace.steps.length === 0) {
    return {
      verdict: "unknown",
      reason: "pipeline-created-never-ran",
      code: "verify.deploy.trace-missing",
      trace,
      ...(expectation === undefined ? {} : { expectation }),
    };
  }

  const status = normalized(trace.status);
  const failed = failedStepName(trace);
  if (status !== undefined) {
    if (SUCCESS_STATUS.has(status) && failed !== undefined) {
      return {
        verdict: "unknown",
        reason: "status-stale",
        code: "verify.deploy.status-stale",
        trace,
        ...(expectation === undefined ? {} : { expectation }),
      };
    }
    if (FAILURE_STATUS.has(status) && failed === undefined) {
      return {
        verdict: "unknown",
        reason: "status-stale",
        code: "verify.deploy.status-stale",
        trace,
        ...(expectation === undefined ? {} : { expectation }),
      };
    }
  }

  if (failed !== undefined) {
    return {
      verdict: "failed",
      failedStep: failed,
      code: "verify.deploy.trace-failed",
      trace,
      ...(expectation === undefined ? {} : { expectation }),
    };
  }

  if (expectation === undefined || expectation.steps.length === 0) {
    return {
      verdict: "unknown",
      reason: "pipeline-created-never-ran",
      code: "verify.deploy.trace-missing",
      trace,
    };
  }

  const absentSteps = missingSteps(expectation, trace);
  const absentArtifacts = missingArtifacts(expectation, trace);
  if (absentSteps.length > 0 || absentArtifacts.length > 0) {
    return {
      verdict: "unknown",
      reason: "pipeline-created-never-ran",
      code: "verify.deploy.trace-missing",
      trace,
      expectation,
    };
  }

  return { verdict: "verified", trace, expectation };
};

/** The failing step or the first expected step that did not execute. */
export const deployDecisiveEvidence = (
  evaluation: DeployEvaluation,
  expectation: DeployExpectationSet | undefined,
): { readonly failedStep?: string; readonly missingSteps: readonly string[] } => {
  if (evaluation.verdict === "failed") {
    return { failedStep: evaluation.failedStep, missingSteps: [] };
  }
  if (expectation === undefined) return { missingSteps: [] };
  return { missingSteps: missingSteps(expectation, evaluation.trace) };
};

/** Project the bounded machine report for a verified deploy. */
export const projectDeployReport = (
  changeRef: string,
  evaluation: Extract<DeployEvaluation, { verdict: "verified" }>,
): DeployReport => {
  const steps = evaluation.trace.steps.slice(0, DEPLOY_MAX_STEPS).map((step) => ({
    name: clamp(step.name, DEPLOY_MAX_NAME_CHARS),
    status: step.status,
  }));
  const artifacts = evaluation.trace.artifacts.slice(0, DEPLOY_MAX_ARTIFACTS).map((artifact) => ({
    name: clamp(artifact.name, DEPLOY_MAX_NAME_CHARS),
  }));
  const expectation = {
    source: evaluation.expectation.source,
    steps: evaluation.expectation.steps.slice(0, DEPLOY_MAX_EXPECTED_STEPS),
    artifacts: evaluation.expectation.artifacts.slice(0, DEPLOY_MAX_EXPECTED_ARTIFACTS),
  };
  return {
    verdict: "verified",
    changeRef,
    jobId: evaluation.trace.jobId,
    pipelineName: evaluation.trace.pipelineName,
    ...(evaluation.trace.headSha === undefined ? {} : { headSha: evaluation.trace.headSha }),
    expectation,
    steps,
    stepsOmitted: Math.max(0, evaluation.trace.steps.length - steps.length),
    artifacts,
    artifactsOmitted: Math.max(0, evaluation.trace.artifacts.length - artifacts.length),
  };
};

/** A bounded rendering of one step list with an explicit `+N` mark. */
export const renderStepEvidence = (steps: readonly DeployStepTrace[]): string => {
  const rendered = steps
    .slice(0, DEPLOY_MAX_STEPS)
    .map((step) => `${clamp(step.name, DEPLOY_MAX_NAME_CHARS)}=${step.status}`);
  const omitted = Math.max(0, steps.length - rendered.length);
  return omitted > 0 ? `${rendered.join(",")} +${omitted}` : rendered.join(",");
};
