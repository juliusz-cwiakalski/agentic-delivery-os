/**
 * TC-EVT-010 and TC-EVT-012 (golden half) — the committed reference pages are
 * the surface's byte-exact output, and the goldens are generated only by the
 * documented command.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSurfaceHarness } from "../fixtures/events/surface-harness";

const ROOT = process.cwd();
const GOLDENS = "tests/fixtures/events/goldens";

const goldenBody = (file: string): string => {
  const text = readFileSync(join(ROOT, GOLDENS, file), "utf8");
  const index = text.indexOf("--- output ---\n");
  expect(index).toBeGreaterThanOrEqual(0);
  return text.slice(index + "--- output ---\n".length);
};

const CASES = [
  { argv: ["events", "list"], file: "events-list.txt" },
  { argv: ["events", "describe", "queue.graph"], file: "events-describe-queue-graph.txt" },
  { argv: ["events", "describe", "lanes"], file: "events-describe-lanes.txt" },
] as const;

describe("events reference page goldens", () => {
  for (const golden of CASES) {
    test(`${golden.argv.join(" ")} equals ${golden.file} byte-for-byte`, async () => {
      const run = await createSurfaceHarness().run(golden.argv);
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toBe(goldenBody(golden.file));
    });
  }

  test("each golden carries its generation header naming the documented command", () => {
    for (const golden of CASES) {
      const text = readFileSync(join(ROOT, GOLDENS, golden.file), "utf8");
      expect(text.startsWith("# GH-290 ")).toBe(true);
      expect(text).toContain("pnpm exec bun run the events renderer");
    }
  });
});
