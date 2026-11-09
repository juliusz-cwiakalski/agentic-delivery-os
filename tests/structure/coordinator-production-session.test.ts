/**
 * TC-COORD-003/AC-F2-2/AC-F2-3 (production half) — the shipped coordinator
 * composes the delivered harness session port and actually runs the spawn and
 * resume effects. No capability-gap is returned for a delivered capability.
 */
import { describe, expect, test } from "bun:test";
import {
  CLAUDE_CAPABILITIES,
  createClaudeSession,
} from "../../packages/adapters/src/harness/index";
import type { CoordinatorSessionFacts } from "../../packages/cli/src/commands/coordinator-loop";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { createProductionComposer } from "../../packages/cli/src/production";
import type {
  HarnessSpawnRunnerResult,
  HarnessSpawnStarter,
  HarnessSpawnStream,
} from "../../packages/core/src/contracts/index";
import { assembleHarnessLiveness, classifyHarnessEvidence } from "../../packages/core/src/index";
import { makeTempRoot, removeRoot } from "../fixtures/state/harness";
import { bufferSink } from "../golden/helpers";

const streamFor = (sessionId: string): HarnessSpawnStream => {
  const lines = [
    JSON.stringify({ session: { id: sessionId }, result: { completion: "complete" } }),
  ];
  return {
    lines: (async function* () {
      for (const line of lines) yield line;
    })(),
    completion: Promise.resolve({
      stdout: lines.join("\n"),
      stderr: "",
      status: 0,
      timedOut: false,
    }),
    acquired: () => undefined,
    kill: () => undefined,
  };
};

const runner = (): Promise<HarnessSpawnRunnerResult> =>
  Promise.resolve({ stdout: "[]", stderr: "", status: 0, timedOut: false });

const invokeCoordinator = async (input: {
  readonly root: string;
  readonly argv?: readonly string[];
  readonly starter: HarnessSpawnStarter;
  readonly sessionFacts?: () => CoordinatorSessionFacts;
  readonly signalHost?: {
    readonly once: (event: "SIGINT" | "SIGTERM", listener: () => void) => void;
    readonly removeListener: (event: "SIGINT" | "SIGTERM", listener: () => void) => void;
  };
  readonly collectionIntervalMs?: number;
}): Promise<{
  readonly code: number;
  readonly data: Record<string, unknown> | undefined;
  readonly stderr: string;
}> => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const environment = {
    HOME: input.root,
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    HARNESS_MODEL: "synthetic/model-large",
    HARNESS_SMALL_MODEL: "synthetic/model-small",
    DELIVERY_WORK_PATH: input.root,
  };
  const facts = {
    environment,
    cwd: input.root,
    homeDirectory: input.root,
    workingName: "delivery-os",
    processId: process.pid,
    harnessSpawnRunner: runner,
    harnessSpawnStarter: input.starter,
    ...(input.sessionFacts === undefined ? {} : { coordinatorSessionFacts: input.sessionFacts }),
    ...(input.signalHost === undefined ? {} : { signalHost: input.signalHost }),
    ...(input.collectionIntervalMs === undefined
      ? {}
      : { coordinatorCollectionIntervalMs: input.collectionIntervalMs }),
  };
  const code = await runEntrypoint([...(input.argv ?? ["coordinator", "tick", "--json"])], {
    streams: { stdout, stderr },
    environment,
    configuredWorkingName: "delivery-os",
    composeProgram: createProductionComposer(facts),
    clock: { now: () => 1_000_000 },
    newRunId: () => "run-coordinator-production",
  });
  let data: Record<string, unknown> | undefined;
  try {
    data = (JSON.parse(stdout.value) as { data?: Record<string, unknown> }).data;
  } catch {
    data = undefined;
  }
  return { code, data, stderr: stderr.value };
};

