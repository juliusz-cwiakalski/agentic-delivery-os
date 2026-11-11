/**
 * Mutant: the detached child is spawned with the state binding only, so the
 * composing `PATH` and home are not forwarded and a `#!/usr/bin/env bun` entry
 * cannot resolve its interpreter.
 *
 * Consumed by `tests/checks/daemon-mutants.test.ts` against a temp copy of the
 * real module; the named suite's exact-key-set assertion trips.
 */
export const name = "spawn-without-forwarded-env";
export const target = "packages/cli/src/daemon-compose.ts";
export const suite = "tests/behaviour/daemon-start-detached.test.ts";
export const assertion = "the captured environment carries the forwarded PATH and home";
export const description = "the spawn sends the state binding only, dropping PATH and the home";

const ORIGINAL = `        const spawnEnvironment =
          composition.reentryEnvironment === undefined
            ? { [composition.environmentName]: composition.stateDirectory }
            : {
                ...composition.reentryEnvironment,
                [composition.environmentName]: composition.stateDirectory,
              };`;

const MUTATED = `        const spawnEnvironment = {
          [composition.environmentName]: composition.stateDirectory,
        };`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("spawn-without-forwarded-env: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: `PATH` and the home are forwarded. */
export const violates = (environment: Readonly<Record<string, string>>): boolean =>
  environment.PATH === undefined && environment.HOME === undefined;
