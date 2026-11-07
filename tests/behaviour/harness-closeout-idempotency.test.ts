/**
 * TC-HARN-024 — closeout capture idempotency: re-runs append nothing and
 * partial-then-success converges.
 */
import { describe, expect, test } from "bun:test";
import { buildCloseoutPlan, runCloseout } from "../../packages/core/src/domain/closeout";
import { canonicalHarnessJson } from "../../packages/core/src/domain/index";
import { readHarnessTelemetry } from "../../packages/core/src/state/index";
import {
  CLOSEOUT_TIMESTAMP,
  makeFacts,
  makeGit,
  makeProvider,
  makeState,
  WORK_ITEM_REF,
} from "../fixtures/closeout/harness";
import {
  makeCloseoutTelemetry,
  makeTelemetryCapture,
  makeTelemetryRecord,
  makeTwoGroupCapture,
  TELEMETRY_RUN_ID,
} from "../fixtures/closeout/harness-telemetry";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const roots: string[] = [];

const realStore = () => {
  const root = makeTempRoot("gh233-idempotency");
  roots.push(root);
  return openStore(makeIdentity(root)).store;
};

const apply = (
  state: ReturnType<typeof makeState>,
  telemetry?: ReturnType<typeof makeCloseoutTelemetry>,
) =>
  runCloseout({
    plan: buildCloseoutPlan(makeFacts()),
    provider: makeProvider().runtime,
    git: makeGit().runtime,
    state: state.runtime,
    timestamp: CLOSEOUT_TIMESTAMP,
    fenceToken: "fence-idem",
    apply: true,
    runId: TELEMETRY_RUN_ID,
    ...(telemetry === undefined ? {} : { telemetry: telemetry.runtime }),
  });

const afterEachCleanup = (): void => {
  for (const root of roots.splice(0)) removeRoot(root);
};

describe("TC-HARN-024 idempotent closeout capture", () => {
  test("re-runs append nothing and converge without duplicates", async () => {
    try {
      const store = realStore();
      const capture = makeTelemetryCapture({ workItemRef: WORK_ITEM_REF, runId: TELEMETRY_RUN_ID });
      const telemetry = makeCloseoutTelemetry({ store, workItemRef: WORK_ITEM_REF, capture });
      expect((await apply(makeState(), telemetry)).ok).toBe(true);
      const first = readHarnessTelemetry(store, WORK_ITEM_REF);
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.value.records).toHaveLength(3);
      const frozen = canonicalHarnessJson(first.value.records);

      expect((await apply(makeState(), telemetry)).ok).toBe(true);
      expect((await apply(makeState(), telemetry)).ok).toBe(true);
      const again = readHarnessTelemetry(store, WORK_ITEM_REF);
      expect(again.ok).toBe(true);
      if (!again.ok) return;
      expect(again.value.records).toHaveLength(3);
      expect(canonicalHarnessJson(again.value.records)).toBe(frozen);
      expect(new Set(again.value.records.map((record) => record.sessionId)).size).toBe(3);
    } finally {
      afterEachCleanup();
    }
  });

  test("a failed capture converges to success without duplicates", async () => {
    try {
      const store = realStore();
      const failed = makeCloseoutTelemetry({
        store,
        workItemRef: WORK_ITEM_REF,
        capture: makeTelemetryCapture({ workItemRef: WORK_ITEM_REF, runId: TELEMETRY_RUN_ID }),
        captureResult: {
          ok: false,
          error: { kind: "harness", code: "harness.telemetry.extraction-failed" },
        },
      });
      const first = await apply(makeState(), failed);
      expect(first.ok).toBe(true);
      const empty = readHarnessTelemetry(store, WORK_ITEM_REF);
      expect(empty.ok).toBe(true);
      if (empty.ok) expect(empty.value.records).toHaveLength(0);
      if (first.ok) expect(first.data.telemetryCapture?.failed).toBe(1);

      const success = makeCloseoutTelemetry({
        store,
        workItemRef: WORK_ITEM_REF,
        capture: makeTelemetryCapture({ workItemRef: WORK_ITEM_REF, runId: TELEMETRY_RUN_ID }),
      });
      expect((await apply(makeState(), success)).ok).toBe(true);
      expect((await apply(makeState(), success)).ok).toBe(true);
      const converged = readHarnessTelemetry(store, WORK_ITEM_REF);
      expect(converged.ok).toBe(true);
      if (converged.ok) expect(converged.value.records).toHaveLength(3);
    } finally {
      afterEachCleanup();
    }
  });

  test("a two-group session re-runs without duplicate group records", async () => {
    try {
      const store = realStore();
      const capture = makeTwoGroupCapture({
        workItemRef: WORK_ITEM_REF,
        runId: TELEMETRY_RUN_ID,
      });
      const telemetry = makeCloseoutTelemetry({ store, workItemRef: WORK_ITEM_REF, capture });
      expect((await apply(makeState(), telemetry)).ok).toBe(true);
      const first = readHarnessTelemetry(store, WORK_ITEM_REF);
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.value.records).toHaveLength(3);
      expect(first.value.records.filter((record) => record.sessionId === "ses_root")).toHaveLength(
        2,
      );
      const frozen = canonicalHarnessJson(first.value.records);

      expect((await apply(makeState(), telemetry)).ok).toBe(true);
      const again = readHarnessTelemetry(store, WORK_ITEM_REF);
      expect(again.ok).toBe(true);
      if (!again.ok) return;
      expect(again.value.records).toHaveLength(3);
      expect(canonicalHarnessJson(again.value.records)).toBe(frozen);
    } finally {
      afterEachCleanup();
    }
  });

  test("one new session appends exactly one record", async () => {
    try {
      const store = realStore();
      const base = makeTelemetryCapture({ workItemRef: WORK_ITEM_REF, runId: TELEMETRY_RUN_ID });
      const first = makeCloseoutTelemetry({ store, workItemRef: WORK_ITEM_REF, capture: base });
      expect((await apply(makeState(), first)).ok).toBe(true);
      const extended = makeTelemetryCapture({
        workItemRef: WORK_ITEM_REF,
        runId: TELEMETRY_RUN_ID,
        records: [
          ...base.records,
          makeTelemetryRecord({
            workItemRef: WORK_ITEM_REF,
            runId: TELEMETRY_RUN_ID,
            sessionId: "ses_child_c",
            treeRoot: "ses_root",
            parentChain: ["ses_root"],
          }),
        ],
      });
      const second = makeCloseoutTelemetry({
        store,
        workItemRef: WORK_ITEM_REF,
        capture: extended,
      });
      expect((await apply(makeState(), second)).ok).toBe(true);
      const read = readHarnessTelemetry(store, WORK_ITEM_REF);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.value.records).toHaveLength(4);
      expect(read.value.records.filter((record) => record.sessionId === "ses_root")).toHaveLength(
        1,
      );
    } finally {
      afterEachCleanup();
    }
  });
});
