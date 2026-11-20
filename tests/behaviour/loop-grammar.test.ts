/**
 * TC-VERB-001/002/005, TC-PARITY-002/009 (GH-348 API-1..API-5, API-7; §8.5).
 *
 * Every verb × declared flag set performs its effect, every malformed form is a
 * grammar refusal at exit 1 with zero appends, the delivered global flags are
 * accepted everywhere, a driver-reported clean end is a success, and no shell
 * environment knob participates.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createLoopHarness } from "../fixtures/loop/harness";

const ROOT = process.cwd();

describe("TC-VERB-001 every verb × declared flag set performs its declared effect", () => {
  const green = [
    ["loop", "start", "--foreground"],
    ["loop", "start", "--foreground", "--fresh-budget"],
    ["loop", "stop"],
    ["loop", "stop", "--mode", "drain"],
    ["loop", "stop", "--mode", "immediate"],
    ["loop", "status"],
    ["loop", "reset"],
  ] as const;

  test("each green row exits 0 and returns its declared payload", async () => {
    for (const argv of green) {
      const harness = createLoopHarness({ label: `grammar-${argv.join("-")}` });
      const result = await harness.run([...argv, "--json"]);
      expect(result.code, argv.join(" ")).toBe(0);
      const data = harness.dataOf(result);
      expect(data, argv.join(" ")).toBeDefined();
    }
  });

  test("a clean end is the cycle driver's declared end with state=stopped", async () => {
    const harness = createLoopHarness({ label: "grammar-clean-end" });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    const data = harness.dataOf(result);
    expect(data.state).toBe("stopped");
    expect(data.released).toBe(true);
    const records = harness.coordinatorRecords();
    if (records.ok) expect(records.fences.at(-1)?.action).toBe("released");
  });
});

describe("TC-VERB-002 every malformed form is a grammar refusal at exit 1", () => {
  const malformed = [
    ["loop"],
    ["loop", "bogus"],
    ["loop", "start"],
    ["loop", "status", "--foreground"],
    ["loop", "status", "--fresh-budget"],
    ["loop", "stop", "--mode", "later"],
    ["loop", "reset", "--mode", "drain"],
    ["loop", "log", "--lines", "0"],
    ["loop", "log", "--lines", "101"],
    ["loop", "log", "--lines", "abc"],
  ] as const;

  for (const argv of malformed) {
    test(`${argv.join(" ")} refuses with fallback.invocation and zero appends`, async () => {
      const harness = createLoopHarness({ label: "grammar-refusal" });
      const before = harness.counters.appends;
      const result = await harness.run([...argv, "--json"]);
      expect(result.code).toBe(1);
      expect(harness.errorCodeOf(result)).toBe("fallback.invocation");
      expect(harness.counters.appends).toBe(before);
    });
  }

  test("the shell's usage exit 2 is NOT the typed behaviour (parity 2)", async () => {
    const harness = createLoopHarness({ label: "parity-002" });
    const result = await harness.run(["loop", "bogus", "--json"]);
    expect(result.code).not.toBe(2);
    expect(result.code).toBe(1);
  });

  test("the delivered global flags are accepted on every verb (R-21)", async () => {
    for (const verb of [["status"], ["log"], ["stop"], ["reset"]]) {
      const harness = createLoopHarness({ label: "globals" });
      const result = await harness.run(["loop", ...verb, "--json", "--verbose", "--pretty"]);
      expect(result.code, verb.join(" ")).toBe(0);
    }
  });
});

describe("TC-VERB-005 every exit is the delivered projection of its identity", () => {
  test("a folded stop is a success at 0, not a refusal", async () => {
    const harness = createLoopHarness({ label: "verb-005" });
    await harness.run(["loop", "stop", "--json"]);
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.dataOf(result).state).toBe("stopped");
  });
});

describe("TC-PARITY-009 no CEO_LOOP_* environment knob participates", () => {
  test("the loop modules read no ambient environment and the loop is unbounded", () => {
    for (const file of [
      "packages/cli/src/commands/loop.ts",
      "packages/core/src/app/loop-supervisor.ts",
      "packages/core/src/app/loop-session.ts",
    ]) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text, file).not.toContain("CEO_LOOP");
      expect(text, file).not.toContain("process.env");
      expect(text, file).not.toContain("MAX_ITERATIONS");
    }
  });
});
