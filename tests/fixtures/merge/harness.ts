/**
 * The binding in-process merge harness (test plan §4.1, §4.2).
 *
 * Every provider reader records invocation count and order; the git seam
 * records every operation; the state store is a real temp `delivery.state.v1`
 * ledger; the clock, run id, brand, configuration, and owner principal are
 * injected. No suite reaches the network or the live state directory.
 */
import { rmSync } from "node:fs";
import {
  createMergeCommandDefinition,
  type MergeCommandRuntime,
  type MergeConfigRead,
} from "../../../packages/cli/src/commands/merge";
import { type CliDependencies, runCli } from "../../../packages/cli/src/index";
import {
  type DeliveryRequest,
  MERGE_GATE_VERIFICATION_SCHEMA,
  MERGE_TRANSACTION_SCHEMA,
  MERGE_WAIVER_SCHEMA,
  type MergeGateEntry,
  type MergeGateVerificationRecord,
  type MergeTransactionRecord,
  type MergeWaiverRecord,
  OWNER_GATE_SLA_POLICY,
  type OwnerGateSlaPolicy,
  type PipelineRun,
  type WorkItem,
} from "../../../packages/core/src/contracts/index";
import type { MergeEffectiveGateSet } from "../../../packages/core/src/domain/merge-gate-set";
import { resolveMergeGateSet } from "../../../packages/core/src/domain/merge-gate-set";
import type { MergeTransactionPorts } from "../../../packages/core/src/domain/merge-transaction";
import {
  appendMergeGateVerification,
  appendMergeTransaction,
  appendMergeWaiver,
  createStateStore,
  readMergeGateVerifications,
  readMergeTransactions,
  readMergeWaivers,
} from "../../../packages/core/src/state/index";
import { bufferSink, SYNTHETIC_BRAND } from "../../golden/helpers";
import { createTestEdge, makeIdentity, makeTempRoot, type TestEdge } from "../state/harness";

export const MERGE_REF = "GH-301";
export const MERGE_RUN_ID = "run-merge-fixture";
export const MERGE_CLOCK_ISO = "2026-11-06T12:00:00Z";
export const MERGE_CLOCK_MS = Date.parse(MERGE_CLOCK_ISO);
export const MERGE_HEAD = "9f21c0e1a2b3c4d5e6f708192a3b4c5d6e7f8091";
export const MERGE_BASE = "main-tools";

export type ProviderRead<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string };

export type CheckRunPage = {
  readonly items: readonly PipelineRun[];
  readonly pageItemCount: number;
  readonly sha?: string;
};

export type MergeGitFacts = {
  head: () => Promise<string | undefined>;
  isContained: (sha: string, ref: string) => Promise<boolean | "failed">;
  refresh: (input: {
    branch: string;
    baseRef: string;
  }) => Promise<
    | { readonly outcome: "conflicted"; readonly paths: readonly string[] }
    | { readonly outcome: "succeeded"; readonly oldSha: string; readonly newSha: string }
    | { readonly outcome: "failed"; readonly code: string }
  >;
  land: (input: { branch: string; baseRef: string; message: string }) => Promise<
    | {
        readonly ok: true;
        readonly squashSha: string;
        readonly requestState: string;
        readonly containedOnBase: boolean | "failed";
      }
    | { readonly ok: false; readonly code: string }
  >;
  deleteBranch: (input: { branch: string }) => Promise<"ok" | "failed">;
};

export type FakeGitOptions = {
  readonly head?: string;
  readonly contained?: boolean | "failed" | (() => boolean | "failed");
  readonly refresh?: Awaited<ReturnType<MergeGitFacts["refresh"]>>;
  readonly land?: Awaited<ReturnType<MergeGitFacts["land"]>>;
  readonly delete?: "ok" | "failed";
};

/** One recording fake git seam. */
export const createFakeGit = (
  options: FakeGitOptions = {},
): MergeGitFacts & {
  readonly operations: string[];
} => {
  const operations: string[] = [];
  return {
    operations,
    head: async () => {
      operations.push("read-head");
      return options.head ?? MERGE_HEAD;
    },
    isContained: async () => {
      operations.push("read-base-containment");
      return typeof options.contained === "function"
        ? options.contained()
        : (options.contained ?? true);
    },
    refresh: async (input) => {
      operations.push(`rebase-refresh:${input.branch}`);
      return (
        options.refresh ?? {
          outcome: "succeeded",
          oldSha: MERGE_HEAD,
          newSha: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
        }
      );
    },
    land: async (input) => {
      operations.push(`squash-land:${input.branch}`);
      return (
        options.land ?? {
          ok: true,
          squashSha: "b1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
          requestState: "merged",
          containedOnBase: true,
        }
      );
    },
    deleteBranch: async (input) => {
      operations.push(`delete-branch:${input.branch}`);
      return options.delete ?? "ok";
    },
  };
};

