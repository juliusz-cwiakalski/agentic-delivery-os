/**
 * Edge-level queue harness for GH-237: a real `createConfigProgram` over an
 * injected temp state store, fact source, clock, and fence tokens.
 */
import { createConfigProgram } from "../../../../packages/cli/src/edge";
import type { QueueComposition, QueueFactSource } from "../../../../packages/cli/src/edge";
import { runCli } from "../../../../packages/cli/src/index";
import { bufferSink } from "../../../golden/helpers";
import { makeAuditStore } from "../../state/harness";
import { baseFacts, queueRuntime } from "../../queue-ready/harness";
import {
  ciSucceeded,
  observed,
  REPO_A,
  REPO_B,
  RUNNER,
} from "../schedule/harness";

export const NOW_ISO = "2026-11-07T10:00:00Z";
export const NOW_MS = Date.parse(NOW_ISO);

export const queueFactSource = (): QueueFactSource => ({
  plans: {
    "GH-320": { state: "valid", tier: "full" },
    "GH-321": { state: "valid", tier: "lite" },
    "GH-310": { state: "valid", tier: "full" },
  },
  workItems: {
    "GH-320": observed(),
    "GH-321": observed(),
    "GH-310": observed({ deliveryState: "ready", labels: ["priority:high"] }),
  },
  ci: {
    "GH-320": ciSucceeded(),
    "GH-321": ciSucceeded(),
    "GH-310": ciSucceeded(),
  },
  provider: { state: "available" },
  close: {
    "GH-320": "none",
    "GH-321": "none",
    "GH-310": "merge-ready",
  },
  deploy: { expectations: {}, verdicts: {} },
});

export type QueueEdgeHarness = {
  readonly run: (argv: readonly string[]) => Promise<{
    readonly exitCode: number;
    readonly stdout: string;
    readonly stderr: string;
  }>;
  readonly composition: QueueComposition;
  readonly factSource: QueueFactSource;
  readonly advance: (ms: number) => void;
  readonly nowIso: () => string;
  readonly nowMs: () => number;
};

/** Build a real edge program over an injected queue composition. */
export const createQueueEdgeHarness = (label = "edge"): QueueEdgeHarness => {
  const fixture = makeAuditStore(`queue-cli-${label}`);
  let now = NOW_MS;
  let fence = 0;
  const factSource = queueFactSource();
  const composition: QueueComposition = {
    store: fixture.store,
    facts: factSource,
    settings: {
      leaseTtlMs: 90_000,
      parkRecheckMs: {
        "provider-window": 60_000,
        "provider-quota": 300_000,
        preemption: 60_000,
      },
    },
    repositoryBinding: {
      repository: REPO_A,
      repositoryRoot: "/work/repo-alpha",
    },
    runner: RUNNER,
    nowIso: () => new Date(now).toISOString(),
    nowMs: () => now,
    newFenceToken: () => `fence-${(fence += 1)}`,
    degraded: ["daemon-unreachable"],
    readyRuntime: queueRuntime(
      baseFacts({ candidates: ["GH-176"], nowIso: NOW_ISO, nowMs: NOW_MS }),
    ),
  };
  const built = createConfigProgram({
    workingName: "synthetic",
    environment: {},
    cwd: "/work",
    homeDirectory: "/home/synthetic",
    platform: "linux",
    fs: { exists: () => false, readText: () => "" },
    repositoryIo: { exists: () => false, isFile: () => false, readText: () => "" },
    queue: composition,
    lanes: composition,
  });
  if (!built.ok) throw new Error("queue edge program failed");
  let tick = 0;
  const run = async (argv: readonly string[]) => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    const exitCode = await runCli(argv, { stdout, stderr }, {
      brand: built.brand,
      clock: {
        now: () => {
          tick += 1;
          return NOW_MS + tick * 10;
        },
      },
      newRunId: () => "run-queue-edge",
      secrets: built.secrets,
      program: built.program,
    });
    return { exitCode, stdout: stdout.value, stderr: stderr.value };
  };
  return {
    run,
    composition,
    factSource,
    advance: (ms) => {
      now += ms;
    },
    nowIso: () => new Date(now).toISOString(),
    nowMs: () => now,
  };
};

/** Repo constants re-exported for the CLI suites. */
export { REPO_A, REPO_B, RUNNER };
