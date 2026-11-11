/**
 * Mutant: the freshness comparison is inclusive, so a heartbeat whose age equals
 * the bound is reported reachable while the delivered fold reports `stale`.
 */
export const name = "stale-inclusive";
export const target = "packages/cli/src/production.ts";
export const suite = "tests/behaviour/daemon-degradation-projection.test.ts";
export const assertion = "an age equal to the bound is stale on both surfaces";

const ORIGINAL = "        return ageMs < daemonConfiguration.settings.lockStalenessMs";
const MUTATED = "        return ageMs <= daemonConfiguration.settings.lockStalenessMs";

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("stale-inclusive: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The mutated inclusive comparison over one age. */
export const evaluate = (ageMs: number, stalenessMs: number): readonly string[] =>
  ageMs <= stalenessMs ? [] : ["daemon-unreachable"];

/** The invariant the named suite asserts: the at-bound cell degrades. */
export const violates = (markers: readonly string[]): boolean => markers.length === 0;
