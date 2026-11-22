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
 *
 * TC-SPEND-035 (GH-384) — the same reading renders on a multi-ref ledger:
 * composed from the per-ref steps read in the delivered order (the
 * composition the `createProductionDependencies` windowEvidence closure
 * builds) over the FX-8-WE interleaved fixture, its matched and excluded sets
 * are computed over exactly the requested ref's steps — skipped foreign steps
 * are named in neither set and no exclusion reason is invented for them.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createSpendCommandDefinition } from "../../packages/cli/src/commands/spend";
import type {
  StateStoreIdentity,
  StateStorePort,
  TelemetryStepRecord,
} from "../../packages/core/src/contracts/index";
import {
  SPEND_WINDOW_BASIS,
  SPEND_WINDOW_EXCLUSION_REASONS,
} from "../../packages/core/src/contracts/spend";
import { windowSpendEvidence } from "../../packages/core/src/domain/spend";
import { readQueueParks } from "../../packages/core/src/index";
import { readTelemetrySteps } from "../../packages/core/src/state/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import {
  GH384_FOREIGN_REF,
  GH384_REF,
  GH384_WINDOW_FROM,
  GH384_WINDOW_THROUGH,
  seedWindowEvidenceLedger,
} from "../fixtures/telemetry/index";

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
    // GH-294 F-8: the foreign-lane exclusion carries its own reason — the
    // attribution-scope disclosure, never a mislabeled boundary exclusion.
    expect(evidence.excluded).toEqual([{ position: 0, reason: "other-lane" }]);
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

  // GH-294 F-8: non-boundary exclusions carry their own declared reasons —
  // a foreign-lane step inside the window is `other-lane` (attribution
  // scope), and an unreadable instant is `unreadable-instant`. Neither is
  // ever mislabeled `pre-park`.
  test("foreign-lane and unreadable-instant exclusions are disclosed with their own reasons", () => {
    const evidence = windowSpendEvidence({
      steps: [
        step({ instant: "2026-11-13T17:00:00.000Z", lane: "GH-901", calls: 2 }), // other lane: excluded
        step({ instant: "not-a-timestamp", calls: 2 }), // unreadable instant: excluded
        step({ instant: PARK, lane: "GH-901", calls: 1 }), // park instant, other lane: in-boundary, lane scope
        step({ instant: "2026-11-13T17:30:00.000Z", calls: 1 }), // mid-window: included
      ],
      ref: "GH-900",
      providerProfile: "profile-a",
      from: PARK,
      through: WINDOW_END,
    });
    expect(evidence.telemetryState).toBe("present");
    expect(evidence.billableCalls).toBe(1);
    expect(evidence.matchedPositions).toEqual([3]);
    expect(evidence.excluded).toEqual([
      { position: 0, reason: "other-lane" },
      { position: 1, reason: "unreadable-instant" },
      { position: 2, reason: "other-lane" },
    ]);
    // The closed reason set: the boundary pair plus the two declared
    // non-boundary values.
    expect([...SPEND_WINDOW_EXCLUSION_REASONS]).toEqual([
      "pre-park",
      "post-window",
      "other-lane",
      "unreadable-instant",
    ]);
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

// ---------------------------------------------------------------------------
// TC-SPEND-035 (GH-384) — the window-scoped zero-spend evidence renders on a
// multi-ref ledger, exactly scoped. The composition is the delivered one (the
// `createProductionDependencies` windowEvidence closure in
// packages/cli/src/edge.ts): the per-ref steps read, the delivered peak-window
// park/profile lookup riding as the pass-through it is, then the pure
// reading — over the FX-8-WE interleaved fixture on a real temp store, with
// the foreign ref's step record first (the observed shape). Pre-fix this
// reading returned `state.store.torn` naming the first foreign step record.
// ---------------------------------------------------------------------------

const gh384WindowRoots: string[] = [];

afterEach(() => {
  for (const root of gh384WindowRoots.splice(0)) removeRoot(root);
});

/** One fresh per-test temp store seeded with FX-8-WE (removed in afterEach). */
const gh384WindowStore = (): { identity: StateStoreIdentity; store: StateStorePort } => {
  const root = makeTempRoot("gh384-window-evidence");
  gh384WindowRoots.push(root);
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  seedWindowEvidenceLedger(store, GH384_REF, GH384_FOREIGN_REF);
  return { identity, store };
};

/**
 * The delivered windowEvidence composition, exactly as the production closure
 * builds it: the per-ref steps read, the peak-window park/profile lookup (a
 * pass-through — FX-8-WE carries no park records, so the profile stays the
 * delivered empty-string default), then the pure reading.
 */
const windowEvidenceOver =
  (store: StateStorePort) =>
  (request: { readonly ref: string; readonly from: string; readonly through: string }) => {
    const read = readTelemetrySteps(store, request.ref);
    if (!read.ok) {
      return {
        ok: false as const,
        error: {
          kind: "state",
          code: read.error.code,
          consequence: read.error.consequence,
          location: read.error.location,
        },
      };
    }
    const parks = readQueueParks(store);
    const profile = parks.ok
      ? [...parks.records]
          .reverse()
          .find(
            (record) =>
              record.ref === request.ref &&
              record.cause === "peak-window" &&
              record.providerProfile !== undefined,
          )?.providerProfile
      : undefined;
    return {
      ok: true as const,
      data: windowSpendEvidence({
        steps: read.value.records,
        ref: request.ref,
        providerProfile: profile ?? "",
        from: request.from,
        through: request.through,
      }),
    };
  };

describe("TC-SPEND-035 the window-scoped zero-spend evidence renders on a multi-ref ledger, exactly scoped", () => {
  test("the reading renders for the requested ref over the foreign-first ledger, exactly scoped", () => {
    const { store } = gh384WindowStore();
    const composed = windowEvidenceOver(store);
    const outcome = composed({
      ref: GH384_REF,
      from: GH384_WINDOW_FROM,
      through: GH384_WINDOW_THROUGH,
    });
    // The reading succeeds — no `state.store.torn` and no other classification.
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const evidence = outcome.data;
    // The delivered shape: ref, provider profile, window bounds, present
    // state, the billable-call count as a number, the delivered basis identity.
    expect(evidence.ref).toBe(GH384_REF);
    expect(evidence.providerProfile).toBe("");
    expect(evidence.from).toBe(GH384_WINDOW_FROM);
    expect(evidence.through).toBe(GH384_WINDOW_THROUGH);
    expect(evidence.telemetryState).toBe("present");
    expect(typeof evidence.billableCalls).toBe("number");
    expect(evidence.basis).toBe(SPEND_WINDOW_BASIS);
    // Matched and excluded sets computed over exactly the requested ref's
    // steps: the park instant, the window end, and both boundary instants
    // included; a seeded mid-window billable step reads non-zero.
    expect(evidence.billableCalls).toBe(6);
    expect(evidence.matchedPositions).toEqual([1, 2, 3]);
    expect(evidence.excluded).toEqual([
      { position: 0, reason: "pre-park" },
      { position: 4, reason: "post-window" },
    ]);
    // Cross-check against the seeded ledger: zero requested-ref steps dropped,
    // zero foreign steps in the projection at all.
    const read = readTelemetrySteps(store, GH384_REF);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.records).toHaveLength(5);
    expect(read.value.records.every((step) => step.workItemRef === GH384_REF)).toBe(true);
    expect(read.value.records.every((step) => step.lane === GH384_REF)).toBe(true);
    // Every matched position is a requested step inside the window on the
    // parked lane; every exclusion reason is from the delivered closed
    // four-value set — no foreign/skipped reason is invented, and skipped
    // foreign steps are named in neither set.
    for (const position of evidence.matchedPositions ?? []) {
      const matched = read.value.records[position];
      expect(matched).toBeDefined();
      expect(matched?.lane).toBe(GH384_REF);
      const at = Date.parse(matched?.finishedAt ?? matched?.startedAt ?? matched?.capturedAt ?? "");
      expect(at).toBeGreaterThanOrEqual(Date.parse(GH384_WINDOW_FROM));
      expect(at).toBeLessThanOrEqual(Date.parse(GH384_WINDOW_THROUGH));
    }
    for (const entry of evidence.excluded ?? []) {
      expect([...SPEND_WINDOW_EXCLUSION_REASONS]).toContain(entry.reason);
    }
    const foreign = readTelemetrySteps(store, GH384_FOREIGN_REF);
    expect(foreign.ok).toBe(true);
    if (foreign.ok) {
      const foreignSessionIds = new Set(foreign.value.records.map((step) => step.sessionId));
      for (const step of read.value.records) {
        expect(foreignSessionIds.has(step.sessionId)).toBe(false);
      }
    }
  });

  test("the same reading for the earlier ref over the same ledger is likewise exactly scoped", () => {
    const { store } = gh384WindowStore();
    const composed = windowEvidenceOver(store);
    const outcome = composed({
      ref: GH384_FOREIGN_REF,
      from: GH384_WINDOW_FROM,
      through: GH384_WINDOW_THROUGH,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const evidence = outcome.data;
    expect(evidence.ref).toBe(GH384_FOREIGN_REF);
    expect(evidence.telemetryState).toBe("present");
    // Exactly the earlier ref's steps in its sets: its own pre-park step
    // excluded with its boundary reason, its mid-window step matched.
    expect(evidence.billableCalls).toBe(4);
    expect(evidence.matchedPositions).toEqual([1]);
    expect(evidence.excluded).toEqual([{ position: 0, reason: "pre-park" }]);
    for (const entry of evidence.excluded ?? []) {
      expect([...SPEND_WINDOW_EXCLUSION_REASONS]).toContain(entry.reason);
    }
  });

  test("the delivered CLI definition renders the composed reading without inventing a stronger claim", async () => {
    const { store } = gh384WindowStore();
    const composed = windowEvidenceOver(store);
    const definition = createSpendCommandDefinition({
      resolveActiveRef: () => ({ ref: GH384_REF }),
      report: () => {
        throw new Error("the evidence form must not fold the six-key report");
      },
      windowEvidence: (request) => composed(request),
    });
    const outcome = await definition.handler({
      argv: [
        "spend",
        "--window-evidence",
        "--ref",
        GH384_REF,
        "--from",
        GH384_WINDOW_FROM,
        "--through",
        GH384_WINDOW_THROUGH,
      ],
      flags: {},
      positionals: [],
    } as never);
    const data = (outcome as { readonly data?: Record<string, unknown> }).data;
    expect(data?.telemetryState).toBe("present");
    expect(data?.billableCalls).toBe(6);
    expect(data?.basis).toBe("delivery.telemetry.storage.v1");
    // The human render states the reading without inventing a stronger claim.
    const human = definition.humanText?.(data, { binaryName: "delivery-os" } as never);
    expect(human).toContain("telemetry=present");
    expect(human).toContain("billableCalls=6");
    expect(human).toContain("delivery.telemetry.storage.v1");
  });
});
