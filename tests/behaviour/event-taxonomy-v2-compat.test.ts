/**
 * TC-PAUSE-063 — the six-point v1-consumer compatibility statement over the
 * delivered control session (GH-294 TDR-0029 D6), end to end through the real
 * daemon publish path on the in-memory transport pair, plus one bounded
 * unix-socket variant.
 *
 * The v1-pinned consumer here is a test-side switch that handles exactly the
 * delivered v1 kinds and carries a default-ignore branch — the shape the
 * statement mandates — so every point is proven as a behavior, not a prose
 * claim.
 */
import { describe, expect, test } from "bun:test";
import type { ControlFrame } from "../../packages/core/src/contracts/index";
import {
  EVENT_ENVELOPE_FIELDS,
  TAXONOMY_VERSION,
} from "../../packages/core/src/contracts/taxonomy";
import { createEventHarness, dataOf, ENVELOPE_KEYS, NOW } from "../fixtures/events/event-harness";
import { createSurfaceHarness } from "../fixtures/events/surface-harness";

const eventFrames = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

/** Wait until a predicate holds over the received frames (bounded, no real sleep web). */
const waitFor = async (
  client: { readonly frames: readonly ControlFrame[] },
  predicate: (frames: readonly ControlFrame[]) => boolean,
): Promise<void> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate(client.frames)) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
};

const appendRaw = (
  harness: Awaited<ReturnType<typeof createEventHarness>>,
  kind: string,
  key: string,
  payload: Record<string, unknown>,
): void => {
  const acquired = harness.store.acquireFence(`v2compat-${key}`);
  if (!acquired.ok) throw new Error("fence refused");
  harness.store.append(acquired.value.handle, { kind, recordKey: key, payload: payload as never });
  harness.store.releaseFence(acquired.value.handle);
};

/** A seeded peak-window park episode: the parked-state record and its recovery. */
const peakPark = (ref: string, recoveredAt?: string): Record<string, unknown> => ({
  schema: "delivery.queue.park.v1",
  ref,
  repository: "github.com/example/repo",
  cause: "peak-window",
  conditionType: "provider-window",
  condition: { kind: "peak-window", detail: "provider-a peak window active" },
  recheckMs: 60_000,
  evaluatedAt: NOW,
  recoveryState: recoveredAt === undefined ? "parked" : "recovered",
  ...(recoveredAt === undefined ? {} : { recoveredAt }),
  providerProfile: "profile-a",
  until: "2026-11-12T11:00:00.000Z",
  graceDeadline: "2026-11-12T10:05:00.000Z",
  windowEnd: "2026-11-12T11:00:00.000Z",
  stoppedAt: NOW,
  preservation: "preserved",
  sessionRef: `session-${ref}`,
  branch: "feat/GH-294/provider-peak-pausing",
  episodeId: `episode-${ref}`,
  recordedAt: NOW,
});

const ownerHoldPark = (ref: string): Record<string, unknown> => ({
  schema: "delivery.queue.park.v1",
  ref,
  repository: "github.com/example/repo",
  cause: "owner-hold",
  conditionType: "preemption",
  condition: { kind: "owner-hold", detail: "owner hold active" },
  recheckMs: 60_000,
  evaluatedAt: NOW,
  recoveryState: "parked",
  episodeId: `episode-${ref}`,
  recordedAt: NOW,
});

/** The delivered v1 kind switch with its mandated default-ignore branch. */
const V1_DISPATCH_KINDS = new Set(["started", "refused", "completed"]);
const V1_GRAPH_KINDS = new Set(["entry", "dependency-edge", "release", "remove"]);
const consume = (
  frames: readonly Record<string, unknown>[],
): { readonly handled: string[]; readonly ignored: string[] } => {
  const handled: string[] = [];
  const ignored: string[] = [];
  for (const frame of frames) {
    const kind = String(frame.kind);
    const known =
      frame.topic === "dispatch.attempt"
        ? V1_DISPATCH_KINDS.has(kind)
        : frame.topic === "queue.graph"
          ? V1_GRAPH_KINDS.has(kind)
          : true;
    (known ? handled : ignored).push(kind);
  }
  return { handled, ignored };
};

