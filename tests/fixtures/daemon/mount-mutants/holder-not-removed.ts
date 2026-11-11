/**
 * Mutant: one signal listener is never removed, so a handler outlives the
 * invocation.
 */
export const name = "holder-not-removed";
export const target = "packages/cli/src/daemon-compose.ts";
export const suite = "tests/behaviour/daemon-foreground-lifetime.test.ts";
export const assertion = "no listener remains registered after the command returns";

const ORIGINAL = `        host.removeListener("SIGTERM", onTerminate);`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("holder-not-removed: anchor not found");
  return source.replace(ORIGINAL, "");
};

/** The invariant the named suite asserts: both listeners are removed. */
export const violates = (registered: number): boolean => registered > 0;
