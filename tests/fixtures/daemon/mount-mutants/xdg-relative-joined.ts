/**
 * Mutant: a relative `XDG_CONFIG_HOME` is joined onto the working directory
 * instead of being treated as absent, so the unit is written outside the user's
 * configuration root.
 *
 * Consumed by `tests/checks/daemon-mutants.test.ts`; the named suite's
 * "relative value is treated as absent" assertion trips.
 */
export const name = "xdg-relative-joined";
export const target = "packages/cli/src/production.ts";
export const suite = "tests/behaviour/daemon-install-mount.test.ts";
export const assertion = "a relative XDG_CONFIG_HOME is treated as absent";

const ORIGINAL = `  return configured !== undefined && configured.length > 0 && configured.startsWith("/")
    ? trimTrailingSeparators(configured)
    : \`\${input.homeDirectory}/.config\`;`;
const MUTATED = `  return configured !== undefined && configured.length > 0
    ? configured
    : \`\${input.homeDirectory}/.config\`;`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("xdg-relative-joined: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: a relative value is not used. */
export const violates = (chosenRoot: string, relativeValue: string): boolean =>
  chosenRoot === relativeValue;
