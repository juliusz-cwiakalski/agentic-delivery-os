/**
 * Mutant: the spawn passes keys outside the declared re-entry set — it inherits
 * the ambient `process.env` (or the whole injected environment) instead of the
 * derived set, so a credential or an unrelated variable can leak into the child.
 *
 * Consumed by `tests/checks/daemon-mutants.test.ts` against a temp copy of the
 * real module; the named suite's exact-key-set assertion trips.
 */
export const name = "spawn-with-full-env";
export const target = "packages/cli/src/daemon-compose.ts";
export const suite = "tests/behaviour/daemon-start-detached.test.ts";
export const assertion = "no ambient key appears in the captured environment";
export const description = "the spawn inherits the ambient process environment";

/** The declared re-entry set, plus the state binding, is the whole allowed set. */
export const DECLARED_KEYS = ["PATH", "HOME", "USERPROFILE", "DELIVERY_OS_WORKING_NAME"] as const;

const ORIGINAL = `        const spawnEnvironment =
          composition.reentryEnvironment === undefined
            ? { [composition.environmentName]: stateDirectoryBinding }
            : {
                ...composition.reentryEnvironment,
                [composition.environmentName]: stateDirectoryBinding,
              };`;

const MUTATED = `        const spawnEnvironment = {
          ...process.env,
          ...(composition.reentryEnvironment ?? {}),
          [composition.environmentName]: stateDirectoryBinding,
        } as Record<string, string>;`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("spawn-with-full-env: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: no key outside the declared set. */
export const violates = (environment: Readonly<Record<string, string>>, binding: string): boolean =>
  Object.keys(environment).some(
    (key) => key !== binding && !(DECLARED_KEYS as readonly string[]).includes(key),
  );
