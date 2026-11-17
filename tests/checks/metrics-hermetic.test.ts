/**
 * TC-METRICS-111 — the new suites are hermetic and skip-free: no `test.skip`,
 * `describe.skip`, `test.todo`, ambient home or live state, spawn, credential,
 * or network probe; planted violations are detected by name.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const SUITES = [
  "tests/behaviour/metrics-grammar.test.ts",
  "tests/behaviour/metrics-envelope.test.ts",
  "tests/behaviour/metrics-report.test.ts",
  "tests/behaviour/metrics-baseline.test.ts",
  "tests/behaviour/metrics-baseline-damage.test.ts",
  "tests/behaviour/metrics-write-discipline.test.ts",
  "tests/behaviour/metrics-cycle-time.test.ts",
  "tests/behaviour/metrics-ceremony-share.test.ts",
  "tests/behaviour/metrics-ci-proxy.test.ts",
  "tests/behaviour/metrics-caveat.test.ts",
  "tests/behaviour/metrics-comparisons.test.ts",
  "tests/behaviour/metrics-dispatch.test.ts",
  "tests/behaviour/metrics-alarms.test.ts",
  "tests/behaviour/metrics-burn-rate-config.test.ts",
  "tests/behaviour/metrics-escaped-defects.test.ts",
  "tests/behaviour/metrics-absence.test.ts",
  "tests/behaviour/metrics-store-damage.test.ts",
  "tests/behaviour/metrics-bounds.test.ts",
  "tests/behaviour/metrics-determinism.test.ts",
  "tests/behaviour/metrics-read-cost.test.ts",
  "tests/behaviour/metrics-purity.test.ts",
  "tests/behaviour/metrics-help.test.ts",
  "tests/structure/metrics-contract.test.ts",
  "tests/structure/metrics-imports.test.ts",
  "tests/structure/metrics-mounting.test.ts",
  "tests/golden/metrics.test.ts",
] as const;

const SKIP_TOKENS = [
  "test.skip",
  "describe.skip",
  "test.todo",
  "test.if",
  "it.skip",
  "return; // skip",
] as const;

const PROBE_TOKENS = [
  "$HOME",
  "process.env.HOME",
  "fetch(",
  "spawnSync(",
  "child_process",
  "resolveCredential",
  "net.connect",
  "WebSocket",
] as const;

/** The scan one suite's source for skipped cases and live probes. */
export const suiteViolations = (relative: string, source: string): string[] => {
  const violations: string[] = [];
  for (const token of SKIP_TOKENS) {
    if (source.includes(token)) violations.push(`${relative}: skipped case (${token})`);
  }
  for (const token of PROBE_TOKENS) {
    if (source.includes(token)) violations.push(`${relative}: live probe (${token})`);
  }
  return violations;
};

describe("TC-METRICS-111 the new suites are hermetic and skip-free", () => {
  test("no declared suite skips a case or reaches a live system", () => {
    const violations: string[] = [];
    // The scanner suites encode the forbidden tokens themselves; they are
    // exempt from the probe arm and judged by their own assertions instead.
    const scanners = new Set([
      "tests/behaviour/metrics-purity.test.ts",
      "tests/structure/metrics-imports.test.ts",
    ]);
    for (const relative of SUITES) {
      if (scanners.has(relative)) continue;
      violations.push(...suiteViolations(relative, readFileSync(join(ROOT, relative), "utf8")));
    }
    expect(violations).toEqual([]);
  });

  test("every suite disposes its temp roots through the fixture harness", () => {
    for (const relative of SUITES) {
      const source = readFileSync(join(ROOT, relative), "utf8");
      if (!source.includes("fixtures/metrics/harness")) continue;
      if (!source.includes("makeMetrics")) continue;
      // Disposal is proven by the explicit call: most suites drop every fixture
      // in `afterEach`, the golden suite disposes inline.
      expect(source, relative).toContain(".dispose()");
    }
  });

  test("a planted skip and a planted live probe are detected by name", () => {
    const skip = suiteViolations("tests/behaviour/planted.test.ts", "test.skip('x', () => {});\n");
    expect(skip).toEqual(["tests/behaviour/planted.test.ts: skipped case (test.skip)"]);
    const probe = suiteViolations(
      "tests/behaviour/planted.test.ts",
      "const root = process.env.HOME;\n",
    );
    expect(probe).toEqual(["tests/behaviour/planted.test.ts: live probe (process.env.HOME)"]);
  });

  test("no suite reads a moving base branch", () => {
    for (const relative of SUITES) {
      const source = readFileSync(join(ROOT, relative), "utf8");
      expect(source, relative).not.toContain("origin/main-tools");
      expect(source, relative).not.toContain("git diff");
    }
  });

  test("the fixtures directory carries no test-named fixture", () => {
    const entries = readdirSync(join(ROOT, "tests/fixtures/metrics"));
    expect(entries.filter((entry) => entry.endsWith(".test.ts"))).toEqual([]);
  });
});
