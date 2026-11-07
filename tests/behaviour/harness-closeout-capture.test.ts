/**
 * TC-HARN-023, TC-HARN-024, TC-HARN-025 — closeout capture durability,
 * idempotency, and non-gating disclosure.
 */
import { describe, expect, test } from "bun:test";
import {
  HARNESS_TELEMETRY_SCHEMA_ID,
  STATE_SCHEMA_VERSION,
  type StateStorePort,
} from "../../packages/core/src/contracts/index";
import { buildCloseoutPlan, runCloseout } from "../../packages/core/src/domain/closeout";
import {
  readHarnessCaptureOutcome,
  readHarnessTelemetry,
} from "../../packages/core/src/state/index";
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
  makeTwoGroupCapture,
  TELEMETRY_RUN_ID,
} from "../fixtures/closeout/harness-telemetry";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const roots: string[] = [];

const realStore = (): StateStorePort => {
  const root = makeTempRoot("gh233-closeout");
  roots.push(root);
  return openStore(makeIdentity(root)).store;
};

const apply = (
  state: ReturnType<typeof makeState>,
  telemetry?: ReturnType<typeof makeCloseoutTelemetry>,
  runId = TELEMETRY_RUN_ID,
) =>
  runCloseout({
    plan: buildCloseoutPlan(makeFacts()),
    provider: makeProvider().runtime,
    git: makeGit().runtime,
    state: state.runtime,
    timestamp: CLOSEOUT_TIMESTAMP,
    fenceToken: "fence-closeout",
    apply: true,
    runId,
    ...(telemetry === undefined ? {} : { telemetry: telemetry.runtime }),
  });

const afterEachCleanup = (): void => {
  for (const root of roots.splice(0)) removeRoot(root);
};

describe("TC-HARN-023 durable closeout capture", () => {
  test("the log alone holds every session statistic after closeout", async () => {
    try {
      const store = realStore();
      const telemetry = makeCloseoutTelemetry({
        store,
        workItemRef: WORK_ITEM_REF,
        capture: makeTelemetryCapture({ workItemRef: WORK_ITEM_REF, runId: TELEMETRY_RUN_ID }),
      });
      const result = await apply(makeState(), telemetry);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.telemetryCapture).toMatchObject({ captured: 3, degraded: 0, failed: 0 });
      const read = readHarnessTelemetry(store, WORK_ITEM_REF);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.value.records).toHaveLength(3);
      for (const record of read.value.records) {
        expect(record.schemaId).toBe(HARNESS_TELEMETRY_SCHEMA_ID);
        expect(record.workItemRef).toBe(WORK_ITEM_REF);
        expect(record.runId).toBe(TELEMETRY_RUN_ID);
        expect(record.tokens.input).toBeGreaterThan(0);
        expect(record.calls).toBeGreaterThan(0);
        expect(record.toolCounts.length).toBeGreaterThan(0);
        expect(record.agent.length).toBeGreaterThan(0);
        expect(record.model.length).toBeGreaterThan(0);
        expect(record.harnessKind).toBe("opencode");
        expect(record.harnessVersion).toBe("1.0.0");
        expect(record.treeRoot.length).toBeGreaterThan(0);
        expect(record.parentChain.length).toBeGreaterThanOrEqual(0);
      }
      const outcome = readHarnessCaptureOutcome(store, WORK_ITEM_REF, TELEMETRY_RUN_ID);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) expect(outcome.value?.captured).toBe(3);
      const acquire = telemetry.log.findIndex((entry) => entry.startsWith("acquireFence"));
      const append = telemetry.log.findIndex((entry) =>
        entry.startsWith("append:harness.telemetry"),
      );
      const release = telemetry.log.findIndex((entry) => entry.startsWith("releaseFence"));
      expect(acquire).toBeGreaterThanOrEqual(0);
      expect(append).toBeGreaterThan(acquire);
      expect(release).toBeGreaterThan(append);
      expect(telemetry.log.slice(0, acquire)).toContain("readRecords");
      expect(
        telemetry.log.slice(release).filter((entry) => entry === "readRecords").length,
      ).toBeGreaterThan(0);
      expect(STATE_SCHEMA_VERSION).toBe("delivery.state.v1");
    } finally {
      afterEachCleanup();
    }
  });

  test("a session spanning two agent/model groups captures both records", async () => {
    try {
      const store = realStore();
      const telemetry = makeCloseoutTelemetry({
        store,
        workItemRef: WORK_ITEM_REF,
        capture: makeTwoGroupCapture({ workItemRef: WORK_ITEM_REF, runId: TELEMETRY_RUN_ID }),
      });
      const result = await apply(makeState(), telemetry);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.telemetryCapture).toMatchObject({ captured: 3, failed: 0 });
      const read = readHarnessTelemetry(store, WORK_ITEM_REF);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.value.records).toHaveLength(3);
      const root = read.value.records.filter((record) => record.sessionId === "ses_root");
      expect(root).toHaveLength(2);
      expect(new Set(root.map((record) => `${record.agent}|${record.model}`)).size).toBe(2);
      for (const record of root) {
        expect(record.treeRoot).toBe("ses_root");
        expect(record.runId).toBe(TELEMETRY_RUN_ID);
      }
    } finally {
      afterEachCleanup();
    }
  });

  test("per-session values and join keys survive verbatim", async () => {
    try {
      const store = realStore();
      const telemetry = makeCloseoutTelemetry({
        store,
        workItemRef: WORK_ITEM_REF,
        capture: makeTelemetryCapture({ workItemRef: WORK_ITEM_REF, runId: TELEMETRY_RUN_ID }),
      });
      expect((await apply(makeState(), telemetry)).ok).toBe(true);
      const read = readHarnessTelemetry(store, WORK_ITEM_REF);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const bySession = new Map(read.value.records.map((record) => [record.sessionId, record]));
      expect(bySession.get("ses_root")?.tokens.input).toBe(10);
      expect(bySession.get("ses_child_a")?.tokens.input).toBe(6);
      const sum = read.value.records.reduce(
        (total, record) => total + (record.tokens.input ?? 0),
        0,
      );
      expect(sum).toBe(20);
      expect(read.value.records.every((record) => record.runId === TELEMETRY_RUN_ID)).toBe(true);
    } finally {
      afterEachCleanup();
    }
  });
});
