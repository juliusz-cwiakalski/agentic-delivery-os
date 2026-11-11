/**
 * Mutant: the state-directory binding is merged **first**, so a forwarded
 * look-alike of the same variable can win and the binding is no longer last.
 *
 * Consumed by `tests/checks/daemon-mutants.test.ts`, which applies it to a temp
 * copy of the real module and asserts the named suite's ordering assertion
 * trips. Applied to a temp copy only; the shipped source is never edited.
 */
export const name = "binding-not-last";
export const target = "packages/cli/src/daemon-compose.ts";
export const suite = "tests/behaviour/daemon-start-detached.test.ts";
export const assertion = "the state binding is the last own property";
export const description =
  "the state-directory binding is written first, so a forwarded same-named value can follow it";

const ORIGINAL = `            : {
                ...composition.reentryEnvironment,
                [composition.environmentName]: composition.stateDirectory,
              };`;

const MUTATED = `            : {
                [composition.environmentName]: composition.stateDirectory,
                ...composition.reentryEnvironment,
              };`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("binding-not-last: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: the binding is the last own key. */
export const violates = (
  environment: Readonly<Record<string, string>>,
  binding: string,
): boolean => {
  const keys = Object.keys(environment);
  return keys[keys.length - 1] !== binding;
};
