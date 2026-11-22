/**
 * TC-BRANDING-008/009/010/011/027 + GH-365 TC-SCAN-001/002 + TC-SHIM-002 —
 * full-scope forbidden-literal scan with the prior-namespace seed class.
 *
 * The registry (`forbidden-literals.registry.json`) is the single source for the
 * seven scope classes, the delivered DEC-8 seed set and allowlist, the fixed
 * corpus baseline, the registered user-facing docs, and the GH-365
 * `priorNamespace` class: its five seeds, its explicit per-class selection, its
 * neutral sites, its declared corpora, and its shim-registry site authority. The
 * scan is read-only over repository content and local git history: it never
 * touches the network and never writes to a tree.
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
  "promptSurface",
  "scriptSurface",
  "userFacingDocs",
] as const;
export const DELIVERED_SCOPE_IDS = [
  "packageTree",
  "rootManifests",
  "rootWorkspaceFiles",
  "ignoreRules",
  "userFacingDocs",
] as const;
export const PRIOR_NAMESPACE_SCOPE_IDS = [
  "packageTree",
  "rootManifests",
  "ignoreRules",
  "promptSurface",
  "scriptSurface",
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
export const EXPECTED_HEADER_PATTERNS = [
  "Copyright",
  "source:",
  "Apache-2.0",
  "ados_distribution:",
] as const;

export const EXPECTED_PRIOR_SEEDS = [
  "prior-config-directory",
  "prior-state-directory",
  "prior-home-config",
  "prior-environment-prefix",
  "prior-executable",
] as const;
export const EXPECTED_NEUTRAL_SITES = [
  "package.json",
  "pnpm-lock.yaml",
  "packages/core/src/branding/index.ts",
] as const;
export const EXPECTED_DECLARED_CORPORA = [
  "doc/changes/",
  "doc/decisions/",
  "doc/planning/oss-tooling/milestones/m1/commands/",
  "doc/inception/analysis/phase-4-quality-baseline.md",
] as const;
export const EXPECTED_SHIM_REGISTRY = "scripts/checks/namespace-shims.registry.json";

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

export type PriorNamespaceSeed = {
  readonly id: string;
  readonly literal: string;
  readonly match: "delimited";
  readonly excludePrecededBy?: readonly string[];
  readonly excludeWithin?: readonly string[];
  readonly scopeClasses?: readonly string[];
};

export type NeutralSite = {
  readonly file: string;
  readonly reason: string;
  readonly seed?: string;
  readonly maxOccurrences?: number;
};

export type DeclaredCorpus = {
  readonly prefix: string;
  readonly reason: string;
};

export type PriorNamespaceBlock = {
  readonly seeds: PriorNamespaceSeed[];
  readonly scopeSelection: Record<string, readonly string[]>;
  readonly neutralSites: NeutralSite[];
  readonly declaredCorpora: DeclaredCorpus[];
  readonly shimRegistry: string;
};

export type ForbiddenLiteralRegistry = {
  readonly corpusBaseline: string;
  readonly scopeClasses: ScopeClass[];
  readonly seedLiterals: string[];
  readonly allowlist: AllowlistEntry[];
  readonly registered: string[];
  readonly priorNamespace?: PriorNamespaceBlock;
};

export type Violation = { readonly file: string; readonly line: number; readonly token: string };
export type ClassReport = { readonly id: string; readonly files: number; readonly detail?: string };

export type NamespaceSiteReport = {
  readonly shimId: string;
  readonly file: string;
  readonly inCorpus: boolean;
  readonly present: boolean;
  readonly occurrences: number;
  readonly budget: number;
  readonly matched: boolean;
};

export type ScanOutcome = {
  readonly failures: string[];
  readonly violations: Violation[];
  readonly classes: ClassReport[];
  readonly registeredDocs: string[];
  readonly sites: readonly NamespaceSiteReport[];
};

export type ScanOptions = {
  /** Test seam: skip the unconditional declared-site presence assertion. */
  readonly checkSitePresence?: boolean;
  /** Test seam: read the shim registry from another path. */
  readonly shimRegistryPath?: string;
};

