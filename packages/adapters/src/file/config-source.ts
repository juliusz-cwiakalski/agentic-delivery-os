import { existsSync, readFileSync } from "node:fs";
import type {
  ConfigAcquisition,
  ConfigFailure,
  ConfigFileLayer,
  ConfigPriorOutcome,
  ConfigSkippedLayer,
  ConfigSourceFacts,
  VerifyCommittedConfigDocumentRead,
} from "@delivery-os/core/contracts";
import { parseConfigYaml } from "./yaml-parser.js";

export type RuntimePlatform = "linux" | "darwin" | "win32";

/** Injected filesystem facts. Tests supply deterministic maps; production wraps fs. */
export type FileSystemFacts = {
  readonly exists: (path: string) => boolean;
  readonly readText: (path: string) => string;
};

export type FileAcquisitionInput = {
  readonly platform: RuntimePlatform;
  readonly homeDirectory: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly gitRoot?: string | undefined;
  readonly explicitProjectRoot?: string | undefined;
  readonly selectedConfig?: string | undefined;
  readonly enableSystemConfig: boolean;
  readonly enableUserConfig: boolean;
  readonly enableProjectLocalConfig: boolean;
  readonly configurationDirectoryName: string;
  /**
   * The prior identity's configuration-directory name (GH-320 F-3, DM-2). When
   * present, the two repository-owned layers consider the prior file second;
   * machine-global layers and an explicitly selected file never fall back.
   */
  readonly priorConfigurationDirectoryName?: string;
  readonly fs: FileSystemFacts;
};

const trimTrailingSeparators = (path: string): string => path.replace(/[\\/]+$/, "");
const under = (base: string, configurationDirectoryName: string, name: string): string =>
  `${trimTrailingSeparators(base)}/${configurationDirectoryName}/${name}`;

const systemCandidates = (input: FileAcquisitionInput): string[] => {
  const variable = input.environment;
  if (input.platform === "linux") {
    const configured = (variable.XDG_CONFIG_DIRS ?? "")
      .split(":")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const bases = configured.length > 0 ? configured : ["/etc/xdg"];
    return bases.map((base) => under(base, input.configurationDirectoryName, "config.yaml"));
  }
  if (input.platform === "darwin") {
    return [under("/Library/Application Support", input.configurationDirectoryName, "config.yaml")];
  }
  const programData = variable.PROGRAMDATA;
  return programData ? [under(programData, input.configurationDirectoryName, "config.yaml")] : [];
};

const userCandidates = (input: FileAcquisitionInput): string[] => {
  const variable = input.environment;
  if (input.platform === "linux") {
    const base =
      variable.XDG_CONFIG_HOME || `${trimTrailingSeparators(input.homeDirectory)}/.config`;
    return [under(base, input.configurationDirectoryName, "config.yaml")];
  }
  if (input.platform === "darwin") {
    return [
      under(
        `${trimTrailingSeparators(input.homeDirectory)}/Library/Application Support`,
        input.configurationDirectoryName,
        "config.yaml",
      ),
    ];
  }
  const appData = variable.APPDATA;
  return appData ? [under(appData, input.configurationDirectoryName, "config.yaml")] : [];
};

const unreadable = (layer: ConfigFileLayer, file: string): ConfigFailure => ({
  kind: "config",
  code: "config.value.invalid",
  layer,
  file,
});
const optionalMissing = (layer: ConfigFileLayer): ConfigSkippedLayer => ({
  layer,
  reason: "missing",
});
const skipped = (
  layer: ConfigFileLayer,
  reason: ConfigSkippedLayer["reason"],
): ConfigSkippedLayer => ({
  layer,
  reason,
});

/**
 * Acquire ordered plain source facts. Eligibility and DM-2 reasons are decided
 * before any content read; skipped layers never call `readText` or parse. An
 * explicitly selected file is read before the optional discovery layers so its
 * failure carries the selected path, never a platform discovery candidate.
 */
