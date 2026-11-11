/**
 * Mutant: the foreground lifetime returns without awaiting the resident loop,
 * so a release can outlive (or abandon) the termination it must precede.
 */
export const name = "release-skip-cancellation";
export const target = "packages/cli/src/daemon-compose.ts";
export const suite = "tests/behaviour/daemon-foreground-lifetime.test.ts";
export const assertion = "the loop promise settled before the command returned";

const ORIGINAL = `        await Promise.race([loop, settled]);
        await loop;`;

const MUTATED = `        await Promise.race([loop, settled]);`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("release-skip-cancellation: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named suite asserts: the loop is awaited. */
export const violates = (source: string): boolean => !source.includes("await loop;");
