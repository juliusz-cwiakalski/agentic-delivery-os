/**
 * TC-PSCAN-005 / help coverage — both deterministic scans are wired into CI and
 * the aggregate gate so later prompt or guide edits cannot drift.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ci = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  readonly scripts: Readonly<Record<string, string>>;
};

describe("ci checks wiring", () => {
  test("CI runs the aggregate gate that includes both scans", () => {
    expect(ci).toContain("pnpm check");
    expect(ci).toContain("scripts/checks/prompt-conformance.ts");
    expect(ci).toContain("scripts/checks/help-guide-coverage.ts");
    expect(manifest.scripts.check).toContain("scripts/checks/prompt-conformance.ts");
    expect(manifest.scripts.check).toContain("scripts/checks/help-guide-coverage.ts");
  });

  test("both scans have a dedicated script and a test suite", () => {
    expect(manifest.scripts["check:prompt"]).toContain("prompt-conformance");
    expect(manifest.scripts["check:help"]).toContain("help-guide-coverage");
    for (const file of [
      "tests/checks/prompt-conformance.test.ts",
      "tests/checks/prompt-conformance-mutants.test.ts",
      "tests/checks/help-guide-coverage.test.ts",
      "tests/checks/help-guide-coverage-mutants.test.ts",
    ]) {
      expect(readFileSync(join(ROOT, file), "utf8").length).toBeGreaterThan(0);
    }
  });
});
