/**
 * TC-SHIM-001 fixture: the shim-registry loader, the shape/window/site
 * validator, the in-corpus occurrence counter, the six mutant families, and the
 * changeset-derived window comparator.
 *
 * Everything here is test-local: the production authority is the registry
 * document itself. The counter resolves each line to the shim whose literal is
 * the longest match at that line, so `DELIVERY_OS_WORKING_NAME` never counts as
 * the bare prefix and `.delivery-os-state` never counts as `.delivery-os`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

export const SHIM_REGISTRY_PATH = "scripts/checks/namespace-shims.registry.json";
export const FORBIDDEN_REGISTRY_PATH = "scripts/checks/forbidden-literals.registry.json";

export const SHIM_KINDS = ["executable", "path", "environment", "environment-prefix"] as const;
export const SHIM_DIRECTIONS = ["invocation", "read-only", "mapping"] as const;
export const SHIM_LINEAGES = ["delivery-os", "pre-freeze"] as const;

export type ShimKind = (typeof SHIM_KINDS)[number];
export type ShimDirection = (typeof SHIM_DIRECTIONS)[number];
export type ShimLineage = (typeof SHIM_LINEAGES)[number];

export type ShimSite = {
  readonly file: string;
  readonly role: string;
  readonly maxOccurrences?: number;
};

export type ShimWindow = {
  readonly declaredIn: string;
  readonly removalRelease: string | null;
};

export type Shim = {
  readonly id: string;
  readonly kind: ShimKind;
  readonly literal: string;
  readonly direction: ShimDirection;
  readonly lineage: ShimLineage;
  readonly noticeId: string;
  readonly notice: string;
  readonly window: ShimWindow;
  readonly owner: string;
  readonly sites: readonly ShimSite[];
};

export type ShimRegistry = {
  readonly schemaId: string;
  readonly window: ShimWindow;
  readonly shims: readonly Shim[];
};

/** The seven normative families of spec Appendix F. */
export const EXPECTED_SHIM_IDS = [
  "executable-alias",
  "prior-config-directory",
  "prior-state-root",
  "prior-working-name-override",
  "prior-environment-prefix",
  "pre-freeze-environment-prefix",
  "pre-freeze-config-directory",
] as const;

export const LOCKSTEP_PACKAGES = [
  "@delivery-os/core",
  "@delivery-os/adapters",
  "@delivery-os/cli",
  "@delivery-os/mcp",
  "@delivery-os/opencode",
] as const;

export const loadShimRegistry = (root: string): ShimRegistry =>
  JSON.parse(readFileSync(join(root, SHIM_REGISTRY_PATH), "utf8")) as ShimRegistry;

const ROOT_CONTROL_FILES = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "tsconfig.base.json",
  "biome.json",
  "commitlint.config.js",
  ".dependency-cruiser.cjs",
  ".bun-version",
  ".changeset/config.json",
  "bunfig.toml",
  ".gitignore",
] as const;

type ForbiddenRegistry = {
  readonly registered?: readonly string[];
};

/** The registered docs the content arm scans (the declaration-only docs are absent). */
export const registeredDocs = (root: string): readonly string[] => {
  const registry = JSON.parse(
    readFileSync(join(root, FORBIDDEN_REGISTRY_PATH), "utf8"),
  ) as ForbiddenRegistry;
  return registry.registered ?? [];
};

/**
 * Whether a declared site lies inside a scanned corpus. Prompt, script, package
 * and root-manifest scopes are unconditional; a document is in-corpus only when
 * the forbidden-literal registry registers it.
 */
export const isInCorpus = (file: string, registered: readonly string[]): boolean => {
  if (
    file.startsWith("packages/") ||
    file.startsWith(".opencode/") ||
    file.startsWith("scripts/") ||
    file.startsWith("tools/")
  ) {
    return true;
  }
  if ((ROOT_CONTROL_FILES as readonly string[]).includes(file)) return true;
  return file.startsWith("doc/") && registered.includes(file);
};

const DELIMITED = /[A-Za-z0-9_-]/;

const isDelimitedAt = (text: string, index: number, length: number): boolean => {
  const before = index === 0 ? undefined : text[index - 1];
  const after = index + length >= text.length ? undefined : text[index + length];
  if (before === "@") return false;
  if (before !== undefined && DELIMITED.test(before)) return false;
  if (after !== undefined && DELIMITED.test(after)) return false;
  return true;
};

const countDelimited = (line: string, literal: string): number => {
  let count = 0;
  let from = 0;
  for (;;) {
    const index = line.indexOf(literal, from);
    if (index === -1) return count;
    if (isDelimitedAt(line, index, literal.length) && !line.includes("agentic-delivery-os")) {
      count += 1;
    }
    from = index + 1;
  }
};