/** The injectable harness configuration. */
export type MergeHarnessOptions = {
  readonly ref?: string;
  readonly gateSet?: unknown;
  readonly gateSetOverride?: MergeEffectiveGateSet;
  readonly freshnessSeconds?: number;
  readonly policy?: OwnerGateSlaPolicy;
  readonly ownerPrincipal?: string | undefined;
  readonly branch?: string;
  readonly baseRef?: string;
  readonly workItem?: WorkItem | { readonly fault: string };
  readonly checkRuns?: CheckRunPage | { readonly fault: string };
  readonly request?: DeliveryRequest | { readonly fault: string };
  readonly git?: MergeGitFacts;
  readonly nowIso?: () => string;
  readonly nowMs?: () => number;
  readonly configFailure?: { readonly code: string; readonly detail?: string };
  readonly appendVerificationFault?: string;
  readonly appendWaiverFault?: string;
  readonly appendTransactionFault?: string;
  readonly auditIdentity?: { readonly kind: "claimed"; readonly value: string };
};

/** One harness handle. */
export type MergeHarness = {
  readonly ref: string;
  readonly store: ReturnType<typeof createStateStore>;
  readonly identity: ReturnType<typeof makeIdentity>;
  readonly edge: TestEdge;
  readonly runtime: MergeCommandRuntime;
  readonly counts: {
    workItem: number;
    checkRuns: number;
    requestDetail: number;
    verification: number;
    order: string[];
  };
  readonly events: string[];
  readonly auditRecords: Array<Record<string, unknown>>;
  setWorkItem(value: WorkItem | { readonly fault: string }): void;
  setCheckRuns(value: CheckRunPage | { readonly fault: string }): void;
  setRequest(value: DeliveryRequest | { readonly fault: string }): void;
  setAppendWaiverFault(code: string | undefined): void;
  setAppendTransactionFault(code: string | undefined): void;
  seedVerification(record: MergeGateVerificationRecord): void;
  seedWaiver(record: MergeWaiverRecord): void;
  seedTransaction(record: MergeTransactionRecord): void;
  verifications(): readonly MergeGateVerificationRecord[];
  waivers(): readonly MergeWaiverRecord[];
  transactions(): readonly MergeTransactionRecord[];
  run(
    args?: readonly string[],
    options?: { readonly json?: boolean; readonly mode?: "interactive" | "scripted" },
  ): Promise<MergeRun>;
  cleanup(): void;
};

export type MergeRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
};

const dataOf = <T>(value: unknown): T => value as T;

