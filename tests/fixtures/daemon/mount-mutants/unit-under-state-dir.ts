/**
 * Mutant: the state directory is used as the supervisor configuration root, so
 * the unit lands outside the configuration root systemd reads.
 *
 * Consumed by `tests/checks/daemon-mutants.test.ts`; the named suite's
 * configuration-root assertion trips.
 */
export const name = "unit-under-state-dir";
export const target = "packages/cli/src/production.ts";
export const suite = "tests/behaviour/daemon-install-mount.test.ts";
export const assertion = "the state directory is never the configuration root";

const ORIGINAL = `        supervisorConfigDirectory: supervisorConfigDirectoryFor({
          environment,
          homeDirectory,
        }),`;
const MUTATED = "        supervisorConfigDirectory: directory,";

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("unit-under-state-dir: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: the two roots differ. */
export const violates = (configRoot: string, stateDirectory: string): boolean =>
  configRoot === stateDirectory;
