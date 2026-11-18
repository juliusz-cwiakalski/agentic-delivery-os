/**
 * TC-HARNESS-020 — pre-change rows stay readable and unchanged, and the added
 * fields are additive only: the schema identity is untouched, no field is
 * removed, and the state-layer projection round-trips the new fields intact
 * (AC-F5-2, T-08/T-09).
 */
import { describe, expect, test } from "bun:test";
import { appendDispatchAttempt } from "../../packages/core/src/app/dispatch-ledger";
import {
  HARNESS_OBSERVED_ABSENCE_PLACEHOLDER,
  HARNESS_TELEMETRY_SCHEMA_ID,
  type HarnessTelemetryRecord,
} from "../../packages/core/src/contracts/index";
import {
  appendHarnessTelemetry,
  readHarnessTelemetry,
} from "../../packages/core/src/state/harness-telemetry";
import { createDispatchState } from "../fixtures/dispatch/harness";

const PRE_CHANGE: HarnessTelemetryRecord = {
  schemaId: HARNESS_TELEMETRY_SCHEMA_ID,
  workItemRef: "GH-335",
  runId: "run-pre-change",
  sessionId: "ses_pre",
  harnessKind: "opencode",
  harnessVersion: "1.0.0",
  agent: "agent-a",
  model: "zai/glm-5",
  treeRoot: "ses_pre",
  parentChain: [],
  tokens: { input: 1, output: 1, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
  calls: 1,
  toolCounts: [],
  cost: 0.01,
  capturedAt: "2026-11-17T00:00:00.000Z",
  warnings: [],
};

describe("TC-HARNESS-020 additive compatibility", () => {
  test("a pre-change row reads unchanged with the new fields absent", () => {
    const state = createDispatchState("gh335-compat");
    const appended = appendHarnessTelemetry(state.store, state.fenceToken, PRE_CHANGE);
    expect(appended.ok).toBe(true);
    const read = readHarnessTelemetry(state.store, "GH-335");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const row = read.value.records[0];
    expect(row).toEqual(PRE_CHANGE);
    expect(row?.seat).toBeUndefined();
    expect(row?.resolvedModel).toBeUndefined();
    expect(row?.durations).toBeUndefined();
    expect(row?.absentObservedAxes).toBeUndefined();
  });

  test("a placeholder-bearing row round-trips with its marker and warning intact", () => {
    const state = createDispatchState("gh335-compat-placeholder");
    const placeholderRow: HarnessTelemetryRecord = {
      ...PRE_CHANGE,
      sessionId: "ses_placeholder",
      treeRoot: "ses_placeholder",
      agent: HARNESS_OBSERVED_ABSENCE_PLACEHOLDER,
      model: "zai/glm-5",
      seat: null,
      resolvedModel: null,
      durations: {
        status: "sourced",
        start: "2026-11-18T00:00:00.000Z",
        end: "2026-11-18T00:00:02.000Z",
        elapsedMs: 2000,
      },
      absentObservedAxes: ["agent"],
      warnings: [
        { reason: "optional-field-absent", field: "agent" },
        { reason: "unresolved-seat", field: "seat" },
      ],
    };
    const appended = appendHarnessTelemetry(state.store, state.fenceToken, placeholderRow);
    expect(appended.ok).toBe(true);
    const read = readHarnessTelemetry(state.store, "GH-335");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const row = read.value.records[0];
    expect(row?.agent).toBe(HARNESS_OBSERVED_ABSENCE_PLACEHOLDER);
    expect(row?.absentObservedAxes).toEqual(["agent"]);
    expect(row?.seat).toBeNull();
    expect(row?.durations).toEqual(placeholderRow.durations);
    expect(row?.warnings).toEqual(placeholderRow.warnings);
  });
});
