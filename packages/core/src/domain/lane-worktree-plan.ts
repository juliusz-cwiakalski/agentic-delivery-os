/**
 * The lane worktree plan (GH-404 F-2, F-3, DM-3; DEC-6, NFR-7).
 *
 * Pure domain over injected, already-resolved PHYSICAL paths: the
 * deterministic worktree path scheme `<worktree-root>/<checkout-basename>-<ref>`,
 * the sibling-of-main-checkout default root, the ordered provisioning steps
 * executed strictly before the first lane phase, the lane-log sweep scope with
 * its declared byte cap (Decision 3: the lane's logs are the runner-log
 * directories; the gate temporary directory is ephemeral scratch, deleted
 * with the worktree), and the lane-environment derivation (the worktree's
 * dependency binaries lead `PATH`, the gate temporary directory anchored
 * inside the worktree with the evidence literal `$PWD/tmp/tmpdir` unchanged
 * because the lane's working directory IS the worktree). No I/O, no spawn, no
 * clock, no configuration reads; symlinked aliases never enter — callers
 * resolve real paths before calling.
 *
 * Branch model (review remediation, Decision 1): the lane worktree is
 * provisioned DETACHED at the base tip and NO lane branch is ever created.
 * The lane's own lifecycle creates its delivery branch
 * `<type>/<REF>/<slug>` inside the worktree per the repository convention;
 * resume verification accepts the provisioned detached state or a
 * delivery-convention branch and refuses genuinely foreign branches
 * (production binds the verification).
 */

/**
 * The ordered provisioning steps, executed in this order before
 * `clarify_scope` (review F-13: the declared order IS the production order —
 * the gate temporary directory first, because the lane environment's TMPDIR
 * anchor must exist before the install and build children run; then the
 * lockfile install, then the gate build).
 */
export const LANE_PROVISIONING_STEPS = [
  "create-gate-temporary-directory",
  "install-dependencies",
  "build-gate-prerequisites",
] as const;

export type LaneProvisioningStep = (typeof LANE_PROVISIONING_STEPS)[number];

/**
 * The lockfile-driven install command template (OQ-1 settlement): the
 * workspace's pinned package manager installs from the committed lockfile.
 */
export const LANE_WORKTREE_INSTALL_COMMAND = "pnpm install --frozen-lockfile" as const;

/** The evidence literal the pm-notes convention keeps; the physical resolution anchors to the lane's worktree (DEC-6). */
export const GATE_TEMPORARY_DIRECTORY_EVIDENCE_LITERAL = "$PWD/tmp/tmpdir" as const;

/**
 * The lane-log sweep's declared byte cap (Decision 3, review F-2): the newest
 * runner-log entries are copied newest-first until this many bytes, and a
 * truncated sweep discloses the fact. The gate temporary directory is
 * scratch by contract and is never swept.
 */
export const LANE_LOG_SWEEP_BYTE_CAP = 33_554_432;

/**
 * The bounded stderr tail a provisioning refusal surfaces (review F-9): the
 * child's own stderr tail, so the operator sees why the install or build
 * died without dumping an unbounded log.
 */
export const LANE_PROVISIONING_STDERR_TAIL_CHARS = 400;

/**
 * The runner-log directory the product's runner contract defines (the lane's
 * real logs); the sweep copies it newest-first, bounded by the declared cap.
 */
export const LANE_RUNNER_LOG_DIRECTORY = "run-logs-runner" as const;

/**
 * The ephemeral scratch directory (the evidence literal's physical anchor):
 * deleted with the worktree at closeout, never preserved.
 */
export const LANE_SCRATCH_DIRECTORY = "tmp/tmpdir" as const;

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
  gateTemporaryDirectory: `${input.worktreePath}/${LANE_SCRATCH_DIRECTORY}`,
  gateTemporaryDirectoryEvidenceLiteral: GATE_TEMPORARY_DIRECTORY_EVIDENCE_LITERAL,
});
