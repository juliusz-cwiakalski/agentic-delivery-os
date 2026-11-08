/**
 * TC-HARN-005 (phase-1 core half) — exactly one classifier, data-only spawn
 * construction, and neutral-tier imports.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  adapterNormalizationViolations,
  ambientReadViolations,
  harnessLiteralViolations,
  listTypeScriptFiles,
} from "../fixtures/harness/neutrality-scans";

const ROOT = process.cwd();

const packageFiles = listTypeScriptFiles("packages");
const coreFiles = packageFiles.filter((file) => file.startsWith("packages/core/src/"));

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

describe("TC-HARN-005 one shared classifier", () => {
  test("exactly one classifier definition exists across the workspace", () => {
    expect(packageFiles.length).toBeGreaterThan(0);
    const definitions = packageFiles.filter((file) =>
      readFileSync(join(ROOT, file), "utf8").includes("export const classifyHarnessEvidence"),
    );
    expect(definitions).toEqual(["packages/core/src/domain/harness-classify.ts"]);
  });

  test("the classifier imports only the contract tier and contains no harness-kind comparison", () => {
    const file = "packages/core/src/domain/harness-classify.ts";
    const text = readFileSync(join(ROOT, file), "utf8");
    expect(text.length).toBeGreaterThan(0);
    expect(importsOf(file).every((specifier) => specifier === "#contracts")).toBe(true);
    expect(text).not.toContain("HARNESS_KINDS");
    expect(text).not.toContain('"opencode"');
    expect(text).not.toContain('"claude-code"');
    expect(text).not.toContain("process.env");
  });

  test("no other module under core re-implements classification", () => {
    const coreDefinitions = coreFiles.filter((file) => {
      if (file === "packages/core/src/domain/harness-classify.ts") return false;
      // The dispatch paths must delegate to the one shared classifier; they do
      // not re-implement it.
      if (
        file === "packages/core/src/app/dispatch.ts" ||
        file === "packages/core/src/app/daemon-dispatch-result.ts"
      ) {
        return false;
      }
      if (file.endsWith("/index.ts")) return false;
      const text = readFileSync(join(ROOT, file), "utf8");
      return text.includes("classifyHarnessEvidence") || text.includes("harnessClassification");
    });
    expect(coreDefinitions).toEqual([]);
  });
});

describe("TC-HARN-014 (core half) spawn construction performs no ambient read", () => {
  test("the spawn-env builder reads no ambient environment, with a non-zero scope", () => {
    const files = coreFiles.filter((file) =>
      file.startsWith("packages/core/src/domain/harness-spawn-env"),
    );
    expect(files.length).toBeGreaterThan(0);
    expect(ambientReadViolations(files)).toEqual([]);
  });

  test("harness domain modules import no runtime API", () => {
    const files = coreFiles.filter(
      (file) =>
        file.startsWith("packages/core/src/domain/harness-") ||
        file === "packages/core/src/domain/harness-canonical.ts",
    );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      for (const specifier of importsOf(file)) {
        expect(specifier.startsWith("node:") || specifier.startsWith("bun:")).toBe(false);
      }
    }
  });
});

describe("TC-HARN-005 adapters normalize only (Phase 3 completing half)", () => {
  test("adapter sources carry no classifier import, token literal, or harness-kind comparison", () => {
    const files = listTypeScriptFiles("packages/adapters/src/harness");
    expect(files.length).toBeGreaterThan(0);
    expect(adapterNormalizationViolations(files)).toEqual([]);
  });

  test("both adapters expose the same bound classifier reference", async () => {
    const { createClaudeSession, createOpencodeSession } = await import(
      "../../packages/adapters/src/harness/index"
    );
    const { classifyHarnessEvidence } = await import("../../packages/core/src/domain/index");
    const { assembleHarnessLiveness } = await import("../../packages/core/src/domain/index");
    const common = {
      command: "synthetic",
      runner: async () => ({ stdout: "", stderr: "", status: 0, timedOut: false }),
      buildEnvironment: () => ({ ok: true as const, value: {} }),
      classify: classifyHarnessEvidence,
      assembleLiveness: assembleHarnessLiveness,
      now: () => "2026-11-06T00:00:00Z",
    };
    const opencode = createOpencodeSession(common);
    const claude = createClaudeSession(common);
    expect(opencode.classify).toBe(classifyHarnessEvidence);
    expect(claude.classify).toBe(classifyHarnessEvidence);
    expect(opencode.classify).toBe(claude.classify);
  });

  test("host is the only execution kind and no core module names it", async () => {
    const { HARNESS_EXECUTION_KINDS } = await import("../../packages/core/src/contracts/index");
    expect([...HARNESS_EXECUTION_KINDS]).toEqual(["host"]);
    const core = listTypeScriptFiles("packages/core/src").filter(
      (file) =>
        file.startsWith("packages/core/src/contracts") ||
        file.startsWith("packages/core/src/domain") ||
        file.startsWith("packages/core/src/app") ||
        file.startsWith("packages/core/src/config"),
    );
    expect(core.length).toBeGreaterThan(0);
    for (const file of core) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text).not.toContain("node:child_process");
    }
  });
});

describe("TC-HARN-028 final neutrality battery", () => {
  test("zero harness-name literals in core outside the closed vocabulary and config defaults", () => {
    const scope = listTypeScriptFiles("packages/core/src").filter(
      (file) =>
        file.startsWith("packages/core/src/contracts") ||
        file.startsWith("packages/core/src/domain") ||
        file.startsWith("packages/core/src/app") ||
        file.startsWith("packages/core/src/state") ||
        file.startsWith("packages/core/src/config"),
    );
    expect(scope.length).toBeGreaterThan(0);
    expect(harnessLiteralViolations(scope)).toEqual([]);
  });

  test("core imports no adapter subpath", () => {
    const scope = listTypeScriptFiles("packages/core/src");
    expect(scope.length).toBeGreaterThan(0);
    for (const file of scope) {
      for (const specifier of importsOf(file)) {
        expect(specifier, file).not.toContain("@delivery-os/adapters");
      }
    }
  });
});
