/**
 * Temp git-repository helpers for scan mutation tests. Everything is created
 * under `mkdtemp`; the live workspace is never written.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ForbiddenLiteralRegistry } from "../../scripts/checks/forbidden-literals";

export const ROOT = process.cwd();
export const REGISTRY_PATH = "scripts/checks/forbidden-literals.registry.json";

export const liveRegistry = (): ForbiddenLiteralRegistry =>
  JSON.parse(readFileSync(join(ROOT, REGISTRY_PATH), "utf8")) as ForbiddenLiteralRegistry;

export const git = (root: string, args: string[]): string =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

export const writeFiles = (root: string, files: Record<string, string>): void => {
  for (const [relative, content] of Object.entries(files)) {
    const path = join(root, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
};

export const writeRegistry = (root: string, registry: ForbiddenLiteralRegistry): void => {
  writeFiles(root, { [REGISTRY_PATH]: `${JSON.stringify(registry, null, 2)}\n` });
};

export const SCOPE_FILES: Record<string, string> = {
  "package.json": '{\n  "name": "synthetic-fixture",\n  "private": true\n}\n',
  "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
  "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n',
  "tsconfig.json": "{}\n",
  "tsconfig.base.json": "{}\n",
  "biome.json": "{}\n",
  "commitlint.config.js": "export default {};\n",
  ".dependency-cruiser.cjs": "module.exports = { forbidden: [] };\n",
  ".bun-version": "1.4.4\n",
  ".changeset/config.json": "{}\n",
  "bunfig.toml": "[test]\n",
  ".gitignore": "node_modules/\ndist/\npackages/*/dist/\n.ai/local/\n.*/config.local.yaml\n",
  "packages/core/src/domain/index.ts": 'export type Placeholder = { readonly module: "domain" };\n',
  "doc/guides/existing.md": "# Existing guide\n\nPre-existing corpus content.\n",
};

export type TempRepo = {
  readonly root: string;
  readonly baseline: string;
  run: (args: string[]) => string;
  commit: (message: string) => string;
};

export const createTempRepo = (files: Record<string, string> = {}): TempRepo => {
  const root = mkdtempSync(join(tmpdir(), "forbidden-fixture-"));
  writeFiles(root, { ...SCOPE_FILES, ...files });
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "fixture@example.invalid"]);
  git(root, ["config", "user.name", "Synthetic Fixture"]);
  const run = (args: string[]): string => git(root, args);
  const commit = (message: string): string => {
    run(["add", "-A"]);
    run(["commit", "-qm", message]);
    return run(["rev-parse", "HEAD"]);
  };
  const baseline = commit("baseline");
  return { root, baseline, run, commit };
};
