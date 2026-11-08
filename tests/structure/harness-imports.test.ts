/**
 * TC-HARN-014 / TC-HARN-005 — spawn-path secret boundary and adapter
 * normalization-only scans.
 *
 * The scan asserts a non-zero file floor. `node:child_process` is confined to
 * the exact declared allowlist below: the pre-existing adapter git/file/session
 * transports, the core state driver edge, the dev-only testkit commit harness,
 * and this change's single host runner. Any addition or removal fails by name.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { ambientReadViolations, listTypeScriptFiles } from "../fixtures/harness/neutrality-scans";

const ROOT = process.cwd();
const HARNESS_DIR = "packages/adapters/src/harness";

/**
 * Every file permitted to import `node:child_process` (F-5).
 *
 * Enumerated from the delivered tree so an added site and a removed site both
 * fail this equality assertion. `packages/adapters/src/host/index.ts` is the one
 * GH-233 addition; the rest pre-date the harness seam.
 */
const DECLARED_CHILD_PROCESS_SITES = [
  "packages/adapters/src/daemon/process.ts",
  "packages/adapters/src/daemon/supervisor.ts",
  "packages/adapters/src/file/commitlint.ts",
  "packages/adapters/src/git/commit.ts",
  "packages/adapters/src/git/index.ts",
  "packages/adapters/src/git/merge.ts",
  "packages/adapters/src/git/watchdog.ts",
  "packages/adapters/src/host/index.ts",
  "packages/adapters/src/session/commit-one-shot.ts",
  "packages/adapters/src/session/index.ts",
  "packages/core/src/state/driver/runtime-edge.ts",
  "packages/testkit/src/commit/git-repo.ts",
] as const;

const importsOf = (file: string): string[] => {
  const source = ts.createSourceFile(
    file,
    readFileSync(join(ROOT, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
};

describe("TC-HARN-014 spawn-path secret boundary", () => {
  test("the harness adapter tree performs no ambient environment read", () => {
    const files = listTypeScriptFiles(HARNESS_DIR);
    expect(files.length).toBeGreaterThan(0);
    expect(ambientReadViolations(files)).toEqual([]);
  });

  test("node:child_process is confined to the exact declared allowlist", () => {
    // The production `runtime-apis-confinement` rule and the boundaries suite
    // (case `runtime-child-process-adapter-registry` in
    // tests/boundaries/fixtures/cases.ts) prove a non-allowed adapters path
    // importing node:child_process fails the boundary check; this row pins the
    // delivered site set so an addition and a removal both fail by name.
    const packageFiles = listTypeScriptFiles("packages");
    expect(packageFiles.length).toBeGreaterThan(0);
    const observed = packageFiles
      .filter((file) => importsOf(file).includes("node:child_process"))
      .sort();
    expect(observed).toEqual([...DECLARED_CHILD_PROCESS_SITES].sort());
    expect(observed.filter((file) => file.startsWith(HARNESS_DIR))).toEqual([]);
  });

  test("the parent environment enters the builder only as an argument", () => {
    const file = "packages/core/src/domain/harness-spawn-env.ts";
    const text = readFileSync(join(ROOT, file), "utf8");
    expect(text).toContain("parentEnvironment");
    expect(text).not.toContain("process");
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const identifiers: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) identifiers.push(node.text);
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(identifiers).toContain("parentEnvironment");
  });

  test("adapters import neither the classifier nor a harness store module", () => {
    const extractionFiles = new Set([
      `${HARNESS_DIR}/sqlite-loader.ts`,
      `${HARNESS_DIR}/telemetry-claude.ts`,
      `${HARNESS_DIR}/telemetry-opencode.ts`,
    ]);
    const files = listTypeScriptFiles(HARNESS_DIR);
    for (const file of files) {
      for (const specifier of importsOf(file)) {
        expect(specifier).not.toContain("harness-classify");
        expect(specifier).not.toContain("core/src/domain");
        expect(specifier).not.toContain("node:child_process");
        if (!extractionFiles.has(file)) {
          expect(specifier.startsWith("node:")).toBe(false);
          expect(specifier.startsWith("bun:")).toBe(false);
        } else {
          const allowed =
            specifier.startsWith("./") ||
            ["node:fs", "node:path", "node:module", "@delivery-os/core/contracts"].includes(
              specifier,
            );
          expect(allowed, `${file}: ${specifier}`).toBe(true);
        }
      }
    }
  });
});
