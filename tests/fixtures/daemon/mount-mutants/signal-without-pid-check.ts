/**
 * Mutant: the cross-process stop signals whatever pid the record carries,
 * skipping the positive-integer refusal.
 */
export const name = "signal-without-pid-check";
export const target = "packages/cli/src/daemon-compose.ts";
export const suite = "tests/behaviour/daemon-stop-safety.test.ts";
export const assertion = "a non-positive recorded pid makes zero signal calls";

const ORIGINAL = `      if (!Number.isInteger(latest.pid) || latest.pid <= 0) {
        return failure("daemon.state-recovery-failed", "recorded-pid-invalid");
      }
`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("signal-without-pid-check: anchor not found");
  return source.replace(ORIGINAL, "");
};

/** The invariant the named suite asserts: nothing is signalled. */
export const violates = (signalCount: number): boolean => signalCount > 0;
