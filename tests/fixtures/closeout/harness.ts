/**
 * The shared, fully injected closeout harness (test-plan §4.1).
 *
 * Provider, git, and state behaviour is supplied by recording fakes; no suite
 * resolves a host, reads a credential, spawns a process, or writes the live
 * tree. Time and ids are fixed constants.
 */
import {
  CLOSEOUT_INTEGRATION_BASE,
  CLOSEOUT_MAX_DEPENDENTS,
  type CloseoutBranchFact,
  type CloseoutCheckoutFacts,
  type CloseoutDependentFact,
  type CloseoutEvidence,
  type CloseoutGitRuntime,
  type CloseoutOperation,
  type CloseoutOperationRecord,
  type CloseoutPlanFacts,
  type CloseoutProviderRuntime,
  type CloseoutReadObservation,
  type CloseoutStateRuntime,
  type AdapterOperation,
  type CapabilityGap,
  type StateFailureCode,
  type CloseoutWriteOutcome,
  type DeliveryRequest,
  type ProviderQualifiedIdentity,
  type StateFenceHandle,
  type WorkItem,
} from "../../../packages/core/src/contracts/index";
import { bufferSink, SYNTHETIC_BRAND } from "../../golden/helpers";

export { SYNTHETIC_BRAND };
export { CANARY_TEXT } from "./canary";
export { CLOSEOUT_SCHEMA_ID } from "../../../packages/core/src/contracts/index";

export const CLOSEOUT_NOW_MS = 1_800_000_000_000;
export const CLOSEOUT_TIMESTAMP = "2026-11-01T00:00:00Z";
export const WORK_ITEM_REF = "GH-183";
export const WORKSPACE_ID = "workspace-a";
export const SYSTEM_NAME = "github";
export const HEAD_SHA = "1111111111111111111111111111111111111111";
export const MERGED_HEAD_SHA = "2222222222222222222222222222222222222222";
export const BRANCH_NAME = "feat/GH-183/closeout-v1-branch-cleanup";
export const BASE_REF = "main-tools";
export const THREAD_ID = "PRRT_2";

export const FIXED_RUN_IDS = [
  "run-0001",
  "run-0002",
  "run-0003",
  "run-0004",
  "run-0005",
] as const;

export const fixedRunId = (index = 0): string =>
  FIXED_RUN_IDS[index % FIXED_RUN_IDS.length] as string;

export type ProviderCall = {
  readonly kind: string;
  readonly target: string;
  readonly args: unknown;
};

export type FakeProviderOptions = {
  readonly systemName?: string;
  readonly supported?: readonly AdapterOperation[];
  readonly gaps?: readonly CapabilityGap[];
  readonly workItem?: CloseoutReadObservation<WorkItem>;
  readonly merged?: CloseoutReadObservation<DeliveryRequest>;
  readonly dependents?: CloseoutReadObservation<readonly WorkItem[]>;
  readonly writeWorkItem?: CloseoutWriteOutcome;
  readonly transitionWorkItem?: CloseoutWriteOutcome;
  readonly resolveDeliveryThread?: CloseoutWriteOutcome;
};

export type FakeProvider = {
  readonly runtime: CloseoutProviderRuntime;
  readonly calls: ProviderCall[];
};

const FULL_SUPPORTED = [
  "read-work-item",
  "read-delivery-request",
  "read-pipeline-run",
  "write-work-item",
  "transition-work-item",
  "resolve-delivery-thread",
] as const;

export const DEFAULT_LABELS = [
  "change",
  "planning",
  "spec-ready",
  "readiness-passed",
  "in-progress",
  "review",
  "blocked",
  "vendor-label",
] as const;

export const makeWorkItem = (overrides: Partial<WorkItem> = {}): WorkItem => ({
  identity: { systemName: SYSTEM_NAME, entityId: "183" },
  title: "Closeout v1 with branch cleanup",
  status: { nativeStatus: "open", deliveryState: "in-review" },
  labels: [...DEFAULT_LABELS],
  assignee: "owner-placeholder",
  relations: [],
  updatedAt: "2026-10-31T00:00:00Z",
  ...overrides,
});

export const makeDependent = (
  entityId: string,
  overrides: Partial<WorkItem> = {},
): WorkItem => ({
  identity: { systemName: SYSTEM_NAME, entityId },
  title: `Dependent ${entityId}`,
  status: { nativeStatus: "open", deliveryState: "ready" },
  labels: ["change", "blocked"],
  relations: [],
  ...overrides,
});

export const makeMergedRequest = (
  overrides: Partial<DeliveryRequest> = {},
): DeliveryRequest => ({
  identity: { systemName: SYSTEM_NAME, entityId: "504" },
  sourceRef: BRANCH_NAME,
  targetRef: BASE_REF,
  reviewState: "merged",
  threads: [
    { threadId: "PRRT_1", resolved: true, commentCount: 2 },
    { threadId: THREAD_ID, resolved: false, commentCount: 1 },
  ],
  headSha: MERGED_HEAD_SHA,
  ...overrides,
});

