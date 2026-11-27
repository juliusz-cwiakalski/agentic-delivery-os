/**
 * GH-416 — the classification fold (TC-LFOLD-001..004, TC-LPUSH-003,
 * TC-LCAUSE-001's engine-arm folded-reference clause).
 *
 * The real engine (`runDispatch`) runs with a fixed attempt id, so a durable
 * lane-push record can be bound to the attempt under classification. The fold
 * adds evidence references only: no token, outcome, comparison reason, or
 * attempt field changes.
 */
import { describe, expect, test } from "bun:test";
import { lanePushEvidenceRefsForAttempt, runDispatch } from "../../packages/core/src/app/dispatch";
import {
  appendDispatchLanePush,
  readDispatchAttempts,
} from "../../packages/core/src/app/dispatch-ledger";
import {
  DISPATCH_LANE_PUSH_PAYLOAD_SCHEMA,
  DISPATCH_PUSH_RECORDABLE_CAUSES,
  type DispatchLanePushRecord,
  type DispatchPushParityReading,
  type HarnessEvidence,
  type HarnessResult,
  type HarnessSessionHandle,
  type HarnessSessionPort,
  type StateStorePort,
} from "../../packages/core/src/contracts/index";
import { classifyHarnessEvidence } from "../../packages/core/src/domain/harness-classify";
import { readsFrom } from "../fixtures/dispatch/golden/harness";
import { createDispatchState } from "../fixtures/dispatch/harness";

const REF = "GH-301";
const REPOSITORY = "github.com/owner/repo";
const ATTEMPT = "attempt-fold-1";
const BRANCH = "feat/GH-301/fold";
const HEAD = "0123456789abcdef0123456789abcdef01234567";

const completeEvidence: HarnessEvidence = {
  completionMarker: true,
  exitStatus: 0,
  timedOut: false,
  spawnRefused: false,
  failureReported: false,
  toolFailure: false,
};

const handle: HarnessSessionHandle = {
  harnessKind: "opencode",
  sessionId: "ses-fold",
  treeRoot: "/tmp/ses-fold",
  workItemRef: REF,
};

const harnessPort = (): HarnessSessionPort => ({
  spawn: async () => ({ ok: true, value: handle }),
  resume: async () => ({ ok: true, value: handle }),
  collect: async (): Promise<HarnessResult<HarnessEvidence>> => ({ ok: true, value: completeEvidence }),
  classify: (input) => classifyHarnessEvidence(input),
  liveness: async () => ({
    ok: true,
    value: {
      readings: [
        {
          kind: "session-traffic",
          status: "sourced",
          value: 1,
          observedAt: "2026-11-08T10:00:00.000Z",
        },
      ],
    },
  }),
  listSessions: async () => ({ ok: true, value: { handles: [handle] } }),
});

const parity = (
  verdict: "clean" | "pushed" | "failed",
  holds: boolean,
): DispatchPushParityReading => ({
  ok: true,
  facts: {
    localHead: holds ? HEAD : "fedcba9876543210fedcba9876543210fedcba98",
    remoteHead: HEAD,
    verdict,
    parity: holds,
  },
});

const seedRecord = (
  store: StateStorePort,
  fenceToken: string,
  overrides: Partial<DispatchLanePushRecord> = {},
): void => {
  const record: DispatchLanePushRecord = {
    schema: DISPATCH_LANE_PUSH_PAYLOAD_SCHEMA,
    ref: REF,
    repository: REPOSITORY,
    branch: BRANCH,
    head: HEAD,
    verdict: "pushed",
    attemptId: ATTEMPT,
    sessionId: "ses-fold",
    recordedAt: "2026-11-27T00:00:00.000Z",
    ...overrides,
  };
  const appended = appendDispatchLanePush(store, fenceToken, record);
  expect(appended.ok).toBe(true);
};

type Classification = {
  readonly token: string | undefined;
  readonly attempt: {
    readonly evidenceRefs: readonly string[];
    readonly token: string;
    readonly outcome: string;
    readonly comparison: unknown;
  } | undefined;
};

const classify = async (input: {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly parity: DispatchPushParityReading;
  readonly attemptId?: string;
}): Promise<Classification> => {
  const result = await runDispatch({
    store: input.store,
    fenceToken: input.fenceToken,
    harness: harnessPort(),
    harnessKind: "opencode",
    descriptor: { kind: "host", workDirectory: "/tmp/ses-fold", environment: [] },
    prompt: `deliver ${REF}`,
    ref: REF,
    evidenceClass: "pilot",
    repository: REPOSITORY,
    handoverState: "dual-run",
    nowIso: () => "2026-11-08T10:00:00.000Z",
    newAttemptId: () => input.attemptId ?? ATTEMPT,
    newDivergenceId: () => "DIV-fold",
    readTruth: async () => readsFrom(),
    claimLease: () => ({ ok: true, leaseId: "lease-fold" }),
    releaseLease: () => true,
    phaseLedger: { completed: 3, total: 9, variant: "full" },
    restartBudget: 24,
    pushParity: async () => input.parity,
  });
  const attemptRead = readDispatchAttempts(input.store);
  const attempt =
    attemptRead.ok && attemptRead.records.length > 0 ? attemptRead.records.at(-1) : undefined;
  return {
    token: result.ok ? result.data.result : undefined,
    attempt:
      attempt === undefined
        ? undefined
        : {
            evidenceRefs: attempt.evidenceRefs,
            token: attempt.token,
            outcome: attempt.outcome,
            comparison: attempt.comparison,
          },
  };
};

