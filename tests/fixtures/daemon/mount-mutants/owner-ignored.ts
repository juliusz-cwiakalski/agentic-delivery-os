/**
 * Mutant: the heartbeat's `instanceId` is not compared to the instance, so an
 * unowned heartbeat is reported as a running daemon.
 */
export const name = "owner-ignored";
export const target = "packages/cli/src/production.ts";
export const suite = "tests/behaviour/daemon-degradation-projection.test.ts";
export const assertion = "an unowned heartbeat degrades";

const ORIGINAL = `        if (heartbeat.latest.instanceId !== latest.instanceId) return ["daemon-unreachable"];`;
const MUTATED = "";

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("owner-ignored: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The mutated rule: the owner is not consulted. */
export const evaluate = (input: {
  readonly instance: { readonly operation: string; readonly instanceId: string } | undefined;
  readonly heartbeat: { readonly beatAt: string } | undefined;
  readonly nowMs: number;
  readonly stalenessMs: number;
}): readonly string[] => {
  if (input.instance === undefined) return ["daemon-unreachable"];
  if (input.instance.operation !== "acquired" && input.instance.operation !== "taken-over") {
    return ["daemon-unreachable"];
  }
  if (input.heartbeat === undefined) return ["daemon-unreachable"];
  return input.nowMs - Date.parse(input.heartbeat.beatAt) < input.stalenessMs
    ? []
    : ["daemon-unreachable"];
};

/** The invariant the named suite asserts: an unowned beat degrades. */
export const violates = (markers: readonly string[]): boolean => markers.length === 0;