export const observed = <T>(value: T, signals?: Parameters<typeof withSignals>[1]): CloseoutReadObservation<T> =>
  withSignals(value, signals);

const withSignals = <T>(
  value: T,
  signals?: { readonly labels?: "observed" | "unavailable"; readonly relations?: "observed" | "unavailable" | "unknown"; readonly assignee?: "observed" | "unavailable" },
): CloseoutReadObservation<T> =>
  signals === undefined
    ? { observation: "observed", value }
    : { observation: "observed", value, signals };

export const makeProvider = (options: FakeProviderOptions = {}): FakeProvider => {
  const calls: ProviderCall[] = [];
  const workItem = options.workItem ?? observed(makeWorkItem());
  const merged = options.merged ?? observed(makeMergedRequest());
  const dependents = options.dependents ?? observed([]);
  const runtime: CloseoutProviderRuntime = {
    systemName: options.systemName ?? SYSTEM_NAME,
    capabilities: {
      supportedOperations: [...(options.supported ?? FULL_SUPPORTED)],
      declaredGaps: [...(options.gaps ?? [])],
      writableCarriers: [],
      readableCarriers: [],
    },
    readWorkItem: async (entityId) => {
      calls.push({ kind: "readWorkItem", target: entityId, args: {} });
      return workItem;
    },
    readWorkItemObservation: async (entityId) => {
      calls.push({ kind: "readWorkItemObservation", target: entityId, args: {} });
      return workItem;
    },
    findMergedDeliveryRequest: async (input) => {
      calls.push({ kind: "findMergedDeliveryRequest", target: input.workItemRef, args: input });
      return merged;
    },
    listBlockedByDependents: async (input) => {
      calls.push({ kind: "listBlockedByDependents", target: input.entityId, args: input });
      return dependents;
    },
    writeWorkItem: async (input) => {
      calls.push({ kind: "writeWorkItem", target: input.entityId, args: input });
      return options.writeWorkItem ?? { ok: true };
    },
    transitionWorkItem: async (input) => {
      calls.push({ kind: "transitionWorkItem", target: input.entityId, args: input });
      return options.transitionWorkItem ?? { ok: true };
    },
    resolveDeliveryThread: async (input) => {
      calls.push({
        kind: "resolveDeliveryThread",
        target: `${input.deliveryRequest.entityId}:${input.threadId}`,
        args: input,
      });
      return options.resolveDeliveryThread ?? { ok: true };
    },
  };
  return { runtime, calls };
};

export type FakeGitOptions = {
  readonly checkout?: CloseoutCheckoutFacts;
  readonly clean?: boolean;
  readonly baseRefExists?: boolean;
  readonly branches?: readonly CloseoutBranchFact[];
  readonly checkedOutElsewhere?: readonly string[];
  readonly restore?: CloseoutWriteOutcome;
  readonly deleteBranch?: CloseoutWriteOutcome;
};

export type FakeGit = {
  readonly runtime: CloseoutGitRuntime;
  readonly calls: ProviderCall[];
};

export const makeGit = (options: FakeGitOptions = {}): FakeGit => {
  const calls: ProviderCall[] = [];
  const branches = options.branches ?? [{ name: BRANCH_NAME, head: MERGED_HEAD_SHA }];
  const runtime: CloseoutGitRuntime = {
    readCheckout: async (input) => {
      calls.push({ kind: "readCheckout", target: input.deliveryBranch, args: input });
      return options.checkout ?? { state: "delivery-branch", branch: BRANCH_NAME, head: HEAD_SHA };
    },
    listBranches: async (input) => {
      calls.push({ kind: "listBranches", target: input.workItemRef, args: input });
      return branches;
    },
    readBranch: async (input) => {
      calls.push({ kind: "readBranch", target: input.branch, args: input });
      return branches.find((branch) => branch.name === input.branch);
    },
    isCheckedOutElsewhere: async (input) => {
      calls.push({ kind: "isCheckedOutElsewhere", target: input.branch, args: input });
      return (options.checkedOutElsewhere ?? []).includes(input.branch);
    },
    isClean: async () => {
      calls.push({ kind: "isClean", target: "", args: {} });
      return options.clean ?? true;
    },
    resolveRef: async (input) => {
      calls.push({ kind: "resolveRef", target: input.ref, args: input });
      return options.baseRefExists ?? true;
    },
    restoreCheckout: async (input) => {
      calls.push({ kind: "restoreCheckout", target: input.baseRef, args: input });
      return options.restore ?? { ok: true };
    },
    deleteBranch: async (input) => {
      calls.push({ kind: "deleteBranch", target: input.branch, args: input });
      return options.deleteBranch ?? { ok: true };
    },
  };
  return { runtime, calls };
};