describe("TC-PAUSE-063 v1-consumer compatibility under taxonomy v2", () => {
  test("point 1+3: the new kinds' frames keep the eight-field envelope and the per-lane sequence stays contiguous through them", async () => {
    const harness = await createEventHarness({ label: "v2compat-shape" });
    try {
      const client = await harness.connect();
      client.subscribe("dispatch.attempt");
      client.subscribe("queue.graph");
      await Promise.resolve();
      await harness.step();

      appendRaw(harness, "queue.park", "queue.parks:GH-800:peak", peakPark("GH-800"));
      await harness.step();
      const frames = eventFrames(client.drain());
      // stop + parked on dispatch.attempt, park-edge on queue.graph.
      expect(frames.map((frame) => `${frame.topic}/${frame.kind}`)).toEqual([
        "dispatch.attempt/stop",
        "dispatch.attempt/parked",
        "queue.graph/park-edge",
      ]);
      for (const frame of frames) {
        expect(Object.keys(frame)).toEqual([...EVENT_ENVELOPE_FIELDS]);
        expect(Object.keys(frame)).toEqual([...ENVELOPE_KEYS]);
        expect(frame.taxonomyVersion).toBe("v2");
      }
      // The stop payload records the bounded-grace deadline; parked carries
      // reason, profile, until, and the preservation classification.
      const stop = frames.find((frame) => frame.kind === "stop");
      expect(Object.keys(stop?.payload as Record<string, unknown>)).toEqual([
        "ref",
        "graceDeadline",
        "providerProfile",
        "windowEnd",
        "stoppedAt",
        "episodeId",
      ]);
      const parked = frames.find((frame) => frame.kind === "parked");
      expect(parked?.payload).toMatchObject({
        ref: "GH-800",
        reason: "peak-window",
        providerProfile: "profile-a",
        until: "2026-11-12T11:00:00.000Z",
        preservation: "preserved",
      });
      const edge = frames.find((frame) => frame.kind === "park-edge");
      expect(edge?.payload).toMatchObject({ ref: "GH-800", cause: "peak-window" });

      // The recovered record emits resumed, and nothing else: exactly one
      // stop, parked, park-edge, and resumed land per episode.
      appendRaw(
        harness,
        "queue.park",
        "queue.parks:GH-800:peak",
        peakPark("GH-800", "2026-11-12T11:00:01.000Z"),
      );
      await harness.step();
      const resumedFrames = eventFrames(client.drain());
      expect(resumedFrames.map((frame) => frame.kind)).toEqual(["resumed"]);
      expect(resumedFrames[0]?.payload).toMatchObject({
        ref: "GH-800",
        sessionRef: "session-GH-800",
        branch: "feat/GH-294/provider-peak-pausing",
        reDispatched: false,
      });
    } finally {
      await harness.stop();
      harness.close();
    }
  });

  test("point 2+3: a v1-pinned switch handles the delivered kinds, default-ignores the new ones, and never repolls", async () => {
    const harness = await createEventHarness({ label: "v2compat-ignore" });
    try {
      const client = await harness.connect();
      client.subscribe("dispatch.attempt");
      client.subscribe("queue.graph");
      await Promise.resolve();
      await harness.step();

      // Delivered content beside a peak-pause episode on the same lane.
      appendRaw(harness, "daemon.lane", "daemon.lanes:GH-801", {
        schema: "delivery.daemon.lane.v1",
        ref: "GH-801",
        state: "delivering",
        sessionId: "session-GH-801",
        harnessKind: "opencode",
        spawnOrdinal: 1,
        recordedAt: NOW,
      });
      await harness.step();
      appendRaw(harness, "queue.park", "queue.parks:GH-801:peak", peakPark("GH-801"));
      await harness.step();
      const frames = eventFrames(client.drain());
      const { handled, ignored } = consume(frames);
      // The v1 switch handles the delivered kind and ignores the new ones.
      expect(handled).toEqual(["started"]);
      expect(ignored).toEqual(["stop", "parked", "park-edge"]);

      // Contiguity: the per-(topic, lane) sequence across handled AND ignored
      // frames increases by exactly one — the new kinds are not a
      // discontinuity, so the correct reaction is ignore-and-continue, never
      // repoll (a repoll would loop: the condition persists).
      const sequences = frames
        .filter((frame) => frame.lane === "GH-801" && frame.topic === "dispatch.attempt")
        .map((frame) => frame.sequence);
      expect(sequences).toEqual([1, 2, 3]);
    } finally {
      await harness.stop();
      harness.close();
    }
  });

  test("point 4+6: a foreign stamp is a drift signal answered by the reference surface, not an error and not a disconnect", async () => {
    const harness = await createEventHarness({ label: "v2compat-stamp" });
    try {
      const client = await harness.connect();
      client.subscribe("dispatch.attempt");
      await Promise.resolve();
      await harness.step();

      appendRaw(harness, "queue.park", "queue.parks:GH-802:peak", peakPark("GH-802"));
      await harness.step();
      const first = eventFrames(client.drain());
      const pin = "v1";
      const drifted = first.filter((frame) => frame.taxonomyVersion !== pin);
      expect(drifted.length).toBeGreaterThan(0);
      // The defined reaction: re-read the events reference surface, which
      // names the served version from the same declaration constant.
      const surface = await createSurfaceHarness().run(["events", "list", "--json"]);
      expect(surface.exitCode).toBe(0);
      expect(surface.data?.taxonomyVersion).toBe(TAXONOMY_VERSION);
      expect(surface.data?.taxonomyVersion).not.toBe(pin);

      // No disconnect and no ordering change: the connection keeps receiving,
      // with the per-lane dispatch.attempt sequence continuing contiguously
      // (stop=1, parked=2, resumed=3) — ignore-and-continue, never repoll.
      appendRaw(
        harness,
        "queue.park",
        "queue.parks:GH-802:peak",
        peakPark("GH-802", "2026-11-12T11:00:01.000Z"),
      );
      await harness.step();
      const after = eventFrames(client.drain());
      expect(after.map((frame) => frame.kind)).toEqual(["resumed"]);
      expect(after[0]?.sequence).toBe(3);
      expect(after[0]?.taxonomyVersion).toBe("v2");
    } finally {
      await harness.stop();
      harness.close();
    }
  });

  test("point 5: the owner-hold park-edge carries no expiry, and the delivered frame remedies stay the only repoll conditions", async () => {
    const harness = await createEventHarness({ label: "v2compat-hold" });
    try {
      const client = await harness.connect();
      client.subscribe("queue.graph");
      await Promise.resolve();
      await harness.step();

      appendRaw(harness, "queue.park", "queue.parks:GH-803:hold", ownerHoldPark("GH-803"));
      await harness.step();
      const frames = eventFrames(client.drain());
      expect(frames.map((frame) => frame.kind)).toEqual(["park-edge"]);
      // The owner-hold park's `until` is the declared classified absence:
      // never a synthesized or borrowed timestamp.
      expect(Object.keys(frames[0]?.payload as Record<string, unknown>)).toEqual([
        "ref",
        "cause",
        "episodeId",
        "recordedAt",
      ]);
      expect(frames[0]?.sequence).toBe(1);
    } finally {
      await harness.stop();
      harness.close();
    }
  });

  test("the bounded unix-socket variant keeps the statement: new kinds decode, sequence contiguous, stamp v2", async () => {
    const harness = await createEventHarness({ label: "v2compat-unix", realSocket: true });
    try {
      const client = await harness.connect();
      client.subscribe("dispatch.attempt");
      client.subscribe("queue.graph");
      // The delivered socket handshake: wait until both subscriptions are
      // registered (their response frames) before any publish tick, so the
      // episode cannot publish to no subscriber.
      await waitFor(
        client,
        (received) => received.filter((frame) => frame.kind === "response").length >= 2,
      );
      await harness.step();
      client.drain();

      appendRaw(harness, "queue.park", "queue.parks:GH-804:peak", peakPark("GH-804"));
      await harness.step();
      await harness.step();
      // The real socket delivers asynchronously: wait until the episode's
      // three frames have arrived, then read them alone.
      await waitFor(client, (received) => eventFrames(received).length >= 3);
      const frames = eventFrames(client.drain());
      expect(frames.map((frame) => `${frame.topic}/${frame.kind}`)).toEqual([
        "dispatch.attempt/stop",
        "dispatch.attempt/parked",
        "queue.graph/park-edge",
      ]);
      for (const frame of frames) {
        expect(Object.keys(frame)).toEqual([...ENVELOPE_KEYS]);
        expect(frame.taxonomyVersion).toBe("v2");
      }
      const { ignored } = consume(frames);
      expect(ignored).toEqual(["stop", "parked", "park-edge"]);
      expect(
        frames.filter((frame) => frame.topic === "dispatch.attempt").map((frame) => frame.sequence),
      ).toEqual([1, 2]);
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});
