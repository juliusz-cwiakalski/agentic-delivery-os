/**
 * Mutant: the install identity passes a bare binary name instead of the
 * absolute entry path, so `ExecStart` names a binary the user manager cannot
 * address off `PATH`.
 *
 * Consumed by `tests/checks/daemon-mutants.test.ts`; the named suite's
 * absolute-executable assertion trips.
 */
export const name = "bare-execstart";
export const target = "packages/cli/src/production.ts";
export const suite = "tests/behaviour/daemon-install-mount.test.ts";
export const assertion = "ExecStart names the absolute entry path";

const ORIGINAL = 'binary: facts.daemonEntry ?? "",';
const MUTATED = "binary: brand.binaryName,";

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("bare-execstart: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: the executable is an absolute path. */
export const violates = (binary: string): boolean => !binary.startsWith("/");