type DeclaredShim = {
  readonly id: string;
  readonly literal: string;
  readonly lineage?: string;
  readonly sites: readonly { readonly file: string; readonly maxOccurrences?: number }[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sameMembers = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && right.every((entry) => left.includes(entry));

const sameSequence = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && right.every((entry, index) => left[index] === entry);

export const readRegistry = (root: string): ForbiddenLiteralRegistry =>
  JSON.parse(readFileSync(join(root, REGISTRY_PATH), "utf8")) as ForbiddenLiteralRegistry;

const validatePriorNamespace = (value: unknown): string[] => {
  const failures: string[] = [];
  if (!isRecord(value)) {
    failures.push(
      "priorNamespace block is required (seeds, scopeSelection, neutralSites, declaredCorpora, shimRegistry)",
    );
    return failures;
  }
  const seeds = value.seeds;
  if (!Array.isArray(seeds) || seeds.length !== EXPECTED_PRIOR_SEEDS.length) {
    failures.push(
      `priorNamespace seeds must be exactly the five declared seeds (${EXPECTED_PRIOR_SEEDS.join(", ")})`,
    );
  } else {
    const ids = seeds.map((entry) =>
      isRecord(entry) && typeof entry.id === "string" ? entry.id : "",
    );
    if (!sameMembers(ids, [...EXPECTED_PRIOR_SEEDS])) {
      failures.push(
        `priorNamespace seeds must be exactly the five declared seeds (${EXPECTED_PRIOR_SEEDS.join(", ")})`,
      );
    }
    const seedById = new Map<string, Record<string, unknown>>();
    for (const entry of seeds) {
      if (isRecord(entry) && typeof entry.id === "string") seedById.set(entry.id, entry);
    }
    // The expected seed literals are assembled from fragments so this checker
    // module itself stays free of a prior-namespace literal.
    const priorLiteral = (...parts: readonly string[]): string => parts.join("");
    const expectedLiterals: Record<string, string> = {
      "prior-config-directory": priorLiteral(".", "delivery", "-os"),
      "prior-state-directory": priorLiteral(".", "delivery", "-os", "-state"),
      "prior-home-config": priorLiteral("~/", ".", "delivery", "-os"),
      "prior-environment-prefix": priorLiteral("DELIVERY", "_OS", "_"),
      "prior-executable": priorLiteral("delivery", "-os"),
    };
    for (const [id, literal] of Object.entries(expectedLiterals)) {
      if (seedById.get(id)?.literal !== literal) {
        failures.push(`priorNamespace seed ${id} must declare literal ${literal}`);
      }
    }
    const executable = seedById.get("prior-executable");
    if (
      !isRecord(executable) ||
      !Array.isArray(executable.excludePrecededBy) ||
      !sameMembers(executable.excludePrecededBy as string[], ["@"]) ||
      !Array.isArray(executable.excludeWithin) ||
      !sameMembers(executable.excludeWithin as string[], ["agentic-delivery-os"]) ||
      !Array.isArray(executable.scopeClasses)
    ) {
      failures.push(
        "priorNamespace seed prior-executable must exclude the @ scope sigil and agentic-delivery-os and declare its scope classes",
      );
    }
  }

  const selection = value.scopeSelection;
  if (!isRecord(selection) || !sameMembers(Object.keys(selection), [...EXPECTED_SCOPE_IDS])) {
    failures.push(
      `priorNamespace scopeSelection must name exactly the seven classes (${EXPECTED_SCOPE_IDS.join(", ")})`,
    );
  } else {
    for (const id of EXPECTED_SCOPE_IDS) {
      const selected = selection[id];
      if (!Array.isArray(selected)) {
        failures.push(`priorNamespace scopeSelection must map ${id} to a class list`);
        continue;
      }
      const carriesPrior = (selected as string[]).includes("priorNamespace");
      const carriesDelivered = (selected as string[]).includes("seedLiterals");
      const expectedPrior = (PRIOR_NAMESPACE_SCOPE_IDS as readonly string[]).includes(id);
      const expectedDelivered = (DELIVERED_SCOPE_IDS as readonly string[]).includes(id);
      if (carriesPrior !== expectedPrior) {
        failures.push(
          `priorNamespace scopeSelection: ${id} ${expectedPrior ? "must carry" : "must not carry"} the priorNamespace class`,
        );
      }
      if (carriesDelivered !== expectedDelivered) {
        failures.push(
          `priorNamespace scopeSelection: ${id} ${expectedDelivered ? "must carry" : "must not carry"} the delivered seedLiterals class`,
        );
      }
    }
    const prompt = selection.promptSurface;
    const script = selection.scriptSurface;
    if (!Array.isArray(prompt) || !sameSequence(prompt as string[], ["priorNamespace"])) {
      failures.push("priorNamespace scopeSelection: promptSurface must map to priorNamespace only");
    }
    if (!Array.isArray(script) || !sameSequence(script as string[], ["priorNamespace"])) {
      failures.push("priorNamespace scopeSelection: scriptSurface must map to priorNamespace only");
    }
  }

  const neutralSites = value.neutralSites;
  if (!Array.isArray(neutralSites) || neutralSites.length !== EXPECTED_NEUTRAL_SITES.length) {
    failures.push(
      `priorNamespace neutralSites must be exactly the three declared sites (${EXPECTED_NEUTRAL_SITES.join(", ")})`,
    );
  } else {
    const files = neutralSites.map((entry) =>
      isRecord(entry) && typeof entry.file === "string" ? entry.file : "",
    );
    if (!sameMembers(files, [...EXPECTED_NEUTRAL_SITES])) {
      failures.push(
        `priorNamespace neutralSites must be exactly the three declared sites (${EXPECTED_NEUTRAL_SITES.join(", ")})`,
      );
    }
    const branding = neutralSites.find(
      (entry) => isRecord(entry) && entry.file === "packages/core/src/branding/index.ts",
    );
    if (
      !isRecord(branding) ||
      branding.seed !== "prior-executable" ||
      branding.maxOccurrences !== 1
    ) {
      failures.push(
        "priorNamespace neutralSites: the SCOPE_ORG site must declare seed prior-executable and maxOccurrences 1",
      );
    }
  }

  const corpora = value.declaredCorpora;
  if (!Array.isArray(corpora)) {
    failures.push("priorNamespace declaredCorpora must be a list of prefixes");
  } else {
    const valid = corpora.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.prefix === "string" &&
        entry.prefix.length > 0 &&
        typeof entry.reason === "string" &&
        entry.reason.length > 0,
    );
    if (!valid) {
      failures.push("priorNamespace declaredCorpora entries must declare a prefix and a reason");
    }
    const prefixes = corpora.map((entry) =>
      isRecord(entry) && typeof entry.prefix === "string" ? entry.prefix : "",
    );
    for (const prefix of ["doc/changes/", "doc/decisions/"] as const) {
      if (!prefixes.includes(prefix)) {
        failures.push(`priorNamespace declaredCorpora is missing the delivered prefix ${prefix}`);
      }
    }
  }

  if (value.shimRegistry !== EXPECTED_SHIM_REGISTRY) {
    failures.push(`priorNamespace shimRegistry must point at ${EXPECTED_SHIM_REGISTRY}`);
  }
  return failures;
};

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
      `scope classes must be exactly the seven declared classes (${EXPECTED_SCOPE_IDS.join(", ")})`,
    );
  } else {
    const ids = scopeClasses.map((entry) =>
      isRecord(entry) && typeof entry.id === "string" ? entry.id : "",
    );
    if (!sameMembers(ids, [...EXPECTED_SCOPE_IDS])) {
      const missing = EXPECTED_SCOPE_IDS.filter((id) => !ids.includes(id));
      failures.push(
        `scope classes must be exactly the seven declared classes (${EXPECTED_SCOPE_IDS.join(", ")}); missing: ${missing.join(", ")}`,
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
    const promptSurface = byId.get("promptSurface");
    if (promptSurface?.root !== ".opencode") {
      failures.push("scope class promptSurface must scan the .opencode/ root");
    }
    const scriptSurface = byId.get("scriptSurface");
    if (
      !isRecord(scriptSurface) ||
      !Array.isArray(scriptSurface.roots) ||
      !sameMembers(scriptSurface.roots as string[], ["scripts", "tools"])
    ) {
      failures.push("scope class scriptSurface must scan the scripts/ and tools/ roots");
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

  failures.push(...validatePriorNamespace(value.priorNamespace));
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

/** Whether a prior-namespace literal occurrence is delimited and not excluded. */
const TOKEN_CHARACTER = /[A-Za-z0-9_-]/;

const priorLiteralAllowed = (line: string, index: number, seed: PriorNamespaceSeed): boolean => {
  const before = index === 0 ? undefined : line[index - 1];
  const afterIndex = index + seed.literal.length;
  const after = afterIndex >= line.length ? undefined : line[afterIndex];
  if (before !== undefined && (seed.excludePrecededBy ?? []).includes(before)) return false;
  if (before !== undefined && TOKEN_CHARACTER.test(before)) return false;
  // An environment prefix is followed by its own suffix, so only its left
  // boundary delimits it; a path or executable literal is delimited on both
  // sides, so `delivery-osx` and `delivery-os-x` are not standalone tokens.
  if (!seed.literal.endsWith("_") && after !== undefined && TOKEN_CHARACTER.test(after)) {
    return false;
  }
  for (const within of seed.excludeWithin ?? []) {
    let from = 0;
    for (;;) {
      const at = line.indexOf(within, from);
      if (at === -1) break;
      if (index >= at && index < at + within.length) return false;
      from = at + 1;
    }
  }
  return true;
};

export type PriorNamespaceMatch = {
  readonly index: number;
  readonly seed: PriorNamespaceSeed;
};

/** The longest prior-namespace seed literal on a line, if any (matcher probe). */
export const matchPriorNamespaceLiteral = (
  line: string,
  block: PriorNamespaceBlock,
): string | undefined => matchPriorNamespaceLine(line, block)[0]?.seed.literal;

/**
 * The prior-namespace matcher: one non-overlapping longest-first match list per
 * line. Case-sensitive exact literals; a nested shorter literal is suppressed by
 * the longer literal that contains it (the state-root literal beats the
 * config-directory literal, and the config-directory literal beats the bare
 * executable token).
 */
export const matchPriorNamespaceLine = (
  line: string,
  block: PriorNamespaceBlock,
): readonly PriorNamespaceMatch[] => {
  const candidates: PriorNamespaceMatch[] = [];
  for (const seed of block.seeds) {
    let from = 0;
    for (;;) {
      const index = line.indexOf(seed.literal, from);
      if (index === -1) break;
      if (priorLiteralAllowed(line, index, seed)) candidates.push({ index, seed });
      from = index + 1;
    }
  }
  candidates.sort(
    (left, right) =>
      left.index - right.index || right.seed.literal.length - left.seed.literal.length,
  );
  const selected: PriorNamespaceMatch[] = [];
  let cursor = -1;
  for (const candidate of candidates) {
    if (candidate.index < cursor) continue;
    selected.push(candidate);
    cursor = candidate.index + candidate.seed.literal.length;
  }
  return selected;
};

const SEED_TO_SHIM: Readonly<Record<string, string>> = {
  "prior-config-directory": "prior-config-directory",
  "prior-state-directory": "prior-state-root",
  "prior-home-config": "prior-config-directory",
  "prior-environment-prefix": "prior-environment-prefix",
  "prior-executable": "executable-alias",
};

export const resolvePriorShim = (
  line: string,
  match: PriorNamespaceMatch,
  shims: readonly DeclaredShim[],
): DeclaredShim | undefined => {
  let resolved = shims.find((shim) => shim.id === SEED_TO_SHIM[match.seed.id]);
  for (const shim of shims) {
    if (!line.startsWith(shim.literal, match.index)) continue;
    if (resolved === undefined || shim.literal.length > resolved.literal.length) resolved = shim;
  }
  return resolved;
};

const isDeclaredCorpus = (block: PriorNamespaceBlock, file: string): boolean =>
  block.declaredCorpora.some((corpus) => file.startsWith(corpus.prefix));

const declaredSiteFor = (
  shim: DeclaredShim,
  file: string,
): { readonly file: string; readonly maxOccurrences?: number } | undefined => {
  const matches = shim.sites.filter(
    (site) => site.file === file || (site.file.endsWith("/") && file.startsWith(site.file)),
  );
  return matches.sort((left, right) => right.file.length - left.file.length)[0];
};

const neutralSiteFor = (
  block: PriorNamespaceBlock,
  file: string,
  seed: PriorNamespaceSeed,
): NeutralSite | undefined =>
  block.neutralSites.find(
    (site) => site.file === file && (site.seed === undefined || site.seed === seed.id),
  );

const readShimRegistry = (root: string, path: string): readonly DeclaredShim[] => {
  const text = readFileSync(join(root, path), "utf8");
  const document = JSON.parse(text) as { shims?: unknown };
  if (!Array.isArray(document.shims)) return [];
  return document.shims.filter(
    (entry): entry is DeclaredShim =>
      isRecord(entry) &&
      typeof entry.id === "string" &&
      typeof entry.literal === "string" &&
      Array.isArray(entry.sites),
  );
};

const classOfFile = (registry: ForbiddenLiteralRegistry, file: string): string | undefined => {
  const packageTree = registry.scopeClasses.find((entry) => entry.id === "packageTree");
  if (packageTree?.root !== undefined && file.startsWith(`${packageTree.root}/`)) {
    return "packageTree";
  }
  for (const id of ["rootManifests", "rootWorkspaceFiles", "ignoreRules"] as const) {
    const entry = registry.scopeClasses.find((candidate) => candidate.id === id);
    if ((entry?.files ?? []).includes(file)) return id;
  }
  const promptSurface = registry.scopeClasses.find((entry) => entry.id === "promptSurface");
  if (promptSurface?.root !== undefined && file.startsWith(`${promptSurface.root}/`)) {
    return "promptSurface";
  }
  const scriptSurface = registry.scopeClasses.find((entry) => entry.id === "scriptSurface");
  if ((scriptSurface?.roots ?? []).some((root) => file.startsWith(`${root}/`))) {
    return "scriptSurface";
  }
  if (registry.registered.includes(file)) return "userFacingDocs";
  return undefined;
};

const carries = (
  registry: ForbiddenLiteralRegistry,
  classId: string | undefined,
  seedSet: "seedLiterals" | "priorNamespace",
): boolean =>
  classId !== undefined &&
  (registry.priorNamespace?.scopeSelection[classId] ?? []).includes(seedSet);

const seedAppliesToClass = (seed: PriorNamespaceSeed, classId: string | undefined): boolean =>
  classId !== undefined && (seed.scopeClasses === undefined || seed.scopeClasses.includes(classId));

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

const scanDeliveredFile = (
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
    const hit = matchSeedLiteral(line, registry.seedLiterals);
    if (hit !== undefined) violations.push({ file, line: index + 1, token: hit });
  });
};

const countPriorOccurrences = (
  root: string,
  file: string,
  shimId: string,
  block: PriorNamespaceBlock,
  shims: readonly DeclaredShim[],
): number => {
  const path = join(root, file);
  if (!existsSync(path)) return 0;
  let total = 0;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    for (const match of matchPriorNamespaceLine(line, block)) {
      if (resolvePriorShim(line, match, shims)?.id === shimId) total += 1;
    }
  }
  return total;
};

/**
 * The prior-namespace pass over one scanned file. A declared corpus is exempt; a
 * neutral site and a declared shim site bound their own occurrences; every other
 * occurrence is a violation. The delivered DEC-8 allowlist never filters it.
 */
const scanPriorFile = (
  root: string,
  file: string,
  registry: ForbiddenLiteralRegistry,
  block: PriorNamespaceBlock,
  shims: readonly DeclaredShim[],
  classId: string,
  violations: Violation[],
): void => {
  if (isDeclaredCorpus(block, file)) return;
  const counts = new Map<string, number>();
  const lines = readFileSync(join(root, file), "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of matchPriorNamespaceLine(line, block)) {
      if (!seedAppliesToClass(match.seed, classId)) continue;
      const shim = resolvePriorShim(line, match, shims);
      if (shim === undefined) continue;
      const neutral = neutralSiteFor(block, file, match.seed);
      const site = declaredSiteFor(shim, file);
      const key = `${shim.id}\u0000${file}\u0000${neutral === undefined ? (site === undefined ? "undeclared" : "site") : "neutral"}`;
      const seen = (counts.get(key) ?? 0) + 1;
      counts.set(key, seen);
      const matchedLiteral = match.seed.literal;
      if (neutral === undefined && site === undefined) {
        violations.push({ file, line: index + 1, token: matchedLiteral });
        continue;
      }
      const budget = neutral?.maxOccurrences ?? site?.maxOccurrences ?? 1;
      if (seen > budget) violations.push({ file, line: index + 1, token: matchedLiteral });
    }
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

const reconcileSites = (
  root: string,
  registry: ForbiddenLiteralRegistry,
  block: PriorNamespaceBlock,
  shims: readonly DeclaredShim[],
  checkPresence: boolean,
  failures: string[],
): readonly NamespaceSiteReport[] => {
  const reports: NamespaceSiteReport[] = [];
  for (const shim of shims) {
    for (const site of shim.sites) {
      const present = existsSync(join(root, site.file));
      if (!present && checkPresence) {
        failures.push(`declared site absent: ${site.file} (shim ${shim.id})`);
      }
      const classId = classOfFile(registry, site.file);
      const inCorpus =
        carries(registry, classId, "priorNamespace") && shim.lineage !== "pre-freeze";
      const occurrences =
        present && inCorpus ? countPriorOccurrences(root, site.file, shim.id, block, shims) : 0;
      const budget = site.maxOccurrences ?? 1;
      reports.push({
        shimId: shim.id,
        file: site.file,
        inCorpus,
        present,
        occurrences,
        budget,
        matched: inCorpus && occurrences > 0,
      });
    }
  }
  return reports;
};

export const scan = (root: string, options: ScanOptions = {}): ScanOutcome => {
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
      sites: [],
    };
  }

  const failures = validateRegistryShape(registry);
  if (failures.length > 0) {
    return { failures, violations: [], classes: [], registeredDocs: [], sites: [] };
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
      sites: [],
    };
  }

  const block = registry.priorNamespace;
  if (block === undefined) {
    return {
      failures: ["priorNamespace block is required"],
      violations: [],
      classes: [],
      registeredDocs: [],
      sites: [],
    };
  }
  let shims: readonly DeclaredShim[] = [];
  try {
    shims = readShimRegistry(root, options.shimRegistryPath ?? block.shimRegistry);
  } catch {
    failures.push(
      `cannot read the shim registry ${options.shimRegistryPath ?? block.shimRegistry}`,
    );
  }

  const violations: Violation[] = [];
  const classes: ClassReport[] = [];

  const packageTree = scopeClass(registry, "packageTree");
  const packageFiles = listRepoFiles(root, packageTree.root ?? "packages").filter((file) =>
    existsSync(join(root, file)),
  );
  for (const file of packageFiles) {
    const classId = "packageTree";
    if (carries(registry, classId, "seedLiterals"))
      scanDeliveredFile(root, file, registry, violations);
    if (carries(registry, classId, "priorNamespace")) {
      scanPriorFile(root, file, registry, block, shims, classId, violations);
    }
  }
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
      if (carries(registry, id, "seedLiterals"))
        scanDeliveredFile(root, file, registry, violations);
      if (carries(registry, id, "priorNamespace")) {
        scanPriorFile(root, file, registry, block, shims, id, violations);
      }
    }
    classes.push({ id, files: files.length });
  }

  for (const id of ["promptSurface", "scriptSurface"] as const) {
    const entry = scopeClass(registry, id);
    const roots = id === "promptSurface" ? [entry.root ?? ".opencode"] : (entry.roots ?? []);
    const files = roots
      .flatMap((relative) => listRepoFiles(root, relative))
      .filter((file) => existsSync(join(root, file)));
    for (const file of files) {
      if (carries(registry, id, "seedLiterals"))
        scanDeliveredFile(root, file, registry, violations);
      if (carries(registry, id, "priorNamespace")) {
        scanPriorFile(root, file, registry, block, shims, id, violations);
      }
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
  for (const doc of scannedDocs) {
    if (carries(registry, "userFacingDocs", "seedLiterals")) {
      scanDeliveredFile(root, doc, registry, violations);
    }
    if (carries(registry, "userFacingDocs", "priorNamespace")) {
      scanPriorFile(root, doc, registry, block, shims, "userFacingDocs", violations);
    }
  }
  classes.push({
    id: "userFacingDocs",
    files: scannedDocs.length,
    detail: scannedDocs.length > 0 ? `registered: ${scannedDocs.join(", ")}` : "registered: none",
  });

  const sites = reconcileSites(
    root,
    registry,
    block,
    shims,
    options.checkSitePresence ?? true,
    failures,
  );

  return { failures, violations, classes, registeredDocs: scannedDocs, sites };
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
    `OK forbidden-literals: ${outcome.classes.length}/7 scope classes scanned, 0 violations`,
  );
  for (const entry of outcome.classes) {
    console.log(`  ${entry.id}: ${entry.files} file(s)${entry.detail ? ` (${entry.detail})` : ""}`);
  }
  console.log(
    `  registered docs: ${outcome.registeredDocs.length > 0 ? outcome.registeredDocs.join(", ") : "none"}`,
  );
}
