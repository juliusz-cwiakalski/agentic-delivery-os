/**
 * TC-SLA-017 and TC-SLA-018 — the machine envelope and `gates[]` record set,
 * and the human aging grid's parity, unknown-age token, TTY independence, and
 * brand-derived header.
 */
import { describe, expect, test } from "bun:test";
import {
  BOARD_MAX_HUMAN_BYTES,
  BOARD_MAX_HUMAN_LINES,
  BOARD_SCHEMA_VERSION,
  OWNER_GATE_KINDS,
  OWNER_GATE_SLA_STATES,
} from "../../packages/core/src/contracts/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { boardData, boardGates, createBoardHarness } from "../fixtures/board/harness";
import { gateFact, HOUR_MS, ownerReviewGate, waiverGate } from "../fixtures/board/matrix";

const MIXED = [
  ownerReviewGate("GH-1001", 10 * HOUR_MS),
  ownerReviewGate("GH-1002", 26 * HOUR_MS),
  waiverGate("GH-1003", 72 * HOUR_MS),
  gateFact({ id: "GH-1004", absent: "missing" }),
  gateFact({ id: "GH-1005", activityAt: "not-a-date" }),
  ownerReviewGate("GH-1006", 100 * HOUR_MS, { waivedBy: "owner" }),
  ownerReviewGate("GH-1007", 73 * HOUR_MS),
];

const EXPECTED_ORDER = [
  "GH-1004",
  "GH-1005",
  "GH-1006:owner-review",
  "GH-1007:owner-review",
  "GH-1002:owner-review",
  "GH-1003:waiver",
  "GH-1001:owner-review",
];

describe("TC-SLA-017 machine envelope and gates[] record contract", () => {
  test("exactly one JSON document with the exact envelope and data shape", async () => {
    const board = createBoardHarness({ gates: MIXED });
    try {
      const run = await board.run([], { json: true });
      expect(run.stdout.endsWith("\n")).toBe(true);
      expect(() => JSON.parse(run.stdout.trim())).not.toThrow();
      expect(run.exitCode).toBe(0);
      expect(assertEnvelopeContract(run.envelope)).toEqual([]);
      expect(Object.keys(run.envelope ?? {}).sort()).toEqual(
        ["data", "exitCode", "runId", "schemaVersion", "timing"].sort(),
      );
      expect(run.envelope).not.toHaveProperty("error");
      const data = boardData(run);
      expect(data?.schemaVersion).toBe(BOARD_SCHEMA_VERSION);
      expect(Array.isArray(data?.gates)).toBe(true);
      expect(data?.truncated).toBe(false);
      expect(data?.omitted).toBe(0);
      expect(data?.collectors).toEqual([{ collector: "tracker", outcome: "available" }]);
    } finally {
      board.cleanup();
    }
  });

  test("every gate carries exactly the declared key set plus the marker when age is null", async () => {
    const board = createBoardHarness({ gates: MIXED });
    try {
      const run = await board.run([], { json: true });
      for (const gate of boardGates(run)) {
        const keys = Object.keys(gate).sort();
        const expected = ["age", "default", "id", "kind", "ref", "slaState", "waivedBy"];
        if (gate.age === null) expected.push("ageUnknownReason");
        expect(keys).toEqual(expected.sort());
        expect(OWNER_GATE_KINDS).toContain(gate.kind as (typeof OWNER_GATE_KINDS)[number]);
        expect(OWNER_GATE_SLA_STATES).toContain(
          gate.slaState as (typeof OWNER_GATE_SLA_STATES)[number],
        );
        expect(gate.age === null).toBe(Object.hasOwn(gate, "ageUnknownReason"));
        if (gate.slaState !== "default-applied") expect(gate.default).toBeNull();
        if (gate.waivedBy !== null) expect(gate.id).toBe("GH-1006:owner-review");
      }
    } finally {
      board.cleanup();
    }
  });

  test("the mixed population yields the exact ranked tuples with no duplicates", async () => {
    const board = createBoardHarness({ gates: MIXED });
    try {
      const run = await board.run([], { json: true });
      const gates = boardGates(run);
      expect(gates.map((gate) => gate.id)).toEqual(EXPECTED_ORDER);
      expect(new Set(gates.map((gate) => gate.id)).size).toBe(gates.length);
      const byId = new Map(gates.map((gate) => [gate.id, gate]));
      expect(byId.get("GH-1002:owner-review")).toMatchObject({
        slaState: "escalated",
        default: null,
      });
      expect(byId.get("GH-1003:waiver")).toMatchObject({
        slaState: "default-applied",
        default: "owner-review-first",
        waivedBy: null,
      });
      expect(byId.get("GH-1006:owner-review")).toMatchObject({
        slaState: "escalated",
        default: null,
        waivedBy: "owner",
      });
      expect(byId.get("GH-1004")).toMatchObject({
        age: null,
        ageUnknownReason: "activity-timestamp-absent",
        slaState: "escalated",
      });
      expect(byId.get("GH-1005")).toMatchObject({
        age: null,
        ageUnknownReason: "activity-timestamp-unparseable",
        slaState: "escalated",
      });
    } finally {
      board.cleanup();
    }
  });

  test("the payload carries no human prose, title, raw provider payload, or duplicate gate data", async () => {
    const board = createBoardHarness({ gates: MIXED });
    try {
      const run = await board.run([], { json: true });
      const text = run.stdout;
      expect(text).not.toContain("owner hand back");
      expect(text).not.toContain("planted-board-");
      expect(text.split('"gates"').length - 1).toBe(1);
    } finally {
      board.cleanup();
    }
  });
});

