/**
 * TC-COORD-037 (structure half) — CPU is never read, structurally or
 * behaviourally.
 *
 * The structural scan covers every coordinator domain and state module; the
 * behavioural probe drives a CPU-shaped fixture (a wedged-looking process with
 * high notional CPU) through the artifact-evidence evaluation and proves the
 * verdict is decided by artifacts alone.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { evaluateStuck } from "../../packages/core/src/domain/index";
import { staleBaseline, NOW_MS, STUCK_WINDOW_MS } from "../fixtures/coordinator/evidence";

const ROOT = process.cwd();
const TIERS = ["packages/core/src/domain", "packages/core/src/state"];

const walk = (relative: string): string[] => {
  if (!existsSync(join(ROOT, relative))) return [];
  const results: string[] = [];
  for (const entry of readdirSync(join(ROOT, relative), { withFileTypes: true })) {
    const next = `${relative}/${entry.name}`;
    if (entry.isDirectory()) results.push(...walk(next));
    else if (entry.name.startsWith("coordinator") && entry.name.endsWith(".ts")) {
      results.push(next);
    }
  }
  return results;
};

const coordinatorModules = (tier: string): string[] => walk(tier).sort();

const CPU_MARKERS = [
  "cpuUsage",
  "cpu_percent",
  "cpuPercent",
  "os.cpus",
  "loadavg",
  "process.cpu",
  "%cpu",
  "ps -o %cpu",
  "getrusage",
  "usage.cpu",
];

describe("TC-COORD-037 CPU is never read in the decision path", () => {
  test("no coordinator module reads a CPU signal", () => {
    const violations: string[] = [];
    for (const tier of [...TIERS, "packages/cli/src"]) {
      for (const file of coordinatorModules(tier)) {
        const text = readFileSync(join(ROOT, file), "utf8");
        for (const marker of CPU_MARKERS) {
          if (text.toLowerCase().includes(marker.toLowerCase())) {
            violations.push(`${file}: CPU marker ${marker}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test("the evidence facts declare no CPU field", () => {
    const facts = staleBaseline();
    const keys = Object.keys(facts);
    expect(keys.some((key) => key.toLowerCase().includes("cpu"))).toBe(false);
    expect(keys.sort()).toEqual([
      "answer",
      "expectedAtMs",
      "fingerprintAdvanced",
      "merge",
      "newTurn",
      "nowMs",
      "progressBoundMs",
      "progressObservedAtMs",
      "stuckWindowMs",
    ]);
  });

  test("a CPU-shaped fixture never changes the verdict", () => {
    const verdict = evaluateStuck(
      staleBaseline({
        // The process looks CPU-hot and wedged; artifacts are the only input.
        expectedAtMs: NOW_MS - STUCK_WINDOW_MS - 1,
      }),
    );
    expect(verdict.verdict).toBe("stuck");
    const progressing = evaluateStuck(
      staleBaseline({
        merge: "advanced",
        expectedAtMs: NOW_MS - STUCK_WINDOW_MS - 1,
      }),
    );
    expect(progressing.verdict).toBe("progressing");
  });
});
