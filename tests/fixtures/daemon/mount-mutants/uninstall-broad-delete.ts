/**
 * Mutant: uninstall drops the ownership guard, so it removes the unit and the
 * marker whatever the recorded owner is — including when nothing was installed.
 *
 * Consumed by `tests/checks/daemon-mutants.test.ts` against a temp copy of the
 * delivered adapter; the named suite's ownership-scoped assertion trips.
 */
export const name = "uninstall-broad-delete";
export const target = "packages/adapters/src/daemon/supervisor.ts";
export const suite = "tests/behaviour/daemon-install-mount.test.ts";
export const assertion = "uninstall removes only its own artifacts";

const ORIGINAL = `      if (marker === undefined || marker.unit !== unit) {
        return { removed: false };
      }`;
const MUTATED = `      if (marker === undefined) {
        return { removed: false };
      }`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("uninstall-broad-delete: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: only an owned installation is removed. */
export const violates = (removed: boolean, ownedByThisUnit: boolean): boolean =>
  removed && !ownedByThisUnit;
