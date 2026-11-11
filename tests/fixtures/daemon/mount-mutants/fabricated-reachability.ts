/**
 * Mutant: an absent or unreadable read is reported as reachable instead of
 * degrading, which fabricates a daemon the record set cannot identify.
 */
export const name = "fabricated-reachability";
export const target = "packages/cli/src/production.ts";
export const suite = "tests/behaviour/daemon-degradation-projection.test.ts";
export const assertion = "a missing instance or heartbeat degrades, never fabricates reachability";

const ORIGINAL = `        const heartbeat = readDaemonHeartbeat(store);
        if (!heartbeat.ok || heartbeat.latest === undefined) return ["daemon-unreachable"];`;

const MUTATED = `        const heartbeat = readDaemonHeartbeat(store);
        if (!heartbeat.ok || heartbeat.latest === undefined) return [];`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("fabricated-reachability: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The mutated rule over plain records, for the non-vacuity control. */
export const evaluate = (input: {
  readonly instance: { readonly operation: string; readonly instanceId: string } | undefined;
  readonly heartbeat: { readonly instanceId: string; readonly beatAt: string } | undefined;
  readonly nowMs: number;
  readonly stalenessMs: number;
}): readonly string[] => {
  if (input.instance === undefined) return ["daemon-unreachable"];
  if (input.instance.operation !== "acquired" && input.instance.operation !== "taken-over") {
    return ["daemon-unreachable"];
  }
  // Mutated: a missing heartbeat is reachable.
  if (input.heartbeat === undefined) return [];
  if (input.heartbeat.instanceId !== input.instance.instanceId) return ["daemon-unreachable"];
  return input.nowMs - Date.parse(input.heartbeat.beatAt) < input.stalenessMs
    ? []
    : ["daemon-unreachable"];
};

/** The invariant the named suite asserts: no heartbeat degrades. */
export const violates = (markers: readonly string[]): boolean => markers.length === 0;