/** Build a harness over a fresh temp state root and recording fakes. */
export const createMergeHarness = (options: MergeHarnessOptions = {}): MergeHarness => {
  const ref = options.ref ?? MERGE_REF;
  const root = makeTempRoot("merge");
  const identity = makeIdentity(root);
  const edge = createTestEdge();
  const store = createStateStore(identity, { driver: "jsonl", edge });
  const git = options.git ?? createFakeGit();
  const branch = options.branch ?? "feat/GH-301/merge";
  const policy = options.policy ?? OWNER_GATE_SLA_POLICY;
  const nowIso = options.nowIso ?? (() => MERGE_CLOCK_ISO);
  const nowMs = options.nowMs ?? (() => MERGE_CLOCK_MS);
  const counts = {
    workItem: 0,
    checkRuns: 0,
    requestDetail: 0,
    verification: 0,
    order: [] as string[],
  };
  const events: string[] = [];
  const auditRecords: Array<Record<string, unknown>> = [];
  const recordingGit: MergeGitFacts = {
    head: () => {
      events.push("git-read-head");
      return git.head();
    },
    isContained: (sha, ref) => {
      events.push("git-read-base-containment");
      return git.isContained(sha, ref);
    },
    refresh: (input) => {
      events.push("git-rebase-refresh");
      return git.refresh(input);
    },
    land: (input) => {
      events.push("git-squash-land");
      return git.land(input);
    },
    deleteBranch: (input) => {
      events.push("git-delete-branch");
      return git.deleteBranch(input);
    },
  };
  let workItemFact: WorkItem | { readonly fault: string } = options.workItem ?? baseWorkItem();
  let checkRunsFact: CheckRunPage | { readonly fault: string } =
    options.checkRuns ?? baseCheckRuns();
  let requestFact: DeliveryRequest | { readonly fault: string } = options.request ?? baseRequest();
  let appendWaiverFault = options.appendWaiverFault;
  let appendTransactionFault = options.appendTransactionFault;

  const resolvedSet =
    options.gateSetOverride ??
    (() => {
      const resolved = resolveMergeGateSet(options.gateSet);
      if (!resolved.ok) throw new Error(`fixture gate set invalid: ${resolved.failure.detail}`);
      return resolved.value;
    })();

  const readConfig = (): MergeConfigRead => {
    if (options.configFailure !== undefined) {
      return { ok: false, ...options.configFailure };
    }
    return {
      ok: true,
      config: {
        gateSet: resolvedSet,
        freshnessBoundSeconds: options.freshnessSeconds ?? 1800,
        comparator: policy.comparator,
        policy,
        ...(options.ownerPrincipal === undefined ? {} : { ownerPrincipal: options.ownerPrincipal }),
        baseRef: options.baseRef ?? MERGE_BASE,
        branch,
      },
    };
  };

  const createPorts = (changeRef: string): MergeTransactionPorts => ({
    nowIso,
    nowMs,
    readVerification: () => {
      counts.verification += 1;
      counts.order.push("verification");
      return readMergeGateVerifications(store, changeRef);
    },
    readTransactions: () => readMergeTransactions(store, changeRef),
    readWaivers: () => readMergeWaivers(store, changeRef),
    appendVerification: (record) => {
      if (options.appendVerificationFault !== undefined) {
        return { ok: false as const, code: options.appendVerificationFault };
      }
      events.push("append-verification");
      const appended = appendMergeGateVerification(store, {
        record,
        fenceToken: "fixture-merge-verification",
      });
      return appended.ok ? { ok: true } : { ok: false, code: appended.error.code };
    },
    appendWaiver: (record) => {
      if (appendWaiverFault !== undefined) {
        return { ok: false as const, code: appendWaiverFault };
      }
      events.push("append-waiver");
      const appended = appendMergeWaiver(store, {
        record,
        fenceToken: "fixture-merge-waiver",
      });
      return appended.ok ? { ok: true } : { ok: false, code: appended.error.code };
    },
    appendTransaction: (record) => {
      if (appendTransactionFault !== undefined) {
        return { ok: false as const, code: appendTransactionFault };
      }
      events.push("append-transaction");
      const appended = appendMergeTransaction(store, {
        record,
        fenceToken: "fixture-merge-transaction",
      });
      return appended.ok ? { ok: true } : { ok: false, code: appended.error.code };
    },
    readWorkItem: async () => {
      counts.workItem += 1;
      counts.order.push("work-item");
      if ("fault" in workItemFact) {
        return { ok: false as const, code: workItemFact.fault };
      }
      return { ok: true as const, item: workItemFact };
    },
    readCheckRuns: async (sha) => {
      counts.checkRuns += 1;
      counts.order.push("check-runs");
      if ("fault" in checkRunsFact) {
        return { ok: false as const, code: checkRunsFact.fault };
      }
      return {
        ok: true as const,
        value: {
          items: checkRunsFact.items,
          pageItemCount: checkRunsFact.pageItemCount,
          sha: checkRunsFact.sha ?? sha,
        },
      };
    },
    readRequestDetail: async () => {
      counts.requestDetail += 1;
      counts.order.push("request-detail");
      if ("fault" in requestFact) {
        return { ok: false as const, code: requestFact.fault };
      }
      return { ok: true as const, request: requestFact };
    },
    readHead: () => recordingGit.head(),
    readBaseContainment: (sha) => recordingGit.isContained(sha, options.baseRef ?? MERGE_BASE),
    refresh: () => recordingGit.refresh({ branch, baseRef: options.baseRef ?? MERGE_BASE }),
    land: (input) =>
      recordingGit.land({
        branch,
        baseRef: input.baseRef,
        message: `merge(${changeRef})`,
      }),
    deleteBranch: (input) =>
      input.branch === undefined
        ? Promise.resolve("failed")
        : recordingGit.deleteBranch({ branch: input.branch }),
  });

  const runtime: MergeCommandRuntime = { readConfig, createPorts };

  const run = async (
    args: readonly string[] = [],
    runOptions: {
      readonly json?: boolean;
      readonly mode?: "interactive" | "scripted";
      readonly runId?: string;
      readonly secrets?: readonly string[];
    } = {},
  ): Promise<MergeRun> => {
    const definition = createMergeCommandDefinition(runtime);
    const stdout = bufferSink();
    const stderr = bufferSink();
    const json = runOptions.json ?? true;
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
      newRunId: () => runOptions.runId ?? MERGE_RUN_ID,
      secrets: runOptions.secrets ?? [],
      program: { commands: { merge: definition } },
      mode: runOptions.mode ?? "interactive",
      audit: {
        scope: "workspace-a",
        ...(options.auditIdentity === undefined ? {} : { identity: options.auditIdentity }),
        record: (facts) => {
          auditRecords.push(facts as unknown as Record<string, unknown>);
          return { ok: true };
        },
      },
    };
    const argv = [json ? "--json" : "", "merge", ...(args.length === 0 ? [ref] : args)].filter(
      (token) => token.length > 0,
    );
    const exitCode = await runCli(argv, { stdout, stderr }, deps);
    const text = stdout.value.trim();
    return {
      exitCode,
      stdout: stdout.value,
      stderr: stderr.value,
      ...(json && text.length > 0 ? { envelope: JSON.parse(text) as Record<string, unknown> } : {}),
    };
  };

  const seedVerification = (record: MergeGateVerificationRecord): void => {
    const appended = appendMergeGateVerification(store, {
      record,
      fenceToken: "fixture-seed-verification",
    });
    if (!appended.ok) throw new Error(`verification seed failed: ${appended.error.code}`);
  };
  const seedWaiver = (record: MergeWaiverRecord): void => {
    const appended = appendMergeWaiver(store, { record, fenceToken: "fixture-seed-waiver" });
    if (!appended.ok) throw new Error(`waiver seed failed: ${appended.error.code}`);
  };
  const seedTransaction = (record: MergeTransactionRecord): void => {
    const appended = appendMergeTransaction(store, {
      record,
      fenceToken: "fixture-seed-transaction",
    });
    if (!appended.ok) throw new Error(`transaction seed failed: ${appended.error.code}`);
  };

  return {
    ref,
    store,
    identity,
    edge,
    counts,
    runtime,
    events,
    auditRecords,
    setWorkItem: (value) => {
      workItemFact = value;
    },
    setCheckRuns: (value) => {
      checkRunsFact = value;
    },
    setRequest: (value) => {
      requestFact = value;
    },
    setAppendWaiverFault: (code) => {
      appendWaiverFault = code;
    },
    setAppendTransactionFault: (code) => {
      appendTransactionFault = code;
    },
    seedVerification,
    seedWaiver,
    seedTransaction,
    verifications: () => {
      const read = readMergeGateVerifications(store, ref);
      return read.ok ? read.records : [];
    },
    waivers: () => {
      const read = readMergeWaivers(store, ref);
      return read.ok ? read.records : [];
    },
    transactions: () => {
      const read = readMergeTransactions(store, ref);
      return read.ok ? read.records : [];
    },
    run,
    cleanup: () => {
      rmSync(root, { recursive: true, force: true });
    },
  };
};

