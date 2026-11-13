/**
 * TC-PAUSE-050..052 — the window-scoped zero-spend assertion (GH-294 F-6,
 * AC-F6-5, DM-5, DEC-4, NFR-4; SC-M2-S17-04).
 *
 * Zero is a falsifiable positive reading over present telemetry, scoped from
 * the park timestamp through the window end with both boundary instants
 * included; telemetry absence is a classified outcome and is never reported
 * as zero — the two renderings are mutually exclusive and are asserted in
 * both directions within the same run. The reading is a pure pass over the
 * telemetry v2 storage records: it performs no harness-store query of its own.
 */
import { describe, expect, test } from "bun:test";
import { createSpendCommandDefinition } from "../../packages/cli/src/commands/spend";
import type { TelemetryStepRecord } from "../../packages/core/src/contracts/index";
import { SPEND_WINDOW_BASIS } from "../../packages/core/src/contracts/spend";
import { windowSpendEvidence } from "../../packages/core/src/domain/spend";

const PARK = "2026-11-13T16:55:00.000Z";
const WINDOW_END = "2026-11-13T18:05:00.000Z";

let ordinal = 0;
const step = (input: {
  readonly instant: string;
  readonly lane?: string;
  readonly calls?: number | null;
}): TelemetryStepRecord => {
  ordinal += 1;
  return {
    schemaId: "delivery.telemetry.step.v1",
    storageVersion: "v2",
    workItemRef: "GH-294",
    runId: `run-${ordinal}`,
    sessionId: `session-${ordinal}`,
    harnessKind: "opencode",
    harnessVersion: "1.0.0",
    treeRoot: null,
    model: "model-a",
    ticket: "GH-294",
    repository: "github.com/example/repo",
    lane: input.lane ?? "GH-900",
    agentRole: "coder",
    tokens: { input: 10, output: 10, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
    calls: input.calls ?? 1,
    cost: null,
    startedAt: input.instant,
    finishedAt: input.instant,
    warnings: [],
    capturedAt: input.instant,
  };
};

describe("TC-PAUSE-050 the present-zero reading is positive and named", () => {
  test("present telemetry with zero attributable calls reads zero with the named basis", () => {
    // Telemetry is present for the window (another lane's call), but nothing
    // is attributable to the parked lane: a positive zero.
    const evidence = windowSpendEvidence({
      steps: [step({ instant: "2026-11-13T17:00:00.000Z", lane: "GH-901", calls: 3 })],
      ref: "GH-900",
      providerProfile: "profile-a",
      from: PARK,
      through: WINDOW_END,
    });
    expect(evidence.telemetryState).toBe("present");
    expect(evidence.billableCalls).toBe(0);
    expect(evidence.basis).toBe(SPEND_WINDOW_BASIS);
    expect(evidence.basis).toBe("delivery.telemetry.storage.v1");
    expect(evidence.matchedPositions).toEqual([]);
  });

  test("the present-zero control and the absence reading are mutually exclusive in the same run", () => {
    const present = windowSpendEvidence({
      steps: [step({ instant: "2026-11-13T17:00:00.000Z", calls: 0 })],
      ref: "GH-900",
      providerProfile: "profile-a",
      from: PARK,
      through: WINDOW_END,
    });
    const absent = windowSpendEvidence({
      steps: [],
      ref: "GH-900",
      providerProfile: "profile-a",
      from: PARK,
      through: WINDOW_END,
    });
    // Present zero: the count exists and is a number.
    expect(present.telemetryState).toBe("present");
    expect(typeof present.billableCalls).toBe("number");
    // Classified absence: the count is absent with the state — never a zero.
    expect(absent.telemetryState).toBe("absent");
    expect(absent.billableCalls).toBeUndefined();
    expect(absent.basis).toBeUndefined();
    // The states are mutually exclusive renderings.
    expect(present.telemetryState).not.toBe(absent.telemetryState);
  });

  test("the CLI surfaces the evidence with the zero state and the named basis", async () => {
    let requested:
      | { readonly ref: string; readonly from: string; readonly through: string }
      | undefined;
    const definition = createSpendCommandDefinition({
      resolveActiveRef: () => ({ ref: "GH-294" }),
      report: () => {
        throw new Error("the evidence form must not fold the six-key report");
      },
      windowEvidence: (request) => {
        requested = request;
        return {
          ok: true,
          data: windowSpendEvidence({
            steps: [step({ instant: "2026-11-13T17:00:00.000Z", lane: "GH-901", calls: 3 })],
            ref: request.ref,
            providerProfile: "profile-a",
            from: request.from,
            through: request.through,
          }),
        };
      },
    });
    const outcome = await definition.handler({
      argv: [
        "spend",
        "--window-evidence",
        "--ref",
        "GH-900",
        "--from",
        PARK,
        "--through",
        WINDOW_END,
      ],
      flags: {},
      positionals: [],
    } as never);
    const data = (outcome as { readonly data?: Record<string, unknown> }).data;
    expect(requested).toEqual({ ref: "GH-900", from: PARK, through: WINDOW_END });
    expect(data?.telemetryState).toBe("present");
    expect(data?.billableCalls).toBe(0);
    expect(data?.basis).toBe("delivery.telemetry.storage.v1");
    // The human render states the reading without inventing a stronger claim.
    const human = definition.humanText?.(data, {
      binaryName: "delivery-os",
    } as never);
    expect(human).toContain("telemetry=present");
    expect(human).toContain("billableCalls=0");
    expect(human).toContain("delivery.telemetry.storage.v1");
  });
});

describe("TC-PAUSE-051 telemetry absence is classified, never zero", () => {
  test("an empty storage read is the classified absence and the CLI renders it as such", async () => {
    const evidence = windowSpendEvidence({
      steps: [],
      ref: "GH-900",
      providerProfile: "profile-a",
      from: PARK,
      through: WINDOW_END,
    });
    expect(evidence.telemetryState).toBe("absent");
    expect("billableCalls" in evidence).toBe(false);
    const definition = createSpendCommandDefinition({
      resolveActiveRef: () => ({ ref: "GH-294" }),
      report: () => ({ ok: true, data: {} as never }),
      windowEvidence: () => ({ ok: true, data: evidence }),
    });
    const outcome = await definition.handler({
      argv: [
        "spend",
        "--window-evidence",
        "--ref",
        "GH-900",
        "--from",
        PARK,
        "--through",
        WINDOW_END,
      ],
      flags: {},
      positionals: [],
    } as never);
    const data = (outcome as { readonly data?: Record<string, unknown> }).data;
    const human = definition.humanText?.(data, { binaryName: "delivery-os" } as never);
    // The human render never fabricates a zero from the absence.
    expect(human).toContain("telemetry=absent");
    expect(human).toContain("never reported as zero");
    expect(human).not.toContain("billableCalls=0");
  });
});

describe("TC-PAUSE-052 boundary scoping excludes only strictly pre-park calls; the zero is falsifiable", () => {
  test("the park instant and the window end both count; pre-park and post-window are disclosed", () => {
    const evidence = windowSpendEvidence({
      steps: [
        step({ instant: "2026-11-13T16:54:59.000Z", calls: 5 }), // strictly pre-park: excluded
        step({ instant: PARK, calls: 1 }), // the park instant itself: included
        step({ instant: "2026-11-13T17:00:00.000Z", calls: 1 }), // mid-window: included
        step({ instant: WINDOW_END, calls: 1 }), // the window end itself: included
        step({ instant: "2026-11-13T18:05:01.000Z", calls: 4 }), // post-window: excluded
      ],
      ref: "GH-900",
      providerProfile: "profile-a",
      from: PARK,
      through: WINDOW_END,
    });
    // Only the three in-scope billable calls count.
    expect(evidence.billableCalls).toBe(3);
    // The scope disclosure names the exclusions with their boundary reasons.
    const reasons = (evidence.excluded ?? []).map((entry) => entry.reason);
    expect(reasons).toEqual(["pre-park", "post-window"]);
    // The matched positions are visible: exactly the three in-scope steps.
    expect(evidence.matchedPositions).toEqual([1, 2, 3]);
  });

  test("a seeded mid-window call reads non-zero: the assertion can fail", () => {
    const evidence = windowSpendEvidence({
      steps: [step({ instant: "2026-11-13T17:00:00.000Z", calls: 7 })],
      ref: "GH-900",
      providerProfile: "profile-a",
      from: PARK,
      through: WINDOW_END,
    });
    expect(evidence.telemetryState).toBe("present");
    expect(evidence.billableCalls).toBe(7);
    expect(evidence.billableCalls).not.toBe(0);
  });
});