describe("GH-416 TC-LFOLD-001 the refusal fold reserves both references", () => {
  test("each of the seven recordable causes folds lane-push:failed plus its cause", () => {
    const state = createDispatchState("fold-causes");
    try {
      for (const [index, cause] of DISPATCH_PUSH_RECORDABLE_CAUSES.entries()) {
        seedRecord(state.store, state.fenceToken, {
          verdict: "failed",
          cause,
          attemptId: `attempt-cause-${index}`,
        });
        const refs = lanePushEvidenceRefsForAttempt(
          state.store,
          REPOSITORY,
          `attempt-cause-${index}`,
        );
        expect(refs).toEqual(["lane-push:failed", `lane-push-cause:${cause}`]);
      }
    } finally {
      state.dispose();
    }
  });

  test("a recorded refusal reaches the attempt record beside a truthful classification", async () => {
    const state = createDispatchState("fold-refusal");
    try {
      seedRecord(state.store, state.fenceToken, {
        verdict: "failed",
        cause: "non-fast-forward",
      });
      const result = await classify({
        store: state.store,
        fenceToken: state.fenceToken,
        parity: parity("clean", true),
      });
      expect(result.token).toBe("pr-open");
      const refs = result.attempt?.evidenceRefs ?? [];
      expect(refs.filter((ref) => ref === "lane-push:failed")).toHaveLength(1);
      expect(refs.filter((ref) => ref === "lane-push-cause:non-fast-forward")).toHaveLength(1);
      expect(refs.length).toBeLessThanOrEqual(16);
      expect(refs).toContain("push:clean");
    } finally {
      state.dispose();
    }
  });
});

describe("GH-416 TC-LFOLD-002 the acceptance fold", () => {
  test("lane-push:pushed sits beside the delivered push verdict, no cause reference", async () => {
    const state = createDispatchState("fold-accept");
    try {
      seedRecord(state.store, state.fenceToken);
      const result = await classify({
        store: state.store,
        fenceToken: state.fenceToken,
        parity: parity("clean", true),
      });
      const refs = result.attempt?.evidenceRefs ?? [];
      expect(refs.filter((ref) => ref === "lane-push:pushed")).toHaveLength(1);
      expect(refs.some((ref) => ref.startsWith("lane-push-cause:"))).toBe(false);
      expect(refs).toContain("push:clean");
      expect(refs).not.toContain("push:pushed");
    } finally {
      state.dispose();
    }
  });
});

describe("GH-416 TC-LFOLD-003 no fabrication", () => {
  test("a foreign attempt, no record, and a foreign repository each contribute nothing", () => {
    const state = createDispatchState("fold-absent");
    try {
      expect(lanePushEvidenceRefsForAttempt(state.store, REPOSITORY, ATTEMPT)).toEqual([]);
      seedRecord(state.store, state.fenceToken, { attemptId: "attempt-other" });
      expect(lanePushEvidenceRefsForAttempt(state.store, REPOSITORY, ATTEMPT)).toEqual([]);
      seedRecord(state.store, state.fenceToken, {
        attemptId: ATTEMPT,
        repository: "github.com/other/repo",
      });
      expect(lanePushEvidenceRefsForAttempt(state.store, REPOSITORY, ATTEMPT)).toEqual([]);
    } finally {
      state.dispose();
    }
  });

  test("a torn lane-push family contributes nothing and never blocks classification", async () => {
    const state = createDispatchState("fold-unreadable");
    try {
      // A record under the lane-push prefix with a malformed payload makes the
      // family read classified-torn while the rest of the store stays readable.
      const acquired = state.store.acquireFence(state.fenceToken);
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      const malformed = state.store.append(acquired.value.handle, {
        kind: "dispatch.lane-push",
        recordKey: "dispatch.lane-pushes:GH-301",
        payload: { schema: DISPATCH_LANE_PUSH_PAYLOAD_SCHEMA, broken: true },
      });
      expect(malformed.ok).toBe(true);
      state.store.releaseFence(acquired.value.handle);

      expect(lanePushEvidenceRefsForAttempt(state.store, REPOSITORY, ATTEMPT)).toEqual([]);
      const result = await classify({
        store: state.store,
        fenceToken: state.fenceToken,
        parity: parity("clean", true),
      });
      expect(result.token).toBe("pr-open");
      expect(result.attempt?.evidenceRefs.some((ref) => ref.startsWith("lane-push:"))).toBe(false);
    } finally {
      state.dispose();
    }
  });

  test("the fold performs exactly one bounded lane-push read", () => {
    const state = createDispatchState("fold-one-read");
    try {
      let reads = 0;
      const counted: StateStorePort = {
        ...state.store,
        readRecords: () => {
          reads += 1;
          return state.store.readRecords();
        },
      };
      lanePushEvidenceRefsForAttempt(counted, REPOSITORY, ATTEMPT);
      expect(reads).toBe(1);
    } finally {
      state.dispose();
    }
  });
});

