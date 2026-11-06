/** In-process verify harness: one combined runtime, fixed brand/clock/runId. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { VerifyCommandRuntime } from "../../../../packages/cli/src/commands/verify";
import { createVerifyCommandDefinition } from "../../../../packages/cli/src/commands/verify";
import type { VerifyGatesCommandRuntime } from "../../../../packages/cli/src/commands/verify-gates";
import { type CliDependencies, runCli } from "../../../../packages/cli/src/index";
import { resolveMergeGateSet } from "../../../../packages/core/src/domain/merge-gate-set";
import { bufferSink, SYNTHETIC_BRAND } from "../../../golden/helpers";
import { baseFacts, type VerifyGatesFacts } from "./facts";

const ROOT = process.cwd();

export const pmNotesText = (): string =>
  readFileSync(join(ROOT, "tests/fixtures/verify/classification/full/base-complete.yaml"), "utf8");

export const pmNotesValue = (): unknown => parse(pmNotesText()) as unknown;

export type RuntimeOverrides = {
  readonly facts?: Partial<VerifyGatesFacts>;
  readonly registryFailure?: { readonly code: string };
  readonly gateSet?: VerifyGatesCommandRuntime["readGateSet"];
  readonly appendVerification?: VerifyGatesCommandRuntime["appendVerification"];
  readonly nowMs?: () => number;
};

export const gatesRuntime = (overrides: RuntimeOverrides = {}): VerifyGatesCommandRuntime => {
  const base = baseFacts();
  const facts: VerifyGatesFacts = { ...base, ...overrides.facts };
  return {
    readLifecycle: () => ({
      document: { ok: true, file: "fixture.yaml", text: pmNotesText(), value: pmNotesValue() },
      registry:
        overrides.registryFailure === undefined
          ? {
              ok: true,
              present: facts.lifecycle.evaluation.registry.present,
              verifiedEmpty: facts.lifecycle.evaluation.registry.verifiedEmpty,
              transitions: [],
              recordCount: facts.lifecycle.evaluation.registry.recordCount,
            }
          : {
              ok: false,
              error: {
                kind: "state",
                code: overrides.registryFailure.code,
                summary: "state failure",
              },
            },
    }),
    readRepository: () => facts.repository,
    readWorkflow: () => facts.workflow,
    readOpenPullRequests: async () => facts.openPullRequests,
    readDeliveryRequestDetail: async () => facts.deliveryRequestDetail,
    readCheckRuns: async () => facts.checkRuns,
    readWorkItem: async () => facts.workItem,
    readGateSet:
      overrides.gateSet ??
      (() => {
        const resolved = resolveMergeGateSet(undefined);
        return resolved.ok
          ? { ok: true as const, value: resolved.value }
          : { ok: false as const, code: resolved.failure.code, detail: resolved.failure.detail };
      }),
    appendVerification: overrides.appendVerification ?? (() => ({ ok: true })),
    nowMs: overrides.nowMs ?? (() => Date.parse("2026-11-06T12:00:00Z")),
  };
};

export const combinedRuntime = (overrides: RuntimeOverrides = {}): VerifyCommandRuntime => ({
  readPmNotes: () => ({
    ok: true,
    file: "fixture.yaml",
    text: pmNotesText(),
    value: pmNotesValue(),
  }),
  readRegistry: () => ({
    ok: true,
    present: true,
    verifiedEmpty: false,
    transitions: [],
    recordCount: 3,
  }),
  gates: gatesRuntime(overrides),
});

export type Run = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
};

export const runVerify = async (
  runtime: VerifyCommandRuntime,
  args: readonly string[],
  options: {
    readonly json?: boolean;
    readonly secrets?: readonly string[];
    readonly runId?: string;
  } = {},
): Promise<Run> => {
  const definition = createVerifyCommandDefinition(runtime);
  const stdout = bufferSink();
  const stderr = bufferSink();
  let tick = 0;
  const ticks = [1000, 1007] as const;
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: {
      now: () => {
        const value = ticks[Math.min(tick, 1)] as number;
        tick += 1;
        return value;
      },
    },
    newRunId: () => options.runId ?? "run-verify-gates-fixture",
    secrets: options.secrets ?? [],
    program: { commands: { verify: definition } },
  };
  const argv = options.json === false ? ["verify", ...args] : ["--json", "verify", ...args];
  const exitCode = await runCli(argv, { stdout, stderr }, deps);
  const text = stdout.value.trim();
  const envelope =
    options.json === false || text.length === 0
      ? undefined
      : (JSON.parse(text) as Record<string, unknown>);
  return {
    exitCode,
    stdout: stdout.value,
    stderr: stderr.value,
    ...(envelope === undefined ? {} : { envelope }),
  };
};

export const throwingRuntime = (): VerifyCommandRuntime => {
  const fail = (name: string) => (): never => {
    throw new Error(`unexpected ${name} read`);
  };
  return {
    readPmNotes: fail("pm-notes"),
    readRegistry: fail("registry"),
    gates: {
      readLifecycle: fail("lifecycle"),
      readRepository: fail("repository"),
      readWorkflow: fail("workflow"),
      readOpenPullRequests: async () => fail("open-PR")() as never,
      readDeliveryRequestDetail: async () => fail("detail")() as never,
      readCheckRuns: async () => fail("check-runs")() as never,
      readWorkItem: async () => fail("work-item")() as never,
    },
  };
};

export { SYNTHETIC_BRAND };
