/**
 * GH-406 TC-DPKNAM-001/002 — the new-code naming rule's own tests.
 *
 * The check passes on the live tree with the committed reason-bearing
 * baseline, and the mutation cases prove the rule fires: a reason-less
 * baseline entry, an unknown post-base offender, the pre-base exemption, and
 * a clean post-base file. Every case runs against the injected-input core or
 * the seamed tree scan, so no mutation ever writes into the committed tree.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BASE_COMMIT,
  BASELINE_PATH,
  findTokenLines,
  isGovernedPath,
  type NamingBaseline,
  type NamingSourceFile,
  SCHEMA_VERSION,
  scanNaming,
  scanTree,
  TOKEN,
  validateBaseline,
} from "../../scripts/checks/new-code-naming";

const ROOT = process.cwd();

const baselineOf = (entries: NamingBaseline["entries"]): NamingBaseline => ({
  schemaVersion: SCHEMA_VERSION,
  baseCommit: BASE_COMMIT,
  token: TOKEN,
  entries,
});

const file = (path: string, text: string): NamingSourceFile => ({ path, text });

const preBase = new Set<string>(["packages/core/src/app/state-scope.ts"]);

describe("TC-DPKNAM-001 the naming rule holds over the real tree", () => {
  test("the live tree passes with the committed baseline", () => {
    const outcome = scanTree(ROOT);
    expect(outcome.failures).toEqual([]);
    expect(outcome.violations).toEqual([]);
    expect(outcome.scanned).toBeGreaterThan(0);
    expect(outcome.baselineEntries).toBeGreaterThanOrEqual(2);
  });

  test("every committed baseline entry carries a non-empty reason", () => {
    const baseline = JSON.parse(readFileSync(join(ROOT, BASELINE_PATH), "utf8")) as NamingBaseline;
    expect(baseline.entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of baseline.entries) {
      expect(entry.path.length).toBeGreaterThan(0);
      expect(entry.reason.trim().length).toBeGreaterThan(0);
    }
  });

  test("the base constant is a full pinned SHA and matches the baseline", () => {
    expect(BASE_COMMIT).toMatch(/^[0-9a-f]{40}$/u);
    const baseline = JSON.parse(readFileSync(join(ROOT, BASELINE_PATH), "utf8")) as NamingBaseline;
    expect(baseline.baseCommit).toBe(BASE_COMMIT);
  });
});

describe("TC-DPKNAM-002 the check is mutation-tested over injected inputs", () => {
  test("mutation A: a baseline entry without a reason fails naming the entry", () => {
    const failures = validateBaseline(
      baselineOf([{ path: "packages/core/src/app/new-module.ts", reason: "  " }]),
    );
    expect(
      failures.some((message) => message.includes("packages/core/src/app/new-module.ts")),
    ).toBe(true);
    expect(failures.some((message) => message.includes("non-empty reason"))).toBe(true);
  });

  test("mutation B: an unlisted post-base file carrying the token fails naming the file and line", () => {
    const outcome = scanNaming({
      baseFiles: preBase,
      baseline: baselineOf([]),
      files: [file("packages/core/src/app/rogue.ts", 'const rogue = { projectKey: "x" };\n')],
    });
    expect(outcome.failures).toEqual([]);
    expect(outcome.violations).toEqual([{ file: "packages/core/src/app/rogue.ts", line: 1 }]);
  });

  test("mutation C: a pre-base file carrying the token is exempt with no counts consulted", () => {
    const outcome = scanNaming({
      baseFiles: preBase,
      baseline: baselineOf([]),
      files: [
        file(
          "packages/core/src/app/state-scope.ts",
          "export const k = (m: { projectKey: string }): string => m.projectKey;\n",
        ),
      ],
    });
    expect(outcome.failures).toEqual([]);
    expect(outcome.violations).toEqual([]);
  });

  test("mutation D: a clean post-base file passes", () => {
    const outcome = scanNaming({
      baseFiles: preBase,
      baseline: baselineOf([]),
      files: [file("tests/structure/new-suite.test.ts", 'const cloneKey = "a-0123abcd";\n')],
    });
    expect(outcome.failures).toEqual([]);
    expect(outcome.violations).toEqual([]);
  });

  test("a covered post-base file passes and a near-miss identifier is not bare", () => {
    const baseline = baselineOf([
      {
        path: "tests/behaviour/fixture-naming.test.ts",
        reason: "Pins the delivered persisted field names unchanged (zero-rename fence).",
      },
    ]);
    const outcome = scanNaming({
      baseFiles: preBase,
      baseline,
      files: [
        file(
          "tests/behaviour/fixture-naming.test.ts",
          'const declaredProjectKey = "p"; const embedded = "xprojectKey"; const suffixed = projectKeySuffix;\n',
        ),
      ],
    });
    expect(outcome.violations).toEqual([]);
    expect(outcome.failures).toEqual([]);
  });

  test("a post-base markdown or JSON file is outside the declared source surface", () => {
    expect(isGovernedPath("doc/changes/2026-11/spec.md")).toBe(false);
    expect(isGovernedPath("scripts/checks/new-code-naming.baseline.json")).toBe(false);
    expect(isGovernedPath("tools/example")).toBe(false);
    expect(isGovernedPath("packages/core/src/contracts/projects.ts")).toBe(true);
    expect(isGovernedPath("tests/structure/x.test.ts")).toBe(true);
    expect(isGovernedPath("scripts/checks/y.ts")).toBe(true);
  });

  test("the bare-token matcher reports exact lines and skips non-bare occurrences", () => {
    expect(
      findTokenLines(
        'const a = "projectKey";\nconst b = xprojectKey;\nconst c = projectKeySuffix;\nconst d = m.projectKey;\n',
        TOKEN,
      ),
    ).toEqual([1, 4]);
  });

  test("an unreachable base fails closed naming the constant", () => {
    const outcome = scanTree(ROOT, {
      resolveBaseFiles: () => ({ failure: "git unavailable in this fixture" }),
      listFiles: () => [],
    });
    expect(outcome.failures).toEqual(["git unavailable in this fixture"]);
    expect(outcome.violations).toEqual([]);
  });

  test("a baseline whose baseCommit drifts from the constant fails closed naming both", () => {
    const drifted = { ...baselineOf([]), baseCommit: "0".repeat(40) };
    const outcome = scanTree(ROOT, { baseline: drifted, listFiles: () => [] });
    expect(outcome.failures).toHaveLength(1);
    expect(outcome.failures[0]).toContain("0".repeat(40));
    expect(outcome.failures[0]).toContain(BASE_COMMIT);
  });
});

describe("TC-DPKNAM-002 the seamed tree scan applies the committed baseline", () => {
  test("a synthetic post-base offender surfaces through scanTree's seams", () => {
    const offender = "tests/structure/synthetic-offender.ts";
    const outcome = scanTree(ROOT, {
      resolveBaseFiles: () => ({ files: new Set<string>() }),
      listFiles: () => [offender],
      readText: () => 'const row = { projectKey: "x-0123abcd" };\n',
    });
    expect(outcome.failures).toEqual([]);
    expect(outcome.violations).toEqual([{ file: offender, line: 1 }]);
  });

  test("the committed baseline covers a synthetic post-base file that spells the token", () => {
    const outcome = scanTree(ROOT, {
      resolveBaseFiles: () => ({ files: new Set<string>() }),
      listFiles: () => ["tests/checks/new-code-naming.test.ts"],
      readText: () => 'const token = "projectKey";\n',
    });
    expect(outcome.failures).toEqual([]);
    expect(outcome.violations).toEqual([]);
  });
});
