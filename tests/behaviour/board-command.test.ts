/**
 * TC-SLA-016 and the TC-SLA-023 behaviour half — the surface is exactly
 * `board [--json]`, rejects unknown grammar before any read, is write-free and
 * timer-free in the handler, renders once, and uses only the injected brand.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { availableCollector, boardGates, createBoardHarness } from "../fixtures/board/harness";
import { HOUR_MS, ownerReviewGate } from "../fixtures/board/matrix";

const ROOT = process.cwd();
const GATES = [ownerReviewGate("GH-601", 2 * HOUR_MS), ownerReviewGate("GH-602", 26 * HOUR_MS)];

const harness = (): ReturnType<typeof createBoardHarness> => createBoardHarness({ gates: GATES });

describe("TC-SLA-016 board command grammar and surface", () => {
  test("text mode exits 0, renders a grid, and reads the collector exactly once", async () => {
    let reads = 0;
    const collector = availableCollector("tracker", GATES);
    const item = {
      ...collector,
      read: async () => {
        reads += 1;
        return collector.read();
      },
    };
    const board = createBoardHarness({ collectors: [item] });
    try {
      const run = await board.run([], { json: false });
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toContain("example-product board");
      expect(run.stdout).toContain("GH-601");
      expect(reads).toBe(1);
    } finally {
      board.cleanup();
    }
  });

  test("--json exits 0 with exactly one envelope and the same gates/states", async () => {
    const board = harness();
    try {
      const text = await board.run([], { json: false });
      const json = await board.run([], { json: true });
      expect(json.exitCode).toBe(0);
      expect(json.envelope).toBeDefined();
      expect(assertEnvelopeContract(json.envelope)).toEqual([]);
      const gates = boardGates(json);
      expect(gates).toHaveLength(2);
      expect(gates.map((gate) => gate.id)).toEqual(["GH-602:owner-review", "GH-601:owner-review"]);
      expect(gates.map((gate) => gate.slaState)).toEqual(["escalated", "fresh"]);
      for (const gate of gates) {
        expect(text.stdout).toContain(String(gate.id));
        expect(text.stdout).toContain(String(gate.slaState));
      }
    } finally {
      board.cleanup();
    }
  });

  test("a positional argument is rejected before any collector read", async () => {
    let reads = 0;
    const board = createBoardHarness({
      collectors: [
        {
          id: "tracker",
          read: async () => {
            reads += 1;
            return availableCollector("tracker", GATES).read();
          },
        },
      ],
    });
    try {
      const run = await board.run(["extra"], { json: true });
      expect(run.exitCode).toBe(1);
      expect(run.envelope?.error).toMatchObject({ code: "fallback.invocation" });
      expect(run.envelope).not.toHaveProperty("data");
      expect(reads).toBe(0);
    } finally {
      board.cleanup();
    }
  });

  test("--watch is rejected in both modes before any read", async () => {
    for (const argv of [["--watch"], ["--json", "--watch"]]) {
      let reads = 0;
      const board = createBoardHarness({
        collectors: [
          {
            id: "tracker",
            read: async () => {
              reads += 1;
              return availableCollector("tracker", GATES).read();
            },
          },
        ],
      });
      try {
        const run = await board.run(argv, { json: true });
        expect(run.exitCode).toBe(1);
        expect(run.envelope?.error).toMatchObject({ code: "fallback.invocation" });
        expect(run.stderr).toContain("--watch");
        expect(reads).toBe(0);
      } finally {
        board.cleanup();
      }
    }
  });

  test("--limit is rejected before any read", async () => {
    let reads = 0;
    const board = createBoardHarness({
      collectors: [
        {
          id: "tracker",
          read: async () => {
            reads += 1;
            return availableCollector("tracker", GATES).read();
          },
        },
      ],
    });
    try {
      const run = await board.run(["--limit", "5"], { json: true });
      expect(run.exitCode).toBe(1);
      expect(run.envelope?.error).toMatchObject({ code: "fallback.invocation" });
      expect(reads).toBe(0);
    } finally {
      board.cleanup();
    }
  });

  test("the definition declares no command flags and no positionals", () => {
    const source = readFileSync(join(ROOT, "packages/cli/src/commands/board.ts"), "utf8");
    expect(source).toContain("flags: [],");
    expect(source).toContain("positionals: { max: 0 },");
    expect(source).not.toContain("--watch");
  });

  test("the handler performs no stdout/stderr write and the module has no timer or unbounded loop", () => {
    const source = readFileSync(join(ROOT, "packages/cli/src/commands/board.ts"), "utf8");
    for (const forbidden of [
      "stdout",
      "stderr",
      "console.",
      "setInterval",
      "setTimeout",
      "setImmediate",
      "while (",
    ]) {
      expect(source.includes(forbidden), forbidden).toBe(false);
    }
  });

  test("the command-registry row exists exactly once and names M1-S5", () => {
    const registry = readFileSync(
      join(ROOT, "doc/planning/oss-tooling/cli-command-registry.md"),
      "utf8",
    );
    expect(registry.split("`ados board`").length - 1).toBe(1);
    const row = registry.split("\n").find((line) => line.startsWith("| `ados board` |"));
    expect(row).toContain("M1-S5");
  });

  test("positive control: the valid surface still renders after rejected invocations", async () => {
    const board = harness();
    try {
      expect((await board.run(["extra"], { json: true })).exitCode).toBe(1);
      const valid = await board.run([], { json: false });
      expect(valid.exitCode).toBe(0);
      expect(valid.stdout).toContain("GH-601");
    } finally {
      board.cleanup();
    }
  });
});

describe("TC-SLA-023 brand neutrality", () => {
  test("the synthetic brand prefix is used and no product literal is committed", async () => {
    const board = harness();
    try {
      const run = await board.run([], { json: false });
      expect(run.stdout.startsWith("example-product board")).toBe(true);
      expect(run.stdout).not.toContain("ados");
      const source = readFileSync(join(ROOT, "packages/cli/src/commands/board.ts"), "utf8");
      expect(source).not.toContain("ados");
    } finally {
      board.cleanup();
    }
  });
});
