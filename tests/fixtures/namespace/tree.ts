/**
 * GH-365 P4 fixtures: a synthetic tracked-set builder with a real git index
 * (including mode `120000` for a symlink) and the rule-world ignore probe
 * runner.
 *
 * Every tree lives under the approved `tmp/tmpdir` root; the live workspace is
 * never written and no native git object is faked.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const BASE = join(ROOT, "tmp/tmpdir/namespace-tree-fixtures");

const git = (root: string, args: readonly string[], input?: string): string =>
  execFileSync("git", [...args], {
    cwd: root,
    encoding: "utf8",
    ...(input === undefined ? {} : { input }),
  }).trim();

const write = (root: string, relative: string, content: string): void => {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

export type SyntheticTreeOptions = {
  readonly layer?: boolean;
  readonly priorFile?: boolean;
  readonly priorStateFile?: boolean;
  readonly symlink?: boolean;
  readonly runtimeFile?: boolean;
};

export type SyntheticTree = {
  readonly root: string;
  readonly run: (args: readonly string[]) => string;
  readonly dispose: () => void;
};

/**
 * Build a real repository. The declaration documents are copied so the tree arm
 * reads the same declaration as the live repository.
 */
export const createSyntheticTree = (options: SyntheticTreeOptions = {}): SyntheticTree => {
  mkdirSync(BASE, { recursive: true });
  const root = mkdtempSync(join(BASE, "tree-"));
  write(root, ".gitignore", readFileSync(join(ROOT, ".gitignore"), "utf8"));
  for (const relative of [
    "scripts/checks/namespace-shims.registry.json",
    "scripts/checks/forbidden-literals.registry.json",
  ]) {
    write(root, relative, readFileSync(join(ROOT, relative), "utf8"));
  }
  if (options.layer !== false) {
    write(root, ".jaiship/config.yaml", "verify:\n  suite-map: {}\n");
  }
  if (options.priorFile === true) {
    write(root, ".delivery-os/config.yaml", "legacy: true\n");
  }
  if (options.priorStateFile === true) {
    write(root, ".delivery-os-state/host-index.json", "{}\n");
  }
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "fixture@example.invalid"]);
  git(root, ["config", "user.name", "Synthetic Fixture"]);
  git(root, ["add", "-A"]);
  git(root, ["commit", "-qm", "baseline"]);
  if (options.runtimeFile === true) {
    write(root, ".jaiship/projects.yaml", "projects: []\n");
    git(root, ["add", "-f", ".jaiship/projects.yaml"]);
    git(root, ["commit", "-qm", "track a runtime file"]);
  }
  if (options.symlink === true) {
    const blob = git(root, ["hash-object", "-w", "--stdin"], ".delivery-os\n");
    git(root, ["update-index", "--add", `--cacheinfo`, `120000,${blob},.jaiship`]);
    git(root, ["commit", "-qm", "reintroduce the symlink"]);
  }
  return {
    root,
    run: (args) => git(root, args),
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
};

/** The rule-world ignore probe: true when git would ignore the path. */
export const ruleWorldProbe = (
  gitignore: string,
  paths: readonly string[],
): Record<string, boolean> => {
  mkdirSync(BASE, { recursive: true });
  const world = mkdtempSync(join(BASE, "rule-world-"));
  try {
    writeFileSync(join(world, ".gitignore"), gitignore);
    spawnSync("git", ["init", "-q"], { cwd: world, encoding: "utf8" });
    const result: Record<string, boolean> = {};
    for (const path of paths) {
      result[path] =
        spawnSync("git", ["check-ignore", "-q", "--no-index", path], {
          cwd: world,
          encoding: "utf8",
        }).status === 0;
    }
    return result;
  } finally {
    rmSync(world, { recursive: true, force: true });
  }
};
