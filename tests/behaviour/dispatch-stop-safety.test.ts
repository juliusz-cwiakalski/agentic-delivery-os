/**
 * TC-PEAK-019 — the stop sends no signal of its own, issues exactly one
 * terminate call with the composed grace, and writes the park only after a
 * confirmed terminate (GH-413 F-9, F-10, AC-F9-2, NFR-1).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { executeDispatchStop } from "../../packages/core/src/app/dispatch-stop";
import type { DispatchLaneRecord, QueueParkRecord } from "../../packages/core/src/contracts/index";

const NOW = Date.parse("2026-11-12T06:30:00.000Z");
const REPOSITORY = "github.com/owner/repo";

const lane = (): DispatchLaneRecord => ({
  schema: "delivery.dispatch.lane.v1",
  ref: "GH-413",
  repository: REPOSITORY,
  attemptId: "attempt-1",
  sessionId: "ses-1",
  harnessKind: "opencode",
  owner: { processId: 4242, startedAt: "2026-11-12T06:00:00.000Z" },
  iterationOrdinal: 1,
  restartsConsumed: 0,
  state: "active",
  providerProfile: "delivery",
  recordedAt: "2026-11-12T06:00:00.000Z",
});

const graceOf = async (input: {
  readonly untilMs: number;
  readonly profileGraceMs: number;
  readonly killGraceMs: number;
}) => {
  const stops: number[] = [];
  const appended: QueueParkRecord[] = [];
  const outcome = await executeDispatchStop(
    {
      resolveRepository: () => REPOSITORY,
      lanes: () => [lane()],
      parks: () => [],
      terminate: async ({ graceMs }) => {
        stops.push(graceMs);
        return { ok: true, terminated: true };
      },
      appendPark: (record) => {
        appended.push(record);
        return true;
      },
      newEpisodeId: () => "episode-1",
      profileGraceMsFor: () => input.profileGraceMs,
      killGraceMs: input.killGraceMs,
      mainCheckout: "/work/repo",
    },
    {
      ref: "GH-413",
      cause: "peak-window",
      until: new Date(input.untilMs).toISOString(),
      nowIso: new Date(NOW).toISOString(),
      nowMs: NOW,
    },
  );
  return { outcome, stops, appended };
};

describe("TC-PEAK-019 one terminate call carries the composed grace", () => {
  test("the profile grace is the smallest bound", async () => {
    const { stops } = await graceOf({
      untilMs: NOW + 4 * 3_600_000,
      profileGraceMs: 20_000,
      killGraceMs: 60_000,
    });
    expect(stops).toEqual([20_000]);
  });

  test("the delivered kill grace is the smallest bound", async () => {
    const { stops } = await graceOf({
      untilMs: NOW + 4 * 3_600_000,
      profileGraceMs: 20_000,
      killGraceMs: 5_000,
    });
    expect(stops).toEqual([5_000]);
  });

  test("the time to the declared end is the smallest bound", async () => {
    const { stops } = await graceOf({
      untilMs: NOW + 7_000,
      profileGraceMs: 20_000,
      killGraceMs: 60_000,
    });
    expect(stops).toEqual([7_000]);
  });

  test("an unconfirmed terminate writes no stop, park, or park-edge", async () => {
    const appended: QueueParkRecord[] = [];
    const outcome = await executeDispatchStop(
      {
        resolveRepository: () => REPOSITORY,
        lanes: () => [lane()],
        parks: () => [],
        terminate: async () => ({ ok: true, terminated: false }),
        appendPark: (record) => {
          appended.push(record);
          return true;
        },
        newEpisodeId: () => "episode-1",
        profileGraceMsFor: () => 20_000,
        killGraceMs: 20_000,
        mainCheckout: "/work/repo",
      },
      {
        ref: "GH-413",
        cause: "peak-window",
        until: new Date(NOW + 3_600_000).toISOString(),
        nowIso: new Date(NOW).toISOString(),
        nowMs: NOW,
      },
    );
    expect(outcome.ok).toBe(false);
    expect(appended).toHaveLength(0);
  });

  test("the command path carries no second signalling route", () => {
    const source = readFileSync(
      join(process.cwd(), "packages/core/src/app/dispatch-stop.ts"),
      "utf8",
    );
    for (const marker of ["SIGTERM", "SIGKILL", "process.kill", "kill("]) {
      expect(source).not.toContain(marker);
    }
    expect(source).toContain("terminate(");
  });
});
