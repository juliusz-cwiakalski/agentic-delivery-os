/**
 * Mutant: the state directory is used as the supervisor configuration root, so
 * the unit lands outside the configuration root systemd reads.
 *
 * The configuration root is consumed by the real supervisor adapter, which the
 * production composer exposes no seam to intercept; the control therefore makes
 * the source-level claim the named suite carries and executes the delivered
 * install path separately.
 */
export const name = "unit-under-state-dir";
export const target = "packages/cli/src/production.ts";
export const suite = "tests/behaviour/daemon-install-mount.test.ts";
export const assertion = "the state directory is never the configuration root";

const ORIGINAL =
  "        ...(supervisorConfigDirectory === undefined ? {} : { supervisorConfigDirectory }),";
const MUTATED = "        supervisorConfigDirectory: directory,";

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("unit-under-state-dir: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: the root comes from the XDG rule. */
export const violates = (source: string): boolean =>
  !source.includes("supervisorConfigDirectory === undefined");
