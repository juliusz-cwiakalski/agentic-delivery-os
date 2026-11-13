/**
 * TC-TELEMETRY-006..008 — the five attribution dimensions on every stored step,
 * the no-misattribution rule for unattributable steps, the substrate join over
 * the delivered economics and command-audit identity, and the production
 * composition that carries a claimed identity and the audit-correlated run id
 * into the stored record (AC-F2-1).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createProductionTelemetrySink } from "../../packages/cli/src/production";
import {
  RESULT_SCHEMA_VERSION,
  TELEMETRY_UNATTRIBUTED_DIMENSION_RULE,
} from "../../packages/core/src/contracts/index";
import { joinAttributionSubstrates } from "../../packages/core/src/domain/telemetry-attribution";
import { decodeTelemetryStepFrame } from "../../packages/core/src/domain/telemetry-ingest";
import {
  appendAuditInvocation,
  readAuditLedger,
  readTelemetryCaptureOutcomes,
  readTelemetrySteps,
} from "../../packages/core/src/state/index";
import { completeTokenFrame } from "../fixtures/harness/scenarios/stream";
import {
  AGENT_ROLE,
  claimedIdentity,
  frameContext,
  LANE,
  MODEL_A,
  MODEL_B,
  makeRestartRecord,
  makeStepRecord,
  makeTelemetryStore,
  REPOSITORY,
  RUN_A,
  reasonCount,
  recordingSubstrates,
  removeRoot,
  SESSION_A,
  SESSION_B,
  seedRestarts,
  T1,
  TELEMETRY_NOW_ISO,
  TELEMETRY_NOW_MS,
  TELEMETRY_REF,
  type TelemetryStoreFixture,
  tallyLines,
} from "../fixtures/telemetry";

const roots: string[] = [];

const store = (label: string): TelemetryStoreFixture => {
  const fixture = makeTelemetryStore(`attribution-${label}`);
  roots.push(fixture.root);
  return fixture;
};

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const decode = (line: string, override: Parameters<typeof frameContext>[0] = {}) =>
  decodeTelemetryStepFrame(JSON.parse(line), frameContext(override));

describe("TC-TELEMETRY-006 the five attribution fields plus step timing", () => {
  test("each stored record carries ticket, repository, lane, agentRole, model, and timing", async () => {
    const fixture = store("fields");
    const first = decode(completeTokenFrame("ses_a"), {
      sessionId: SESSION_A,
      runId: RUN_A,
      model: MODEL_A,
      claimed: claimedIdentity({ lane: LANE, agentRole: AGENT_ROLE }),
    });
    expect(first.kind).toBe("captured");
    if (first.kind !== "captured") return;
    expect(first.record.ticket).toBe(TELEMETRY_REF);
    expect(first.record.repository).toBe(REPOSITORY);
    expect(first.record.lane).toBe(LANE);
    expect(first.record.agentRole).toBe(AGENT_ROLE);
    expect(first.record.model).toBe(MODEL_A);
    expect(first.record.finishedAt).not.toBeNull();
    expect(first.record.warnings).toEqual([]);
    // A second lane/role/model in the same delivery keeps its own identity.
    const second = decode(completeTokenFrame("ses_b"), {
      sessionId: SESSION_B,
      runId: RUN_A,
      model: MODEL_B,
      claimed: claimedIdentity({ lane: "lane-beta", agentRole: "planner" }),
    });
    expect(second.kind).toBe("captured");
    if (second.kind !== "captured") return;
    expect(second.record.lane).toBe("lane-beta");
    expect(second.record.agentRole).toBe("planner");
    expect(second.record.model).toBe(MODEL_B);
    expect(fixture.store).toBeDefined();
  });

  test("a record with a missing dimension is not silently complete", () => {
    const decoded = decode(completeTokenFrame("ses_missing"), {
      claimed: claimedIdentity({ lane: null }),
    });
    expect(decoded.kind).toBe("captured");
    if (decoded.kind !== "captured") return;
    expect(decoded.record.lane).toBeNull();
    expect(decoded.record.warnings.some((warning) => warning.field === "lane")).toBe(true);
  });
});

describe("TC-TELEMETRY-007 unattributable steps are classified degradation", () => {
  test("an absent lane and role are null with unattributable-step warnings", () => {
    const decoded = decode(completeTokenFrame("ses_unattributed"), {
      claimed: claimedIdentity({ lane: null, agentRole: null }),
      model: null,
    });
    expect(decoded.kind).toBe("captured");
    if (decoded.kind !== "captured") return;
    expect(decoded.record.lane).toBeNull();
    expect(decoded.record.agentRole).toBeNull();
    expect(decoded.record.model).toBeNull();
    const fields = decoded.record.warnings
      .filter((warning) => warning.reason === "unattributable-step")
      .map((warning) => warning.field)
      .sort();
    expect(fields).toEqual(["agentRole", "lane", "model"]);
    // Never a guessed default: no dimension carries a fabricated value.
    expect(decoded.record.lane).not.toBe("unknown");
    expect(decoded.record.agentRole).not.toBe("unknown");
  });

  test("the declared rule is exclude-and-disclose, applied the same way on every dimension", () => {
    expect(TELEMETRY_UNATTRIBUTED_DIMENSION_RULE).toBe("exclude-and-disclose");
    const tally = tallyLines(
      [completeTokenFrame("ses_unattributed")],
      frameContext({
        claimed: claimedIdentity({ lane: null, agentRole: null }),
      }),
    );
    expect(reasonCount(tally, "unattributable-step")).toBeGreaterThanOrEqual(2);
    expect(tally.counts.degraded).toBe(1);
  });

  test("a paired fully-attributed control carries no unattributable warning", () => {
    const decoded = decode(completeTokenFrame("ses_control"));
    expect(decoded.kind).toBe("captured");
    if (decoded.kind !== "captured") return;
    expect(
      decoded.record.warnings.some((warning) => warning.reason === "unattributable-step"),
    ).toBe(false);
  });
});

describe("TC-TELEMETRY-008 attribution joins the delivered substrates", () => {
  test("the join reads exactly the economics session and the audit identity", () => {
    const recording = recordingSubstrates();
    const attribution = joinAttributionSubstrates(
      {
        workItemRef: TELEMETRY_REF,
        runId: RUN_A,
        sessionId: SESSION_A,
        repository: REPOSITORY,
        model: MODEL_A,
      },
      recording.substrates,
    );
    expect(recording.calls).toEqual([`session:${SESSION_A}`, `claimed:${RUN_A}`]);
    expect(attribution.lane).toBe(LANE);
    expect(attribution.agentRole).toBe(AGENT_ROLE);
    expect(attribution.ticket).toBe(TELEMETRY_REF);
    expect(attribution.repository).toBe(REPOSITORY);
    expect(attribution.model).toBe(MODEL_A);
    expect(attribution.warnings).toEqual([]);
  });

  test("a session identity from economics is preferred over the caller's run id", () => {
    const recording = recordingSubstrates({
      session: { sessionId: SESSION_A, runId: "run-from-economics" },
    });
    const attribution = joinAttributionSubstrates(
      {
        workItemRef: TELEMETRY_REF,
        runId: RUN_A,
        sessionId: SESSION_A,
        repository: REPOSITORY,
        model: MODEL_A,
      },
      recording.substrates,
    );
    expect(recording.calls[0]).toBe(`session:${SESSION_A}`);
    expect(recording.calls[1]).toBe("claimed:run-from-economics");
    expect(attribution.lane).toBe(LANE);
  });

  test("two sessions in one delivery attribute to their own identities", () => {
    const recording = recordingSubstrates({ claimed: claimedIdentity({ lane: "lane-beta" }) });
    const attribution = joinAttributionSubstrates(
      {
        workItemRef: TELEMETRY_REF,
        runId: RUN_A,
        sessionId: SESSION_B,
        repository: REPOSITORY,
        model: MODEL_B,
      },
      recording.substrates,
    );
    expect(attribution.lane).toBe("lane-beta");
    expect(attribution.model).toBe(MODEL_B);
  });

  test("the stored record keeps the step timing from the frame", () => {
    const decoded = decode(completeTokenFrame("ses_timing"));
    expect(decoded.kind).toBe("captured");
    if (decoded.kind !== "captured") return;
    expect(decoded.record.finishedAt).toBe(new Date(3).toISOString());
    expect(decoded.record.startedAt).toBeNull();
    expect(makeStepRecord({ finishedAt: T1 }).finishedAt).toBe(T1);
  });
});

describe("TC-TELEMETRY-008 the production composition joins the delivered substrates", () => {
  test("the audit-ledger claim and the audit-correlated run id reach the stored step record", () => {
    const fixture = store("production-compose");
    const audited = appendAuditInvocation(fixture.store, {
      runId: RUN_A,
      command: "spend",
      arguments: ["spend", "--ref", TELEMETRY_REF],
      exitCode: 0,
      timing: { totalMs: 1 },
      resultSchemaVersion: RESULT_SCHEMA_VERSION,
      outcomeClass: "success",
      scope: "workspace-a",
      startedAt: TELEMETRY_NOW_MS,
      agentIdentity: { kind: "claimed", value: "coder-ledger" },
    });
    if (!audited.ok) throw new Error(audited.error.code);
    seedRestarts(fixture.store, [
      makeRestartRecord({ ordinal: 1, sessionId: SESSION_A, runId: RUN_A }),
    ]);

    const sink = createProductionTelemetrySink({
      store: fixture.store,
      workItemRef: TELEMETRY_REF,
      runId: RUN_A,
      environment: {},
      environmentPrefix: "TEST_",
      treeRoot: REPOSITORY,
      repository: REPOSITORY,
      harnessVersion: "2.2.5",
      nowIso: () => TELEMETRY_NOW_ISO,
      newFenceToken: () => "production-compose-fence",
    });
    const frame: unknown = JSON.parse(completeTokenFrame(SESSION_A));
    sink.onFrame(frame, { sessionId: SESSION_A });

    const steps = readTelemetrySteps(fixture.store, TELEMETRY_REF);
    if (!steps.ok) throw new Error(steps.error.code);
    expect(steps.value.records).toHaveLength(1);
    const record = steps.value.records[0];
    // The claimed role is the audit ledger's recorded claim for this run —
    // not an invented default and not another run's value.
    expect(record?.agentRole).toBe("coder-ledger");
    // The stored run id is the invocation's audit run id, and it joins the
    // command-audit ledger by exactly that value.
    expect(record?.runId).toBe(RUN_A);
    const ledger = readAuditLedger(fixture.store, { limit: 8 });
    if (!ledger.ok) throw new Error(ledger.error.code);
    expect(ledger.value.records.some((entry) => entry.runId === record?.runId)).toBe(true);
    // The lane dimension stays unattributed and disclosed, never guessed.
    expect(record?.lane).toBeNull();
    expect(
      record?.warnings.some(
        (warning) => warning.reason === "unattributable-step" && warning.field === "lane",
      ),
    ).toBe(true);
    expect(sink.accounting().counts.captured).toBe(1);

    // Session close lands the durable ingest-accounting record (§10).
    sink.onSessionClose(SESSION_A);
    const captures = readTelemetryCaptureOutcomes(fixture.store, TELEMETRY_REF);
    if (!captures.ok) throw new Error(captures.error.code);
    expect(captures.value.records).toHaveLength(1);
    const capture = captures.value.records[0];
    expect(capture?.runId).toBe(RUN_A);
    expect(capture?.sessionId).toBe(SESSION_A);
    expect(capture?.counts.captured).toBe(1);
    expect(capture?.counts.failed).toBe(0);
    expect(capture?.byReason["unattributable-step"]).toBe(2);
  });

  test("without a ledger record, the invoking process's own claimed identity answers", () => {
    const fixture = store("production-compose-env");
    seedRestarts(fixture.store, [
      makeRestartRecord({ ordinal: 1, sessionId: SESSION_A, runId: RUN_A }),
    ]);
    const sink = createProductionTelemetrySink({
      store: fixture.store,
      workItemRef: TELEMETRY_REF,
      runId: RUN_A,
      environment: { TEST_AGENT_IDENTITY: "coder-invocation" },
      environmentPrefix: "TEST_",
      treeRoot: REPOSITORY,
      repository: REPOSITORY,
      nowIso: () => TELEMETRY_NOW_ISO,
      newFenceToken: () => "production-compose-fence",
    });
    sink.onFrame(JSON.parse(completeTokenFrame(SESSION_A)), { sessionId: SESSION_A });
    const steps = readTelemetrySteps(fixture.store, TELEMETRY_REF);
    if (!steps.ok) throw new Error(steps.error.code);
    expect(steps.value.records[0]?.agentRole).toBe("coder-invocation");
    expect(steps.value.records[0]?.runId).toBe(RUN_A);
  });
});
