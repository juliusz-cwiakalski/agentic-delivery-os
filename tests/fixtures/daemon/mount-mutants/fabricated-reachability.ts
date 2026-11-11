/**
 * Mutant: an absent or unreadable read is reported as reachable instead of
 * unreachable, which fabricates a daemon the record set cannot identify.
 *
 * The mutation lands in the exported production predicate, so the control loads
 * the mutated `production.ts` and calls the mutated predicate directly.
 */
export const name = "fabricated-reachability";
export const target = "packages/cli/src/production.ts";
export const suite = "tests/behaviour/daemon-degradation-projection.test.ts";
export const assertion = "a missing instance or heartbeat degrades, never fabricates reachability";

const ORIGINAL = `    const heartbeat = readDaemonHeartbeat(input.store);
    if (!heartbeat.ok || heartbeat.latest === undefined) return false;`;

const MUTATED = `    const heartbeat = readDaemonHeartbeat(input.store);
    if (!heartbeat.ok || heartbeat.latest === undefined) return true;`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("fabricated-reachability: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: an absent heartbeat is unreachable. */
export const violates = (source: string): boolean =>
  source.includes("heartbeat.latest === undefined) return true;");
