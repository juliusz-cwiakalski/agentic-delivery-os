/**
 * The project configuration document reader (GH-309 F-1, F-2, DM-1).
 *
 * The adapter seam locates `<gitRoot>/<configDirectoryName>/projects.yaml`
 * beside the delivered project-committed configuration file, reads it through
 * the delivered yaml-parser seam, and hands the parsed value to the caller. It
 * performs no product-tier validation and imports no core root (the adapters
 * package-matrix rule); the pure validator in `core` classifies the value.
 * Absence is the valid empty listing; a path that cannot be read is the
 * unreadable-scope boundary; readable bytes that fail the parse are malformed.
 * Filesystem facts are injected; production wraps `node:fs`.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { PROJECT_GROUPS_CONFIG_ARTIFACT_NAME } from "@delivery-os/core/contracts";
import { parseConfigYaml } from "./yaml-parser.js";

/** The injected filesystem facts; tests supply deterministic maps. */
export type ProjectConfigFileSystem = {
  readonly pathExists: (path: string) => boolean;
  readonly isDirectory: (path: string) => boolean;
  readonly readText: (path: string) => string;
};

/** The production filesystem facts over `node:fs`. */
export const nodeProjectConfigFileSystem = (): ProjectConfigFileSystem => ({
  pathExists: (path) => {
    try {
      return existsSync(path);
    } catch {
      return false;
    }
  },
  isDirectory: (path) => {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  },
  readText: (path) => readFileSync(path, "utf8"),
});

const trimTrailingSeparators = (path: string): string => path.replace(/[\\/]+$/, "");

/** The configuration document path beside the project-committed configuration file. */
export const projectGroupsConfigPath = (
  gitRoot: string,
  configurationDirectoryName: string,
): string =>
  `${trimTrailingSeparators(gitRoot)}/${configurationDirectoryName}/${PROJECT_GROUPS_CONFIG_ARTIFACT_NAME}`;

/**
 * One bounded configuration read: the parsed document value (absent included as
 * `undefined`, which the validator reads as the valid empty listing), readable
 * bytes that failed the parse, or the unreadable path (the scope boundary).
 */
export type ProjectGroupsConfigRead =
  | { readonly state: "document"; readonly path: string; readonly value: unknown }
  | { readonly state: "malformed"; readonly path: string }
  | { readonly state: "unreadable"; readonly path: string };

/** Read the configuration document for one invoking checkout root. */
export const readProjectGroupsConfig = (input: {
  readonly gitRoot: string;
  readonly configurationDirectoryName: string;
  /**
   * The prior identity's configuration-directory name (GH-320 F-3). The prior
   * document is read only when the current-identity document is absent.
   */
  readonly priorConfigurationDirectoryName?: string;
  readonly fs?: ProjectConfigFileSystem;
}): ProjectGroupsConfigRead => {
  const fs = input.fs ?? nodeProjectConfigFileSystem();
  const currentPath = projectGroupsConfigPath(input.gitRoot, input.configurationDirectoryName);
  const path =
    input.priorConfigurationDirectoryName === undefined
      ? currentPath
      : (() => {
          try {
            if (fs.pathExists(currentPath)) return currentPath;
            const priorPath = projectGroupsConfigPath(
              input.gitRoot,
              input.priorConfigurationDirectoryName,
            );
            return fs.pathExists(priorPath) ? priorPath : currentPath;
          } catch {
            return currentPath;
          }
        })();
  const parent = dirname(path);
  // A naturally absent configuration directory is the common adopt-as-empty
  // case; a parent that exists but is not a directory (or cannot be probed at
  // all) is the unreadable-scope boundary (TC-GRPDOC-003).
  const parentUsable = (() => {
    try {
      return fs.pathExists(parent) ? fs.isDirectory(parent) : true;
    } catch {
      return false;
    }
  })();
  if (!parentUsable) return { state: "unreadable", path };
  const present = (() => {
    try {
      return fs.pathExists(path);
    } catch {
      return false;
    }
  })();
  if (!present) return { state: "document", path, value: undefined };
  let text: string;
  try {
    text = fs.readText(path);
  } catch {
    return { state: "unreadable", path };
  }
  const parsed = parseConfigYaml(text, "project-committed", path);
  return parsed.ok
    ? { state: "document", path, value: parsed.facts.values }
    : { state: "malformed", path };
};
