/**
 * TC-SCAFFOLD-008..015 — boundary negative fixtures and ambient-global guard.
 *
 * Every case runs in an `mkdtemp` workspace with the production config copied
 * verbatim. Failing cases cruise clean first, then inject; controls cruise once
 * and must stay clean.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
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
    // The adapter exemption is ADR-verbatim I/O subpaths only (DEC-6) plus the
    // credentials implementation (GH-181) and, per ADR-0005 (GH-188), the three
    // exact provider client subpaths that perform network I/O. Provider and
    // registry entries are exact paths, never a pattern widening: `azure`, `ci`,
    // and `registry` stay non-I/O. The state allowance is GH-174 D8's tightened
    // driver edge, not the whole state tree.
    expect([...pathNot]).toEqual([
      "^packages/core/src/state/driver/",
      "^packages/adapters/src/(repo|file|host|session|legacy|credentials)/",
      "^packages/adapters/src/github/",
      "^packages/adapters/src/gitlab/",
      "^packages/adapters/src/jira/",
      "^packages/cli/",
      "^packages/opencode/",
    ]);
  });
});

const CONFINEMENT_RULE = "runtime-apis-confinement";

/**
 * TC-BOUNDARY-001 step 5 — the allowlist-erosion guard. A pattern widening
 * (`providers/**`), a wildcard, or a `registry` admission is rejected by name
 * before any cruise could green-light it (ADR-0005 C-2, RSK-4).
 */
export const confinementGuard = (pathNot: readonly string[]): string[] => {
  const failures: string[] = [];
  for (const entry of pathNot) {
    if (entry.includes("*")) failures.push(`wildcard allowance ${entry}`);
    if (!entry.startsWith("^packages/")) failures.push(`non-adapter allowance ${entry}`);
    if (entry.includes("registry")) failures.push(`registry must stay non-I/O: ${entry}`);
    if (/providers/.test(entry)) failures.push(`pattern widening to providers: ${entry}`);
  }
  return failures;
};

const confinementPathNot = (): string[] => {
  const rule = config.forbidden.find((entry) => entry.name === CONFINEMENT_RULE);
  return [...(rule?.from?.pathNot ?? [])];
};

describe("TC-BOUNDARY-001 confinement non-erosion", () => {
  test("the live allowance is exact and excludes registry, azure, and ci", () => {
    const pathNot = confinementPathNot();
    expect(confinementGuard(pathNot)).toEqual([]);
    expect(pathNot.join("\n")).not.toContain("registry");
    expect(pathNot.join("\n")).not.toContain("azure");
    expect(pathNot.join("\n")).not.toContain("ci)");
  });

  test("widening the allowance to providers/** or registry fails the guard", () => {
    const pathNot = confinementPathNot();
    const widened = confinementGuard([...pathNot, "^packages/adapters/src/providers/"]);
    expect(widened.some((message) => message.includes("providers"))).toBe(true);
    const registry = confinementGuard([...pathNot, "^packages/adapters/src/registry/"]);
    expect(registry.some((message) => message.includes("registry"))).toBe(true);
    const wildcard = confinementGuard([...pathNot, "^packages/adapters/src/*/"]);
    expect(wildcard.some((message) => message.includes("wildcard"))).toBe(true);
  });

  test("a widened temp config would green-light a registry runtime import", () => {
    const root = materializeWorkspace(["adapters"]);
    try {
      const configPath = join(root, ".dependency-cruiser.cjs");
      const original = readFileSync(configPath, "utf8");
      const widened = original.replace(
        '"^packages/adapters/src/(repo|file|host|session|legacy|credentials)/",',
        '"^packages/adapters/src/(repo|file|host|session|legacy|credentials|registry)/",',
      );
      expect(widened).not.toBe(original);
      writeFileSync(configPath, widened);
      writeProbe(
        root,
        "packages/adapters/src/registry/probe.ts",
        'import fs from "node:fs";\nexport const value = fs;\n',
      );
      // Erosion is real: the mutated config cruises clean, which is exactly why
      // the structural guard above must reject the widened array.
      expect(cruise(root).violations).toEqual([]);
      expect(
        confinementGuard([
          ...confinementPathNot(),
          "^packages/adapters/src/(repo|file|host|session|legacy|credentials|registry)/",
        ]).some((message) => message.includes("registry")),
      ).toBe(true);
    } finally {
      cleanup(root);
    }
  }, 120_000);
});
