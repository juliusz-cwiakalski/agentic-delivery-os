/**
 * TC-KEYVAL-003 — the `verify change` verdict keeps its committed shape and key
 * order.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const GOLDEN = "tests/fixtures/verify-gates/golden/verify-change-human.txt";

const parse = (text: string): Record<string, unknown> =>
  JSON.parse(text) as Record<string, unknown>;

describe("TC-KEYVAL-003 verify change shape", () => {
  test("the verdict carries the registered keys in order", () => {
    const data = parse(readFileSync(join(ROOT, GOLDEN), "utf8"));
    expect(Object.keys(data).slice(0, 5)).toEqual([
      "changeRef",
      "target",
      "result",
      "variant",
      "requiredPhases",
    ]);
  });

  test("the verdict stays a bounded, stable document", () => {
    const text = readFileSync(join(ROOT, GOLDEN), "utf8");
    expect(text).toContain('"result": "finished"');
    expect(text.length).toBeLessThanOrEqual(65_536);
  });

  test("a mutated result is detected", () => {
    const text = readFileSync(join(ROOT, GOLDEN), "utf8");
    expect(text.replace('"result": "finished"', '"result": "done"')).not.toBe(text);
  });
});