describe("TC-SLA-018 text aging grid parity and determinism", () => {
  test("one line per rendered gate in rank order, with machine-parity values", async () => {
    const board = createBoardHarness({ gates: MIXED });
    try {
      const json = await board.run([], { json: true });
      const text = await board.run([], { json: false });
      const lines = text.stdout.trimEnd().split("\n");
      expect(lines[0]?.startsWith("example-product board")).toBe(true);
      const gateLines = lines.filter((line) => line.includes("  age="));
      const machineGates = boardGates(json);
      expect(gateLines).toHaveLength(machineGates.length);
      for (const [index, gate] of machineGates.entries()) {
        const line = gateLines[index] ?? "";
        expect(line).toContain(String(gate.id));
        expect(line).toContain(String(gate.kind));
        expect(line).toContain(String(gate.ref));
        expect(line).toContain(`sla=${String(gate.slaState)}`);
        expect(line).toContain(`default=${String(gate.default ?? "null")}`);
        expect(line).toContain(`waivedBy=${String(gate.waivedBy ?? "null")}`);
      }
    } finally {
      board.cleanup();
    }
  });

  test("unknown age renders the declared unknown token, never 0h, fresh, or a fabricated duration", async () => {
    const board = createBoardHarness({ gates: MIXED });
    try {
      const text = await board.run([], { json: false });
      expect(text.stdout).toContain("unknown:activity-timestamp-absent");
      expect(text.stdout).toContain("unknown:activity-timestamp-unparseable");
      expect(text.stdout).not.toContain("age=0h");
      expect(text.stdout).not.toContain("unknown:0");
    } finally {
      board.cleanup();
    }
  });

  test("the grid is ANSI-free and byte-identical across runs", async () => {
    const first = createBoardHarness({ gates: MIXED });
    const second = createBoardHarness({ gates: MIXED });
    try {
      const one = await first.run([], { json: false });
      const two = await second.run([], { json: false });
      expect(one.stdout).toBe(two.stdout);
      expect(one.stdout.includes(String.fromCharCode(27))).toBe(false);
    } finally {
      first.cleanup();
      second.cleanup();
    }
  });

  test("the human grid is within the NFR-4 line and byte bounds", async () => {
    const board = createBoardHarness({ gates: MIXED });
    try {
      const run = await board.run([], { json: false });
      const lines = run.stdout.trimEnd().split("\n");
      expect(lines.length).toBeLessThanOrEqual(BOARD_MAX_HUMAN_LINES);
      expect(Buffer.byteLength(run.stdout, "utf8")).toBeLessThanOrEqual(BOARD_MAX_HUMAN_BYTES);
    } finally {
      board.cleanup();
    }
  });

  test("observed-empty renders an explicit evidence line, not a failure", async () => {
    const board = createBoardHarness({ gates: [] });
    try {
      const run = await board.run([], { json: false });
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toContain("observed-empty");
      expect(run.stdout).toContain("tracker:available");
    } finally {
      board.cleanup();
    }
  });
});
