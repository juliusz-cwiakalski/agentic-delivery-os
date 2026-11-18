/**
 * The GH-335 propagation harness double (test plan §4.1 rule 2, TC-HARNESS-011..018).
 *
 * One recording spawn double records every invocation's argv and child
 * environment, so "was a session started", "which pair reached the honoured
 * surface", and "did the environment widen" are asserted from recorded
 * arguments. The composition wrapper and the adapter are the production
 * functions; only the child-process seams are doubles.
 */
import {
  createOpencodeSession,
  type OpencodeBindingSeams,
} from "../../../packages/adapters/src/harness/index";
import {
  PRODUCTION_OPENCODE_ARGS,
  createHarnessProfilePort,
} from "../../../packages/cli/src/production";
import { buildHarnessSpawnEnvironment } from "../../../packages/core/src/domain/harness-spawn-env";
import {
  bindingInvocationArgs,
  evaluateModelExpressibility,
  harnessAgentIdentityViolation,
  resolveBinding as defaultResolveBinding,
  type HarnessBindingResolution,
  type HarnessProfileView,
  type HarnessSelectionView,
} from "../../../packages/core/src/domain/index";
import type {
  HarnessExecutionEnvironmentDescriptor,
  HarnessMode,
  HarnessSeatBinding,
  HarnessSessionPort,
  HarnessVersionVerdict,
} from "../../../packages/core/src/contracts/index";
import {
  HARNESS_COMMAND,
  TIMEOUT_MS,
  type RecordedInvocation,
  createFakeCredentialPort,
  createRecordingRunner,
  classifier,
  assembleLiveness,
  FIXED_NOW,
  PARENT_ENVIRONMENT,
  SPAWN_ENV_DESCRIPTOR,
  output,
  runnerResult,
  streamStarterFromRunner,
} from "./harness-io";

export const PROPAGATION_BINDING_SEAMS: OpencodeBindingSeams = {
  identityViolation: harnessAgentIdentityViolation,
  expressibility: evaluateModelExpressibility,
  invocationArgs: bindingInvocationArgs,
  environmentRecords: () => ({}),
};

export type PropagationHarnessInput = {
  readonly sessionIds?: readonly string[];
  readonly versionVerdict?: HarnessVersionVerdict;
  readonly observedVersion?: string | null;
  readonly mode?: HarnessMode;
  readonly profile?: HarnessProfileView;
  readonly selection?: HarnessSelectionView;
  readonly resolve?: (
    profile: HarnessProfileView,
    selection: HarnessSelectionView,
    agent?: string,
  ) => HarnessBindingResolution;
  /** Wrap the adapter in the composition's resolution call site. */
  readonly composed?: boolean;
  readonly spawnArgs?: readonly string[];
  readonly resumeArgs?: readonly string[];
  readonly listArgs?: readonly string[];
  readonly listingOutput?: string;
  readonly listingStatus?: number;
};

export type PropagationHarness = {
  readonly port: HarnessSessionPort;
  readonly invocations: readonly RecordedInvocation[];
  readonly credentials: ReturnType<typeof createFakeCredentialPort>;
  readonly descriptor: HarnessExecutionEnvironmentDescriptor;
  readonly resolve?: PropagationHarnessInput["resolve"];
};

/** Build the propagation harness over the production adapter and composition. */
export const createPropagationHarness = (
  input: PropagationHarnessInput = {},
): PropagationHarness => {
  const credentials = createFakeCredentialPort();
  let spawnIndex = 0;
  const recording = createRecordingRunner((invocation) => {
    if (invocation.args.includes("list")) {
      return runnerResult(input.listingOutput ?? "[]", input.listingStatus ?? 0);
    }
    const sessionIds = input.sessionIds ?? ["ses_1"];
    const sessionId = sessionIds[Math.min(spawnIndex, sessionIds.length - 1)] ?? "ses_1";
    spawnIndex += 1;
    return runnerResult(output(sessionId, "complete"));
  });

  const adapter = createOpencodeSession({
    command: HARNESS_COMMAND,
    runner: recording.runner,
    starter: streamStarterFromRunner(recording.runner),
    buildEnvironment: (descriptor, context) =>
      buildHarnessSpawnEnvironment({
        descriptor,
        parentEnvironment: PARENT_ENVIRONMENT,
        credentials: credentials.port,
        ...(context?.record === undefined ? {} : { record: context.record }),
      }),
    classify: classifier,
    assembleLiveness,
    now: () => FIXED_NOW,
    timeoutMs: TIMEOUT_MS,
    spawnArgs: input.spawnArgs ?? PRODUCTION_OPENCODE_ARGS.spawn,
    resumeArgs: input.resumeArgs ?? PRODUCTION_OPENCODE_ARGS.resume,
    listArgs: input.listArgs ?? PRODUCTION_OPENCODE_ARGS.list,
    bindingSeams: PROPAGATION_BINDING_SEAMS,
    ...(input.versionVerdict === undefined ? {} : { versionVerdict: input.versionVerdict }),
    ...(input.observedVersion === undefined ? {} : { observedVersion: input.observedVersion }),
    ...(input.mode === undefined ? {} : { mode: input.mode }),
  });

  const port =
    input.composed === true
      ? createHarnessProfilePort({
          port: adapter,
          ...(input.profile === undefined ? {} : { profile: input.profile }),
          ...(input.selection === undefined ? {} : { selection: input.selection }),
          resolve: input.resolve ?? defaultResolveBinding,
        })
      : adapter;

  return {
    port,
    invocations: recording.invocations,
    credentials,
    descriptor: SPAWN_ENV_DESCRIPTOR,
    ...(input.resolve === undefined ? {} : { resolve: input.resolve }),
  };
};

/** The `--agent` values present in one invocation's argv. */
export const agentArgs = (invocation: RecordedInvocation): string[] => {
  const args = [...invocation.args];
  return args.filter((value) => value === "--agent");
};

/** The `--model` values present in one invocation's argv. */
export const modelArgs = (invocation: RecordedInvocation): string[] => {
  const args = [...invocation.args];
  return args.filter((value) => value === "--model");
};

/** The value following one flag in an argv, if present. */
export const valueAfter = (args: readonly string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};

export type { HarnessSeatBinding };
