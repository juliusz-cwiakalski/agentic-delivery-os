/**
 * TC-TELEMETRY-046 committed golden: the delivered single-ref results of the
 * per-ref telemetry families read — records with ordering, the verified-empty
 * flag, the evidence pair, and every delivered tear identity and location —
 * captured from delivered behavior before the GH-381 branch edit (test-plan
 * §8.2 ordering constraint).
 *
 * Regenerate only with the explicit capture entry, never by hand and never as
 * a blanket rewrite; a golden change that alters a tear case must fail review:
 *
 *   bun tests/fixtures/telemetry/foreign-ref-skip-golden-run.ts
 *
 * The <stateDirectory> placeholder stands for the per-run temp state root, so
 * the golden holds no absolute path.
 */
import type { Gh381NormalizedRead, Gh381NormalizedTear } from "./index";

export type ForeignRefSkipGolden = {
  readonly requestedRef: string;
  readonly foreignRef: string;
  readonly healthy: Gh381NormalizedRead;
  readonly emptyLedger: Gh381NormalizedRead;
  readonly tears: {
    readonly bareStepPrefix: Gh381NormalizedTear;
    readonly bareBaselinePrefix: Gh381NormalizedTear;
    readonly stepKindMismatch: Gh381NormalizedTear;
    readonly baselineKindMismatch: Gh381NormalizedTear;
    readonly stepMalformedPayload: Gh381NormalizedTear;
  };
};

export const FOREIGN_REF_SKIP_GOLDEN: ForeignRefSkipGolden = {
  requestedRef: "GH-381",
  foreignRef: "GH-365",
  healthy: {
    steps: [
      {
        schemaId: "delivery.harness.telemetry.step.v1",
        storageVersion: "delivery.telemetry.storage.v1",
        workItemRef: "GH-381",
        runId: "run-gh381-GH-381",
        sessionId: "ses-gh381-GH-381-s1",
        harnessKind: "opencode",
        harnessVersion: "2.2.5",
        treeRoot: "/work/checkout-a",
        model: "model-alpha",
        ticket: "GH-381",
        repository: "/work/checkout-a",
        lane: "lane-alpha",
        agentRole: "coder",
        tokens: {
          input: 10,
          output: 5,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
        },
        calls: 1,
        cost: 0.25,
        startedAt: null,
        finishedAt: "2026-11-12T08:10:00.000Z",
        warnings: [],
        capturedAt: "2026-11-12T08:10:00.000Z",
      },
      {
        schemaId: "delivery.harness.telemetry.step.v1",
        storageVersion: "delivery.telemetry.storage.v1",
        workItemRef: "GH-381",
        runId: "run-gh381-GH-381",
        sessionId: "ses-gh381-GH-381-s2",
        harnessKind: "opencode",
        harnessVersion: "2.2.5",
        treeRoot: "/work/checkout-a",
        model: "model-alpha",
        ticket: "GH-381",
        repository: "/work/checkout-a",
        lane: "lane-alpha",
        agentRole: "coder",
        tokens: {
          input: 20,
          output: 10,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
        },
        calls: 2,
        cost: 0.5,
        startedAt: null,
        finishedAt: "2026-11-12T08:10:00.000Z",
        warnings: [],
        capturedAt: "2026-11-12T08:10:00.000Z",
      },
    ],
    baselines: [
      {
        schemaId: "delivery.harness.telemetry.baseline.v1",
        storageVersion: "delivery.telemetry.storage.v1",
        workItemRef: "GH-381",
        runId: "run-gh381-GH-381",
        sessionId: "ses-gh381-GH-381-baseline",
        tokens: {
          input: 100,
          output: 50,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
        },
        calls: 2,
        cost: 1.5,
        capturedAt: "2026-11-12T08:25:00.000Z",
        warnings: [],
      },
    ],
    records: [
      {
        schemaId: "delivery.harness.telemetry.v1",
        workItemRef: "GH-381",
        runId: "run-gh381-GH-381",
        sessionId: "ses-gh381-GH-381-v1",
        harnessKind: "opencode",
        harnessVersion: "2.2.5",
        agent: "coder",
        model: "model-alpha",
        treeRoot: "/work/checkout-a",
        parentChain: [],
        tokens: {
          input: 40,
          output: 20,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
        },
        calls: 2,
        toolCounts: [],
        cost: 1,
        capturedAt: "2026-11-12T08:00:00.000Z",
        warnings: [],
      },
    ],
    outcomes: [
      {
        schemaId: "delivery.harness.telemetry.capture.v1",
        workItemRef: "GH-381",
        runId: "run-gh381-GH-381",
        captured: 1,
        degraded: 0,
        failed: 0,
        warnings: [],
        capturedAt: "2026-11-12T08:40:00.000Z",
      },
    ],
    verifiedEmpty: false,
    evidence: {
      storePath: "<stateDirectory>/ledger.workspace-a.jsonl",
      recordCount: 5,
    },
  },
  emptyLedger: {
    steps: [],
    baselines: [],
    records: [],
    outcomes: [],
    verifiedEmpty: true,
    evidence: {
      storePath: "<stateDirectory>/ledger.workspace-a.jsonl",
      recordCount: 0,
    },
  },
  tears: {
    bareStepPrefix: {
      kind: "state",
      code: "state.store.torn",
      consequence: "not_landed",
      location: {
        path: "<stateDirectory>/ledger.workspace-a.jsonl",
        record: 6,
      },
    },
    bareBaselinePrefix: {
      kind: "state",
      code: "state.store.torn",
      consequence: "not_landed",
      location: {
        path: "<stateDirectory>/ledger.workspace-a.jsonl",
        record: 6,
      },
    },
    stepKindMismatch: {
      kind: "state",
      code: "state.store.torn",
      consequence: "not_landed",
      location: {
        path: "<stateDirectory>/ledger.workspace-a.jsonl",
        record: 6,
      },
    },
    baselineKindMismatch: {
      kind: "state",
      code: "state.store.torn",
      consequence: "not_landed",
      location: {
        path: "<stateDirectory>/ledger.workspace-a.jsonl",
        record: 6,
      },
    },
    stepMalformedPayload: {
      kind: "state",
      code: "state.store.torn",
      consequence: "not_landed",
      location: {
        path: "<stateDirectory>/ledger.workspace-a.jsonl",
        record: 6,
      },
    },
  },
};