export type FakeStateOptions = {
  readonly records?: readonly CloseoutOperationRecord[];
  readonly torn?: boolean;
  readonly acquire?: { readonly ok: false; readonly code: StateFailureCode };
};

export type FakeState = {
  readonly runtime: CloseoutStateRuntime;
  readonly records: CloseoutOperationRecord[];
  readonly fence: { acquired: number; released: number; appends: number };
};

const handleFor = (token: string): StateFenceHandle =>
  ({ token, workspaceId: WORKSPACE_ID, fenceNamespace: "closeout" }) as unknown as StateFenceHandle;

export const makeState = (options: FakeStateOptions = {}): FakeState => {
  const records: CloseoutOperationRecord[] = [...(options.records ?? [])];
  const fence = { acquired: 0, released: 0, appends: 0 };
  const runtime: CloseoutStateRuntime = {
    acquireFence: (token) => {
      if (options.acquire !== undefined && options.acquire.ok === false) {
        return {
          ok: false,
          error: {
            kind: "state",
            code: options.acquire.code,
            consequence: "not_landed",
            location: { path: "state" },
          },
        };
      }
      fence.acquired += 1;
      return { ok: true, value: { handle: handleFor(token), token } };
    },
    append: (handle, request) => {
      fence.appends += 1;
      const record = request.payload as unknown as CloseoutOperationRecord;
      records.push(record);
      return {
        ok: true,
        value: { sequence: records.length, checksum: "0".repeat(64), path: "ledger" },
      };
    },
    releaseFence: (handle) => {
      fence.released += 1;
      return { ok: true, value: { token: handle.token, released: true } };
    },
    readHistory: () =>
      options.torn === true
        ? {
            ok: false,
            error: {
              kind: "state",
              code: "state.store.torn",
              consequence: "not_landed",
              location: { path: "ledger", record: 1 },
            },
          }
        : { ok: true, value: records },
  };
  return { runtime, records, fence };
};

export const makeRecord = (
  operation: CloseoutOperation,
  outcome: CloseoutOperationRecord["outcome"],
  overrides: Partial<CloseoutOperationRecord> = {},
): CloseoutOperationRecord => ({
  schemaId: "delivery.closeout.operation.v1",
  operationId: operation.operationId,
  workItemRef: WORK_ITEM_REF,
  engine: operation.engine,
  capabilityContext: operation.capabilityContext,
  operation: operation.name,
  arguments: operation.arguments,
  target: operation.target,
  outcome,
  evidence: operationEvidence(operation),
  timestamp: CLOSEOUT_TIMESTAMP,
  ...overrides,
});

const operationEvidence = (operation: CloseoutOperation): CloseoutEvidence => [
  { name: "operation", value: operation.name },
  { name: "target", value: operation.target.entityId },
];

export const makeFacts = (overrides: Partial<CloseoutPlanFacts> = {}): CloseoutPlanFacts => ({
  workspaceId: WORKSPACE_ID,
  workItemRef: WORK_ITEM_REF,
  provider: {
    systemName: SYSTEM_NAME,
    capabilities: {
      supportedOperations: [...FULL_SUPPORTED],
      declaredGaps: [
        { operation: "write-comment", reason: "adapter-not-implemented" },
        { operation: "write-delivery-request", reason: "adapter-not-implemented" },
      ],
      writableCarriers: [],
      readableCarriers: [],
    },
  },
  observedWorkItem: observed(makeWorkItem()),
  mergedRequest: observed(makeMergedRequest()),
  dependents: observed([]),
  checkout: { state: "delivery-branch", branch: BRANCH_NAME, head: HEAD_SHA },
  cleanWorktree: true,
  baseRefExists: true,
  branches: [{ name: BRANCH_NAME, head: MERGED_HEAD_SHA }],
  checkedOutElsewhere: [],
  persisted: {},
  ...overrides,
});

export const testDependent = (
  item: WorkItem,
  blockers: CloseoutReadObservation<readonly WorkItem[]>,
): CloseoutDependentFact => ({ item, blockers });

export const operationById = (
  operations: readonly CloseoutOperation[],
  operationId: string,
): CloseoutOperation => {
  const found = operations.find((operation) => operation.operationId === operationId);
  if (found === undefined) throw new Error(`missing operation ${operationId}`);
  return found;
};

export const bufferStreams = (): {
  readonly streams: { readonly stdout: ReturnType<typeof bufferSink>; readonly stderr: ReturnType<typeof bufferSink> };
} => ({ streams: { stdout: bufferSink(), stderr: bufferSink() } });

export const MAX_DEPENDENTS = CLOSEOUT_MAX_DEPENDENTS;
export const INTEGRATION_BASE = CLOSEOUT_INTEGRATION_BASE;

export type { ProviderQualifiedIdentity };
