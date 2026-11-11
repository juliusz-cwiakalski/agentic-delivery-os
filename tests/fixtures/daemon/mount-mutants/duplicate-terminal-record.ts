/**
 * Mutant: a second signal starts a second stop, so the invocation can append a
 * duplicate terminal instance record.
 *
 * The control delivers two signals with a clock advance between them, so both
 * release appends are distinct executed records rather than one deduplicated
 * payload. The delivered guard keeps the count at one in both drivings.
 */
export const name = "duplicate-terminal-record";
export const target = "packages/cli/src/daemon-compose.ts";
export const suite = "tests/behaviour/daemon-foreground-lifetime.test.ts";
export const assertion = "a second signal produces exactly one stop and one terminal record";

const ORIGINAL = `        if (stopMode !== undefined) return;
        stopMode = mode;`;

const MUTATED = `        stopMode = mode;`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("duplicate-terminal-record: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: one terminal record per invocation. */
export const violates = (terminalRecords: number): boolean => terminalRecords > 1;
