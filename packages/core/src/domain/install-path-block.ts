/**
 * The managed PATH block (F-12; DM-5, OQ-TP-7).
 *
 * One delimited block in one operator profile file: a start marker and an end
 * marker derived from the declared binary name, and between them exactly the
 * one export line that puts the install directory first. The file is
 * `--shell-profile` when given, otherwise the DECLARED shell mapping of the
 * basename of the injected `SHELL` value with the home marker expanded. An
 * identical block is never re-appended; different content is replaced in place
 * and never duplicated.
 */
import { INSTALL_SHELL_PROFILE_MAPPING, type InstallShellName } from "../contracts/install.js";

export type PathBlock = {
  readonly file: string;
  readonly marker: string;
  readonly startMarker: string;
  readonly endMarker: string;
  readonly exportLine: string;
  readonly text: string;
};

/** The declared shell mapping's profile path for one shell basename. */
export const shellProfileFor = (shell: string | undefined): string | undefined => {
  if (shell === undefined || shell.length === 0) return undefined;
  const basename = shell.split("/").pop() ?? "";
  if (!Object.hasOwn(INSTALL_SHELL_PROFILE_MAPPING, basename)) return undefined;
  return INSTALL_SHELL_PROFILE_MAPPING[basename as InstallShellName];
};

/** Expand the leading home marker against the invoking home. */
export const expandHome = (path: string, homeDirectory: string): string =>
  path.startsWith("~/") ? `${homeDirectory}/${path.slice(2)}` : path;

/**
 * Resolve the profile file: an explicit `--shell-profile` always wins; otherwise
 * the declared shell mapping of the injected `SHELL` basename; otherwise
 * `undefined` (the typed unresolved-shell refusal).
 */
export const resolveProfilePath = (input: {
  readonly explicit?: string;
  readonly shell?: string;
  readonly homeDirectory: string;
}): string | undefined => {
  if (input.explicit !== undefined && input.explicit.length > 0) {
    return expandHome(input.explicit, input.homeDirectory);
  }
  const mapped = shellProfileFor(input.shell);
  return mapped === undefined ? undefined : expandHome(mapped, input.homeDirectory);
};

/** Render the one block for a binary name and its install directory. */
export const renderPathBlock = (input: {
  readonly binaryName: string;
  readonly installDirectory: string;
  readonly file: string;
}): PathBlock => {
  const marker = `${input.binaryName}-install-path`;
  const startMarker = `# >>> ${marker} >>>`;
  const endMarker = `# <<< ${marker} <<<`;
  const exportLine = `export PATH="${input.installDirectory}:$PATH"`;
  return {
    file: input.file,
    marker,
    startMarker,
    endMarker,
    exportLine,
    text: `${startMarker}\n${exportLine}\n${endMarker}\n`,
  };
};

const blockRegion = (
  text: string,
  block: PathBlock,
): { readonly start: number; readonly end: number } | undefined => {
  const start = text.indexOf(block.startMarker);
  if (start < 0) return undefined;
  const endMarkerIndex = text.indexOf(block.endMarker, start);
  if (endMarkerIndex < 0) return undefined;
  const end = endMarkerIndex + block.endMarker.length;
  return { start, end: text.slice(end, end + 1) === "\n" ? end + 1 : end };
};

/**
 * Merge one block into a profile text: an identical block is not re-appended, a
 * different block at the same markers is replaced IN PLACE, and a profile
 * without the block gains exactly one copy at the end.
 */
export const mergePathBlock = (existing: string, block: PathBlock): string => {
  const region = blockRegion(existing, block);
  if (region === undefined) {
    const separator = existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
    return `${existing}${separator}${block.text}`;
  }
  const current = existing.slice(region.start, region.end);
  return current === block.text
    ? existing
    : `${existing.slice(0, region.start)}${block.text}${existing.slice(region.end)}`;
};

/** Remove exactly the managed block; nothing else in the profile changes. */
export const removePathBlock = (existing: string, block: PathBlock): string => {
  const region = blockRegion(existing, block);
  return region === undefined
    ? existing
    : `${existing.slice(0, region.start)}${existing.slice(region.end)}`;
};

/** Whether a profile already carries the identical block (content-idempotence). */
export const hasIdenticalBlock = (existing: string, block: PathBlock): boolean => {
  const region = blockRegion(existing, block);
  return region !== undefined && existing.slice(region.start, region.end) === block.text;
};
