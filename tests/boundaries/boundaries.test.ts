/**
 * TC-SCAFFOLD-008..015 — boundary negative fixtures and ambient-global guard.
 *
 * Every case runs in an `mkdtemp` workspace with the production config copied
 * verbatim. Failing cases cruise clean first, then inject; controls cruise once
 * and must stay clean.
 */
import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AMBIENT_SCOPE, scan } from "../../scripts/checks/ambient-globals";
import { AMBIENT_CASES, RULE_CASES } from "./fixtures/cases";
import { cleanup, cruise, materializeWorkspace, writeProbe } from "./harness";

const require = createRequire(import.meta.url);
type ForbiddenRule = {
  name: string;
  severity: string;
  comment?: string;
  from?: { pathNot?: string[] };
};
const config = require("../../.dependency-cruiser.cjs") as { forbidden: ForbiddenRule[] };

describe("dependency-cruiser negative fixtures", () => {
  for (const fixture of RULE_CASES) {
    test(`${fixture.id} → ${fixture.expect === "violation" ? fixture.rule : "clean"}`, () => {
      const root = materializeWorkspace(fixture.packages, fixture.extraFiles);
      try {
        if (fixture.expect === "violation") {
          const before = cruise(root);
          expect({ status: before.status, violations: before.violations }).toEqual({
            status: 0,
            violations: [],
          });
        }
        writeProbe(root, fixture.probe, fixture.source);
        const after = cruise(root);
        if (fixture.expect === "clean") {
          expect(after.violations).toEqual([]);
          expect(after.status).toBe(0);
        } else {
          expect(after.status).not.toBe(0);
          expect(after.violations.map((violation) => violation.rule)).toContain(fixture.rule);
        }
      } finally {
        cleanup(root);
      }
    }, 120_000);
  }
});

describe("ambient-global guard", () => {
  for (const fixture of AMBIENT_CASES) {
    test(`${fixture.id} → ${fixture.expect === "violation" ? fixture.rule : "clean"}`, () => {
      const root = mkdtempSync(join(tmpdir(), "ambient-fixture-"));
      try {
        writeProbe(root, fixture.probe, fixture.source);
        const violations = scan(root);
        if (fixture.expect === "clean") {
          expect(violations).toEqual([]);
        } else {
          expect(violations.map((violation) => violation.rule)).toContain(fixture.rule);
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

describe("ADR-verbatim scope and allowlist assertions", () => {
  test("ambient guard scope equals the ADR neutral set exactly", () => {
    // Literal ADR strings on purpose: an assertion built from the exported
    // constants would move with any coordinated narrowing of the guard scope.
    expect([...AMBIENT_SCOPE.files]).toEqual(["packages/core/src/index.ts"]);
    expect([...AMBIENT_SCOPE.directories]).toEqual([
      "packages/core/src/contracts",
      "packages/core/src/domain",
      "packages/core/src/app",
      "packages/core/src/config",
      "packages/core/src/branding",
    ]);
  });

  test("runtime-apis-confinement names all four ADR allowlist locations", () => {
    const rule = config.forbidden.find((entry) => entry.name === "runtime-apis-confinement");
    expect(rule).toBeDefined();
    const comment = rule?.comment ?? "";
    for (const location of [
      "core ./state",
      "adapter I/O subpaths",
      "CLI build",
      "OpenCode host integration",
    ]) {
      expect(comment).toContain(location);
    }
    const pathNot = rule?.from?.pathNot ?? [];
    // The adapter exemption is ADR-verbatim I/O subpaths only (DEC-6):
    // provider (gitlab/jira/github/azure/ci) and registry subpaths are not I/O.
    // GH-174 D8 tightens the state allowance from the whole state tree to the
    // driver edge (no rule is weakened; the state facade and verifier stay
    // runtime-neutral and the tightening ships with failing fixtures).
    expect([...pathNot]).toEqual([
      "^packages/core/src/state/driver/",
      "^packages/adapters/src/(repo|file|host|session|legacy)/",
      "^packages/cli/",
      "^packages/opencode/",
    ]);
  });
});
