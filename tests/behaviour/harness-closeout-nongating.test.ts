/**
 * TC-HARN-025 — closeout capture is non-gating: failure is classified,
 * disclosed, and changes no other effect.
 */
import { describe, expect, test } from "bun:test";
import { buildCloseoutPlan, runCloseout } from "../../packages/core/src/domain/closeout";
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
  TELEMETRY_RUN_ID,
} from "../fixtures/closeout/harness-telemetry";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const roots: string[] = [];

const realStore = () => {
  const root = makeTempRoot("gh233-nongating");
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
    fenceToken: "fence-nongating",
    apply: true,
    runId: TELEMETRY_RUN_ID,
    ...(telemetry === undefined ? {} : { telemetry: telemetry.runtime }),
  });

const afterEachCleanup = (): void => {
  for (const root of roots.splice(0)) removeRoot(root);
};

describe("TC-HARN-025 non-gating closeout capture", () => {
  test("a thrown extraction changes no step outcome, summary, or verdict", async () => {
    try {
      const baseline = await apply(makeState());
      expect(baseline.ok).toBe(true);
      const store = realStore();
      const telemetry = makeCloseoutTelemetry({
        store,
        workItemRef: WORK_ITEM_REF,
        capture: makeTelemetryCapture({ workItemRef: WORK_ITEM_REF, runId: TELEMETRY_RUN_ID }),
        throwCapture: true,
      });
      const failing = await apply(makeState(), telemetry);
      expect(failing.ok).toBe(true);
      if (!baseline.ok || !failing.ok) return;
      expect(failing.data.steps).toEqual(baseline.data.steps);
      expect(failing.data.summary).toEqual(baseline.data.summary);
      expect(failing.data.telemetryCapture).toMatchObject({ captured: 0, failed: 1 });
      expect(failing.data.telemetryCapture?.warnings[0]?.reason).toBe("session-capture-failed");
      const records = readHarnessTelemetry(store, WORK_ITEM_REF);
      expect(records.ok).toBe(true);
      if (records.ok) expect(records.value.records).toHaveLength(0);
    } finally {
      afterEachCleanup();
    }
  });

  test("an append failure is classified and writes no readable records", async () => {
    try {
      const store = realStore();
      const telemetry = makeCloseoutTelemetry({
        store,
        workItemRef: WORK_ITEM_REF,
        capture: makeTelemetryCapture({ workItemRef: WORK_ITEM_REF, runId: TELEMETRY_RUN_ID }),
        failAppend: true,
      });
      const result = await apply(makeState(), telemetry);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.telemetryCapture?.failed).toBe(1);
      const records = readHarnessTelemetry(store, WORK_ITEM_REF);
      expect(records.ok).toBe(true);
      if (records.ok) expect(records.value.records).toHaveLength(0);
    } finally {
      afterEachCleanup();
    }
  });

  test("a degraded capture appends records and keeps the outcome equal to baseline", async () => {
    try {
      const baseline = await apply(makeState());
      const store = realStore();
      const degradedRecord = makeTelemetryRecord({
        workItemRef: WORK_ITEM_REF,
        runId: TELEMETRY_RUN_ID,
        sessionId: "ses_root",
      });
      const degraded = {
        ...degradedRecord,
        warnings: [{ reason: "cost-missing" as const, field: "cost" }],
      };
      const telemetry = makeCloseoutTelemetry({
        store,
        workItemRef: WORK_ITEM_REF,
        capture: makeTelemetryCapture({
          workItemRef: WORK_ITEM_REF,
          runId: TELEMETRY_RUN_ID,
          records: [degraded],
        }),
      });
      const result = await apply(makeState(), telemetry);
      expect(result.ok && baseline.ok).toBe(true);
      if (!result.ok || !baseline.ok) return;
      expect(result.data.steps).toEqual(baseline.data.steps);
      expect(result.data.telemetryCapture).toMatchObject({ captured: 1, degraded: 1, failed: 0 });
      const records = readHarnessTelemetry(store, WORK_ITEM_REF);
      expect(records.ok).toBe(true);
      if (records.ok) expect(records.value.records).toHaveLength(1);
    } finally {
      afterEachCleanup();
    }
  });
});
