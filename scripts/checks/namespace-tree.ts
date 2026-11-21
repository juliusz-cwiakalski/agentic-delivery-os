/**
 * GH-365 P4 TC-SCAN-003/004/005 — the repository-tree arm.
 *
 * The content arm cannot see a tracked path or a symlink target, so this arm
 * asserts the tree properties: zero tracked paths under a declared
 * prior-namespace root, zero tracked symlinks that resolve into one, the
 * committed layer present, the runtime-written project files ignored by the
 * repository's own rules (probed in a rule-world), and no tracked runtime file.
 *
 * The prior-root PREFIX SET is read from the declaration — the shim registry's
 * prior config/state literals cross-checked with the forbidden-literal registry's
 * home-form seed — never a hardcoded list, and the arm reports the set it used.
 * Read-only, offline and deterministic; the tree is never written.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize } from "node:path";

export const TREE_ARM_VERSION = "delivery.namespace-tree.v1";
export const CURRENT_LAYER = ".jaiship/config.yaml";
export const RUNTIME_PROJECT_FILES = [
  ".jaiship/config.local.yaml",
  ".jaiship/projects.yaml",
] as const;
const RUNTIME_PROJECT_PATTERN = /(^|\/)[^/]*(?:config\.local\.yaml|projects\.yaml)$/;

type DeclaredShim = {
  readonly id: string;
  readonly literal: string;
};

type ForbiddenSeeds = {
  readonly priorNamespace?: {
    readonly seeds: readonly { readonly id: string; readonly literal: string }[];
  };
};

export type TreeOptions = {
  /** Test seam for M55: a caller-supplied set substitutes the reported set. */
  readonly priorRootPrefixes?: readonly string[];
};

export type TreeCheck = {
  readonly id: string;
  readonly ok: boolean;
  readonly detail?: string;
};

export type TreeOutcome = {
  readonly failures: string[];
  readonly priorRootPrefixes: readonly string[];
  readonly checks: readonly TreeCheck[];
};

const git = (root: string, args: readonly string[]): string => {
  const result = spawnSync("git", [...args], { cwd: root, encoding: "utf8" });
  return result.status === 0 ? (result.stdout ?? "") : "";
};

const readShims = (root: string): readonly DeclaredShim[] => {
  try {
    const document = JSON.parse(
      readFileSync(join(root, "scripts/checks/namespace-shims.registry.json"), "utf8"),
    ) as { shims?: unknown };
    if (!Array.isArray(document.shims)) return [];
    return document.shims.filter(
      (entry): entry is DeclaredShim =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === "string" &&
        typeof (entry as { literal?: unknown }).literal === "string",
    );
  } catch {
    return [];
  }
};

const readForbiddenSeeds = (root: string): ForbiddenSeeds => {
  try {
    return JSON.parse(
      readFileSync(join(root, "scripts/checks/forbidden-literals.registry.json"), "utf8"),
    ) as ForbiddenSeeds;
  } catch {
    return {};
  }
};

/**
 * The declared prior-root prefix set: the shim registry's config-directory and
 * state-root literals plus the forbidden registry's home-form seed. Each entry
 * is a directory prefix with its trailing slash.
 */
export const declaredPriorRootPrefixes = (
  root: string,
): { readonly prefixes: readonly string[]; readonly failures: readonly string[] } => {
  const failures: string[] = [];
  const shims = readShims(root);
  const config = shims.find((shim) => shim.id === "prior-config-directory");
  const state = shims.find((shim) => shim.id === "prior-state-root");
  const seeds = readForbiddenSeeds(root).priorNamespace?.seeds ?? [];
  const configSeed = seeds.find((seed) => seed.id === "prior-config-directory");
  const stateSeed = seeds.find((seed) => seed.id === "prior-state-directory");
  const homeSeed = seeds.find((seed) => seed.id === "prior-home-config");

  if (config === undefined || state === undefined) {
    failures.push(
      "the shim registry does not declare the prior config-directory and state-root shims",
    );
  }
  if (configSeed === undefined || stateSeed === undefined || homeSeed === undefined) {
    failures.push(
      "the forbidden-literal registry does not declare the prior config-directory, state-directory and home-config seeds",
    );
  }
  if (
    config !== undefined &&
    state !== undefined &&
    configSeed !== undefined &&
    stateSeed !== undefined &&
    homeSeed !== undefined
  ) {
    if (configSeed.literal !== config.literal) {
      failures.push("the prior config-directory literal disagrees between the two declarations");
    }
    if (stateSeed.literal !== state.literal) {
      failures.push("the prior state-root literal disagrees between the two declarations");
    }
    if (homeSeed.literal !== `~/${config.literal}`) {
      failures.push(
        "the prior home-config seed is not the home form of the config-directory literal",
      );
    }
  }
  const prefixes =
    config === undefined || state === undefined || homeSeed === undefined
      ? []
      : [`${config.literal}/`, `${state.literal}/`, `${homeSeed.literal}/`];
  return { prefixes, failures };
};

type TrackedEntry = {
  readonly mode: string;
  readonly blob: string;
  readonly path: string;
};

const trackedEntries = (root: string): readonly TrackedEntry[] => {
  const output = git(root, ["ls-files", "-s", "-z"]);
  return output
    .split("\0")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const tab = line.indexOf("\t");
      if (tab < 0) return [];
      const [mode, blob] = line.slice(0, tab).split(" ");
      const path = line.slice(tab + 1);
      if (mode === undefined || blob === undefined || path.length === 0) return [];
      return [{ mode, blob, path }];
    });
};

const blobText = (root: string, blob: string): string => git(root, ["cat-file", "blob", blob]);

