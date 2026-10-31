import { existsSync, readFileSync } from "node:fs";
import type {
  ConfigAcquisition,
  ConfigFailure,
  ConfigFileLayer,
  ConfigSkippedLayer,
  ConfigSourceFacts,
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

  // Project-committed: selection occupies this slot; otherwise root-only file.
  if (selected !== undefined) {
    sources.push(...selectedFacts);
  } else if (root === undefined) {
    skips.push(skipped("project-committed", "no-git-root"));
  } else {
    const file = under(root, input.configurationDirectoryName, "config.yaml");
    if (!input.fs.exists(file)) skips.push(optionalMissing("project-committed"));
    else {
      const failure = readLayer("project-committed", file, sources);
      if (failure) return { ok: false, error: failure };
    }
  }

  // Project-local: selection > ci-disabled > no-git-root > missing.
  if (hasSelection) {
    skips.push(skipped("project-local", "selected-config"));
  } else if (ci && !input.enableProjectLocalConfig) {
    skips.push(skipped("project-local", "ci-disabled"));
  } else if (root === undefined) {
    skips.push(skipped("project-local", "no-git-root"));
  } else {
    const file = under(root, input.configurationDirectoryName, "config.local.yaml");
    if (!input.fs.exists(file)) skips.push(optionalMissing("project-local"));
    else {
      const failure = readLayer("project-local", file, sources);
      if (failure) return { ok: false, error: failure };
    }
  }

  return { ok: true, sources, skipped: skips };
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
