/**
 * Mutant: one signal listener is never removed, so a handler outlives the
 * invocation.
 *
 * The anchor is the LAST `removeListener("SIGTERM", ...)` in the source: that is
 * the lifetime `finally` removal. The composed start path also removes the
 * listeners on a failed start, and that cleanup must stay intact so the mutant
 * isolates the exit path rather than every removal.
 */
export const name = "holder-not-removed";
export const target = "packages/cli/src/daemon-compose.ts";
export const suite = "tests/behaviour/daemon-foreground-lifetime.test.ts";
export const assertion = "no listener remains registered after the command returns";

const ORIGINAL = `        host.removeListener("SIGTERM", onTerminate);`;

export const apply = (source: string): string => {
  const index = source.lastIndexOf(ORIGINAL);
  if (index < 0) throw new Error("holder-not-removed: anchor not found");
  return source.slice(0, index) + source.slice(index + ORIGINAL.length);
};

/** The invariant the named suite asserts: both listeners are removed. */
export const violates = (registered: number): boolean => registered > 0;
