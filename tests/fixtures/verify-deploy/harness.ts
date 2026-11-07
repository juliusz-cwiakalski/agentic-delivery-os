/**
 * In-process `verify deploy` harness (test plan §4.1): injected target
 * resolution and one recording trace read, fixed brand/run id/clock, buffer
 * streams. No network and no live provider.
 */
import { createVerifyCommandDefinition } from "../../../packages/cli/src/commands/verify";
import type {
  DeployResolveOutcome,
  DeployTraceOutcome,
  VerifyDeployRuntime,
} from "../../../packages/cli/src/commands/verify-deploy";
import { type CliDependencies, runCli } from "../../../packages/cli/src/index";
import type {
  DeployExpectationSet,
  DeployTargetCandidate,
  DeployTrace,
} from "../../../packages/core/src/contracts/index";
import { bufferSink, SYNTHETIC_BRAND } from "../../golden/helpers";

export const DEPLOY_REF = "GH-305";
export const DEPLOY_RUN_ID = "run-deploy-fixture";
export const DEPLOY_JOB_ID = "deploy-44833";
export const DEPLOY_HEAD = "9f21c0e1a2b3c4d5e6f708192a3b4c5d6e7f8091";
export const DEPLOY_CLOCK_ISO = "2026-11-06T12:00:00Z";

export const defaultTarget = (
  overrides: Partial<DeployTargetCandidate> = {},
): DeployTargetCandidate => ({
  jobId: DEPLOY_JOB_ID,
  pipelineName: "deploy",
  headSha: DEPLOY_HEAD,
  ...overrides,
});

export const defaultExpectation = (
  overrides: Partial<DeployExpectationSet> = {},
): DeployExpectationSet => ({
  source: "configuration",
  steps: ["build", "publish", "smoke"],
  artifacts: [`registry:app@${DEPLOY_HEAD.slice(0, 7)}`],
  ...overrides,
});

export const verifiedTrace = (overrides: Partial<DeployTrace> = {}): DeployTrace => ({
  jobId: DEPLOY_JOB_ID,
  pipelineName: "deploy",
  headSha: DEPLOY_HEAD,
  status: "success",
  located: true,
  steps: [
    { name: "build", status: "succeeded" },
    { name: "publish", status: "succeeded" },
    { name: "smoke", status: "succeeded" },
  ],
  artifacts: [{ name: `registry:app@${DEPLOY_HEAD.slice(0, 7)}` }],
  ...overrides,
});

export type DeployHarnessOptions = {
  readonly resolve?: DeployResolveOutcome | (() => DeployResolveOutcome);
  readonly trace?: DeployTraceOutcome | (() => DeployTraceOutcome);
  readonly expectation?: DeployExpectationSet | undefined;
};

export type DeployHarness = {
  readonly counts: { resolve: number; trace: number };
  setResolve(value: DeployResolveOutcome | (() => DeployResolveOutcome)): void;
  setTrace(value: DeployTraceOutcome | (() => DeployTraceOutcome)): void;
  run(
    args?: readonly string[],
    options?: { readonly json?: boolean; readonly mode?: "interactive" | "scripted" },
  ): Promise<DeployRun>;
};

export type DeployRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
};

const resolveFact = <T>(value: T | (() => T)): T =>
  typeof value === "function" ? (value as () => T)() : value;

export const createDeployHarness = (options: DeployHarnessOptions = {}): DeployHarness => {
  const counts = { resolve: 0, trace: 0 };
  let resolveValue: DeployResolveOutcome | (() => DeployResolveOutcome) = options.resolve ?? {
    ok: true,
    target: defaultTarget(),
    expectation: options.expectation ?? defaultExpectation(),
  };
  let traceValue: DeployTraceOutcome | (() => DeployTraceOutcome) = options.trace ?? {
    ok: true,
    trace: verifiedTrace(),
  };

  const runtime: VerifyDeployRuntime = {
    resolve: async () => {
      counts.resolve += 1;
      return resolveFact(resolveValue);
    },
    readTrace: async () => {
      counts.trace += 1;
      return resolveFact(traceValue);
    },
  };

  const definition = createVerifyCommandDefinition({
    readPmNotes: () => ({ ok: false, reason: "missing" }),
    readRegistry: () => ({
      ok: false,
      error: {
        kind: "state",
        code: "state.store.torn",
        consequence: "not_landed",
        location: { path: "fixture" },
      },
    }),
    deploy: runtime,
  });

  return {
    counts,
    setResolve: (value) => {
      resolveValue = value;
    },
    setTrace: (value) => {
      traceValue = value;
    },
    run: async (args = [DEPLOY_REF], runOptions = {}) => {
      const stdout = bufferSink();
      const stderr = bufferSink();
      let tick = 0;
      const deps: CliDependencies = {
        brand: SYNTHETIC_BRAND,
        clock: {
          now: () => {
            const value = tick === 0 ? 1000 : 1007;
            tick += 1;
            return value;
          },
        },
        newRunId: () => DEPLOY_RUN_ID,
        secrets: [],
        program: { commands: { verify: definition } },
        mode: runOptions.mode ?? "interactive",
      };
      const json = runOptions.json ?? true;
      const argv = [json ? "--json" : "", "verify", "deploy", ...args].filter(
        (token) => token.length > 0,
      );
      const exitCode = await runCli(argv, { stdout, stderr }, deps);
      const text = stdout.value.trim();
      return {
        exitCode,
        stdout: stdout.value,
        stderr: stderr.value,
        ...(json && text.length > 0
          ? { envelope: JSON.parse(text) as Record<string, unknown> }
          : {}),
      };
    },
  };
};
