/**
 * TC-BRANDING-008/009/010/011/027 — full-scope forbidden-literal scan.
 *
 * The registry (`forbidden-literals.registry.json`) is the single source for
 * scope classes, the seed set, the DEC-8 allowlist, the fixed corpus baseline,
 * and registered user-facing docs. The scan is read-only over repository content
 * and local git history: it never touches the network and never writes to a tree.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const REGISTRY_PATH = "scripts/checks/forbidden-literals.registry.json";

export const EXPECTED_SCOPE_IDS = [
  "packageTree",
  "rootManifests",
  "rootWorkspaceFiles",
  "ignoreRules",
  "userFacingDocs",
] as const;
export const EXPECTED_SEED_LITERALS = ["ados", "ADOS_", "~/.ados"] as const;
export const EXPECTED_ROOT_MANIFESTS = ["package.json", "pnpm-lock.yaml"] as const;
export const EXPECTED_ROOT_WORKSPACE_FILES = [
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "tsconfig.base.json",
  "biome.json",
  "commitlint.config.js",
  ".dependency-cruiser.cjs",
  ".bun-version",
  ".changeset/config.json",
  "bunfig.toml",
] as const;
export const EXPECTED_ALLOWLIST_IDS = [
  "branding-subpath",
  "legacy-adapter-subpath",
  "decision-records",
  "historical-change-artifacts",
  "source-headers",
] as const;
export const EXPECTED_HEADER_PATTERNS = ["Copyright", "source:", "Apache-2.0"] as const;

export type ScopeClass = {
  readonly id: string;
  readonly root?: string;
  readonly files?: string[];
  readonly roots?: string[];
  readonly excludedPrefixes?: string[];
};

export type PathAllowlistEntry = {
  readonly id: string;
  readonly kind: "path";
  readonly path: string;
};
export type LineAllowlistEntry = {
  readonly id: string;
  readonly kind: "line";
  readonly patterns: string[];
};
export type AllowlistEntry = PathAllowlistEntry | LineAllowlistEntry;

export type ForbiddenLiteralRegistry = {
  readonly corpusBaseline: string;
  readonly scopeClasses: ScopeClass[];
  readonly seedLiterals: string[];
  readonly allowlist: AllowlistEntry[];
  readonly registered: string[];
};

export type Violation = { readonly file: string; readonly line: number; readonly token: string };
export type ClassReport = { readonly id: string; readonly files: number; readonly detail?: string };
export type ScanOutcome = {
  readonly failures: string[];
  readonly violations: Violation[];
  readonly classes: ClassReport[];
  readonly registeredDocs: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sameMembers = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && right.every((entry) => left.includes(entry));

export const readRegistry = (root: string): ForbiddenLiteralRegistry =>
  JSON.parse(readFileSync(join(root, REGISTRY_PATH), "utf8")) as ForbiddenLiteralRegistry;

export const validateRegistryShape = (value: unknown): string[] => {
  const failures: string[] = [];
  if (!isRecord(value)) return ["registry must be a JSON object"];

  const baseline = value.corpusBaseline;
  if (typeof baseline !== "string" || !/^[0-9a-f]{40}$/.test(baseline)) {
    failures.push(
      `invalid corpusBaseline: must be a full 40-character commit SHA (never a branch, tag, or moving ref)`,
    );
  }

  const scopeClasses = value.scopeClasses;
  if (!Array.isArray(scopeClasses) || scopeClasses.length !== EXPECTED_SCOPE_IDS.length) {
    failures.push(
      `scope classes must be exactly the five DEC-8 classes (${EXPECTED_SCOPE_IDS.join(", ")})`,
    );
  } else {
    const ids = scopeClasses.map((entry) =>
      isRecord(entry) && typeof entry.id === "string" ? entry.id : "",
    );
    if (!sameMembers(ids, [...EXPECTED_SCOPE_IDS])) {
      failures.push(
        `scope classes must be exactly the five DEC-8 classes (${EXPECTED_SCOPE_IDS.join(", ")})`,
      );
    }
    const byId = new Map<string, Record<string, unknown>>();
    for (const entry of scopeClasses) {
      if (isRecord(entry) && typeof entry.id === "string") byId.set(entry.id, entry);
    }
    const packageTree = byId.get("packageTree");
    if (packageTree?.root !== "packages") {
      failures.push("scope class packageTree must scan the packages/ root");
    }
    const rootManifests = byId.get("rootManifests");
    if (
      !isRecord(rootManifests) ||
      !Array.isArray(rootManifests.files) ||
      !sameMembers(rootManifests.files as string[], [...EXPECTED_ROOT_MANIFESTS])
    ) {
      failures.push(
        `scope class rootManifests must name exactly ${EXPECTED_ROOT_MANIFESTS.join(", ")}`,
      );
    }
    const rootWorkspace = byId.get("rootWorkspaceFiles");
    if (
      !isRecord(rootWorkspace) ||
      !Array.isArray(rootWorkspace.files) ||
      !sameMembers(rootWorkspace.files as string[], [...EXPECTED_ROOT_WORKSPACE_FILES])
    ) {
      failures.push(
        `scope class rootWorkspaceFiles must name exactly the ADR root workspace files (${EXPECTED_ROOT_WORKSPACE_FILES.join(", ")})`,
      );
    }
    const ignoreRules = byId.get("ignoreRules");
    if (
      !isRecord(ignoreRules) ||
      !Array.isArray(ignoreRules.files) ||
      !sameMembers(ignoreRules.files as string[], [".gitignore"])
    ) {
      failures.push("scope class ignoreRules must scan .gitignore");
    }
    const docs = byId.get("userFacingDocs");
    if (
      !isRecord(docs) ||
      !Array.isArray(docs.roots) ||
      !sameMembers(docs.roots as string[], ["doc"]) ||
      !Array.isArray(docs.excludedPrefixes) ||
      !sameMembers(docs.excludedPrefixes as string[], ["doc/changes/", "doc/decisions/"])
    ) {
      failures.push(
        "scope class userFacingDocs must scan doc/ and exclude doc/changes/** and doc/decisions/**",
      );
    }
  }

  const seeds = value.seedLiterals;
  if (
    !Array.isArray(seeds) ||
    seeds.length !== EXPECTED_SEED_LITERALS.length ||
    ![...EXPECTED_SEED_LITERALS].every((seed, index) => seeds[index] === seed)
  ) {
    failures.push(
      `seedLiterals must be exactly the three DEC-8 seed tokens (${EXPECTED_SEED_LITERALS.join(", ")})`,
    );
  }

  const allowlist = value.allowlist;
  const allowlistFailure =
    "allowlist must be exactly the DEC-8 set (branding subpath, legacy adapter subpath, decision records, historical change artifacts, source headers)";
  if (!Array.isArray(allowlist) || allowlist.length !== EXPECTED_ALLOWLIST_IDS.length) {
    failures.push(allowlistFailure);
  } else {
    const entries = allowlist.filter(isRecord) as Array<Record<string, unknown>>;
    const ids = entries.map((entry) => (typeof entry.id === "string" ? entry.id : ""));
    if (!sameMembers(ids, [...EXPECTED_ALLOWLIST_IDS])) {
      failures.push(allowlistFailure);
    }
    const paths = entries
      .filter((entry) => entry.kind === "path")
      .map((entry) => (typeof entry.path === "string" ? entry.path : ""));
    const expectedPaths = [
      "packages/core/src/branding/",
      "packages/adapters/src/legacy/",
      "doc/decisions/",
      "doc/changes/",
    ];
    if (!sameMembers(paths, expectedPaths)) {
      failures.push(allowlistFailure);
    }
    const header = entries.find((entry) => entry.kind === "line");
    if (
      header === undefined ||
      !Array.isArray(header.patterns) ||
      !sameMembers(header.patterns as string[], [...EXPECTED_HEADER_PATTERNS])
    ) {
      failures.push(allowlistFailure);
    }
  }

  if (
    !Array.isArray(value.registered) ||
    value.registered.some((entry) => typeof entry !== "string")
  ) {
    failures.push("registered must be an explicit list of user-facing doc paths");
  } else if (new Set(value.registered as string[]).size !== (value.registered as string[]).length) {
    failures.push("registered contains duplicate entries");
  }

  return failures;
};

const isLowerAscii = (character: string | undefined): boolean =>
  character !== undefined && character >= "a" && character <= "z";

const hasDelimitedOccurrence = (haystack: string, needle: string): boolean => {
  const lowerHaystack = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  if (lowerNeedle.length === 0) return false;
  let from = 0;
  while (from <= lowerHaystack.length - lowerNeedle.length) {
    const index = lowerHaystack.indexOf(lowerNeedle, from);
    if (index < 0) return false;
    const before = index === 0 ? undefined : haystack[index - 1];
    const afterIndex = index + needle.length;
    const after = afterIndex >= haystack.length ? undefined : haystack[afterIndex];
    if (!isLowerAscii(before) && !isLowerAscii(after)) return true;
    from = index + 1;
  }
  return false;
};

/**
 * D1 matching: case-insensitive, delimited from lowercase ASCII letters on both
 * sides. The longest matching seed literal is reported (e.g. `~/.ados` reports
 * `~/.ados`, not the nested `ados`). A fully lowercase embedded identifier
 * (`myados`) is deliberately not matched (residual risk RSK-2).
 */
