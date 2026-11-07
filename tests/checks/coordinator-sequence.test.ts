/**
 * TC-COORD-001..003 — the coordinator J1 sequence is ordered, the lifecycle
 * merge path is `merge`, retained bash stays primary, and `queue plan` next
 * actions are consumed.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ceo = readFileSync(join(ROOT, ".opencode/agent/ceo.md"), "utf8");
const retained = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/prompt-inventory/retained-retired.json"), "utf8"),
) as {
  readonly retained: readonly {
    readonly id: string;
    readonly entry: string;
    readonly primary: boolean;
  }[];
  readonly retired: readonly { readonly id: string; readonly literal: string }[];
};

const NEGATIONS = [/\bnever\b/i, /\bnot\b/i, /\bdo not\b/i, /\bdon't\b/i];

const nonNegatedLines = (text: string): readonly string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !NEGATIONS.some((pattern) => pattern.test(line)));

describe("TC-COORD-001 the J1 sequence is ordered and avoids raw merge/discovery", () => {
  test("status precedes blockers answer, finalization, merge, closeout, and queue plan", () => {
    const line = ceo.split("\n").find((entry) => entry.includes("Coordinated iteration"));
    expect(line).toBeDefined();
    if (line === undefined) return;
    const order = [
      "status",
      "blockers answer",
      "verify change",
      "phase list",
      "merge",
      "closeout --apply",
      "queue plan --next N",
    ];
    let cursor = -1;
    for (const token of order) {
      const index = line.indexOf(token);
      expect(index, token).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  test("no non-negated lifecycle prompt line uses a platform merge or PR-list discovery path", () => {
    const failures = nonNegatedLines(ceo).filter((line) =>
      ["gh pr merge", "glab mr merge", "gh pr list"].some((literal) => line.includes(literal)),
    );
    expect(failures).toEqual([]);
  });

  test("the coordinator verifies finalization and merges through the primitive", () => {
    expect(ceo).toContain("verify change <ref>");
    expect(ceo).toContain("phase list <ref>");
    expect(ceo).toContain("merge <ref>");
    expect(ceo).toContain("merge <ref> --dry-run");
  });
});

describe("TC-COORD-002/003 retained bash and next actions", () => {
  test("retained bash entry points are primary and named", () => {
    for (const entry of retained.retained) {
      expect(entry.primary).toBe(true);
      expect(ceo).toContain(entry.entry);
    }
    expect(retained.retired.some((entry) => entry.id === "platform-merge")).toBe(true);
  });

  test("no prompt claims dispatch or the resident daemon", () => {
    const claims = nonNegatedLines(ceo).filter(
      (line) => /\bdispatch\b/i.test(line) || /\bdaemon\b/i.test(line),
    );
    // The retained per-ticket delivery is a script call, not the undelivered dispatch primitive.
    expect(claims.filter((line) => line.includes("dispatch <"))).toEqual([]);
  });

  test("queue plan next actions and reasons are consumed", () => {
    expect(ceo).toContain("queue plan --next");
    expect(ceo).toContain("nextActions");
  });
});