/** One deterministic work item. */
export const baseWorkItem = (overrides: Partial<WorkItem> = {}): WorkItem => ({
  identity: { systemName: "github", entityId: "301" },
  title: "Fixture work item",
  status: { nativeStatus: "open", deliveryState: "in-progress" },
  labels: ["change"],
  relations: [],
  updatedAt: "2026-11-06T11:58:00Z",
  ...overrides,
});

/** One deterministic check-run page with all-green jobs. */
export const baseCheckRuns = (): CheckRunPage => ({
  items: ["CI / test (18)", "CI / lint"].map((name, index) => ({
    identity: { systemName: "github", entityId: String(44800 + index) },
    pipelineName: name,
    jobs: [{ jobName: name, jobState: "succeeded" }],
    traceEvidence: [],
  })),
  pageItemCount: 2,
  sha: MERGE_HEAD,
});

/** One deterministic delivery request. */
export const baseRequest = (overrides: Partial<DeliveryRequest> = {}): DeliveryRequest => ({
  identity: { systemName: "github", entityId: "99" },
  sourceRef: "feat/GH-301/merge",
  targetRef: MERGE_BASE,
  reviewState: "open",
  threads: [],
  headSha: MERGE_HEAD,
  sourceHeadSha: MERGE_HEAD,
  mergeableState: "mergeable",
  commitCount: 3,
  changedFileCount: 2,
  ...overrides,
});