export const matchSeedLiteral = (text: string, seeds: readonly string[]): string | undefined => {
  const ordered = [...seeds].sort((left, right) => right.length - left.length);
  return ordered.find((seed) => hasDelimitedOccurrence(text, seed));
};

const SKIP_DIRECTORIES = new Set(["node_modules", "dist", "coverage", ".git", "tmp"]);

export const listFilesUnder = (root: string, relativeDir: string): string[] => {
  const directory = join(root, relativeDir);
  if (!existsSync(directory)) return [];
  const results: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        walk(next);
      } else {
        results.push(next);
      }
    }
  };
  walk(relativeDir);
  return results.sort();
};

/**
 * Tracked files plus untracked-but-not-ignored files under a directory. Ignored
 * private corpus content never enters the scan; a newly authored doc does.
 */
export const listRepoFiles = (root: string, relativeDir: string): string[] => {
  const result = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", relativeDir],
    { cwd: root, encoding: "utf8" },
  );
  if (result.status !== 0) return [];
  return (result.stdout ?? "")
    .split("\0")
    .filter((file) => file.length > 0)
    .sort();
};

const pathAllowlist = (registry: ForbiddenLiteralRegistry): string[] =>
  registry.allowlist
    .filter((entry): entry is PathAllowlistEntry => entry.kind === "path")
    .map((entry) => entry.path);

