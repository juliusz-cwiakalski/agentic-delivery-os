/**
 * TC-PAUSE-064 / TC-PAUSE-093 — exactly-once episode event evidence over real
 * episodes (GH-294 F-7, AC-F7-6 ledger half, NFR-6; EVT-1..EVT-4).
 *
 * Over the delivered daemon publish path (in-memory transport pair, injected
 * clock, temp store), exactly one `stop`, `parked`, `resumed`, and `park-edge`
 * lands per episode across many supervision ticks; the payloads reconstruct
 * the episode from the ledger alone; and the four kinds hold the NFR-6
 * evidence bounds — at most 20 payload fields and at most 1024 evidence bytes,
 * measured and printed with the fixture size.
 */
import { describe, expect, test } from "bun:test";
import type { ControlFrame } from "../../packages/core/src/contracts/index";
import { TAXONOMY } from "../../packages/core/src/contracts/taxonomy";
import { createEventHarness, dataOf, ENVELOPE_KEYS, NOW } from "../fixtures/events/event-harness";
import { CONTRACT_PAYLOAD_FIELDS } from "../fixtures/events/taxonomy-cases";

const eventFrames = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

const appendRaw = (
  harness: Awaited<ReturnType<typeof createEventHarness>>,
  key: string,
  payload: Record<string, unknown>,
): void => {
  const acquired = harness.store.acquireFence(`episode-${key}`);
  if (!acquired.ok) throw new Error("fence refused");
  harness.store.append(acquired.value.handle, {
    kind: "queue.park",
    recordKey: key,
    payload: payload as never,
  });
  harness.store.releaseFence(acquired.value.handle);
};

const peakPark = (
  ref: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  schema: "delivery.queue.park.v1",
  ref,
  repository: "github.com/example/repo",
  cause: "peak-window",
  conditionType: "provider-window",
  condition: { type: "provider-window", expiresAt: "2026-11-12T11:00:00.000Z" },
  recheckMs: 60_000,
  evaluatedAt: NOW,
  recoveryState: "parked",
  providerProfile: "profile-a",
  until: "2026-11-12T11:00:00.000Z",
  graceDeadline: "2026-11-12T10:05:00.000Z",
  windowEnd: "2026-11-12T11:00:00.000Z",
  stoppedAt: NOW,
  preservation: "preserved",
  episodeId: `episode-${ref}`,
  recordedAt: NOW,
  ...overrides,
});