const countPlain = (line: string, literal: string): number => {
  let count = 0;
  let from = 0;
  for (;;) {
    const index = line.indexOf(literal, from);
    if (index === -1) return count;
    count += 1;
    from = index + literal.length;
  }
};

export const countOccurrences = (line: string, shim: Shim): number =>
  shim.kind === "executable" ? countDelimited(line, shim.literal) : countPlain(line, shim.literal);

/** The shim whose literal is the longest match on the line, if any. */
const lineShim = (line: string, shims: readonly Shim[]): Shim | undefined => {
  let best: Shim | undefined;
  for (const shim of shims) {
    if (countOccurrences(line, shim) === 0) continue;
    if (best === undefined || shim.literal.length > best.literal.length) best = shim;
  }
  return best;
};

/** Occurrences of one shim's literal in one file, resolved line by line. */
export const occurrencesInFile = (
  root: string,
  file: string,
  shim: Shim,
  shims: readonly Shim[],
): number => {
  const path = join(root, file);
  if (!existsSync(path) || !statSync(path).isFile()) return 0;
  let total = 0;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (lineShim(line, shims)?.id === shim.id) total += countOccurrences(line, shim);
  }
  return total;
};

export type SiteReport = {
  readonly shimId: string;
  readonly file: string;
  readonly inCorpus: boolean;
  readonly occurrences: number;
  readonly budget: number;
  readonly matched: boolean;
};

export const siteReports = (registry: ShimRegistry, root: string): readonly SiteReport[] => {
  const registered = registeredDocs(root);
  return registry.shims.flatMap((shim) =>
    shim.sites.map((site) => {
      const inCorpus = isInCorpus(site.file, registered);
      const occurrences = occurrencesInFile(root, site.file, shim, registry.shims);
      return {
        shimId: shim.id,
        file: site.file,
        inCorpus,
        occurrences,
        budget: site.maxOccurrences ?? 1,
        matched: inCorpus && occurrences > 0,
      };
    }),
  );
};

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export const compareSemver = (left: string, right: string): number => {
  const a = SEMVER.exec(left);
  const b = SEMVER.exec(right);
  if (a === null || b === null) return Number.NaN;
  for (let index = 1; index <= 3; index += 1) {
    const delta = Number(a[index]) - Number(b[index]);
    if (delta !== 0) return delta;
  }
  return 0;
};

export const bumpMinor = (version: string): string => {
  const match = SEMVER.exec(version);
  if (match === null) return "";
  return `${match[1]}.${String(Number(match[2]) + 1)}.0`;
};

const isWindow = (value: unknown): value is ShimWindow => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.declaredIn === "string" &&
    (typeof record.removalRelease === "string" || record.removalRelease === null)
  );
};

const isSite = (value: unknown): value is ShimSite => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.file === "string" && typeof record.role === "string";
};

const isShim = (value: unknown): value is Shim => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.kind === "string" &&
    typeof record.literal === "string" &&
    typeof record.direction === "string" &&
    typeof record.lineage === "string" &&
    typeof record.noticeId === "string" &&
    typeof record.notice === "string" &&
    typeof record.owner === "string" &&
    isWindow(record.window) &&
    Array.isArray(record.sites)
  );
};

/**
 * Validate the registry document against `namespace.shims.v1`. Returns one
 * message per violation, each naming the offending shim, site, or field.
 */