const headerPatterns = (registry: ForbiddenLiteralRegistry): string[] => {
  const entry = registry.allowlist.find(
    (candidate): candidate is LineAllowlistEntry => candidate.kind === "line",
  );
  return entry?.patterns ?? [];
};

const isPathAllowed = (file: string, registry: ForbiddenLiteralRegistry): boolean =>
  pathAllowlist(registry).some((prefix) => file.startsWith(prefix));

const isHeaderLine = (line: string, patterns: readonly string[]): boolean =>
  patterns.some((pattern) => line.includes(pattern));

const scanFile = (
  root: string,
  file: string,
  registry: ForbiddenLiteralRegistry,
  violations: Violation[],
): void => {
  if (isPathAllowed(file, registry)) return;
  const patterns = headerPatterns(registry);
  const lines = readFileSync(join(root, file), "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (isHeaderLine(line, patterns)) return;
    const token = matchSeedLiteral(line, registry.seedLiterals);
    if (token !== undefined) violations.push({ file, line: index + 1, token });
  });
};

const baselineDocs = (root: string, baseline: string, excluded: readonly string[]): Set<string> => {
  const result = spawnSync("git", ["ls-tree", "-r", "--name-only", baseline, "--", "doc"], {
    cwd: root,
    encoding: "utf8",
  });
  const set = new Set<string>();
  if (result.status !== 0) return set;
  for (const line of (result.stdout ?? "").split("\n")) {
    const file = line.trim();
    if (!file) continue;
    if (excluded.some((prefix) => file.startsWith(prefix))) continue;
    if (file.split("/").includes("tmp")) continue;
    set.add(file);
  }
  return set;
};

const scopeClass = (registry: ForbiddenLiteralRegistry, id: string): ScopeClass => {
  const entry = registry.scopeClasses.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`registry is missing scope class ${id}`);
  return entry;
};

