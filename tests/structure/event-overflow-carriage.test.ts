/**
 * TC-EVT-041 (structure half) — the declared `overflow` and the frame's
 * `overflow` come from one constant, and the degradation path carries no second
 * literal.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OVERFLOW_VALUES,
  TAXONOMY,
  TAXONOMY_OVERFLOW,
  validateTaxonomy,
} from "../../packages/core/src/contracts/taxonomy";

const ROOT = process.cwd();
const SESSION_PATH = "packages/core/src/domain/control-session.ts";
const DEGRADATION_PATHS = [SESSION_PATH, "packages/core/src/app/control-server.ts"];

describe("TC-EVT-041 overflow carriage", () => {
  test("the closed value set is exactly repoll and every topic declares it", () => {
    expect([...OVERFLOW_VALUES]).toEqual(["repoll"]);
    expect(TAXONOMY_OVERFLOW).toBe("repoll");
    for (const topic of TAXONOMY.topics) expect(topic.overflow).toBe(TAXONOMY_OVERFLOW);
  });

  test("the degradation path imports the constant and carries no second repoll literal", () => {
    const failures: string[] = [];
    for (const path of DEGRADATION_PATHS) {
      const text = readFileSync(join(ROOT, path), "utf8");
      if (path === SESSION_PATH && !text.includes("TAXONOMY_OVERFLOW"))
        failures.push(`${path}: does not import the constant`);
      const literals = text.match(/"repoll"/gu) ?? [];
      if (literals.length > 0) failures.push(`${path}: second literal ${literals.length}`);
    }
    expect(failures).toEqual([]);
  });

  test("an unknown overflow value is refused by the closed-value integrity check", () => {
    const mutant = JSON.parse(JSON.stringify(TAXONOMY)) as {
      topics: { name: string; overflow: string }[];
    };
    const queue = mutant.topics.find((topic) => topic.name === "queue");
    if (queue !== undefined) queue.overflow = "drop";
    const violations = validateTaxonomy(mutant);
    expect(
      violations.some((violation) => violation.topic === "queue" && violation.field === "overflow"),
    ).toBe(true);
  });

  test("the delivered degraded marker and reason vocabulary are untouched", () => {
    const session = readFileSync(join(ROOT, DEGRADATION_PATHS[0] as string), "utf8");
    expect(session).toContain('degraded: "subscriber-overflow"');
    expect(session).toContain("TAXONOMY_VERSION");
  });
});
