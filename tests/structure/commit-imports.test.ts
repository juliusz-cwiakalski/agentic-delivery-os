/**
 * TC-TIER-002 — commit domain purity: contracts-only and intra-domain imports,
 * no runtime APIs, and no ambient reads. A temp-copy mutation proves the guard
 * covers the new modules without a new allowlist edge.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";
import { scan } from "../../scripts/checks/ambient-globals";

const ROOT = process.cwd();
const DOMAIN_DIR = "packages/core/src/domain";
const COMMIT_MODULES = [
  "commit-skeleton.ts",
  "commit-bundle.ts",
  "commit-staging.ts",
  "commit-safety.ts",
  "commit-message.ts",
  "commit-transport.ts",
  "commit-converge.ts",
  "commit-act.ts",
] as const;

const importViolations = (root: string, relative: string): string[] => {
  const violations: string[] = [];
  const source = ts.createSourceFile(
    relative,
    readFileSync(join(root, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    const allowed =
      specifier === "#contracts" ||
      specifier.startsWith("./") ||
      specifier === "@delivery-os/core/contracts";
    if (!allowed) violations.push(`${relative}: forbidden import ${specifier}`);
  }
  return violations;
};

const runtimeApiViolations = (root: string, relative: string): string[] => {
  const violations: string[] = [];
  const text = readFileSync(join(root, relative), "utf8");
  for (const marker of ["process.", "Date.now", "Math.random", "fetch(", "node:", "bun:"]) {
    if (text.includes(marker)) violations.push(`${relative}: ambient marker ${marker}`);
  }
  return violations;
};

const tempModule = (name: string, content: string): string => {
  const root = mkdtempSync(join(tmpdir(), "commit-purity-"));
  const path = join(root, DOMAIN_DIR, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return root;
};

describe("TC-TIER-002 commit domain purity", () => {
  test("every commit domain module imports only contracts or intra-domain files", () => {
    const violations = COMMIT_MODULES.flatMap((name) =>
      importViolations(ROOT, `${DOMAIN_DIR}/${name}`),
    );
    expect(violations).toEqual([]);
  });

  test("every commit domain module avoids runtime APIs and ambient globals", () => {
    const violations = COMMIT_MODULES.flatMap((name) =>
      runtimeApiViolations(ROOT, `${DOMAIN_DIR}/${name}`),
    );
    expect(violations).toEqual([]);
    expect(scan(ROOT)).toEqual([]);
  });

  test("a mutation importing an adapter or a runtime is reported by name", () => {
    const cases = [
      ['import "@delivery-os/adapters/file";\n', "@delivery-os/adapters/file"],
      ['import "node:fs";\n', "node:fs"],
    ];
    for (const [source, expected] of cases) {
      const root = tempModule("commit-probe.ts", source);
      try {
        const violations = [
          ...importViolations(root, `${DOMAIN_DIR}/commit-probe.ts`),
          ...runtimeApiViolations(root, `${DOMAIN_DIR}/commit-probe.ts`),
        ];
        expect(violations.join("\n")).toContain(expected);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });
});
