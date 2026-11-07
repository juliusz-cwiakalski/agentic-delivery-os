/**
 * The `delivery.verify-deploy.v1` vocabulary (GH-225 F-6, DEC-10, GAP-2).
 *
 * Runtime-neutral by construction: types and `as const` data only. The closed
 * verdict enum, the closed reason enum (plus the failed-step naming rule), the
 * one declared bidirectional reason-to-identity map, the expectation-set and
 * trace shapes, and the evidence caps are declared once here. Negative verdicts
 * are classified errors whose machine identity is the code (GAP-16): the
 * `reason` datum is text-mode evidence, never identity prose.
 */

/** The closed three-value verdict taxonomy (DEC-10). */
export const DEPLOY_VERDICTS = ["verified", "unknown", "failed"] as const;
export type DeployVerdict = (typeof DEPLOY_VERDICTS)[number];

/** The two declared unknown reasons; a failed verdict carries a step name. */
export const DEPLOY_UNKNOWN_REASONS = ["pipeline-created-never-ran", "status-stale"] as const;
export type DeployUnknownReason = (typeof DEPLOY_UNKNOWN_REASONS)[number];

/** The declared failed verdict evidence rule: the failing step is named. */
export const DEPLOY_FAILED_STEP_RULE = "named-failing-step" as const;

/** The declared expectation sources (configuration first, provider where exposed). */
export const DEPLOY_EXPECTATION_SOURCES = ["configuration", "provider"] as const;
export type DeployExpectationSource = (typeof DEPLOY_EXPECTATION_SOURCES)[number];

/** The three deploy error identities (DEC-7, DEC-13). */
export const DEPLOY_ERROR_CODES = [
  "verify.deploy.trace-missing",
  "verify.deploy.status-stale",
  "verify.deploy.trace-failed",
] as const;
export type DeployErrorCode = (typeof DEPLOY_ERROR_CODES)[number];

/** The declared reason and cause vocabulary of the map. */
export const DEPLOY_EVIDENCE_CAUSES = [
  "absent-evidence",
  "pipeline-created-never-ran",
  "status-stale",
  "failed-step",
] as const;
export type DeployEvidenceCause = (typeof DEPLOY_EVIDENCE_CAUSES)[number];

/**
 * The one declared, bidirectional reason-to-identity map (GAP-2).
 *
 * Absent executed-step or artifact evidence — including the zero-executed-steps
 * instance, which keeps its reason `pipeline-created-never-ran` — maps to
 * `verify.deploy.trace-missing`; `status-stale` maps to
 * `verify.deploy.status-stale`; a failed-step trace maps to
 * `verify.deploy.trace-failed`. No fourth row and no fourth reason exists.
 */
export const DEPLOY_REASON_IDENTITY_MAP = [
  {
    cause: "absent-evidence",
    verdict: "unknown",
    code: "verify.deploy.trace-missing",
  },
  {
    cause: "pipeline-created-never-ran",
    verdict: "unknown",
    reason: "pipeline-created-never-ran",
    code: "verify.deploy.trace-missing",
  },
  {
    cause: "status-stale",
    verdict: "unknown",
    reason: "status-stale",
    code: "verify.deploy.status-stale",
  },
  {
    cause: "failed-step",
    verdict: "failed",
    code: "verify.deploy.trace-failed",
  },
] as const;

/** The declared target-resolution tie rule (deterministic, no heuristics). */
export const DEPLOY_TARGET_TIE_RULE = "highest-job-id" as const;

/** One executed step in the trace (steps only, never log bodies). */
export type DeployStepTrace = {
  readonly name: string;
  readonly status: "succeeded" | "failed" | "skipped" | "unknown";
};

/** One produced artifact in the trace. */
export type DeployArtifactTrace = {
  readonly name: string;
};

/**
 * The deploy-job execution trace (the only evidence a verified verdict accepts).
 *
 * `located` distinguishes "the trace was read and showed no executed steps" from
 * "no trace was located"; both share the absent-evidence identity. `status` is
 * the provider status field copied verbatim as evidence only — it is never a
 * pass signal.
 */
export type DeployTrace = {
  readonly jobId: string;
  readonly pipelineName: string;
  readonly headSha?: string;
  readonly status?: string;
  readonly located: boolean;
  readonly steps: readonly DeployStepTrace[];
  readonly artifacts: readonly DeployArtifactTrace[];
};

/** The declared expectation set the trace is compared against (GAP-3). */
export type DeployExpectationSet = {
  readonly source: DeployExpectationSource;
  readonly steps: readonly string[];
  readonly artifacts: readonly string[];
};

/** One deterministic target candidate. */
export type DeployTargetCandidate = {
  readonly jobId: string;
  readonly pipelineName: string;
  readonly headSha?: string;
  readonly createdAt?: string;
};

/** The pure deploy evaluation result. */
export type DeployEvaluation =
  | {
      readonly verdict: "verified";
      readonly trace: DeployTrace;
      readonly expectation: DeployExpectationSet;
    }
  | {
      readonly verdict: "unknown";
      readonly reason: DeployUnknownReason;
      readonly code: DeployErrorCode;
      readonly trace: DeployTrace;
      readonly expectation?: DeployExpectationSet;
    }
  | {
      readonly verdict: "failed";
      readonly failedStep: string;
      readonly code: DeployErrorCode;
      readonly trace: DeployTrace;
      readonly expectation?: DeployExpectationSet;
    };

/** The bounded machine `data` payload of a verified deploy (F-6, AC-F6-1). */
export type DeployReport = {
  readonly verdict: "verified";
  readonly changeRef: string;
  readonly jobId: string;
  readonly pipelineName: string;
  readonly headSha?: string;
  readonly expectation: {
    readonly source: DeployExpectationSource;
    readonly steps: readonly string[];
    readonly artifacts: readonly string[];
  };
  readonly steps: readonly DeployStepTrace[];
  readonly stepsOmitted: number;
  readonly artifacts: readonly DeployArtifactTrace[];
  readonly artifactsOmitted: number;
};

/** The trace step-list cap; every drop is marked (NFR-3/NFR-4). */
export const DEPLOY_MAX_STEPS = 50 as const;
/** The trace artifact-list cap; every drop is marked. */
export const DEPLOY_MAX_ARTIFACTS = 50 as const;
/** The declared expectation cap. */
export const DEPLOY_MAX_EXPECTED_STEPS = 50 as const;
export const DEPLOY_MAX_EXPECTED_ARTIFACTS = 50 as const;
/** Per-name display cap. */
export const DEPLOY_MAX_NAME_CHARS = 160 as const;
/** Ref character cap. */
export const DEPLOY_MAX_REF_CHARS = 120 as const;
/** Machine `data` UTF-8 byte cap. */
export const DEPLOY_MAX_MACHINE_BYTES = 65_536 as const;
/** Human summary line cap. */
export const DEPLOY_MAX_HUMAN_LINES = 24 as const;
/** Human summary UTF-8 byte cap. */
export const DEPLOY_MAX_HUMAN_BYTES = 4_096 as const;
