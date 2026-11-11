/**
 * Mutant: a relative `XDG_CONFIG_HOME` is accepted instead of being treated as
 * absent, so the unit is written outside the user's configuration root.
 *
 * The configuration root is consumed by the real supervisor adapter, which the
 * production composer exposes no seam to intercept; the control therefore makes
 * the source-level claim the named suite carries.
 */
export const name = "xdg-relative-joined";
export const target = "packages/cli/src/production.ts";
export const suite = "tests/behaviour/daemon-install-mount.test.ts";
export const assertion = "a relative XDG_CONFIG_HOME is treated as absent";

const ORIGINAL = `  if (configured !== undefined && configured.length > 0 && configured.startsWith("/")) {
    return trimTrailingSeparators(configured);
  }`;
const MUTATED = `  if (configured !== undefined && configured.length > 0) {
    return trimTrailingSeparators(configured);
  }`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("xdg-relative-joined: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: only an absolute value becomes the root. */
export const violates = (source: string): boolean => !source.includes('configured.startsWith("/")');