export const acquireFileConfig = (input: FileAcquisitionInput): ConfigAcquisition => {
  const sources: ConfigSourceFacts[] = [];
  const skips: ConfigSkippedLayer[] = [];
  const prior: ConfigPriorOutcome[] = [];
  const ci = input.environment.CI === "true";
  const root = input.explicitProjectRoot || input.gitRoot || undefined;
  const selected = input.selectedConfig;
  const hasSelection = selected !== undefined;

  const readLayer = (
    layer: ConfigFileLayer,
    file: string,
    sink: ConfigSourceFacts[],
  ): ConfigFailure | undefined => {
    try {
      const text = input.fs.readText(file);
      const parsed = parseConfigYaml(text, layer, file);
      if (!parsed.ok) return parsed.error;
      sink.push(parsed.facts);
      return undefined;
    } catch {
      return unreadable(layer, file);
    }
  };

  // Selection: read before optional discovery so an explicit selection failure
  // is attributed to the selected path; facts wait for the committed slot.
  const selectedFacts: ConfigSourceFacts[] = [];
  if (selected !== undefined) {
    if (selected.length === 0 || !input.fs.exists(selected))
      return { ok: false, error: unreadable("project-committed", selected) };
    const failure = readLayer("project-committed", selected, selectedFacts);
    if (failure) return { ok: false, error: failure };
  }

  // System: CI first-match, then first existing candidate, then missing.
  if (ci && !input.enableSystemConfig) {
    skips.push(skipped("system", "ci-disabled"));
  } else {
    const candidate = systemCandidates(input).find((path) => input.fs.exists(path));
    if (candidate === undefined) skips.push(optionalMissing("system"));
    else {
      const failure = readLayer("system", candidate, sources);
      if (failure) return { ok: false, error: failure };
    }
  }

  // User-global: independent CI switch.
  if (ci && !input.enableUserConfig) {
    skips.push(skipped("user-global", "ci-disabled"));
  } else {
    const candidate = userCandidates(input).find((path) => input.fs.exists(path));
    if (candidate === undefined) skips.push(optionalMissing("user-global"));
    else {
      const failure = readLayer("user-global", candidate, sources);
      if (failure) return { ok: false, error: failure };
    }
  }

  // The two repository-owned layers consider the prior identity's file second
  // (GH-320 F-3, DEC-7/DEC-8): the current file wins whenever it exists and the
  // prior file is then reported not used; the prior file is read only when the
  // current file is absent. Existence-only probing: a shadowed prior file is
  // never opened.
  const priorFileFor = (name: string): string | undefined =>
    root === undefined || input.priorConfigurationDirectoryName === undefined
      ? undefined
      : under(root, input.priorConfigurationDirectoryName, name);

  const readEligibleLayer = (
    layer: "project-committed" | "project-local",
    name: string,
  ): ConfigFailure | undefined => {
    if (root === undefined) return undefined;
    const currentFile = under(root, input.configurationDirectoryName, name);
    const priorFile = priorFileFor(name);
    if (input.fs.exists(currentFile)) {
      if (priorFile !== undefined && input.fs.exists(priorFile)) {
        prior.push({ state: "not used", layer, file: priorFile, currentFile });
      }
      return readLayer(layer, currentFile, sources);
    }
    if (priorFile !== undefined && input.fs.exists(priorFile)) {
      const failure = readLayer(layer, priorFile, sources);
      if (failure === undefined) {
        prior.push({ state: "read", layer, file: priorFile, currentFile });
      }
      return failure;
    }
    skips.push(optionalMissing(layer));
    return undefined;
  };

  // Project-committed: selection occupies this slot; otherwise root-only file.
  if (selected !== undefined) {
    sources.push(...selectedFacts);
  } else if (root === undefined) {
    skips.push(skipped("project-committed", "no-git-root"));
  } else {
    const failure = readEligibleLayer("project-committed", "config.yaml");
    if (failure) return { ok: false, error: failure };
  }

  // Project-local: selection > ci-disabled > no-git-root > missing.
  if (hasSelection) {
    skips.push(skipped("project-local", "selected-config"));
  } else if (ci && !input.enableProjectLocalConfig) {
    skips.push(skipped("project-local", "ci-disabled"));
  } else if (root === undefined) {
    skips.push(skipped("project-local", "no-git-root"));
  } else {
    const failure = readEligibleLayer("project-local", "config.local.yaml");
    if (failure) return { ok: false, error: failure };
  }

  return { ok: true, sources, skipped: skips, ...(prior.length === 0 ? {} : { prior }) };
};

/**
 * Read the one document that occupies the project-committed layer slot (DM-9).
 *
 * Exactly one path is resolved: the explicitly selected file when a selection is
 * in play, else `<root>/<configDirectoryName>/config.yaml` where `<root>` is
 * `explicitProjectRoot`, falling back to `gitRoot` — the same pair
 * `acquireFileConfig` resolves. At most one stat-class existence probe and at
 * most one bounded content read are performed, with zero content reads when
 * neither a selected nor a committed path exists. No system, user-global,
 * project-local, environment, or CLI source is read and the merged layer tree is
 * never consulted. The document's content is classified, never interpreted: a
 * parser-level failure anywhere is `unparseable`, an unreadable path is
 * `unreadable`, and a selection naming a missing or unreadable path is
 * `selected-unusable`, which the map read refuses rather than treating as
 * undeclared.
 */
export const readCommittedConfigDocument = (
  input: FileAcquisitionInput,
): VerifyCommittedConfigDocumentRead => {
  const root = input.explicitProjectRoot || input.gitRoot || undefined;
  const selected = input.selectedConfig;

  const readPath = (file: string): VerifyCommittedConfigDocumentRead => {
    let text: string;
    try {
      text = input.fs.readText(file);
    } catch {
      return { ok: false, state: "unreadable" };
    }
    const parsed = parseConfigYaml(text, "project-committed", file);
    if (!parsed.ok) return { ok: false, state: "unparseable" };
    return { ok: true, state: "parsed", document: parsed.facts.values };
  };

  if (selected !== undefined) {
    if (selected.length === 0 || !input.fs.exists(selected)) {
      return { ok: false, state: "selected-unusable" };
    }
    const outcome = readPath(selected);
    return outcome.ok ? outcome : { ok: false, state: "selected-unusable" };
  }
  if (root === undefined) return { ok: true, state: "absent" };
  const file = under(root, input.configurationDirectoryName, "config.yaml");
  if (!input.fs.exists(file)) return { ok: true, state: "absent" };
  return readPath(file);
};

/**
 * Supply raw environment facts with only explicit recognized names excluded.
 * Prefix validation/mapping stays in the pure core catalog resolver.
 */
export const neutralEnvironmentFacts = (
  environment: Readonly<Record<string, string | undefined>>,
  excludedNames: readonly string[],
): Record<string, string | undefined> => {
  const facts: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(environment)) {
    if (value !== undefined && !excludedNames.includes(name)) facts[name] = value;
  }
  return facts;
};

/** Production filesystem facts; composition roots inject them into acquisition. */
export const nodeFileSystemFacts = (): FileSystemFacts => ({
  exists: (path) => existsSync(path),
  readText: (path) => readFileSync(path, "utf8"),
});

/** The host platform is an injected fact; this wrapper is for the runtime edge. */
export const runtimePlatform = (): RuntimePlatform => {
  if (process.platform === "darwin") return "darwin";
  if (process.platform === "win32") return "win32";
  return "linux";
};
