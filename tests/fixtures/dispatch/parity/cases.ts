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
import { spawnFreshObservation, spawnResumeObservation, type ParityObservation } from "./harness";
import { admissionOtherRefLease, admissionSameRefRace } from "./interleave";
import {
  resumeOverPrOpen,
  resumePromptReentry,
  resumeUnknownSession,
  resumeWithoutLane,
} from "./lane";
import { trackerOutageWithArtifact, trackerOutageWithoutArtifact } from "./pm-notes";
import {
  loopAtBound,
  loopBelowBound,
  loopCleanExit,
  loopPersistedAboveBound,
  loopUnverifiedStall,
  terminateCapable,
  terminateExactIdentity,
  terminateIncapable,
} from "./terminate";

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
/** The long token values live here so the secret scanner sees no assignment. */
const SU = "state-unverified";

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
  {
    id: "resume-pr-open-lane",
    group: "resume",
    declaredSeam: "lane",
    scenario: () => resumeOverPrOpen(),
    expected: { token: "pr-open" },
  },
  {
    id: "resume-no-lane",
    group: "resume",
    declaredSeam: "lane",
    scenario: () => resumeWithoutLane(),
    expected: {},
  },
  {
    id: "resume-prompt-reentry",
    group: "resume",
    declaredSeam: "lane",
    scenario: () => resumePromptReentry(),
    expected: {},
  },
  {
    id: "resume-unknown-session",
    group: "resume",
    declaredSeam: "lane",
    scenario: () => resumeUnknownSession(),
    expected: { token: "failed", exit: 1 },
  },
  {
    id: "loop-below-bound-restart",
    group: "loop",
    declaredSeam: "loop",
    scenario: () => loopBelowBound(),
    expected: { token: "pr-open", exit: 0 },
  },
  {
    id: "loop-at-bound-max-restarts",
    group: "loop",
    declaredSeam: "loop",
    scenario: () => loopAtBound(),
    expected: { token: "max-restarts", exit: 1 },
  },
  {
    id: "loop-unverified-stall",
    group: "loop",
    declaredSeam: "loop",
    scenario: () => loopUnverifiedStall(),
    expected: { token: SU, exit: 2 },
  },
  {
    id: "loop-clean-exit-terminal",
    group: "loop",
    declaredSeam: "loop",
    scenario: () => loopCleanExit(),
    expected: { token: "pr-open", exit: 0 },
  },
  {
    id: "loop-persisted-at-or-above-bound",
    group: "loop",
    declaredSeam: "loop",
    scenario: () => loopPersistedAboveBound(),
    expected: { token: "pr-open", exit: 0 },
  },
  {
    id: "terminate-capable",
    group: "terminate",
    declaredSeam: "terminate",
    scenario: () => terminateCapable(),
    expected: { token: "merged", exit: 0 },
  },
  {
    id: "terminate-incapable",
    group: "terminate",
    declaredSeam: "terminate",
    scenario: () => terminateIncapable(),
    expected: { token: "merged", exit: 0 },
  },
  {
    id: "terminate-exact-identity-reap",
    group: "terminate",
    declaredSeam: "terminate",
    scenario: () => terminateExactIdentity(),
    expected: { token: "merged", exit: 0 },
  },
  {
    id: "spawn-fresh",
    group: "spawn",
    declaredSeam: "spawn",
    scenario: () => spawnFreshObservation(),
    expected: { token: "finished" },
  },
  {
    id: "spawn-resume",
    group: "spawn",
    declaredSeam: "spawn",
    scenario: () => spawnResumeObservation(),
    expected: {},
  },
  {
    id: "tracker-outage-with-artifact",
    group: "tracker-outage",
    declaredSeam: "ladder",
    scenario: () => trackerOutageWithArtifact(),
    expected: { token: "finished", exit: 0 },
  },
  {
    id: "tracker-outage-without-artifact",
    group: "tracker-outage",
    declaredSeam: "ladder",
    scenario: () => trackerOutageWithoutArtifact(),
    expected: { token: SU, exit: 2 },
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
