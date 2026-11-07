/**
 * The closeout telemetry runtime fixture (test-plan §4.7).
 *
 * A fully injected capture capability over a real temp state store; every
 * state call is recorded so the fence/verify order is observable. The records
 * are deterministic metadata only.
 */
import {
  HARNESS_TELEMETRY_SCHEMA_ID,
  type HarnessResult,
  type HarnessTelemetryCapture,
  type HarnessTelemetryRecord,
  type StateStorePort,
} from "../../../packages/core/src/contracts/index";
import type { CloseoutTelemetryRuntime } from "../../../packages/core/src/domain/closeout";
import {
  appendHarnessCaptureOutcome,
  appendHarnessTelemetry,
  readHarnessTelemetry,
} from "../../../packages/core/src/state/index";

export const TELEMETRY_NOW = "2026-11-06T00:00:00Z";
export const TELEMETRY_RUN_ID = "run-telemetry-1";

export const makeTelemetryRecord = (input: {
  readonly workItemRef: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly treeRoot?: string;
  readonly parentChain?: readonly string[];
  readonly agent?: string;
  readonly model?: string;
  readonly input?: number | null;
}): HarnessTelemetryRecord => ({
  schemaId: HARNESS_TELEMETRY_SCHEMA_ID,
  workItemRef: input.workItemRef,
  runId: input.runId,
  sessionId: input.sessionId,
  harnessKind: "opencode",
  harnessVersion: "1.0.0",
  agent: input.agent ?? "agent-a",
  model: input.model ?? "model-a",
  treeRoot: input.treeRoot ?? input.sessionId,
  parentChain: [...(input.parentChain ?? [])],
  tokens: {
    input: input.input === undefined ? 10 : input.input,
    output: 5,
    reasoning: 1,
    cacheRead: 2,
    cacheWrite: 1,
  },
  calls: 2,
  toolCounts: [{ tool: "edit", calls: 2 }],
  cost: 0.5,
  capturedAt: TELEMETRY_NOW,
  warnings: [],
});

export const makeTelemetryCapture = (input: {
  readonly workItemRef: string;
  readonly runId: string;
  readonly records?: readonly HarnessTelemetryRecord[];
}): HarnessTelemetryCapture => {
  const records = input.records ?? [
    makeTelemetryRecord({
      workItemRef: input.workItemRef,
      runId: input.runId,
      sessionId: "ses_root",
    }),
    makeTelemetryRecord({
      workItemRef: input.workItemRef,
      runId: input.runId,
      sessionId: "ses_child_a",
      treeRoot: "ses_root",
      parentChain: ["ses_root"],
      agent: "agent-b",
      model: "model-b",
      input: 6,
    }),
    makeTelemetryRecord({
      workItemRef: input.workItemRef,
      runId: input.runId,
      sessionId: "ses_child_b",
      treeRoot: "ses_root",
      parentChain: ["ses_root"],
      agent: "agent-a",
      model: "model-b",
      input: 4,
    }),
  ];
  return {
    workItemRef: input.workItemRef,
    runId: input.runId,
    capturedAt: TELEMETRY_NOW,
    records,
    agents: [
      { agent: "agent-a", calls: 4 },
      { agent: "agent-b", calls: 2 },
    ],
    models: [
      { model: "model-a", calls: 2 },
      { model: "model-b", calls: 4 },
    ],
    failedSessions: [],
    warnings: [],
  };
};

/**
 * A capture where one session spans two (agent, model) groups (F-3).
 *
 * Both group records share `ses_root`; the append identity must include the
 * group so the second record is not skipped as a duplicate.
 */
export const makeTwoGroupCapture = (input: {
  readonly workItemRef: string;
  readonly runId: string;
}): HarnessTelemetryCapture =>
  makeTelemetryCapture({
    workItemRef: input.workItemRef,
    runId: input.runId,
    records: [
      makeTelemetryRecord({
        workItemRef: input.workItemRef,
        runId: input.runId,
        sessionId: "ses_root",
        agent: "agent-a",
        model: "model-a",
        input: 10,
      }),
      makeTelemetryRecord({
        workItemRef: input.workItemRef,
        runId: input.runId,
        sessionId: "ses_root",
        agent: "agent-b",
        model: "model-b",
        input: 3,
      }),
      makeTelemetryRecord({
        workItemRef: input.workItemRef,
        runId: input.runId,
        sessionId: "ses_child_a",
        treeRoot: "ses_root",
        parentChain: ["ses_root"],
        agent: "agent-a",
        model: "model-b",
        input: 6,
      }),
    ],
  });

export type TelemetryFixtureOptions = {
  readonly store: StateStorePort;
  readonly workItemRef: string;
  readonly capture: HarnessTelemetryCapture;
  readonly failAppend?: boolean;
  readonly throwCapture?: boolean;
  readonly captureResult?: HarnessResult<HarnessTelemetryCapture>;
};

export type CloseoutTelemetryFixture = {
  readonly runtime: CloseoutTelemetryRuntime;
  readonly log: string[];
  readonly captureCalls: () => number;
};

const recordingStore = (store: StateStorePort, log: string[]): StateStorePort => ({
  ...store,
  acquireFence: (token) => {
    log.push(`acquireFence:${token}`);
    return store.acquireFence(token);
  },
  append: (handle, request) => {
    log.push(`append:${request.kind}:${request.recordKey}`);
    return store.append(handle, request);
  },
  releaseFence: (handle) => {
    log.push(`releaseFence:${handle.token}`);
    return store.releaseFence(handle);
  },
  readRecords: () => {
    log.push("readRecords");
    return store.readRecords();
  },
});

/** Build the closeout telemetry capability over a recording state store. */
export const makeCloseoutTelemetry = (
  options: TelemetryFixtureOptions,
): CloseoutTelemetryFixture => {
  const log: string[] = [];
  const store = recordingStore(options.store, log);
  let calls = 0;
  const runtime: CloseoutTelemetryRuntime = {
    extract: async (input) => {
      calls += 1;
      if (options.throwCapture === true) throw new Error("synthetic extraction failure");
      if (options.captureResult !== undefined) return options.captureResult;
      return {
        ok: true,
        value: makeTelemetryCapture({
          workItemRef: input.workItemRef,
          runId: input.runId,
          records: options.capture.records,
        }),
      };
    },
    append: (capture) => {
      if (options.failAppend === true) {
        return {
          ok: false,
          error: {
            kind: "state",
            code: "state.write.failed",
            consequence: "not_landed",
            location: { path: "synthetic-state" },
          },
        };
      }
      let appended = 0;
      let skipped = 0;
      for (const [index, record] of capture.records.entries()) {
        const result = appendHarnessTelemetry(store, `telemetry-${index}`, record);
        if (!result.ok) return result;
        appended += result.value.report.appended;
        skipped += result.value.report.skipped;
      }
      const outcome = appendHarnessCaptureOutcome(store, "telemetry-capture", {
        schemaId: "delivery.harness.telemetry.capture.v1",
        workItemRef: capture.workItemRef,
        runId: capture.runId,
        captured: capture.records.length,
        degraded: capture.records.filter((record) => record.warnings.length > 0).length,
        failed: capture.failedSessions.length,
        warnings: capture.warnings,
        capturedAt: TELEMETRY_NOW,
      });
      if (!outcome.ok) return outcome;
      return { ok: true, value: { appended, skipped } };
    },
  };
  return { runtime, log, captureCalls: () => calls };
};

export { readHarnessTelemetry };
