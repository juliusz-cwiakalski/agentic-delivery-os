/**
 * `ci-healthy` cases (TC-QREADY-009/010).
 */
import type {
  QueueReadyConditionState,
  QueueReadyReason,
} from "../../../../packages/core/src/contracts/index";
import {
  type FactsOverrides,
  failedPipelineRunRead,
  job,
  makePipelineRun,
  observedHeadWithoutSha,
  pipelineRunRead,
  repository,
  unavailableBinding,
} from "../harness";

export type CiCase = {
  readonly name: string;
  readonly facts: FactsOverrides;
  readonly state: QueueReadyConditionState;
  readonly reason: QueueReadyReason;
  readonly detail?: string;
  readonly payloadTruncated?: boolean;
};

const runs = (jobState: "succeeded" | "failed" | "running" | "queued" | "canceled" | "skipped") =>
  pipelineRunRead([makePipelineRun({ entityId: "1", jobs: [job("build", jobState)] })]);

const atLimitRuns = (count: number) =>
  pipelineRunRead(
    [
      makePipelineRun({ entityId: "1", jobs: [job("build", "succeeded")] }),
      ...Array.from({ length: count - 1 }, (_, index) =>
        makePipelineRun({ entityId: String(index + 2), jobs: [job("build", "skipped")] }),
      ),
    ],
    count,
  );

export const ciCases: readonly CiCase[] = [
  {
    name: "succeeded",
    facts: { ci: runs("succeeded") },
    state: "satisfied",
    reason: "ci-succeeded",
    detail: "result:succeeded",
  },
  {
    name: "failed",
    facts: { ci: runs("failed") },
    state: "unsatisfied",
    reason: "ci-failed",
    detail: "result:failed",
  },
  {
    name: "pending-running",
    facts: { ci: runs("running") },
    state: "unsatisfied",
    reason: "ci-pending",
    detail: "result:pending",
  },
  {
    name: "pending-queued",
    facts: { ci: runs("queued") },
    state: "unsatisfied",
    reason: "ci-pending",
    detail: "result:pending",
  },
  {
    name: "canceled",
    facts: { ci: runs("canceled") },
    state: "unsatisfied",
    reason: "ci-canceled",
    detail: "result:canceled",
  },
  {
    name: "none",
    facts: { ci: pipelineRunRead([]) },
    state: "unsatisfied",
    reason: "ci-none",
    detail: "result:none",
  },
  {
    name: "all-skipped-none",
    facts: { ci: runs("skipped") },
    state: "unsatisfied",
    reason: "ci-none",
    detail: "result:none",
  },
  {
    name: "unresolved-sha",
    facts: { repository: observedHeadWithoutSha() },
    state: "unknown",
    reason: "commit-unresolved",
  },
  {
    name: "binding-addressing",
    facts: {
      repository: {
        binding: unavailableBinding("addressing-unresolved"),
        head: { branch: "x", detached: false },
      },
    },
    state: "unknown",
    reason: "addressing-unresolved",
  },
  {
    name: "binding-remote-unsupported",
    facts: {
      repository: {
        binding: unavailableBinding("remote-unsupported"),
        head: { branch: "x", detached: false },
      },
    },
    state: "unknown",
    reason: "remote-unsupported",
  },
  {
    name: "credential-unavailable",
    facts: { ci: failedPipelineRunRead("credential-unavailable") },
    state: "unknown",
    reason: "credential-unavailable",
    detail: "failureCode:config.credential.missing",
  },
  {
    name: "read-failed",
    facts: { ci: failedPipelineRunRead("read-failed") },
    state: "unknown",
    reason: "read-failed",
    detail: "failureClass:provider.payload.invalid",
  },
  {
    name: "at-limit-20",
    facts: { ci: atLimitRuns(20) },
    state: "satisfied",
    reason: "ci-succeeded",
    detail: "result:succeeded",
    payloadTruncated: true,
  },
  {
    name: "at-limit-19",
    facts: { ci: atLimitRuns(19) },
    state: "satisfied",
    reason: "ci-succeeded",
    detail: "result:succeeded",
    payloadTruncated: false,
  },
  {
    name: "restored-control",
    facts: { ci: runs("succeeded") },
    state: "satisfied",
    reason: "ci-succeeded",
    detail: "result:succeeded",
  },
];

export const observedRepository = repository;