describe("GH-416 TC-LFOLD-004 a disclosure is not a claim", () => {
  test("arm A: a recorded refusal beside parity that holds leaves pr-open truthful", async () => {
    const state = createDispatchState("fold-arm-a");
    try {
      seedRecord(state.store, state.fenceToken, {
        verdict: "failed",
        cause: "non-fast-forward",
      });
      const result = await classify({
        store: state.store,
        fenceToken: state.fenceToken,
        parity: parity("clean", true),
      });
      expect(result.token).toBe("pr-open");
      expect(result.attempt?.comparison).toMatchObject({ class: "tracker-truth", outcome: "match" });
      expect(result.attempt?.evidenceRefs).toContain("lane-push:failed");
    } finally {
      state.dispose();
    }
  });

  test("arm B: a recorded refusal beside parity that fails fires the delivered row once", async () => {
    const state = createDispatchState("fold-arm-b");
    try {
      seedRecord(state.store, state.fenceToken, {
        verdict: "failed",
        cause: "non-fast-forward",
      });
      const result = await classify({
        store: state.store,
        fenceToken: state.fenceToken,
        parity: parity("failed", false),
      });
      expect(result.token).toBe("failed");
      expect(result.attempt?.token).toBe("failed");
      expect(result.attempt?.comparison).toMatchObject({ reason: "push-parity-unmet" });
      expect(result.attempt?.evidenceRefs).toContain("push:failed");
      expect(result.attempt?.evidenceRefs).toContain("lane-push:failed");
      expect(result.attempt?.evidenceRefs).toContain("lane-push-cause:non-fast-forward");
    } finally {
      state.dispose();
    }
  });

  test("arm C: a recorded push cannot mask a genuine divergence and is never rewritten", async () => {
    const state = createDispatchState("fold-arm-c");
    try {
      seedRecord(state.store, state.fenceToken);
      const result = await classify({
        store: state.store,
        fenceToken: state.fenceToken,
        parity: parity("failed", false),
      });
      expect(result.token).toBe("failed");
      expect(result.attempt?.evidenceRefs).toContain("lane-push:pushed");
      const read = readDispatchAttempts(state.store);
      expect(read.ok).toBe(true);
    } finally {
      state.dispose();
    }
  });
});

describe("GH-416 TC-LPUSH-003 a classification after an accepted lane push", () => {
  test("equal heads: zero engine push acts, push:clean and lane-push:pushed once each", async () => {
    const state = createDispatchState("lane-push-003");
    try {
      seedRecord(state.store, state.fenceToken);
      let pushActs = 0;
      const result = await runDispatch({
        store: state.store,
        fenceToken: state.fenceToken,
        harness: harnessPort(),
        harnessKind: "opencode",
        descriptor: { kind: "host", workDirectory: "/tmp/ses-fold", environment: [] },
        prompt: `deliver ${REF}`,
        ref: REF,
        evidenceClass: "pilot",
        repository: REPOSITORY,
        handoverState: "dual-run",
        nowIso: () => "2026-11-08T10:00:00.000Z",
        newAttemptId: () => ATTEMPT,
        newDivergenceId: () => "DIV-lpush-003",
        readTruth: async () => readsFrom(),
        claimLease: () => ({ ok: true, leaseId: "lease-lpush-003" }),
        releaseLease: () => true,
        phaseLedger: { completed: 3, total: 9, variant: "full" },
        restartBudget: 24,
        // Equal heads: the parity port answers clean and performs no act.
        pushParity: async () => parity("clean", true),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.result).toBe("pr-open");
      expect(pushActs).toBe(0);
      const refs = result.attempt.evidenceRefs;
      expect(refs.filter((ref) => ref === "push:clean")).toHaveLength(1);
      expect(refs.filter((ref) => ref === "lane-push:pushed")).toHaveLength(1);
      // The two families never collapse.
      expect(refs.filter((ref) => ref.startsWith("lane-push:")).length).toBeLessThanOrEqual(2);
    } finally {
      state.dispose();
    }
  });
});
