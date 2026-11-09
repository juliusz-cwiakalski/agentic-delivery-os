/**
 * Shared harness I/O fixtures (test-plan §4.1).
 *
 * The recording runner captures every invocation; the injected store/file
 * reads and liveness facts are plain data. The header records the bash-era
 * behaviour this suite pins (spawn/resume/session listing mapped to work items,
 * keys-env credentials replaced by the descriptor); no bash script is executed
 * (GAP-T2).
 */
import type {
  EconomicsSourcedSignalReading,
  HarnessClassifier,
  HarnessExecutionEnvironmentDescriptor,
  HarnessLivenessSourcedReading,
  HarnessSpawnRunner,
  HarnessSpawnRunnerResult,
} from "../../../packages/core/src/contracts/index";
import { buildHarnessSpawnEnvironment } from "../../../packages/core/src/domain/harness-spawn-env";
import {
  assembleHarnessLiveness,
  classifyHarnessEvidence,
} from "../../../packages/core/src/domain/index";
import {
  createFakeCredentialPort,
  type FakeCredentialPort,
  PARENT_ENVIRONMENT,
  SPAWN_ENV_DESCRIPTOR,
} from "./spawn-env";

export { createFakeCredentialPort, PARENT_ENVIRONMENT, SPAWN_ENV_DESCRIPTOR };

export const HARNESS_COMMAND = "synthetic-opencode";
export const SPAWN_ARGS = ["run", "--format", "json"] as const;
export const RESUME_ARGS = ["run", "--resume", "--format", "json"] as const;
export const LIST_ARGS = ["session", "list", "--format", "json"] as const;
export const CLAUDE_COMMAND = "synthetic-claude";
export const CLAUDE_HEADLESS_ARGS = ["--print", "--output-format", "json"] as const;
export const FIXED_NOW = "2026-11-06T00:00:00Z";
export const TIMEOUT_MS = 45_000;

export type RecordedInvocation = {
  readonly file: string;
  readonly args: readonly string[];
  readonly options: {
    readonly cwd: string;
    readonly env: Readonly<Record<string, string>>;
    readonly timeout: number;
    readonly stdin?: string;
  };
};

export type RecordingRunner = {
  readonly runner: HarnessSpawnRunner;
  readonly invocations: RecordedInvocation[];
};

export const createRecordingRunner = (
  handler: (invocation: RecordedInvocation) => HarnessSpawnRunnerResult,
): RecordingRunner => {
  const invocations: RecordedInvocation[] = [];
  return {
    invocations,
    runner: async (file, args, options) => {
      const invocation = { file, args: [...args], options };
      invocations.push(invocation);
      return handler(invocation);
    },
  };
};

export const output = (
  sessionId: string,
  completion: "complete" | "incomplete" | "failed",
  extra: Record<string, unknown> = {},
): string =>
  JSON.stringify({
    session: { id: sessionId },
    result: {
      completion,
      ...(completion === "failed" ? { status: "failed" } : {}),
      ...extra,
    },
  });

export const runnerResult = (
  stdout: string,
  status = 0,
  overrides: Partial<HarnessSpawnRunnerResult> = {},
): HarnessSpawnRunnerResult => ({
  stdout,
  stderr: status === 0 ? "" : "synthetic harness failure",
  status,
  timedOut: false,
  ...overrides,
});

export const declaredBuildEnvironment = (
  credentials: FakeCredentialPort,
): ((
  descriptor: HarnessExecutionEnvironmentDescriptor,
) => ReturnType<typeof buildHarnessSpawnEnvironment>) => {
  return (descriptor) =>
    buildHarnessSpawnEnvironment({
      descriptor,
      parentEnvironment: PARENT_ENVIRONMENT,
      credentials: credentials.port,
    });
};

export const classifier: HarnessClassifier = classifyHarnessEvidence;
export const assembleLiveness = assembleHarnessLiveness;

export type {
  FakeStreamControl,
  FakeStreamStarter,
  StreamScript,
  VirtualClock,
} from "./stream";
// The streaming-starter fixtures (GH-275) are re-exported beside the one-shot
// runner fixtures so every adapter suite has one import site.
export {
  createFakeStreamStarter,
  createVirtualClock,
  flushUntil,
  streamStarterFromRunner,
} from "./stream";

export const LIVENESS_FACTS: readonly HarnessLivenessSourcedReading[] = [
  {
    kind: "session-traffic",
    status: "sourced",
    value: 7,
    observedAt: "2026-11-06T00:00:05Z",
  },
  {
    kind: "process",
    status: "sourced",
    value: 1,
    observedAt: "2026-11-06T00:00:05Z",
  },
];

/** The additive sourced-signal facts (GH-235 D-3): read-only, counts only. */
export const SOURCED_SIGNAL_FACTS: readonly EconomicsSourcedSignalReading[] = [
  {
    kind: "heartbeat-age",
    status: "sourced",
    value: 1_500,
    observedAt: "2026-11-06T00:00:05Z",
  },
  {
    kind: "token-delta",
    status: "sourced",
    value: 42,
    observedAt: "2026-11-06T00:00:05Z",
  },
];
