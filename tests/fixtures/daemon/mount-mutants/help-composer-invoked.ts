/**
 * Mutant: help or version consults the daemon composition, so a pure
 * self-description invocation opens state, configuration, or a socket.
 *
 * The control loads the mutated `entrypoint.ts` from a temp copy and runs the
 * version path with a counting composer, so the invocation is observed rather
 * than asserted by inspection.
 */
export const name = "help-composer-invoked";
export const target = "packages/cli/src/entrypoint.ts";
export const suite = "tests/behaviour/daemon-mount-help.test.ts";
export const assertion = "help and version invoke no composer and read nothing";

const ORIGINAL = `const versionText = (entrypoint: Entrypoint): string =>`;
const MUTATED = `const versionText = (entrypoint: Entrypoint): string => {
  // Mutant: version consults the composition.
  try {
    void entrypoint.composeProgram({} as never);
  } catch {
    // The control's point is the call, not the composed program.
  }
  return "";
};
const unreachableVersionText = (entrypoint: Entrypoint): string =>`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("help-composer-invoked: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: version invokes no composer. */
export const violates = (composerCalls: number): boolean => composerCalls > 0;
