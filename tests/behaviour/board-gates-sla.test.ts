/**
 * TC-BOARD-020 and TC-BOARD-022 — the delivered SLA matrix is preserved and the
 * gate row is extended rather than re-semanted (AC-F4-1, DM-3, §8.5).
 */
import { describe, expect, test } from "bun:test";
import { projectBoard } from "../../packages/core/src/domain/owner-gate-sla";
import { boardGates, createBoardHarness } from "../fixtures/board/harness";
import {
  BOARD_NOW_ISO,
  BOARD_NOW_MS,
  HOUR_MS,
  ownerReviewGate,
  shippedPolicy,
  waiverGate,
} from "../fixtures/board/matrix";
import { BOARD_REPOSITORY } from "../fixtures/board/sections";

const gatesFor = (gates: ReturnType<typeof ownerReviewGate>[]) =>
  createBoardHarness({
    repositories: [{ key: BOARD_REPOSITORY, gates, lanes: [], asks: [], parks: [] }],
  });

describe("TC-BOARD-020 delivered SLA matrix", () => {
  test("fresh under 24h, escalated from 24h, default-applied at 72h for waiver", async () => {
    const board = gatesFor([
      ownerReviewGate("GH-4001", 24 * HOUR_MS - 1),
      ownerReviewGate("GH-4002", 24 * HOUR_MS),
      waiverGate("GH-4003", 72 * HOUR_MS),
      ownerReviewGate("GH-4004", 100 * HOUR_MS),
    ]);
    try {
      const run = await board.run([], { json: true });
      const byId = new Map(boardGates(run).map((gate) => [gate.ref, gate]));
      expect(byId.get("GH-4001")?.slaState).toBe("fresh");
      expect(byId.get("GH-4002")?.slaState).toBe("escalated");
      expect(byId.get("GH-4003")?.slaState).toBe("default-applied");
      expect(byId.get("GH-4003")?.default).toBe("owner-review-first");
      expect(byId.get("GH-4004")?.slaState).toBe("escalated");
      expect(byId.get("GH-4004")?.default).toBeNull();
    } finally {
      board.cleanup();
    }
  });

  test("a recorded waiver surfaces with its authorizer and the delivered rank", async () => {
    const board = gatesFor([
      ownerReviewGate("GH-4010", HOUR_MS),
      waiverGate("GH-4011", 30 * HOUR_MS, { waivedBy: "principal-w" }),
    ]);
    try {
      const run = await board.run([], { json: true });
      const gates = boardGates(run);
      expect(gates[0]?.ref).toBe("GH-4011");
      expect(gates[0]?.kind).toBe("waiver");
      expect(gates[0]?.waivedBy).toBe("principal-w");
      expect(gates[1]?.ref).toBe("GH-4010");
    } finally {
      board.cleanup();
    }
  });
});

describe("TC-BOARD-022 gate row extension", () => {
  test("the delivered fields keep their names and the extension is additive", async () => {
    const board = gatesFor([ownerReviewGate("GH-4020", 2 * HOUR_MS)]);
    try {
      const run = await board.run([], { json: true });
      const [gate] = boardGates(run);
      expect(Object.keys(gate ?? {}).sort()).toEqual([
        "age",
        "condition",
        "default",
        "id",
        "kind",
        "owner",
        "ownerSource",
        "ref",
        "repository",
        "slaState",
        "waivedBy",
      ]);
      expect(gate?.repository).toBe(BOARD_REPOSITORY);
      expect(gate?.condition).toBe(`${String(gate?.kind)}:${String(gate?.slaState)}`);
      expect(gate?.owner).toBe("owner");
      expect(gate?.ownerSource).toBe("gate-audience");
    } finally {
      board.cleanup();
    }
  });
});

/**
 * TC-BOARD-024 (remediation, review iter-1 F-5): the edge caps active lanes
 * before phase resolution and carries the omitted count, so the payload's lane
 * omission stays exact and the phase-read cost stays inside NFR-5.
 */
describe("TC-BOARD-024 edge lane-cap omission", () => {
  test("an edge-side lane omission is counted, with no lane row fabricated", async () => {
    const projection = projectBoard({
      audience: "owner",
      scope: "repository",
      selection: "all",
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [],
          lanes: [],
          omittedLanes: 5,
          asks: [],
          parks: [],
          decisions: [],
        },
      ],
      omittedRepositories: 0,
      ownerHold: { active: false },
      policy: shippedPolicy(),
      nowMs: BOARD_NOW_MS,
      nowIso: BOARD_NOW_ISO,
    });
    expect(projection.data.lanes).toEqual([]);
    expect(projection.data.omittedBySection.lanes).toBe(5);
    expect(projection.data.omitted).toBe(5);
    expect(projection.data.truncated).toBe(true);
  });
});

/**
 * TC-BOARD-024 (remediation, review iter-1 F-4): the truncation detector matches
 * the delivered 160-character gate-kind clamp, so a 121–160 character kind is
 * preserved and reported as untruncated.
 */
describe("TC-BOARD-024 gate-kind cap alignment", () => {
  const project = (kind: string) =>
    projectBoard({
      audience: "owner",
      scope: "repository",
      selection: "current",
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [
            {
              id: "GH-9999:custom",
              kind,
              ref: "GH-9999",
              activityAt: new Date(BOARD_NOW_MS - HOUR_MS).toISOString(),
            },
          ],
          lanes: [],
          asks: [],
          parks: [],
          decisions: [],
        },
      ],
      omittedRepositories: 0,
      ownerHold: { active: false },
      policy: shippedPolicy(),
      nowMs: BOARD_NOW_MS,
      nowIso: BOARD_NOW_ISO,
    });

  test("a 130-character kind is preserved and not reported as truncated", () => {
    const kind = "k".repeat(130);
    const projection = project(kind);
    expect(projection.data.gates[0]?.kind).toBe(kind);
    expect(projection.data.truncated).toBe(false);
  });

  test("an over-160 kind is clamped and the clamp marks truncation", () => {
    const projection = project("k".repeat(170));
    expect(Array.from(String(projection.data.gates[0]?.kind))).toHaveLength(160);
    expect(projection.data.truncated).toBe(true);
  });
});