export const validateRegistry = (registry: ShimRegistry, root: string): string[] => {
  const failures: string[] = [];
  if (registry.schemaId !== "namespace.shims.v1") {
    failures.push(`schemaId expected namespace.shims.v1, received ${String(registry.schemaId)}`);
  }
  if (!isWindow(registry.window) || registry.window.removalRelease === null) {
    failures.push("registry window defaults must declare a declaredIn and a removalRelease");
  } else if (!(compareSemver(registry.window.removalRelease, registry.window.declaredIn) > 0)) {
    failures.push(
      `window not strictly increasing: registry ${registry.window.declaredIn} -> ${registry.window.removalRelease}`,
    );
  }
  if (!Array.isArray(registry.shims) || registry.shims.length === 0) {
    failures.push("registry declares no shims");
    return failures;
  }

  const ids = new Set<string>();
  for (const [index, entry] of registry.shims.entries()) {
    if (!isShim(entry)) {
      failures.push(`shim at index ${String(index)} is missing a required field`);
      continue;
    }
    const shim = entry;
    if (shim.id.length === 0) failures.push(`shim at index ${String(index)} has an empty id`);
    if (!(SHIM_KINDS as readonly string[]).includes(shim.kind)) {
      failures.push(`unknown shim kind: ${String(shim.kind)}`);
    }
    if (!(SHIM_DIRECTIONS as readonly string[]).includes(shim.direction)) {
      failures.push(`unknown shim direction: ${String(shim.direction)}`);
    }
    if (!(SHIM_LINEAGES as readonly string[]).includes(shim.lineage)) {
      failures.push(`unknown shim lineage: ${String(shim.lineage)}`);
    }
    if (shim.literal.length === 0) failures.push(`shim ${shim.id} has an empty literal`);
    if (shim.noticeId.length === 0) failures.push(`shim ${shim.id} has an empty noticeId`);
    if (shim.owner.length === 0) failures.push(`shim ${shim.id} has an empty owner`);
    if (shim.notice.length === 0 || shim.notice.includes("\n")) {
      failures.push(`shim ${shim.id} notice must be one bounded sentence`);
    }
    if (!isWindow(shim.window)) {
      failures.push(`shim ${shim.id} has no resolvable window`);
    } else if (shim.lineage === "delivery-os") {
      if (shim.window.removalRelease === null) {
        failures.push(`shim ${shim.id} must declare a removalRelease`);
      } else if (!(compareSemver(shim.window.removalRelease, shim.window.declaredIn) > 0)) {
        failures.push(
          `window not strictly increasing: ${shim.id} ${shim.window.declaredIn} -> ${shim.window.removalRelease}`,
        );
      }
    } else if (shim.window.removalRelease !== null) {
      failures.push(`pre-freeze shim ${shim.id} must declare removalRelease null`);
    }

    if (ids.has(shim.id)) failures.push(`duplicate shim id: ${shim.id}`);
    ids.add(shim.id);

    if (shim.sites.length === 0) failures.push(`shim ${shim.id} declares no sites`);
    for (const site of shim.sites) {
      if (!isSite(site)) {
        failures.push(`shim ${shim.id} has a malformed site`);
        continue;
      }
      if (site.file.length === 0) failures.push(`shim ${shim.id} has a site with an empty file`);
      if (site.file.includes("*")) failures.push(`wildcard site refused: ${site.file}`);
      const path = join(root, site.file);
      if (!existsSync(path)) {
        failures.push(`declared site absent: ${site.file} (shim ${shim.id})`);
        continue;
      }
      if (site.file.endsWith("/") && !statSync(path).isDirectory()) {
        failures.push(`declared site prefix is not a directory: ${site.file}`);
      }
      if (!site.file.endsWith("/") && !statSync(path).isFile()) {
        failures.push(`declared site is not a file: ${site.file}`);
      }
      if (
        site.maxOccurrences !== undefined &&
        (!Number.isInteger(site.maxOccurrences) || site.maxOccurrences <= 0)
      ) {
        failures.push(`site ${site.file} maxOccurrences must be a positive integer`);
      }
    }
  }

  const literals = registry.shims.map((shim) => shim.literal);
  for (const id of EXPECTED_SHIM_IDS) {
    const shim = registry.shims.find((entry) => entry.id === id);
    if (shim === undefined) failures.push(`missing shim family: ${id}`);
  }
  for (const literal of new Set(literals)) {
    const owners = registry.shims.filter((shim) => shim.literal === literal);
    if (owners.length !== 1) {
      failures.push(
        `expected exactly one shim declaring literal ${literal}; found ${String(owners.length)}`,
      );
    }
  }

  // Lineage separation: a pre-freeze site file may never be a DELIVERY_OS_ site.
  const deliverySites = new Set(
    registry.shims
      .filter((shim) => shim.lineage === "delivery-os")
      .flatMap((shim) => shim.sites.map((site) => site.file)),
  );
  for (const shim of registry.shims.filter((entry) => entry.lineage === "pre-freeze")) {
    for (const site of shim.sites) {
      if (deliverySites.has(site.file)) {
        failures.push(`lineage sites overlap: ${site.file} (${shim.id} and a delivery-os shim)`);
      }
    }
  }

  // Presence always; match and budget only for a site inside a scanned corpus.
  const registered = registeredDocs(root);
  for (const shim of registry.shims) {
    for (const site of shim.sites) {
      if (!isInCorpus(site.file, registered)) continue;
      if (!existsSync(join(root, site.file))) continue;
      const occurrences = occurrencesInFile(root, site.file, shim, registry.shims);
      const budget = site.maxOccurrences ?? 1;
      if (occurrences === 0) {
        failures.push(`declared in-corpus site not matched: ${shim.id} ${site.file}`);
      } else if (occurrences > budget) {
        failures.push(
          `occurrence budget exceeded: ${site.file} ${String(occurrences)} > ${String(budget)}`,
        );
      }
    }
  }

  return failures;
};

