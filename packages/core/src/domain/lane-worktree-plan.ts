/**
 * The lane worktree plan (GH-404 F-2, F-3, DM-3; DEC-6, NFR-7).
 *
 * Pure domain over injected, already-resolved PHYSICAL paths: the
 * deterministic worktree path scheme `<worktree-root>/<checkout-basename>-<ref>`,
 * the sibling-of-main-checkout default root, the ordered provisioning steps
 * executed strictly before the first lane phase, and the lane-environment
 * derivation (the worktree's dependency binaries lead `PATH`, the gate
 * temporary directory anchored inside the worktree with the evidence literal
 * `$PWD/tmp/tmpdir` unchanged because the lane's working directory IS the
 * worktree). No I/O, no spawn, no clock, no configuration reads; symlinked
 * aliases never enter — callers resolve real paths before calling.
 */

/** The ordered provisioning steps, executed in this order before `clarify_scope`. */
export const LANE_PROVISIONING_STEPS = [
  "install-dependencies",
  "build-gate-prerequisites",
  "create-gate-temporary-directory",
] as const;

export type LaneProvisioningStep = (typeof LANE_PROVISIONING_STEPS)[number];

/**
 * The lockfile-driven install command template (OQ-1 settlement): the
 * workspace's pinned package manager installs from the committed lockfile.
 */
export const LANE_WORKTREE_INSTALL_COMMAND = "pnpm install --frozen-lockfile" as const;

/** The evidence literal the pm-notes convention keeps; the physical resolution anchors to the lane's worktree (DEC-6). */
export const GATE_TEMPORARY_DIRECTORY_EVIDENCE_LITERAL = "$PWD/tmp/tmpdir" as const;

const trimTrailingSeparators = (value: string): string => value.replace(/[\\/]+$/u, "");

/** One path segment's parent directory (the sibling root of a checkout). */
export const parentDirectory = (path: string): string => {
  const trimmed = trimTrailingSeparators(path);
  const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return index <= 0 ? trimmed : trimmed.slice(0, index);
};

/** One checkout directory's own name (the last path segment), separators trimmed. */
export const checkoutBasenameOf = (path: string): string => {
  const trimmed = trimTrailingSeparators(path);
  const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return index < 0 ? trimmed : trimmed.slice(index + 1);
};

/**
 * The default worktree root: the parent of the clone's PHYSICAL location, so
 * each lane worktree lands as a sibling of the main checkout (DM-3). The input
 * is the already-resolved real path — an alias resolved here would defeat
 * NFR-7, so none is ever taken.
 */
export const defaultLaneWorktreeRoot = (input: { readonly physicalCheckoutRoot: string }): string =>
  parentDirectory(input.physicalCheckoutRoot);

/** The effective worktree root: the explicit `lane.worktree-root` setting wins; absent takes the sibling default (DM-3). */
export const resolveLaneWorktreeRoot = (input: {
  readonly configuredRoot?: string;
  readonly physicalCheckoutRoot: string;
}): string =>
  input.configuredRoot === undefined
    ? defaultLaneWorktreeRoot({ physicalCheckoutRoot: input.physicalCheckoutRoot })
    : trimTrailingSeparators(input.configuredRoot);

/**
 * The deterministic lane worktree path: `<worktree-root>/<checkout-basename>-<ref>`
 * (F-2). Both roots and the basename arrive already resolved to physical paths.
 */
export const laneWorktreePath = (input: {
  readonly worktreeRoot: string;
  readonly physicalCheckoutRoot: string;
  readonly ref: string;
}): string =>
  `${trimTrailingSeparators(input.worktreeRoot)}/${checkoutBasenameOf(input.physicalCheckoutRoot)}-${input.ref}`;

/** The new branch every lane worktree is created on, at the tip of the base branch (F-2). */
export const laneWorktreeBranch = (input: { readonly ref: string }): string => `lane/${input.ref}`;

/** The derived lane environment for one worktree lane (F-3). */
export type LaneWorktreeEnvironment = {
  /** The lane's working directory: its worktree. */
  readonly workingDirectory: string;
  /** The worktree's dependency binaries; they lead `PATH`. */
  readonly pathLeadingBin: string;
  /** The gate temporary directory, created inside the worktree (DEC-6). */
  readonly gateTemporaryDirectory: string;
  /** The unchanged evidence literal the pm-notes convention keeps. */
  readonly gateTemporaryDirectoryEvidenceLiteral: typeof GATE_TEMPORARY_DIRECTORY_EVIDENCE_LITERAL;
};

/** Derive the lane environment for one worktree path (pure; no environment read). */
export const deriveLaneWorktreeEnvironment = (input: {
  readonly worktreePath: string;
}): LaneWorktreeEnvironment => ({
  workingDirectory: input.worktreePath,
  pathLeadingBin: `${input.worktreePath}/node_modules/.bin`,
  gateTemporaryDirectory: `${input.worktreePath}/tmp/tmpdir`,
  gateTemporaryDirectoryEvidenceLiteral: GATE_TEMPORARY_DIRECTORY_EVIDENCE_LITERAL,
});
