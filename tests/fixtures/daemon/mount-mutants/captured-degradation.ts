/**
 * Mutant: the marker set is captured once at composition time instead of being
 * resolved per projection, so a later state change is reported with a stale
 * verdict.
 */
export const name = "captured-degradation";
export const target = "packages/cli/src/edge.ts";
export const suite = "tests/structure/daemon-degradation-wiring.test.ts";
export const assertion = "each projection resolves the marker set afresh";

const ORIGINAL = `      degraded: resolveDegraded(composition.degraded),
    };
  };`;

const MUTATED = `      degraded: capturedDegraded,
    };
  };
  const capturedDegraded = resolveDegraded(composition.degraded);`;

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("captured-degradation: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named scan asserts: no captured marker set exists. */
export const violates = (source: string): boolean => source.includes("capturedDegraded");
