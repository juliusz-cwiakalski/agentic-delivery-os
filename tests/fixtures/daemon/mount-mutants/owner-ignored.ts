/**
 * Mutant: the heartbeat's `instanceId` is not compared to the instance, so an
 * unowned (foreign) heartbeat is reported as a running daemon.
 *
 * The mutation lands in the exported production predicate, so the control loads
 * the mutated `production.ts` and calls the mutated predicate directly.
 */
export const name = "owner-ignored";
export const target = "packages/cli/src/production.ts";
export const suite = "tests/behaviour/daemon-degradation-projection.test.ts";
export const assertion = "an unowned heartbeat degrades";

const ORIGINAL = `    if (heartbeat.latest.instanceId !== latest.instanceId) return false;`;
const MUTATED = "";

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("owner-ignored: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: an unowned beat is unreachable. */
export const violates = (source: string): boolean =>
  !source.includes("heartbeat.latest.instanceId !== latest.instanceId");