const symlinkTargetsPriorRoot = (
  target: string,
  linkPath: string,
  priorPrefixes: readonly string[],
): boolean => {
  if (target.startsWith("/")) return priorPrefixes.some((prefix) => target.startsWith(prefix));
  const resolved = normalize(join(dirname(linkPath), target));
  const compared = resolved.endsWith("/") ? resolved : `${resolved}/`;
  return priorPrefixes.some(
    (prefix) =>
      compared === prefix || compared.startsWith(prefix) || resolved === prefix.slice(0, -1),
  );
};

const REPO_RELATIVE_PREFIXES = (prefixes: readonly string[]): readonly string[] =>
  prefixes.filter((prefix) => !prefix.startsWith("~"));

const probeIgnoreRules = (root: string): { readonly failures: string[] } => {
  const failures: string[] = [];
  let ignoreText: string;
  try {
    ignoreText = readFileSync(join(root, ".gitignore"), "utf8");
  } catch {
    return { failures: [".gitignore is unreadable; the runtime-file probe cannot run"] };
  }
  const world = mkdtempSync(join(tmpdir(), "namespace-tree-ignore-"));
  try {
    writeFileSync(join(world, ".gitignore"), ignoreText);
    const init = spawnSync("git", ["init", "-q"], { cwd: world, encoding: "utf8" });
    if (init.status !== 0) return { failures: ["the rule-world git init failed"] };
    const ignored = (path: string): boolean =>
      spawnSync("git", ["check-ignore", "-q", "--no-index", path], {
        cwd: world,
        encoding: "utf8",
      }).status === 0;
    for (const path of RUNTIME_PROJECT_FILES) {
      if (!ignored(path)) {
        failures.push(`runtime-written project file is not ignored: ${path}`);
      }
    }
    if (ignored(CURRENT_LAYER)) {
      failures.push(`tracked layer reported ignored: ${CURRENT_LAYER}`);
    }
  } finally {
    rmSync(world, { recursive: true, force: true });
  }
  return { failures };
};

export const scanTree = (root: string, options: TreeOptions = {}): TreeOutcome => {
  const failures: string[] = [];
  const checks: TreeCheck[] = [];
  const declared = declaredPriorRootPrefixes(root);
  failures.push(...declared.failures);

  const reportedPrefixes = options.priorRootPrefixes ?? declared.prefixes;
  const prefixSetMatches =
    reportedPrefixes.length === declared.prefixes.length &&
    declared.prefixes.every((prefix) => reportedPrefixes.includes(prefix));
  checks.push({
    id: "declared-prior-root-prefix-set",
    ok: prefixSetMatches && declared.failures.length === 0,
    detail: `reported ${reportedPrefixes.join(", ")}; declared ${declared.prefixes.join(", ")}`,
  });
  if (!prefixSetMatches) {
    failures.push(
      `declared prior-root prefix set mismatch: reported [${reportedPrefixes.join(", ")}], declared [${declared.prefixes.join(", ")}]`,
    );
  }

  const entries = trackedEntries(root);
  const relativePrefixes = REPO_RELATIVE_PREFIXES(reportedPrefixes);
  const trackedPrior = entries.filter((entry) =>
    relativePrefixes.some((prefix) => entry.path.startsWith(prefix)),
  );
  checks.push({
    id: "tracked-prior-root-paths",
    ok: trackedPrior.length === 0,
    detail: trackedPrior.map((entry) => entry.path).join(", "),
  });
  for (const entry of trackedPrior) {
    failures.push(`tracked path under a prior-namespace root: ${entry.path}`);
  }

  const trackedSymlinks = entries.filter((entry) => entry.mode === "120000");
  const symlinksIntoPrior: string[] = [];
  for (const entry of trackedSymlinks) {
    const target = blobText(root, entry.blob).trim();
    if (symlinkTargetsPriorRoot(target, entry.path, reportedPrefixes)) {
      symlinksIntoPrior.push(`${entry.path} -> ${target}`);
    }
  }
  checks.push({
    id: "tracked-prior-root-symlinks",
    ok: symlinksIntoPrior.length === 0,
    detail: symlinksIntoPrior.join(", "),
  });
  for (const finding of symlinksIntoPrior) {
    failures.push(`tracked symlink resolves into a prior-namespace root: ${finding}`);
  }

  const hasLayer = entries.some((entry) => entry.path === CURRENT_LAYER);
  checks.push({ id: "committed-layer-present", ok: hasLayer, detail: CURRENT_LAYER });
  if (!hasLayer) failures.push(`committed project layer is not tracked: ${CURRENT_LAYER}`);

  const ignore = probeIgnoreRules(root);
  checks.push({ id: "runtime-project-files-ignored", ok: ignore.failures.length === 0 });
  failures.push(...ignore.failures);

  const trackedRuntime = entries.filter((entry) => RUNTIME_PROJECT_PATTERN.test(entry.path));
  checks.push({
    id: "runtime-project-files-not-tracked",
    ok: trackedRuntime.length === 0,
    detail: trackedRuntime.map((entry) => entry.path).join(", "),
  });
  for (const entry of trackedRuntime) {
    failures.push(`tracked runtime-written project file: ${entry.path}`);
  }

  return { failures, priorRootPrefixes: reportedPrefixes, checks };
};

if (import.meta.main) {
  const outcome = scanTree(process.cwd());
  for (const failure of outcome.failures) {
    console.error(`FAIL namespace-tree: ${failure}`);
  }
  if (outcome.failures.length > 0) process.exit(1);
  console.log("OK namespace-tree: repository tree conforms to the declared prior-root set");
  for (const check of outcome.checks) {
    console.log(
      `  ${check.id}: ${check.ok ? "ok" : "fail"}${check.detail ? ` (${check.detail})` : ""}`,
    );
  }
  console.log(`  prior-root prefixes: ${outcome.priorRootPrefixes.join(", ")}`);
}
