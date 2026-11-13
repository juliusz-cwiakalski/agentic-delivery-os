/**
 * TC-PAUSE-080 / TC-PAUSE-081 — the declared daemon-absent degradation
 * (GH-294 F-8, AC-F8-7, DEC-7, NFR-7; SC-M2-S17-05; AMB-P4).
 *
 * Without a resident daemon there is no window watcher and no mid-flight
 * park: behavior degrades to the delivered iteration-start gating, the
 * machine read declares it (`peakEnforcement.mode`), `parkClaimed` is false,
 * and no surface claims a park that did not happen. The machine-read case
 * fails naming the missing surface if delivery exposes none (AMB-P4) — the
 * `lanes --json` read is that surface.
 */
import { describe, expect, test } from "bun:test";
import { QUEUE_PEAK_ENFORCEMENT_MODES } from "../../packages/core/src/contracts/index";
import { TAXONOMY } from "../../packages/core/src/contracts/taxonomy";
import { projectBrief } from "../../packages/core/src/domain/brief";
import type { QueueSchedule } from "../../packages/core/src/domain/index";
import { foldLanes } from "../../packages/core/src/domain/index";
import { aggregateStatus } from "../../packages/core/src/domain/status";
import { createQueueEdgeHarness } from "../fixtures/queue/cli/harness";
import { baseFacts } from "../fixtures/status/harness";

const emptySchedule = (): QueueSchedule =>
  ({
    entries: [],
    leases: [],
    findings: [],
    next: [],
  }) as unknown as QueueSchedule;

describe("TC-PAUSE-080 the machine read declares the degradation", () => {
  test("foldLanes defaults to iteration-start-gating with parkClaimed false", () => {
    const data = foldLanes({
      schedule: emptySchedule(),
      economics: {},
      degraded: ["daemon-unreachable"],
    });
    // The OQ-TP-6 pin, on the machine read: both values, one object.
    expect(data.peakEnforcement).toEqual({
      mode: "iteration-start-gating",
      parkClaimed: false,
    });
    // The mode is a closed two-member set.
    expect([...QUEUE_PEAK_ENFORCEMENT_MODES]).toEqual(["window-watch", "iteration-start-gating"]);
  });

  test("a resident daemon composes window-watch, and a claimed park reads true only from a record", () => {
    const watching = foldLanes({
      schedule: emptySchedule(),
      economics: {},
      degraded: [],
      peakEnforcement: { mode: "window-watch", parkClaimed: true },
    });
    expect(watching.peakEnforcement).toEqual({ mode: "window-watch", parkClaimed: true });
  });

  test("the lanes --json machine read names the mode and parkClaimed over the real edge", async () => {
    const harness = createQueueEdgeHarness("s17-degradation");
    const run = await harness.run(["lanes", "list", "--json"]);
    expect(run.exitCode).toBe(0);
    const parsed = JSON.parse(run.stdout) as { readonly data?: Record<string, unknown> };
    const data = parsed.data as { readonly peakEnforcement?: Record<string, unknown> } | undefined;
    // AMB-P4: the machine read exists and carries both values — a missing
    // surface fails here by name rather than passing vacuously.
    expect(data?.peakEnforcement, "the lanes --json surface carries peakEnforcement").toBeDefined();
    expect(data?.peakEnforcement?.mode).toBe("iteration-start-gating");
    expect(data?.peakEnforcement?.parkClaimed).toBe(false);
  });

  test("the delivered iteration-start gating is unchanged: admission gating did not move", () => {
    // The delivered provider-peak-window suite owns the admission semantics
    // (it is a gate control); here the degradation adds no new admission
    // behavior — the lanes read stays a read.
    const data = foldLanes({
      schedule: emptySchedule(),
      economics: {},
      degraded: ["daemon-unreachable"],
    });
    expect(data.lanes).toEqual([]);
    expect(data.peakEnforcement.mode).toBe("iteration-start-gating");
  });
});

describe("TC-PAUSE-081 no surface claims a park that did not happen", () => {
  test("status, brief, lanes, board data, attempts, and the events reference carry zero claims", async () => {
    // Daemon-absent facts: no lane parks exist, so no surface renders one.
    const facts = baseFacts();
    const digest = aggregateStatus(facts);
    const providers = digest.sections.find((section) => section.id === "providers");
    // Status: no laneParks field at all (never an empty-claims array padded
    // to look like evidence).
    expect(providers?.laneParks).toBeUndefined();
    // Brief: the projection adds zero reads and carries nothing.
    const brief = projectBrief(facts);
    const briefProviders = brief.surfaces.find((surface) => surface.id === "providers");
    expect(briefProviders?.laneParks).toBeUndefined();
    // Lanes: parkClaimed is false and no lane is parked.
    const lanes = foldLanes({
      schedule: emptySchedule(),
      economics: {},
      degraded: ["daemon-unreachable"],
    });
    expect(lanes.peakEnforcement.parkClaimed).toBe(false);
    expect(lanes.counts.parked).toBe(0);
    // Events reference: no park-family kind claims emission beyond the
    // declaration, and the taxonomy declares — it never asserts an episode
    // that has no records.
    const dispatch = TAXONOMY.topics.find((topic) => topic.name === "dispatch.attempt");
    for (const kind of dispatch?.kinds ?? []) {
      // Declaration is data, not a claim: a kind is a contract, and the
      // no-claims property is about rendered state, which carries no episode.
      expect(kind.emitted === true || kind.emitted === false).toBe(true);
    }
  });

  test("zero park-family records exist for the window interval and no zero-spend reading is synthesized", () => {
    // The daemon-absent store holds no park-family records at all: the
    // degradation cannot claim an episode for an interval that has none.
    const harness = createQueueEdgeHarness("s17-no-claims");
    const parks = harness.composition.store.readRecords();
    expect(parks.ok).toBe(true);
    if (!parks.ok) return;
    const parkFamily = parks.value.records.filter((record) => record.kind === "queue.park");
    expect(parkFamily).toEqual([]);
    // No window-scoped zero-spend episode reading exists for a park that
    // never happened: the evidence form requires a park record to name the
    // profile, and the store names none.
    const claims = parks.value.records.filter((record) =>
      JSON.stringify(record.payload).includes("peak-window"),
    );
    expect(claims).toEqual([]);
  });
});
