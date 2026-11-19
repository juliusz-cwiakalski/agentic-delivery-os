/**
 * GH-346 TC-INST-014 — the composition holds no network client and no build spawn.
 *
 * The assertion is static over the install surface and carries a planted control:
 * the scanner must name an injected `fetch(`/`execFile` on a temp copy, so the
 * absence is proven by a guard that can fail.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/** The declared scan scope: the family handler and the composition's install block. */
const SCAN_FILES = [
  "packages/cli/src/commands/install.ts",
  "packages/cli/src/output/install-text.ts",
  "packages/adapters/src/file/install-destination.ts",
  "packages/core/src/domain/install-admission.ts",
  "packages/core/src/domain/install-status.ts",
  "packages/core/src/contracts/install.ts",
] as const;

const FORBIDDEN = [
  "node:http",
  "node:https",
  "createGithubNativeTransport",
  "createGithubClient",
  "fetch(",
  "execFile",
  "spawn(",
  "child_process",
  "pnpm",
  "npm install",
  "bun build",
] as const;

/** Scan one text for the forbidden composition capabilities. */
export const compositionViolations = (text: string): readonly string[] =>
  FORBIDDEN.filter((token) => text.includes(token));

describe("TC-INST-014 no HTTP client and no build spawn in the install surface", () => {
  test("every scanned file is clean", () => {
    const failures: string[] = [];
    for (const file of SCAN_FILES) {
      const violations = compositionViolations(readFileSync(join(ROOT, file), "utf8"));
      for (const violation of violations) failures.push(`${file}: ${violation}`);
    }
    expect(failures).toEqual([]);
  });

  test("the production composition registers the family unconditionally and spawns nothing", () => {
    const production = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    expect(production).toContain("install: createInstallCommandDefinition(installRuntime)");
    const block = production.slice(
      production.indexOf("const installRuntime: InstallRuntime"),
      production.indexOf("const installProgram"),
    );
    expect(compositionViolations(block)).toEqual([]);
  });

  test("a planted client and a planted spawn fail by name", () => {
    expect(compositionViolations("const client = createGithubClient({});")).toEqual([
      "createGithubClient",
    ]);
    expect(compositionViolations("const child = execFile('bun', ['build']);")).toEqual([
      "execFile",
    ]);
    expect(compositionViolations("await fetch('https://example.invalid');")).toEqual(["fetch("]);
    expect(compositionViolations("import { spawn } from 'node:child_process';")).toEqual([
      "child_process",
    ]);
  });
});
