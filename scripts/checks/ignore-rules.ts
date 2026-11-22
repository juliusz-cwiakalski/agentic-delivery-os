/**
 * TC-SCAFFOLD-034 / TC-BRANDING-013 / TC-LAYER-002 — ignore rules incl. the
 * brand-free project-local config and runtime-written project-file globs.
 *
 * Asserts the five coverage classes, both brand-free root-anchored globs, rename
 * survival of those globs, the tracked project layer never being reported
 * ignored, and real `git check-ignore` behaviour on representative paths.
 * Token enforcement for `.gitignore` is subsumed by the full-scope
 * `forbidden-literals` scan (class 4); the coverage classes, globs, rename
 * simulation, and probes below remain load-bearing.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const failures: string[] = [];
const fail = (message: string): void => {
  failures.push(message);
};

const ignoreText = readFileSync(join(ROOT, ".gitignore"), "utf8");
const lines = ignoreText
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"));

const hasPattern = (pattern: string): boolean => lines.includes(pattern);

// 1. Five coverage classes. The last is the runtime-written project-file class
// (DM-2, AC-F1-3): the group document and its `.local` sibling are written by
// normal runtime use, so a fresh clone must stay clean through the repository's
// own rules, never a workstation exclude file.
const coverage: Array<{ label: string; patterns: string[] }> = [
  { label: "workspace dependency dirs", patterns: ["node_modules/"] },
  { label: "build output", patterns: ["dist/", "packages/*/dist/"] },
  { label: "local ephemeral state", patterns: [".ai/local/"] },
  { label: "project-local config", patterns: [".*/config.local.yaml"] },
  { label: "runtime-written project files", patterns: [".*/projects.yaml"] },
];
for (const entry of coverage) {
  for (const pattern of entry.patterns) {
    if (!hasPattern(pattern)) fail(`.gitignore is missing the ${entry.label} pattern ${pattern}`);
  }
}

// 2. Brand-free globs. Neither pattern may name the current brand or a specific
// product: a rename must keep matching the same path shape.
const brandFree = [
  { label: "project-local config pattern", pattern: ".*/config.local.yaml" },
  { label: "runtime-written project pattern", pattern: ".*/projects.yaml" },
];
for (const entry of brandFree) {
  const fileName = entry.pattern.slice(entry.pattern.lastIndexOf("/") + 1);
  const literalPaths = lines.filter((line) => line.endsWith(`/${fileName}`) && !line.includes("*"));
  for (const literal of literalPaths) {
    fail(`${entry.label} must be a brand-free glob, received ${literal}`);
  }
  if (!entry.pattern.includes("*")) {
    fail(`${entry.label} must be a brand-free glob, received ${entry.pattern}`);
  }
}

// 3. Rename simulation: a synthetic product name still matches the same path
// shape, and a nested package path is not matched (the embedded separator is
// what anchors the glob to a root dot-directory).
const globToRegExp = (glob: string): RegExp => {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
};
const syntheticNames = [".renamed-product", ".alt-brand", ".synthetic"];
for (const entry of brandFree) {
  const regExp = globToRegExp(entry.pattern);
  const fileName = entry.pattern.slice(entry.pattern.lastIndexOf("/") + 1);
  for (const name of syntheticNames) {
    const probe = `${name}/${fileName}`;
    if (!regExp.test(probe)) {
      fail(`rename simulation failed: ${entry.pattern} does not match ${probe}`);
    }
  }
  if (regExp.test(`packages/core/.nested/${fileName}`)) {
    fail(`${entry.label} must be anchored to the repository root (embedded slash)`);
  }
}

// 4. Real ignore behaviour, probed in a rule-world temp git dir seeded with the
// repository's real .gitignore — live-tree probes are environment-dependent
// (pnpm's node_modules symlinks make git check-ignore die with fatal 128),
// rule-world probes are not.
const isIgnoredInRuleWorld = (ruleWorld: string, path: string): boolean => {
  try {
    execFileSync("git", ["check-ignore", "-q", "--no-index", path], {
      cwd: ruleWorld,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};

// The tracked project layer is read from git metadata so the positive control is
// brand-free: exactly one root `<dot-directory>/config.yaml` is committed.
const trackedProjectLayers = (): string[] => {
  const result = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
  return (result ?? "").split("\0").filter((path) => /^\.[^/]+\/config\.yaml$/.test(path));
};

const ruleWorld = mkdtempSync(join(tmpdir(), "ignore-rules-"));
try {
  writeFileSync(join(ruleWorld, ".gitignore"), ignoreText);
  execFileSync("git", ["init", "-q"], { cwd: ruleWorld, stdio: "ignore" });
  const expectIgnored = (path: string, ignored: boolean): void => {
    const actual = isIgnoredInRuleWorld(ruleWorld, path);
    if (actual !== ignored) {
      fail(
        `git check-ignore reports ${path} ignored=${String(actual)}; expected ignored=${String(ignored)}`,
      );
    }
  };
  expectIgnored("node_modules/@delivery-os/core/index.js", true);
  expectIgnored("packages/core/dist/index.js", true);
  expectIgnored("dist/index.js", true);
  expectIgnored(".ai/local/state.json", true);
  expectIgnored(".example-app/config.local.yaml", true);
  expectIgnored(".example-app/projects.yaml", true);
  expectIgnored("packages/x/projects.yaml", false);
  expectIgnored("packages/core/.nested/config.local.yaml", false);

  // Positive control: a committed layer is never matched by the runtime rules.
  // A synthetic tree without a committed layer has nothing to protect, so the
  // control is load-bearing exactly where a layer is tracked.
  const trackedLayers = trackedProjectLayers();
  for (const path of trackedLayers) {
    if (isIgnoredInRuleWorld(ruleWorld, path)) {
      fail(`tracked layer reported ignored: ${path}`);
    }
  }
} finally {
  rmSync(ruleWorld, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const message of failures) console.error(`FAIL ignore-rules: ${message}`);
  process.exit(1);
}
console.log(
  "OK ignore-rules: five coverage classes, brand-free globs, rename-safe, git probes green",
);
