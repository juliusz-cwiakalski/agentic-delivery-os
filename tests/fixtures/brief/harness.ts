/**
 * Shared brief harness (test-plan §4.1).
 *
 * Every case injects `StatusFacts`; the same object drives the status digest
 * and the brief, so no independently constructed fact set can mask drift.
 * Nothing here reads the clock, environment, network, or live tree.
 */
import { createBriefCommandDefinition } from "../../../packages/cli/src/commands/brief";
import { type CliDependencies, runCli } from "../../../packages/cli/src/index";
import type { StatusFacts } from "../../../packages/core/src/contracts/index";
import { bufferSink, SYNTHETIC_BRAND } from "../../golden/helpers";
import {
  baseFacts,
  createStatusRecorder,
  failedDeliveryRequestRead,
  failedPipelineRunRead,
  failedWorkItemRead,
  type StatusCallRecorder,
  type StatusCliOptions,
  type StatusCliRun,
  statusRuntime,
} from "../status/harness";

export {
  ALL_AVAILABLE,
  activeChange,
  anonymousInstance,
  baseFacts,
  blockedBy,
  capSizedFacts,
  createStatusRecorder,
  DAY_MS,
  deliveryRequestRead,
  failedDeliveryRequestRead,
  failedPipelineRunRead,
  failedWorkItemRead,
  GITHUB_SLICE_AVAILABILITY,
  localContext,
  makeDeliveryRequest,
  makePipelineRun,
  makeWorkItem,
  malformedLocalContext,
  missingLocalContext,
  NOW_ISO,
  NOW_MS,
  parkView,
  pipelineRunRead,
  providerConfig,
  providerConfigRead,
  providers,
  REVIEWS_AVAILABLE,
  REVIEWS_UNAVAILABLE,
  repository,
  statusInstance,
  unavailableBinding,
  workItemRead,
} from "../status/harness";

/** The brief runtime is the status runtime: it exposes exactly the same members. */
export const briefRuntime = statusRuntime;

export type BriefCliRun = StatusCliRun;
export type BriefCliOptions = StatusCliOptions;
export type BriefCallRecorder = StatusCallRecorder;

/** Run the brief definition in process with fixed brand/clock/run id/streams. */
export const runBriefCli = async (
  argv: readonly string[],
  runtime: ReturnType<typeof statusRuntime>,
  options: StatusCliOptions = {},
): Promise<StatusCliRun> => {
  const recorder = options.recorder ?? createStatusRecorder();
  const stdout = bufferSink();
  const stderr = bufferSink();
  const ticks = [100, 110] as const;
  let tick = 0;
  const deps: CliDependencies = {
    brand: options.brand ?? SYNTHETIC_BRAND,
    clock: {
      now: () => {
        const value = ticks[Math.min(tick, 1)] as number;
        tick += 1;
        return value;
      },
    },
    newRunId: () => options.runId ?? "run-brief-fixture",
    secrets: options.secrets ?? [],
    program: { commands: { brief: createBriefCommandDefinition(runtime) } },
  };
  const exitCode = await runCli(argv, { stdout, stderr }, deps);
  return { exitCode, stdout: stdout.value, stderr: stderr.value, recorder };
};

/** A fact set whose GitHub reads all fail with a credential refusal. */
export const failedEverywhereFacts = (): StatusFacts => ({
  ...baseFacts(),
  tracker: failedWorkItemRead("credential-unavailable"),
  changes: failedDeliveryRequestRead("credential-unavailable"),
  ci: failedPipelineRunRead("credential-unavailable"),
});

export type BriefCase = {
  readonly name: string;
  readonly facts: StatusFacts;
};
