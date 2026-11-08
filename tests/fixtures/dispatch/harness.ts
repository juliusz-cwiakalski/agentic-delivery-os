/**
 * Shared dispatch test harness (GH-239 §6.2): a temp state root, a fixed clock
 * with deterministic UTC-date advance, a scripted harness session port that
 * supplies neutral evidence only (the real shared classifier is used), and
 * recording merge / tracker / CI / VCS seams.
 *
 * No test touches the live state directory, a live remote, the network, or a
 * model. Fixtures are never named `*.test.ts`.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyHarnessEvidence } from "../../../packages/core/src/domain/harness-classify";
import {
  makeIdentity,
  openStore,
  removeRoot,
  type TestEdge,
} from "../state/harness";
import type {
  HarnessEvidence,
  HarnessLivenessReport,
  HarnessResult,
  HarnessSessionHandle,
  HarnessSessionPort,
  HarnessSpawnInput,
  StateStorePort,
} from "../../../packages/core/src/contracts/index";

/** The fixed dispatch clock instant used by every suite. */
export const DISPATCH_NOW = "2026-11-08T10:00:00.000Z" as const;

/** A deterministic clock that advances only when a test says so. */
export type DispatchClock = {
  readonly nowMs: () => number;
  readonly nowIso: () => string;
  readonly advanceMs: (ms: number) => void;
  readonly advanceDays: (days: number) => void;
  readonly value: () => number;
};

export const createDispatchClock = (startIso: string = DISPATCH_NOW): DispatchClock => {
  let value = Date.parse(startIso);
  return {
    nowMs: () => value,
    nowIso: () => new Date(value).toISOString(),
    advanceMs: (ms) => {
      value += ms;
    },
    advanceDays: (days) => {
      value += days * 86_400_000;
    },
    value: () => value,
  };
};

/** A deterministic id sequence (attempt, divergence, run). */
export type DispatchIds = {
  readonly next: (prefix: string) => string;
  readonly count: () => number;
};

export const createDispatchIds = (): DispatchIds => {
  let index = 0;
  return {
    next: (prefix) => {
      index += 1;
      return `${prefix}-${index}`;
    },
    count: () => index,
  };
};

/** One isolated dispatch state root over the delivered test state edge. */
export type DispatchState = {
  readonly root: string;
  readonly store: StateStorePort;
  readonly edge: TestEdge;
  readonly fenceToken: string;
  readonly workspaceId: string;
  readonly dispose: () => void;
};

export const createDispatchState = (label = "dispatch"): DispatchState => {
  const root = mkdtempSync(join(tmpdir(), `gh239-${label}-`));
  const identity = makeIdentity(root, { workspaceId: `workspace-${label}` });
  const { store, edge } = openStore(identity);
  return {
    root,
    store,
    edge,
    fenceToken: "fence-dispatch",
    workspaceId: identity.workspaceId,
    dispose: () => removeRoot(root),
  };
};

/** A scripted harness session port: neutral evidence only, real classifier. */
export type ScriptedHarnessOptions = {
  readonly evidence?: HarnessEvidence;
  readonly spawnFails?: boolean;
  readonly liveness?: HarnessLivenessReport;
  readonly sessionId?: string;
  readonly harnessKind?: "opencode" | "claude-code";
};

export type ScriptedHarness = {
  readonly port: HarnessSessionPort;
  readonly calls: string[];
  readonly spawnInputs: HarnessSpawnInput[];
};

const DEFAULT_EVIDENCE: HarnessEvidence = {
  completionMarker: true,
  exitStatus: 0,
  timedOut: false,
  spawnRefused: false,
  failureReported: false,
  toolFailure: false,
};

export const createScriptedHarness = (
  options: ScriptedHarnessOptions = {},
): ScriptedHarness => {
  const calls: string[] = [];
  const spawnInputs: HarnessSpawnInput[] = [];
  const handle: HarnessSessionHandle = {
    harnessKind: options.harnessKind ?? "opencode",
    sessionId: options.sessionId ?? "session-1",
    treeRoot: "/tmp/session-1",
    workItemRef: "GH-239",
  };
  const port: HarnessSessionPort = {
    spawn: async (input) => {
      calls.push("spawn");
      spawnInputs.push(input);
      return options.spawnFails === true
        ? ({
            ok: false,
            error: { kind: "harness", code: "harness.spawn.refused" },
          } satisfies HarnessResult<HarnessSessionHandle>)
        : { ok: true, value: handle };
    },
    deliver: async () => {
      calls.push("deliver");
      return { ok: true, value: handle };
    },
    resume: async () => {
      calls.push("resume");
      return { ok: true, value: handle };
    },
    collect: async () => {
      calls.push("collect");
      return { ok: true, value: options.evidence ?? DEFAULT_EVIDENCE };
    },
    classify: (evidence) => classifyHarnessEvidence(evidence),
    liveness: async () => {
      calls.push("liveness");
      return {
        ok: true,
        value: options.liveness ?? {
          readings: [
            { kind: "session-traffic", status: "sourced", value: 1, observedAt: DISPATCH_NOW },
            { kind: "worktree-activity", status: "sourced", value: 1, observedAt: DISPATCH_NOW },
            { kind: "process", status: "sourced", value: 1, observedAt: DISPATCH_NOW },
          ],
        },
      };
    },
    listSessions: async () => {
      calls.push("listSessions");
      return { ok: true, value: { handles: [handle] } };
    },
  };
  return { port, calls, spawnInputs };
};

/** A recording merge seam: any call fails the scenario that injected it. */
export type RecordingMergePort = {
  readonly merge: (input: unknown) => void;
  readonly calls: readonly unknown[];
};

export const createRecordingMergePort = (): RecordingMergePort => {
  const calls: unknown[] = [];
  return {
    merge: (input) => {
      calls.push(input);
    },
    get calls() {
      return calls;
    },
  };
};

/** The evidence sets the truth fixtures compose. */
export const COMPLETED_EVIDENCE: HarnessEvidence = {
  ...DEFAULT_EVIDENCE,
};

export const SPAWN_REFUSED_EVIDENCE: HarnessEvidence = {
  ...DEFAULT_EVIDENCE,
  completionMarker: false,
  spawnRefused: true,
  exitStatus: null,
};

export const TOOL_FAILURE_EVIDENCE: HarnessEvidence = {
  ...DEFAULT_EVIDENCE,
  toolFailure: true,
};

export const PREMATURE_END_EVIDENCE: HarnessEvidence = {
  ...DEFAULT_EVIDENCE,
  completionMarker: false,
};

export const TIMED_OUT_EVIDENCE: HarnessEvidence = {
  ...DEFAULT_EVIDENCE,
  timedOut: true,
  exitStatus: null,
};

export const cleanupDispatchState = (state: DispatchState): void => {
  state.dispose();
  rmSync(state.root, { recursive: true, force: true });
};
