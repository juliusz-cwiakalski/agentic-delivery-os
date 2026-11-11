/**
 * Mutant: the freshness comparison is inclusive, so a heartbeat whose age equals
 * the bound is reported reachable while the delivered rule and the delivered
 * fold both call the at-bound cell stale.
 *
 * The mutation lands in the exported production predicate, so the control loads
 * the mutated `production.ts` and calls the mutated predicate with an injected
 * `nowMs` and `lockStalenessMs`.
 */
export const name = "stale-inclusive";
export const target = "packages/cli/src/production.ts";
export const suite = "tests/behaviour/daemon-degradation-projection.test.ts";
export const assertion = "an age equal to the bound is stale on both surfaces";

const ORIGINAL = "    return ageMs < input.lockStalenessMs;";
const MUTATED = "    return ageMs <= input.lockStalenessMs;";

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("stale-inclusive: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: the at-bound age is unreachable. */
export const violates = (source: string): boolean =>
  source.includes("return ageMs <= input.lockStalenessMs;");