/** One deterministic verification record bound to the fixture head and set. */
export const verificationRecord = (
  overrides: Partial<MergeGateVerificationRecord> = {},
): MergeGateVerificationRecord => ({
  schema: MERGE_GATE_VERIFICATION_SCHEMA,
  changeRef: MERGE_REF,
  headSha: MERGE_HEAD,
  verifiedAt: MERGE_CLOCK_ISO,
  gateSet: {
    schemaVersion: "delivery.merge.gates.v1",
    ids: [
      "lifecycle-finalization",
      "ci-green",
      "push-parity",
      "owner-gate",
      "squash-preflight",
      "tracker-freshness",
    ],
  },
  gates: [
    {
      id: "lifecycle-finalization",
      verdict: "pass",
      reason: "lifecycle-complete",
      citation: {
        sources: [],
        identity: { changeRef: MERGE_REF },
        counts: [],
        names: [],
        reasons: ["lifecycle-complete"],
      },
    },
    {
      id: "ci-green",
      verdict: "pass",
      reason: "ci-green",
      citation: {
        sources: [{ name: "github-check-runs", outcome: "read" }],
        identity: { changeRef: MERGE_REF, headSha: MERGE_HEAD },
        counts: [],
        names: [{ kind: "failed-jobs", values: [], omitted: 0 }],
        reasons: ["ci-green"],
      },
    },
    {
      id: "push-parity",
      verdict: "pass",
      reason: "parity-matched",
      citation: {
        sources: [],
        identity: { changeRef: MERGE_REF },
        counts: [],
        names: [],
        reasons: ["parity-matched"],
      },
    },
    {
      id: "owner-gate",
      verdict: "pass",
      reason: "owner-gate-absent",
      citation: {
        sources: [],
        identity: { changeRef: MERGE_REF },
        counts: [],
        names: [],
        reasons: ["owner-gate-absent"],
      },
    },
    {
      id: "squash-preflight",
      verdict: "pass",
      reason: "squash-ready",
      citation: {
        sources: [],
        identity: { changeRef: MERGE_REF },
        counts: [],
        names: [],
        reasons: ["squash-ready"],
      },
    },
  ],
  trackerPosture: { labels: ["change"], ownerLabels: [] },
  ...overrides,
});

/** One deterministic waiver record. */
export const waiverRecord = (overrides: Partial<MergeWaiverRecord> = {}): MergeWaiverRecord => ({
  schema: MERGE_WAIVER_SCHEMA,
  changeRef: MERGE_REF,
  gateId: "owner-gate",
  gateClass: "owner-review",
  authorizer: "owner-principal",
  authorizedAt: MERGE_CLOCK_ISO,
  ...overrides,
});

/** One deterministic merged transaction record. */
export const transactionRecord = (
  overrides: Partial<MergeTransactionRecord> = {},
): MergeTransactionRecord => ({
  schema: MERGE_TRANSACTION_SCHEMA,
  changeRef: MERGE_REF,
  result: "merged",
  squashSha: "b1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
  replayed: false,
  landing: { shaOnBase: true, requestState: "merged" },
  refresh: { attempts: 0, outcome: "not-attempted" },
  waiverRefs: [],
  postLanding: [
    { id: "branch-deletion", status: "ok" },
    { id: "closeout-ready", status: "ok" },
  ],
  recordedAt: MERGE_CLOCK_ISO,
  ...overrides,
});

/** A gate set declaration with a repo-declared `both` gate. */
export const declaredGateSetWith = (entries: readonly MergeGateEntry[]) => ({
  schemaVersion: "delivery.merge.gates.v1",
  entries,
});

export { dataOf };

/** One verification record bound to an effective gate-set identity. */
export const verificationFor = (
  set: MergeEffectiveGateSet,
  overrides: Partial<MergeGateVerificationRecord> = {},
): MergeGateVerificationRecord =>
  verificationRecord({
    gateSet: { schemaVersion: set.schemaVersion, ids: set.ids },
    ...overrides,
  });