export const scan = (root: string): ScanOutcome => {
  let registry: ForbiddenLiteralRegistry;
  try {
    registry = readRegistry(root);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      failures: [`cannot read ${REGISTRY_PATH}: ${reason}`],
      violations: [],
      classes: [],
      registeredDocs: [],
    };
  }

  const failures = validateRegistryShape(registry);
  if (failures.length > 0) {
    return { failures, violations: [], classes: [], registeredDocs: [] };
  }

  const reachable = spawnSync("git", ["cat-file", "-e", `${registry.corpusBaseline}^{commit}`], {
    cwd: root,
    encoding: "utf8",
  });
  if (reachable.status !== 0) {
    return {
      failures: [
        `missing or unreachable corpusBaseline ${registry.corpusBaseline}; fetch the recorded commit (the docs scope fails closed)`,
      ],
      violations: [],
      classes: [],
      registeredDocs: [],
    };
  }

  const violations: Violation[] = [];
  const classes: ClassReport[] = [];

  const packageTree = scopeClass(registry, "packageTree");
  const packageFiles = listRepoFiles(root, packageTree.root ?? "packages").filter((file) =>
    existsSync(join(root, file)),
  );
  for (const file of packageFiles) scanFile(root, file, registry, violations);
  classes.push({ id: "packageTree", files: packageFiles.length });

  for (const [id, label] of [
    ["rootManifests", "root manifests"],
    ["rootWorkspaceFiles", "root workspace files"],
    ["ignoreRules", "ignore rules"],
  ] as const) {
    const entry = scopeClass(registry, id);
    const files = entry.files ?? [];
    for (const file of files) {
      if (!existsSync(join(root, file))) {
        failures.push(`missing scope file for ${label}: ${file}`);
        continue;
      }
      scanFile(root, file, registry, violations);
    }
    classes.push({ id, files: files.length });
  }

  const docsClass = scopeClass(registry, "userFacingDocs");
  const excluded = docsClass.excludedPrefixes ?? [];
  const presentDocs = listRepoFiles(root, docsClass.roots?.[0] ?? "doc")
    .filter((file) => !excluded.some((prefix) => file.startsWith(prefix)))
    .filter((file) => existsSync(join(root, file)));
  const baselineSet = baselineDocs(root, registry.corpusBaseline, excluded);
  const presentSet = new Set(presentDocs);
  const registeredSet = new Set(registry.registered);

  for (const doc of presentDocs) {
    if (!baselineSet.has(doc) && !registeredSet.has(doc)) {
      failures.push(`unregistered user-facing doc absent at corpusBaseline: ${doc}`);
    }
  }
  for (const entry of registry.registered) {
    if (!presentSet.has(entry)) {
      failures.push(`registered doc is missing from the tree: ${entry}`);
    } else if (baselineSet.has(entry)) {
      failures.push(`registered doc is present at corpusBaseline: ${entry}`);
    }
  }

  const scannedDocs = registry.registered.filter((entry) => presentSet.has(entry));
  for (const doc of scannedDocs) scanFile(root, doc, registry, violations);
  classes.push({
    id: "userFacingDocs",
    files: scannedDocs.length,
    detail: scannedDocs.length > 0 ? `registered: ${scannedDocs.join(", ")}` : "registered: none",
  });

  return { failures, violations, classes, registeredDocs: scannedDocs };
};

if (import.meta.main) {
  const outcome = scan(process.cwd());
  for (const failure of outcome.failures) {
    console.error(`FAIL forbidden-literals: ${failure}`);
  }
  for (const violation of outcome.violations) {
    console.error(
      `FAIL forbidden-literals: ${violation.file}:${violation.line}: ${violation.token}`,
    );
  }
  if (outcome.failures.length > 0 || outcome.violations.length > 0) process.exit(1);
  console.log(
    `OK forbidden-literals: ${outcome.classes.length}/5 scope classes scanned, 0 violations`,
  );
  for (const entry of outcome.classes) {
    console.log(`  ${entry.id}: ${entry.files} file(s)${entry.detail ? ` (${entry.detail})` : ""}`);
  }
  console.log(
    `  registered docs: ${outcome.registeredDocs.length > 0 ? outcome.registeredDocs.join(", ") : "none"}`,
  );
}
