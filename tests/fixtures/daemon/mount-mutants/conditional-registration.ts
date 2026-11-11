/**
 * Mutant: the daemon family is registered only when an entry path is composed,
 * so a composition without one loses a prompt-required command and every
 * invocation is contained as `fallback.internal`.
 */
export const name = "conditional-registration";
export const target = "packages/cli/src/production.ts";
export const suite = "tests/structure/daemon-production-composition.test.ts";
export const assertion =
  "the family is registered on every composition, whatever the optional facts";

const ORIGINAL = `      daemon: daemonRuntime,`;
const MUTATED = `      ...(facts.daemonEntry === undefined ? {} : { daemon: daemonRuntime }),`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("conditional-registration: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: the family is passed unconditionally. */
export const violates = (source: string): boolean =>
  source.includes(": { daemon: daemonRuntime }") || !/^\s+daemon: daemonRuntime,$/mu.test(source);
