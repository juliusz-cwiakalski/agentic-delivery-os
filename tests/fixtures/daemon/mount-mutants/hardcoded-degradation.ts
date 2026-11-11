/**
 * Mutant: the production composition wires a constant marker array again
 * instead of the durable resolver.
 */
export const name = "hardcoded-degradation";
export const target = "packages/cli/src/production.ts";
export const suite = "tests/structure/daemon-degradation-wiring.test.ts";
export const assertion = "the queue composition wires the durable resolver function";

const ORIGINAL = "      degraded: daemonReachability,";
const MUTATED = '      degraded: ["daemon-unreachable"] as const,';

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("hardcoded-degradation: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named scan asserts: the wire is the resolver function. */
export const violates = (source: string): boolean =>
  !source.includes("degraded: daemonReachability") ||
  source.includes('degraded: ["daemon-unreachable"]');
