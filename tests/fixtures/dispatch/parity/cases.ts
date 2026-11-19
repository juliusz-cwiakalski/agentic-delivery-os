/**
 * The ONE whole-battery parity case registry (GH-347 test plan §6.1, §7.1).
 *
 * 29 rows: 11 `class` rows and 18 non-class rows across the seven declared
 * groups. Rows are authored incrementally at first need, by the phase that owns
 * the case: the `admission` group here in phase 2, then `resume`,
 * `tracker-outage`, `loop`/`terminate`, `spawn`, and finally the 11 `class` rows.
 *
 * A suite consumes its entry's `scenario` builder; no suite re-expresses a
 * scenario and no scenario is written twice.
 */
import type { ParityObservation } from "./harness";
import { admissionOtherRefLease, admissionSameRefRace } from "./interleave";

/** The seven declared group names; the vocabulary is closed. */
export const PARITY_GROUPS = [
  "class",
  "admission",
  "resume",
  "tracker-outage",
  "loop",
  "terminate",
  "spawn",
] as const;

export type ParityGroup = (typeof PARITY_GROUPS)[number];

/**
 * The declared seam a row exercises. Every member is a surface the proof
 * boundary declares PROVEN (phase 7 asserts the membership); a row may never
 * declare a not-proven surface.
 */
export const PARITY_SEAMS = ["claim", "lane", "spawn", "ladder", "terminate", "loop"] as const;

export type ParitySeam = (typeof PARITY_SEAMS)[number];

/** One row's declared expectation, asserted by the owning suite. */
export type ParityExpectation = {
  readonly token?: string;
  readonly exit?: number;
  /** The same-ref race: exactly one invocation is admitted. */
  readonly admitted?: number;
  /** The same-ref race: exactly one invocation is refused. */
  readonly refused?: number;
};

export type ParityCase = {
  readonly id: string;
  readonly group: ParityGroup;
  readonly declaredSeam: ParitySeam;
  readonly scenario: () => Promise<ParityObservation>;
  readonly expected: ParityExpectation;
};

/**
 * The registry. Phase 2 authors the two `admission` rows; later phases append
 * their own groups and phase 7 completes the `class` group (29 total).
 */
export const PARITY_CASES: readonly ParityCase[] = [
  {
    id: "admission-same-ref-race",
    group: "admission",
    declaredSeam: "claim",
    scenario: () => admissionSameRefRace({ parked: "first" }),
    expected: { admitted: 1, refused: 1 },
  },
  {
    id: "admission-other-ref-lease",
    group: "admission",
    declaredSeam: "claim",
    scenario: () => admissionOtherRefLease(),
    expected: { exit: 1 },
  },
];

/** Run one registry row's scenario exactly as its owning suite does. */
export const runParityCase = async (entry: ParityCase): Promise<ParityObservation> =>
  entry.scenario();

/** Run every declared row in registry order (TC-PARITY-003 / TC-SHELL-001). */
export const runAllParityCases = async (): Promise<
  readonly { readonly entry: ParityCase; readonly observation: ParityObservation }[]
> => {
  const results: { readonly entry: ParityCase; readonly observation: ParityObservation }[] = [];
  for (const entry of PARITY_CASES) {
    results.push({ entry, observation: await runParityCase(entry) });
  }
  return results;
};

/** The registry rows of one group, in registry order. */
export const parityCasesOf = (group: ParityGroup): readonly ParityCase[] =>
  PARITY_CASES.filter((entry) => entry.group === group);