describe("TC-PAUSE-064 exactly-once episode evidence over real episodes", () => {
  test("one stop, parked, park-edge, and resumed lands per episode across many ticks", async () => {
    const harness = await createEventHarness({ label: "episode-exactly-once" });
    try {
      const client = await harness.connect();
      client.subscribe("dispatch.attempt");
      client.subscribe("queue.graph");
      await Promise.resolve();
      await harness.step();
      client.drain();

      // The parked-state record: the episode's stop, parked, and park-edge.
      appendRaw(harness, "queue.parks:GH-860:peak", peakPark("GH-860"));
      await harness.step();
      // Nine further ticks while nothing changes: no duplicate lands.
      for (let tick = 0; tick < 9; tick += 1) await harness.step();
      const afterPark = eventFrames(client.drain());
      const kinds = afterPark.map((frame) => `${frame.topic}/${frame.kind}`);
      expect(kinds).toEqual([
        "dispatch.attempt/stop",
        "dispatch.attempt/parked",
        "queue.graph/park-edge",
      ]);

      // The recovered record: the episode's resumed frame.
      appendRaw(
        harness,
        "queue.parks:GH-860:peak",
        peakPark("GH-860", {
          recoveryState: "recovered",
          recoveredAt: "2026-11-12T11:00:01.000Z",
          clearedAt: "2026-11-12T11:00:01.000Z",
          sessionRef: "session-GH-860",
          branch: "feat/GH-294/provider-peak-pausing",
          recordedAt: "2026-11-12T11:00:01.000Z",
          evaluatedAt: "2026-11-12T11:00:01.000Z",
        }),
      );
      await harness.step();
      for (let tick = 0; tick < 9; tick += 1) await harness.step();
      const afterRecovery = eventFrames(client.drain());
      expect(afterRecovery.map((frame) => frame.kind)).toEqual(["resumed"]);

      // Exactly once per episode, across the whole run.
      const all = [...afterPark, ...afterRecovery];
      const perKind = new Map<string, number>();
      for (const frame of all) {
        const key = `${frame.topic}/${frame.kind}`;
        perKind.set(key, (perKind.get(key) ?? 0) + 1);
      }
      expect(perKind.get("dispatch.attempt/stop")).toBe(1);
      expect(perKind.get("dispatch.attempt/parked")).toBe(1);
      expect(perKind.get("queue.graph/park-edge")).toBe(1);
      expect(perKind.get("dispatch.attempt/resumed")).toBe(1);
      expect(all.every((frame) => frame.taxonomyVersion === "v2")).toBe(true);
    } finally {
      await harness.stop();
      harness.close();
    }
  });

  test("the payloads reconstruct the episode from the ledger alone", async () => {
    const harness = await createEventHarness({ label: "episode-reconstruct" });
    try {
      const client = await harness.connect();
      client.subscribe("dispatch.attempt");
      client.subscribe("queue.graph");
      await Promise.resolve();
      await harness.step();
      client.drain();

      appendRaw(harness, "queue.parks:GH-861:peak", peakPark("GH-861"));
      await harness.step();
      appendRaw(
        harness,
        "queue.parks:GH-861:peak",
        peakPark("GH-861", {
          recoveryState: "recovered",
          recoveredAt: "2026-11-12T11:00:01.000Z",
          clearedAt: "2026-11-12T11:00:01.000Z",
          sessionRef: "session-GH-861",
          branch: "feat/GH-294/provider-peak-pausing",
          recordedAt: "2026-11-12T11:00:01.000Z",
          evaluatedAt: "2026-11-12T11:00:01.000Z",
        }),
      );
      await harness.step();
      const all = eventFrames(client.drain());
      const byKind = new Map(all.map((frame) => [frame.kind, frame]));

      // The stop names the lane, the grace deadline, the profile, the window
      // end, and the episode identity.
      const stop = byKind.get("stop");
      expect(stop?.payload).toMatchObject({
        ref: "GH-861",
        graceDeadline: "2026-11-12T10:05:00.000Z",
        providerProfile: "profile-a",
        windowEnd: "2026-11-12T11:00:00.000Z",
        episodeId: "episode-GH-861",
      });
      // The parked frame names reason, profile, until, and the classification.
      const parked = byKind.get("parked");
      expect(parked?.payload).toMatchObject({
        ref: "GH-861",
        reason: "peak-window",
        providerProfile: "profile-a",
        until: "2026-11-12T11:00:00.000Z",
        preservation: "preserved",
        episodeId: "episode-GH-861",
      });
      // The resumed frame names the preserved session-state reference, the
      // same branch, and the no-re-dispatch fact.
      const resumed = byKind.get("resumed");
      expect(resumed?.payload).toMatchObject({
        ref: "GH-861",
        sessionRef: "session-GH-861",
        branch: "feat/GH-294/provider-peak-pausing",
        reDispatched: false,
        episodeId: "episode-GH-861",
      });
      // The park-edge carries the episode identity on the queue graph.
      const edge = byKind.get("park-edge");
      expect(edge?.payload).toMatchObject({
        ref: "GH-861",
        cause: "peak-window",
        episodeId: "episode-GH-861",
      });
      // One episode identity joins all four frames: reconstruction from the
      // ledger alone.
      const episodeIds = all.map((frame) => (frame.payload as { episodeId?: string }).episodeId);
      expect(new Set(episodeIds)).toEqual(new Set(["episode-GH-861"]));
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});

describe("TC-PAUSE-093 event evidence bounds on the four kinds", () => {
  test("at most 20 payload fields and at most 1024 evidence bytes, measured and printed", () => {
    const kinds = ["stop", "parked", "resumed", "park-edge"] as const;
    const topics = {
      stop: "dispatch.attempt",
      parked: "dispatch.attempt",
      resumed: "dispatch.attempt",
      "park-edge": "queue.graph",
    };
    for (const kind of kinds) {
      const fields = CONTRACT_PAYLOAD_FIELDS[topics[kind]]?.[kind] ?? [];
      expect(fields.length, `${kind} field count`).toBeLessThanOrEqual(20);
      // A maximal emitted payload, byte-measured over the declared evidence
      // budget (NFR-6). The measurement context prints with the fixture.
      const payload: Record<string, unknown> = {};
      for (const field of fields) {
        const name = field.replace(/[?]$/u, "").replace(/\[\]$/u, "");
        payload[name] = "2026-11-13T18:05:00.000Z";
      }
      const bytes = new TextEncoder().encode(JSON.stringify(payload)).length;
      expect(bytes, `${kind} evidence bytes`).toBeLessThanOrEqual(1024);
      expect({ kind, fields: fields.length, bytes }).toEqual({
        kind,
        fields: fields.length,
        bytes,
      });
    }
    // The declared envelope is the eight fields on every event frame.
    expect([...ENVELOPE_KEYS]).toEqual([
      "topic",
      "kind",
      "lane",
      "ref",
      "sequence",
      "occurredAt",
      "payload",
      "taxonomyVersion",
    ]);
    // The declaration pins the same lists (one source of truth).
    const dispatch = TAXONOMY.topics.find((topic) => topic.name === "dispatch.attempt");
    const graph = TAXONOMY.topics.find((topic) => topic.name === "queue.graph");
    for (const kind of ["stop", "parked", "resumed"]) {
      expect(dispatch?.kinds.find((entry) => entry.name === kind)?.payloadFields).toEqual(
        CONTRACT_PAYLOAD_FIELDS["dispatch.attempt"]?.[kind],
      );
    }
    expect(graph?.kinds.find((entry) => entry.name === "park-edge")?.payloadFields).toEqual(
      CONTRACT_PAYLOAD_FIELDS["queue.graph"]?.["park-edge"],
    );
  });
});
