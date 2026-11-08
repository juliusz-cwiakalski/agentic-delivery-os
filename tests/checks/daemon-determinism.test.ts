/**
 * TC-DET-001 (status half) — identical input yields byte-identical status output
 * across 100 runs.
 */
import { describe, expect, test } from "bun:test";
import {
  foldDaemonStatus,
  renderDaemonStatusHuman,
} from "../../packages/core/src/domain/daemon-status";
import type { DaemonSupervisorDescriptor } from "../../packages/core/src/contracts/index";

const supervisor: DaemonSupervisorDescriptor = {
  kind: "systemd-user",
  installed: false,
  unit: "ados.service",
  scope: "scope",
  linger: false,
  commandForm: "foreground",
  serviceType: "simple",
  restartPolicy: "on-failure",
};

describe("GH-238 status determinism", () => {
  test("100 identical folds and renders are byte-identical", () => {
    const render = (): string =>
      renderDaemonStatusHuman(
        foldDaemonStatus({
          lanes: [],
          restarts: {},
          queueDepth: 0,
          heartbeatIntervalMs: 5_000,
          lockStalenessMs: 30_000,
          nowMs: 1_000,
          socket: { path: "<state-dir>/daemon.sock", transport: "unix", reachable: false },
          supervisor,
          mergeCodePath: "absent",
          degraded: [],
        }),
      );
    const baseline = render();
    for (let index = 0; index < 100; index += 1) expect(render()).toBe(baseline);
  });

  test("the human render stays within the declared line and byte bounds", () => {
    const lanes = Array.from({ length: 100 }, (_, index) => ({
      schema: "delivery.daemon.lane.v1" as const,
      ref: `GH-${index}`,
      state: "delivering" as const,
      spawnOrdinal: 1,
      recordedAt: "2026-11-08T10:00:00Z",
    }));
    const text = renderDaemonStatusHuman(
      foldDaemonStatus({
        lanes,
        restarts: {},
        queueDepth: 0,
        heartbeatIntervalMs: 5_000,
        lockStalenessMs: 30_000,
        nowMs: 1_000,
        socket: { path: "<state-dir>/daemon.sock", transport: "unix", reachable: false },
        supervisor,
        mergeCodePath: "absent",
        degraded: [],
      }),
    );
    expect(text.split("\n").filter((line) => line.length > 0).length).toBeLessThanOrEqual(40);
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(8_192);
  });
});

import { decidePreemption } from "../../packages/core/src/domain/daemon-preemption";

describe("GH-238 preemption determinism", () => {
  test("100 identical decisions are byte-identical", () => {
    const input = {
      ref: "GH-238",
      repository: "repo",
      closeRef: "GH-999",
      holder: "holder",
      hasActiveSession: true,
      requestedAt: "2026-11-08T10:00:00Z",
    };
    const baseline = JSON.stringify(decidePreemption(input));
    for (let index = 0; index < 100; index += 1) {
      expect(JSON.stringify(decidePreemption(input))).toBe(baseline);
    }
  });
});

import { createWatchProjection } from "../../packages/core/src/domain/watch-stream";

describe("GH-238 watch determinism", () => {
  test("100 identical snapshots are byte-identical", () => {
    const render = (): string | undefined =>
      createWatchProjection("queue").snapshot({ entries: 3, edges: 2 });
    const baseline = JSON.stringify(render());
    for (let index = 0; index < 100; index += 1) expect(JSON.stringify(render())).toBe(baseline);
  });
});
