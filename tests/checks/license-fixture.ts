/**
 * Temporary-tree helper for the spawned license-audit contract suite.
 *
 * Each tree contains only the manifests, lockfile, and mutated registry the
 * audit reads from its working directory. The live tree is never written.
 */
import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const PACKAGE_NAMES = ["core", "adapters", "cli", "mcp", "opencode", "testkit"];

export const createLicenseTree = (registryText: string, root: string = process.cwd()): string => {
  const tree = mkdtempSync(join(tmpdir(), "license-audit-tree-"));
  const copy = (relative: string): void => {
    const source = join(root, relative);
    if (!existsSync(source)) return;
    const target = join(tree, relative);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target);
  };

  copy("package.json");
  for (const packageName of PACKAGE_NAMES) {
    copy(`packages/${packageName}/package.json`);
  }
  copy("pnpm-lock.yaml");

  const registryPath = join(tree, "doc/legal/dependency-licenses.yaml");
  mkdirSync(dirname(registryPath), { recursive: true });
  writeFileSync(registryPath, registryText);
  return tree;
};

export const spawnLicenseAudit = (
  tree: string,
  root: string = process.cwd(),
): SpawnSyncReturns<string> =>
  spawnSync("bun", ["run", join(root, "scripts/checks/license-audit.ts")], {
    cwd: tree,
    encoding: "utf8",
  });

export const removeLicenseTree = (tree: string): void => {
  rmSync(tree, { recursive: true, force: true });
};
