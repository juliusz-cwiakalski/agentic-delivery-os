/**
 * Mutant: the install handler renders without the entry-path refusal, so a unit
 * is written with an empty `ExecStart`.
 *
 * Consumed by `tests/checks/daemon-mutants.test.ts` against a temp copy of the
 * real module; the named suite's "renders nothing" assertion trips.
 */
export const name = "install-empty-executable";
export const target = "packages/cli/src/daemon-compose.ts";
export const suite = "tests/behaviour/daemon-install-mount.test.ts";
export const assertion = "no unit is rendered without a composed entry path";

const ORIGINAL = `      if (composition.daemonEntry === undefined || composition.daemonEntry.length === 0) {
        return failure("daemon.state-recovery-failed", "entry-path-absent");
      }
`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("install-empty-executable: anchor not found");
  return source.replace(ORIGINAL, "");
};

/** The invariant the named suite asserts: the rendered executable is not empty. */
export const violates = (unitText: string): boolean => unitText.includes("ExecStart= daemon");
