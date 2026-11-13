/**
 * TC-TELEMETRY-006..008 — the five attribution dimensions on every stored step,
 * the no-misattribution rule for unattributable steps, and the substrate join
 * over the delivered economics and command-audit identity.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { TELEMETRY_UNATTRIBUTED_DIMENSION_RULE } from "../../packages/core/src/contracts/index";
import { joinAttributionSubstrates } from "../../packages/core/src/domain/telemetry-attribution";
import { decodeTelemetryStepFrame } from "../../packages/core/src/domain/telemetry-ingest";
import { completeTokenFrame } from "../fixtures/harness/scenarios/stream";
import {
  AGENT_ROLE,
  claimedIdentity,
  frameContext,
  LANE,
  MODEL_A,
  MODEL_B,
  makeStepRecord,
  makeTelemetryStore,
  REPOSITORY,
  RUN_A,
  reasonCount,
  recordingSubstrates,
  removeRoot,
  SESSION_A,
  SESSION_B,
  T1,
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
