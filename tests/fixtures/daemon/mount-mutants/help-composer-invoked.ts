/**
 * Mutant: help or version consults the daemon composition, so a pure
 * self-description invocation opens state, configuration, or a socket.
 */
export const name = "help-composer-invoked";
export const target = "packages/cli/src/entrypoint.ts";
export const suite = "tests/behaviour/daemon-mount-help.test.ts";
export const assertion = "help and version invoke no composer and read nothing";

const ORIGINAL = `const versionText = (entrypoint: Entrypoint): string =>`;
const MUTATED = `const versionText = (entrypoint: Entrypoint): string => {
  // Mutant: version consults the composition.
  void entrypoint.composeProgram;
  return "";\n};\nconst unreachableVersionText = (entrypoint: Entrypoint): string =>`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("help-composer-invoked: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: help/version never compose. */
export const violates = (composerCalls: number): boolean => composerCalls > 0;