describe("coordinator production session effects", () => {
  test("an absent session spawns through the delivered harness port", async () => {
    const root = makeTempRoot("gh241-coordinator-spawn");
    try {
      const invocations: Array<{ readonly file: string; readonly args: readonly string[] }> = [];
      const starter: HarnessSpawnStarter = (file, args) => {
        invocations.push({ file, args });
        return streamFor("ses-production-spawn");
      };
      const { code, data, stderr } = await invokeCoordinator({ root, starter });
      expect(code, stderr).toBe(0);
      expect((data?.decision as { kind?: string } | undefined)?.kind).toBe("spawn-fresh");
      expect((data?.decision as { reason?: string } | undefined)?.reason).toBe("initial-start");
      expect((data?.session as { sessionId?: string } | undefined)?.sessionId).toBe(
        "ses-production-spawn",
      );
      expect((data?.restarts as { count?: number } | undefined)?.count).toBe(0);
      expect(invocations).toHaveLength(1);
      expect(invocations[0]?.args).toEqual(["run", "--format", "json"]);
    } finally {
      removeRoot(root);
    }
  });

  test("a resumable recorded session resumes through the delivered harness port", async () => {
    const root = makeTempRoot("gh241-coordinator-resume");
    try {
      const invocations: Array<{ readonly file: string; readonly args: readonly string[] }> = [];
      const starter: HarnessSpawnStarter = (file, args) => {
        invocations.push({ file, args });
        return streamFor("ses-production-resume");
      };
      const sessionFacts = () => ({
        sessionId: "ses-production-resume",
        liveness: "absent" as const,
        contextTokens: 1_000,
        harnessKind: "opencode",
        completedCleanly: false,
        resumable: true,
        resumeDeclared: true,
        pid: 4242,
        processStartTimeMs: 2_000,
      });
      const { code, data, stderr } = await invokeCoordinator({ root, starter, sessionFacts });
      expect(code, stderr).toBe(0);
      expect((data?.decision as { kind?: string } | undefined)?.kind).toBe("resume-context");
      expect((data?.restarts as { count?: number } | undefined)?.count).toBe(1);
      expect((data?.session as { sessionId?: string } | undefined)?.sessionId).toBe(
        "ses-production-resume",
      );
      expect(invocations).toHaveLength(1);
      expect(invocations[0]?.args).toEqual([
        "run",
        "--format",
        "json",
        "--session",
        "ses-production-resume",
      ]);
    } finally {
      removeRoot(root);
    }
  });

  test("start --foreground runs the composed spawn effect and releases the lease", async () => {
    const root = makeTempRoot("gh241-coordinator-start");
    try {
      const invocations: Array<{ readonly file: string; readonly args: readonly string[] }> = [];
      const starter: HarnessSpawnStarter = (file, args) => {
        invocations.push({ file, args });
        return streamFor("ses-production-start");
      };
      const signalHost = {
        once: (_event: "SIGINT" | "SIGTERM", listener: () => void) => {
          queueMicrotask(listener);
        },
        removeListener: () => undefined,
      };
      const { code, data, stderr } = await invokeCoordinator({
        root,
        argv: ["coordinator", "start", "--foreground", "--json"],
        starter,
        signalHost,
        collectionIntervalMs: 1,
      });
      expect(code, stderr).toBe(0);
      // The start decision creates the session; the first loop cycle then
      // records a join-live decision, which is the last recorded decision.
      expect((data?.decision as { kind?: string } | undefined)?.kind).toBe("join-live");
      expect((data?.session as { sessionId?: string } | undefined)?.sessionId).toBe(
        "ses-production-start",
      );
      expect((data?.instance as { instanceId?: string } | null | undefined)?.instanceId).toMatch(
        /^instance-/,
      );
      expect((data?.fence as { action?: string } | undefined)?.action).toBe("released");
      expect(invocations).toHaveLength(1);
    } finally {
      removeRoot(root);
    }
  });

  test("the delivered claude-code resume is a declared capability gap, not a coordinator fake", async () => {
    expect(CLAUDE_CAPABILITIES.supportedOperations).not.toContain("resume");
    const port = createClaudeSession({
      command: "claude",
      runner,
      buildEnvironment: () => ({ ok: true, value: {} }),
      classify: classifyHarnessEvidence,
      assembleLiveness: assembleHarnessLiveness,
      now: () => "1970-01-01T00:00:00.000Z",
    });
    const resumed = await port.resume({
      handle: {
        harnessKind: "claude-code",
        sessionId: "ses-claude-1",
        treeRoot: "GH-1",
        workItemRef: "GH-1",
      },
      prompt: "continue",
    });
    expect(resumed.ok).toBe(false);
    if (!resumed.ok) {
      expect(resumed.error.code).toBe("harness.capability.gap");
      expect(resumed.error.summary).toContain("resume");
    }
  });
});
