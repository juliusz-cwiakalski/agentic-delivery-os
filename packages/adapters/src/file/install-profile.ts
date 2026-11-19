/**
 * `@delivery-os/adapters/file` — the one operator-owned file the product writes.
 *
 * A profile read, and the block append/replace/remove expressed as a whole-file
 * staged-and-renamed write. Nothing else outside the Jaiship namespaces and the
 * install directory is written, and only when the operator asked for it.
 */
import type { InstallFilePort } from "@delivery-os/core/contracts";

/** The profile file mode: the operator's own file, never tightened silently. */
export const INSTALL_PROFILE_MODE = 0o644;

/** Read a profile text; an absent profile is the empty text. */
export const readProfileText = (input: {
  readonly fs: InstallFilePort;
  readonly path: string;
}): string => {
  if (!input.fs.exists(input.path)) return "";
  return input.fs.readText(input.path) ?? "";
};

/**
 * Write the profile atomically: create the parent directory when an explicit
 * `--shell-profile` names one that does not exist yet, stage beside the file,
 * then rename.
 */
export const writeProfileText = (input: {
  readonly fs: InstallFilePort;
  readonly path: string;
  readonly text: string;
}): boolean => {
  const parent = input.path.slice(0, input.path.lastIndexOf("/"));
  if (parent.length > 0 && !input.fs.mkdirp(parent)) return false;
  const staged = input.fs.writeStaged(
    input.path,
    new TextEncoder().encode(input.text),
    INSTALL_PROFILE_MODE,
  );
  if (!staged.ok) return false;
  if (!input.fs.rename(staged.stagedPath, input.path)) {
    input.fs.remove(staged.stagedPath);
    return false;
  }
  return true;
};
