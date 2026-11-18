/**
 * TC-HARNESS-019 / TC-HARNESS-020 / TC-HARNESS-026 — the landed row shape from
 * the observed current generation (DM-9, DM-10; AC-F5-1, AC-F5-2).
 *
 * Every field the ticket asks for is asserted on a LANDED row: the schema
 * identity, the session's own version, the recorded seat and resolved model,
 * the observed agent and model, the five token classes, calls, cost, and the
 * store-sourced duration pair. Nothing is read from a column that does not
 * exist.
 */
import { describe, expect, test } from "bun:test";
import {
  HARNESS_TELEMETRY_SCHEMA_ID,
  HARNESS_UNRESOLVED_SEAT_REASON,
} from "../../packages/core/src/contracts/index";
import {
  CAPTURED_AT,
  CHILD_BINDING,
  ROOT_BINDING,
  RUN_ID,
  WORK_ITEM_REF,
  extractOpencode,
} from "../fixtures/harness/telemetry-attempts";
import {
  CHILD_MODEL_ID,
  CHILD_SESSION,
  FULL_FIXTURE_TOTALS,
  HARNESS_VERSION,
  ROOT_AGENT,
  ROOT_MODEL_ID,
  ROOT_SESSION,
  buildOpencodeStore,
} from "../fixtures/harness/opencode-store/build";

describe("TC-HARNESS-019 the current-generation row", () => {
  test("a complete session lands one row per observed group with every field", () => {
    const store = buildOpencodeStore();
    const captured = extractOpencode({
      store,
      heldSessionIds: [ROOT_SESSION],
      bindings: { [ROOT_SESSION]: ROOT_BINDING },
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    // The held identity's tree is root + one child; each is its own row.
    expect(captured.value.records).toHaveLength(2);
    const row = captured.value.records.find((entry) => entry.sessionId === ROOT_SESSION);
    expect(row?.schemaId).toBe(HARNESS_TELEMETRY_SCHEMA_ID);
    expect(row?.workItemRef).toBe(WORK_ITEM_REF);
    expect(row?.runId).toBe(RUN_ID);
    expect(row?.sessionId).toBe(ROOT_SESSION);
    expect(row?.harnessKind).toBe("opencode");
    expect(row?.harnessVersion).toBe(HARNESS_VERSION);
    expect(row?.agent).toBe(ROOT_AGENT);
    expect(row?.model).toBe(ROOT_MODEL_ID);
    expect(row?.seat).toBe(ROOT_BINDING.seat);
    expect(row?.resolvedModel).toBe(ROOT_MODEL_ID);
    expect(row?.treeRoot).toBe(ROOT_SESSION);
    expect(row?.parentChain).toEqual([]);
    expect(row?.tokens.input).toBe(15);
    expect(row?.tokens.output).toBe(8);
    expect(row?.tokens.reasoning).toBe(2);
    expect(row?.tokens.cacheRead).toBe(3);
    expect(row?.tokens.cacheWrite).toBe(1);
    expect(row?.calls).toBe(2);
    expect(row?.cost).toBe(0.75);
    expect(row?.capturedAt).toBe(CAPTURED_AT);
    expect(row?.durations).toEqual({
      status: "sourced",
      start: new Date(1_700_000_000_000).toISOString(),
      end: new Date(1_700_000_002_000).toISOString(),
      elapsedMs: 2000,
    });
    // No observed generation exposes a populated tool source.
    expect(row?.toolCounts).toEqual([]);
    expect(row?.warnings.some((warning) => warning.reason === "no-tool-source")).toBe(true);
    expect(row?.absentObservedAxes).toBeUndefined();
  });

  test("the held identity's tree is read below it, with the child's own group", () => {
    const store = buildOpencodeStore();
    const captured = extractOpencode({
      store,
      heldSessionIds: [ROOT_SESSION],
      bindings: {
        [ROOT_SESSION]: {
          ...ROOT_BINDING,
          agent: "agent-b",
          seat: "seat-execution",
          resolvedModel: CHILD_MODEL_ID,
        },
      },
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const child = captured.value.records.find((row) => row.sessionId === CHILD_SESSION);
    expect(child).toBeDefined();
    expect(child?.parentChain).toEqual([ROOT_SESSION]);
    expect(child?.treeRoot).toBe(ROOT_SESSION);
    expect(child?.agent).toBe("agent-b");
    expect(child?.model).toBe(CHILD_MODEL_ID);
    // The single binding's agent matches only the child's group.
    expect(child?.seat).toBe("seat-execution");
    const root = captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
    expect(root?.seat).toBeNull();
    expect(
      root?.warnings.some((warning) => warning.reason === HARNESS_UNRESOLVED_SEAT_REASON),
    ).toBe(true);
    const input = captured.value.records.reduce((total, row) => total + (row.tokens.input ?? 0), 0);
    expect(input).toBe(FULL_FIXTURE_TOTALS.input);
  });

  test("the session totals equal the baseline once and the reported zero is kept", () => {
    const store = buildOpencodeStore({ variant: "reported-zero-cost" });
    const captured = extractOpencode({
      store,
      heldSessionIds: [ROOT_SESSION],
      bindings: { [ROOT_SESSION]: CHILD_BINDING },
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const root = captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
    // A reported zero is the reported value, never an absence.
    expect(root?.cost).toBe(0);
    expect(root?.warnings.some((warning) => warning.reason === "cost-missing")).toBe(false);
  });
});

/**
 * GH-335 review remediation F-6 / F-7 / F-8 — the observed transitions, the
 * normalized version stamp, and the duration range guard.
 */
describe("F-6/F-7/F-8 review remediation", () => {
  test("agent-switched/model-switched rows scope the following usage group", () => {
    const store = buildOpencodeStore({ variant: "switched" });
    const captured = extractOpencode({ store, heldSessionIds: [ROOT_SESSION] });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const rows = captured.value.records.filter((row) => row.sessionId === ROOT_SESSION);
    // The baseline group (agent-a) and the switched group (agent-c/model-c).
    expect(rows.some((row) => row.agent === ROOT_AGENT)).toBe(true);
    const switched = rows.find((row) => row.agent === "agent-c");
    expect(switched).toBeDefined();
    expect(switched?.model).toBe("synthetic/model-c");
    expect(switched?.tokens.input).toBe(2);
    expect(switched?.absentObservedAxes).toBeUndefined();
    // The stale session baseline never wins over the transition.
    expect(rows.every((row) => row.agent !== "")).toBe(true);
  });

  test("a stored version is normalized before stamping (v-prefix stripped)", () => {
    const store = buildOpencodeStore({ variant: "version-prefixed" });
    const captured = extractOpencode({ store, heldSessionIds: [ROOT_SESSION] });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const root = captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
    expect(root?.harnessVersion).toBe("2.2.5");
  });

  test("an unrepresentable timestamp pair is an absence and the rows still land", () => {
    const store = buildOpencodeStore({ variant: "absurd-timestamps" });
    const captured = extractOpencode({ store, heldSessionIds: [ROOT_SESSION] });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const root = captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
    expect(root).toBeDefined();
    expect(root?.durations).toEqual({ status: "absent", reason: "duration-absent" });
    expect(root?.warnings.some((warning) => warning.reason === "duration-absent")).toBe(true);
    // The whole capture is not failed by one bad pair.
    expect(captured.value.records.length).toBeGreaterThan(0);
  });
});
