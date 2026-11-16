/**
 * The in-process action CLI runner (GH-287 test-plan §4.1 items 1 and 5): the
 * production edge composition over a temp store, a fixed injected clock, fixed
 * run-id/fence sequences, and no child process, socket, or live state.
 */
import { createBoardCommandDefinition } from "../../../packages/cli/src/commands/board";
import { createRetroCommandDefinition } from "../../../packages/cli/src/commands/retro";
import { createRetroCommandRuntime } from "../../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../../packages/cli/src/index";
import type { StateStorePort } from "../../../packages/core/src/contracts/index";
import { bufferSink, SYNTHETIC_BRAND } from "../../golden/helpers";
import { NOW_MS } from "./clock";

export type ActionCliRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

const deps = (commands: Record<string, unknown>, runId: string): CliDependencies => ({
  brand: SYNTHETIC_BRAND,
  clock: { now: () => NOW_MS },
  newRunId: () => runId,
  secrets: [],
  program: { commands: commands as never },
});

/** Run one `retro` invocation through the production edge composition. */
export const runActionCli = async (
  argv: readonly string[],
  store: StateStorePort,
  options: {
    readonly runId?: string;
    readonly newActionId?: () => string;
    readonly secrets?: readonly string[];
    readonly audit?: import("../../../packages/cli/src/index").CliAuditDependencies;
  } = {},
): Promise<ActionCliRun> => {
  let fence = 0;
  const runtime = createRetroCommandRuntime({
    store,
    stateDirectory: "/temp/state",
    workspaceId: "workspace-action",
    changesDirectory: "/work/doc/changes",
    fs: { exists: () => false, readText: () => "" },
    clock: { nowMs: () => NOW_MS, nowIso: () => "2026-11-16T12:00:00Z" },
    newRunId: () => options.runId ?? "run-action-fixture",
    newTraceId: () => "ev-action-fixture",
    newFenceToken: () => {
      fence += 1;
      return `fence-action-${String(fence)}`;
    },
    newActionId: options.newActionId ?? (() => "action-fixture"),
    newClosureId: () => "closure-fixture",
    collectors: {
      readAuditLedger: () => ({
        ok: true,
        value: {
          verifiedEmpty: true,
          records: [],
          matched: 0,
          truncated: false,
          chain: { verified: true, records: 0, breaks: [], orphans: [], storePath: "audit" },
          storePath: "audit",
        },
      }),
      readStateFamilies: () => ({
        ok: true,
        value: { transitions: [], closeouts: [], telemetry: [] },
      }),
      readNotes: () => ({ ok: true, value: { retroNotes: [] } }),
    },
    readChanges: () => [],
    redact: (text) =>
      (options.secrets ?? []).reduce(
        (value, secret) => (secret.length === 0 ? value : value.split(secret).join("[redacted]")),
        text,
      ),
  });
  const command = createRetroCommandDefinition(runtime);
  const stdout = bufferSink();
  const stderr = bufferSink();
  const secrets = options.secrets ?? [];
  const exitCode = await runCli(
    argv,
    { stdout, stderr },
    {
      ...deps({ retro: command }, options.runId ?? "run-action-fixture"),
      secrets,
      ...(options.audit === undefined ? {} : { audit: options.audit }),
    },
  );
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};

/** Run one `board` invocation over the injected repository facts. */
export const runBoardCli = async (input: {
  readonly repository: string;
  readonly actions: readonly Record<string, unknown>[];
  readonly actionsSource?: "available" | "unavailable";
}): Promise<ActionCliRun> => {
  const definition = createBoardCommandDefinition({
    resolve: () => ({
      ok: true,
      scope: "repository",
      selection: "current",
      repositories: [input.repository],
      omittedRepositories: 0,
    }),
    loadRepository: () => ({
      ok: true,
      facts: {
        key: input.repository,
        gates: [],
        lanes: [],
        asks: [],
        parks: [],
        decisions: [],
        actions: input.actions as never,
        ...(input.actionsSource === undefined ? {} : { actionsSource: input.actionsSource }),
      },
    }),
    appendDecision: () => ({ ok: true, value: { records: [], appended: [] } as never }),
    ownerHold: () => ({ active: false }),
    policy: {
      comparator: ">=",
      escalationThresholdMs: 86_400_000,
      expiryThresholdMs: 259_200_000,
      rows: [],
    },
    nowIso: () => "2026-11-16T12:00:00Z",
    nowMs: () => NOW_MS,
  });
  const stdout = bufferSink();
  const stderr = bufferSink();
  const exitCode = await runCli(
    ["--json", "board"],
    { stdout, stderr },
    { ...deps({ board: definition }, "run-board-action"), secrets: [] },
  );
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};