/** Parse the changeset frontmatter into a package→bump map. */
const changesetReleases = (
  root: string,
): readonly {
  readonly file: string;
  readonly packages: Readonly<Record<string, string>>;
}[] => {
  const directory = join(root, ".changeset");
  return readdirSync(directory)
    .filter((name) => name.endsWith(".md") && /gh-?365/i.test(name))
    .sort()
    .map((file) => {
      const text = readFileSync(join(directory, file), "utf8");
      const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
      const packages =
        match === null ? {} : ((parseYaml(match[1] ?? "") as Record<string, string> | null) ?? {});
      return { file, packages };
    });
};

export type ChangesetWindow = {
  readonly files: readonly string[];
  readonly failures: string[];
  readonly declaredIn: string;
  readonly removalRelease: string;
};

/**
 * Derive the delivery-os one-release window from the change's changeset: the
 * release that ships this change (a minor bump over the shared current version)
 * and the next minor as its removal release.
 */
export const changesetWindow = (root: string): ChangesetWindow => {
  const failures: string[] = [];
  const releases = changesetReleases(root);
  if (releases.length !== 1) {
    failures.push(`changeset for GH-365 expected exactly one, received ${String(releases.length)}`);
  }
  const versions = LOCKSTEP_PACKAGES.map((name) => {
    const directory = name.replace("@delivery-os/", "");
    const manifest = JSON.parse(
      readFileSync(join(root, "packages", directory, "package.json"), "utf8"),
    ) as { version?: string };
    return manifest.version ?? "";
  });
  const [version] = versions;
  if (version === undefined || versions.some((candidate) => candidate !== version)) {
    failures.push(`lockstep packages do not share one version: ${versions.join(", ")}`);
  }
  const first = releases[0];
  if (first !== undefined) {
    for (const name of LOCKSTEP_PACKAGES) {
      if (first.packages[name] !== "minor") {
        failures.push(`changeset ${first.file} must bump ${name} minor`);
      }
    }
  }
  const declaredIn = version === undefined ? "" : bumpMinor(version);
  const removalRelease = declaredIn === "" ? "" : bumpMinor(declaredIn);
  return {
    files: releases.map((release) => release.file),
    failures,
    declaredIn,
    removalRelease,
  };
};

const clone = (registry: ShimRegistry): ShimRegistry => structuredClone(registry);

const withFirstShim = (registry: ShimRegistry, mutate: (shim: Shim) => Shim): ShimRegistry => {
  const shims = [...registry.shims];
  const first = shims[0];
  if (first !== undefined) shims[0] = mutate(first);
  return { ...registry, shims };
};

/** Six mutant families; `unknown kind` and `unknown direction` share one family. */
export const mutantBuilders = {
  duplicateId: (registry: ShimRegistry): ShimRegistry => {
    const next = clone(registry);
    const [first, second] = next.shims;
    if (first === undefined || second === undefined) return next;
    const shims = [...next.shims];
    shims[1] = { ...second, id: first.id };
    return { ...next, shims };
  },
  unknownKind: (registry: ShimRegistry): ShimRegistry =>
    withFirstShim(registry, (shim) => ({ ...shim, kind: "unsupported" as ShimKind })),
  unknownDirection: (registry: ShimRegistry): ShimRegistry =>
    withFirstShim(registry, (shim) => ({ ...shim, direction: "unsupported" as ShimDirection })),
  emptySites: (registry: ShimRegistry): ShimRegistry =>
    withFirstShim(registry, (shim) => ({ ...shim, sites: [] })),
  absentSite: (registry: ShimRegistry): ShimRegistry =>
    withFirstShim(registry, (shim) => {
      const site = shim.sites[0];
      if (site === undefined) return shim;
      return { ...shim, sites: [{ ...site, file: "does/not/exist/declared-site.ts" }] };
    }),
  wildcardSite: (registry: ShimRegistry): ShimRegistry =>
    withFirstShim(registry, (shim) => {
      const site = shim.sites[0];
      if (site === undefined) return shim;
      return { ...shim, sites: [{ ...site, file: "packages/**" }] };
    }),
  nonIncreasingWindow: (registry: ShimRegistry): ShimRegistry =>
    withFirstShim(registry, (shim) => ({
      ...shim,
      window: { declaredIn: "0.2.0", removalRelease: "0.2.0" },
    })),
} as const;
