/**
 * Mutant: the stop signals the negated pid (the process-group form), which
 * addresses every process in the group instead of the recorded one.
 */
export const name = "signal-negative-pid";
export const target = "packages/cli/src/daemon-compose.ts";
export const suite = "tests/behaviour/daemon-stop-safety.test.ts";
export const assertion = "the recorded positive pid only, never a negated group pid";

const ORIGINAL = `      const signalled = processPort.signal(latest.pid, mode === "drain" ? "SIGTERM" : "SIGINT");`;
const MUTATED = `      const signalled = processPort.signal(-latest.pid, mode === "drain" ? "SIGTERM" : "SIGINT");`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("signal-negative-pid: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: every signalled pid is positive. */
export const violates = (pids: readonly number[]): boolean => pids.some((pid) => pid < 0);
