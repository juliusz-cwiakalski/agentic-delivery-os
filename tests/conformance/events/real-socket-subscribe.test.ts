/**
 * TC-EVT-021 — the same `queue.graph` observation over the delivered real unix
 * socket under a temp state directory (the one integration-marked subscription
 * case). Bounded, temp-rooted, and closed in `finally`.
 */
import { describe, expect, test } from "bun:test";
import { statSync } from "node:fs";
import type { ControlFrame } from "../../../packages/core/src/contracts/index";
import { createEventHarness, dataOf, NOW } from "../../fixtures/events/event-harness";

const HARD_TIMEOUT_MS = 20_000;

const eventFrames = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

/** Wait until a predicate holds over the received frames (bounded, no real sleep web). */
const waitFor = async (
  windows: { readonly frames: readonly ControlFrame[] },
  predicate: (frames: readonly ControlFrame[]) => boolean,
): Promise<void> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate(windows.frames)) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
};

const appendRaw = (
  harness: Awaited<ReturnType<typeof createEventHarness>>,
  key: string,
  payload: Record<string, unknown>,
): void => {
  const acquired = harness.store.acquireFence(`socket-${key}`);
  if (!acquired.ok) throw new Error("fence refused");
  harness.store.append(acquired.value.handle, {
    kind: "queue.dependency",
    recordKey: key,
    payload: payload as never,
  });
  harness.store.releaseFence(acquired.value.handle);
};

describe("TC-EVT-021 real unix-socket subscription", () => {
  test(
    "entry and dependency-edge arrive with the same envelope over the delivered transport",
    async () => {
      const harness = await createEventHarness({ label: "socket", realSocket: true });
      try {
        const client = await harness.connect();
        client.subscribe("queue.graph");
        await waitFor(client, (frames) => frames.some((frame) => frame.kind === "response"));
        await harness.step();
        expect(eventFrames(client.drain())).toHaveLength(0);

        harness.appendEntry({
          schema: "delivery.queue.entry.v1" as never,
          ref: "GH-999",
          priority: 5,
          recordedAt: NOW,
        } as never);
        await harness.step();
        await waitFor(client, (received) => eventFrames(received).length >= 1);
        let frames = eventFrames(client.drain());
        expect(frames).toHaveLength(1);
        expect(frames[0]).toMatchObject({ kind: "entry", sequence: 1, taxonomyVersion: "v1" });

        appendRaw(harness, "queue.deps:GH-999:socket", {
          schema: "delivery.queue.dependency.v1",
          ref: "GH-999",
          edges: ["GH-777"],
          recordedAt: "2026-11-12T10:00:05.000Z",
        });
        await harness.step();
        await waitFor(client, (received) => eventFrames(received).length >= 1);
        frames = eventFrames(client.drain());
        expect(frames).toHaveLength(1);
        expect(frames[0]).toMatchObject({ kind: "dependency-edge", sequence: 2 });
        expect(((frames[0]?.payload ?? {}) as { added: string[] }).added).toEqual(["GH-777"]);

        // The delivered transport invariants: a 0700 directory and a 0600 socket.
        expect(statSync(harness.root).mode & 0o777).toBe(0o700);
        expect(statSync(`${harness.root}/daemon.sock`).mode & 0o777).toBe(0o600);
      } finally {
        await harness.stop();
        harness.close();
      }
    },
    HARD_TIMEOUT_MS,
  );
});
