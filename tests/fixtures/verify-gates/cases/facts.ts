/**
 * Shared pure verify-gates fact builders. No I/O; every suite deep-clones one
 * base bundle, applies one mutation, and exits through the same evaluator.
 */
import type {
  DeliveryRequest,
  PipelineRun,
  WorkItem,
} from "../../../../packages/core/src/contracts/index";
import type {
  VerifyGatesFacts,
  VerifyGatesReadResult,
  VerifyLedgerEvaluation,
} from "../../../../packages/core/src/domain/index";

export const CHANGE_REF = "GH-178";
export const BRANCH = "feat/GH-178/verify-gates-v1";
export const LOCAL_SHA = "1111111111111111111111111111111111111111";
export const REMOTE_SHA = "1111111111111111111111111111111111111111";
export const CANARY = "planted-payload-verify-gates-canary";

export const EXPECTED_JOBS = Array.from(
  { length: 23 },
  (_, index) => `job-${String(index + 1).padStart(2, "0")}`,
);

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const request = (overrides: Partial<DeliveryRequest> = {}): DeliveryRequest => ({
  identity: { systemName: "github", entityId: "178" },
  sourceRef: BRANCH,
  targetRef: "main-tools",
  reviewState: "open",
  threads: [],
  sourceHeadSha: REMOTE_SHA,
  mergeableState: "mergeable",
  commitCount: 3,
  changedFileCount: 7,
  ...overrides,
});

export const run = (
  name: string,
  jobState: PipelineRun["jobs"][number]["jobState"],
): PipelineRun => ({
  identity: { systemName: "github", entityId: `${name}-run` },
  pipelineName: name,
  jobs: [{ jobName: name, jobState }],
  traceEvidence: [],
});

export const workItem = (
  labels: readonly string[] = ["change", "planning", "good first issue"],
): WorkItem => ({
  identity: { systemName: "github", entityId: "178" },
  title: CANARY,
  status: { nativeStatus: "open", deliveryState: "ready" },
  labels,
  relations: [],
});

export const lifecycle = (
  overrides: Partial<VerifyLedgerEvaluation> = {},
): VerifyLedgerEvaluation => {
  const requiredPhases = Array.from({ length: 11 }, (_, index) => `phase-${index + 1}`);
  return {
    variant: "full",
    outcome: "finished",
    requiredPhases,
    completedPhases: requiredPhases,
    missingPhases: [],
    declaration: { requiredCount: 11, completedCount: 11 },
    registry: {
      present: true,
      verifiedEmpty: false,
      recordCount: 12,
      transitionCount: 3,
      overlaidPhases: requiredPhases.slice(0, 2),
    },
    ...overrides,
  };
};

export const greenCheckRuns = (): VerifyGatesReadResult<{
  readonly items: readonly PipelineRun[];
  readonly pageItemCount: number;
}> => ({
  ok: true,
  value: {
    items: EXPECTED_JOBS.map((name) => run(name, "succeeded")),
    pageItemCount: EXPECTED_JOBS.length,
  },
});

export const baseFacts = (): VerifyGatesFacts => ({
  changeRef: CHANGE_REF,
  lifecycle: { evaluation: lifecycle() },
  repository: {
    binding: "resolved",
    head: { branch: BRANCH, sha: LOCAL_SHA, detached: false },
  },
  workflow: { outcome: "read", names: [...EXPECTED_JOBS] },
  openPullRequests: {
    ok: true,
    value: { items: [request()], pageItemCount: 1 },
  },
  deliveryRequestDetail: { ok: true, value: { request: request() } },
  checkRuns: greenCheckRuns(),
  workItem: { ok: true, value: { item: workItem() } },
});

export const withReadError = <T>(
  reason: "read-failed" | "credential-unavailable" | "address-unresolved",
): VerifyGatesReadResult<T> => ({
  ok: false,
  reason,
  ...(reason === "credential-unavailable" ? { failureCode: "config.credential.missing" } : {}),
  ...(reason === "read-failed" ? { failureClass: "provider.payload.invalid" } : {}),
});
