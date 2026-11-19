/**
 * The ONE loop parity case registry (GH-348 test plan §7.3; GH-347 DoR finding).
 *
 * Every battery row is declared here exactly once as
 * `{id, group, declaredSeam, scenario, expected}`. Phases APPEND their own
 * group and never re-author another phase's scenario: phase 2 authors the
 * registry with the `spawn` group and the log renderer rows, phase 3 appends
 * `single-instance`, phase 4 `stuck` and `kill`, phase 5 `backoff-budget`, phase
 * 6 `stop`, phase 7 `verbs` and the log read rows, phase 8 the `no-shell` rows.
 *
 * A suite row may not be added without an entry here, and no scenario is
 * expressed twice: the suites consume the builders below.
 */

/** The nine proven surface ids every row must name one of (Appendix C/G). */
export const LOOP_PROVEN_SEAMS = [
  "verbs",
  "log",
  "spawn",
  "stuck",
  "kill",
  "backoff-budget",
  "stop",
  "single-instance",
  "no-shell",
] as const;

export type LoopProvenSeam = (typeof LOOP_PROVEN_SEAMS)[number];

/** One registry row. */
export type LoopParityCase = {
  readonly id: string;
  readonly group: LoopProvenSeam;
  readonly declaredSeam: string;
  readonly scenario: Readonly<Record<string, unknown>>;
  readonly expected: Readonly<Record<string, unknown>>;
};

/** The `spawn` group's rows: the CEO identity, title, refusals, and the pid. */
const SPAWN_CASES: readonly LoopParityCase[] = [
  {
    id: "spawn-fresh-identity",
    group: "spawn",
    declaredSeam: "S-spawn",
    scenario: { agent: "ceo", fresh: true, pid: 4242 },
    expected: { spawns: 1, titles: 1, records: 1 },
  },
  {
    id: "spawn-fresh-title",
    group: "spawn",
    declaredSeam: "S-spawn",
    scenario: { fresh: true, nowMs: 1_000_000 },
    expected: { title: "ceo-loop-20260101-001640" },
  },
  {
    id: "spawn-pid-absent",
    group: "spawn",
    declaredSeam: "S-spawn",
    scenario: { fresh: true, pid: null },
    expected: { pid: null, fabricated: false },
  },
  {
    id: "spawn-pid-present",
    group: "spawn",
    declaredSeam: "S-spawn",
    scenario: { fresh: true, pid: 4242 },
    expected: { pid: 4242 },
  },
  {
    id: "spawn-refusal-unassigned",
    group: "spawn",
    declaredSeam: "S-spawn",
    scenario: { failure: "provider.profile.invalid" },
    expected: { exit: 1, sessionRecords: 0, leaseReleased: true },
  },
  {
    id: "spawn-no-hook",
    group: "spawn",
    declaredSeam: "S-spawn",
    scenario: { fresh: true, homePlanted: true },
    expected: { hookRuns: 0, spawns: 1 },
  },
];

/** The `log` group's renderer rows (the read rows are phase 7's). */
const LOG_CASES: readonly LoopParityCase[] = [
  {
    id: "log-line-shape",
    group: "log",
    declaredSeam: "S-log",
    scenario: { event: "start", pairs: { instance: "instance-1", pid: 9001 } },
    expected: { singleLine: true, ansiFree: true, maxBytes: 512 },
  },
  {
    id: "log-rotation",
    group: "log",
    declaredSeam: "S-log",
    scenario: { activeBytes: 1_048_000, lineBytes: 1_000 },
    expected: { rotated: true, newestRetained: true, generations: 1 },
  },
  {
    id: "log-failed-append",
    group: "log",
    declaredSeam: "S-log",
    scenario: { failing: true, exit: 0 },
    expected: { exit: 0, records: 1, disclosure: "log-unavailable" },
  },
];

/** The whole registry; every phase appends its own group. */
export const LOOP_PARITY_CASES: readonly LoopParityCase[] = [...SPAWN_CASES, ...LOG_CASES];

/** The rows of one proven surface, in declaration order. */
export const loopParityCasesOf = (group: LoopProvenSeam): readonly LoopParityCase[] =>
  LOOP_PARITY_CASES.filter((entry) => entry.group === group);

/** Every declared group, in the boundary order. */
export const loopParityGroups = (): readonly LoopProvenSeam[] => LOOP_PROVEN_SEAMS;

/**
 * Run every registry row through its declared builder.
 *
 * The runner is deliberately thin: it resolves the row's scenario with the
 * caller's factory and records the expected envelope, so a suite asserts the
 * OBSERVATION rather than restating the scenario (AC-F8-1).
 */
export const runAllLoopParityCases = async (
  run: (entry: LoopParityCase) => Promise<Readonly<Record<string, unknown>>>,
): Promise<
  readonly { readonly id: string; readonly observed: Readonly<Record<string, unknown>> }[]
> => {
  const results: { id: string; observed: Readonly<Record<string, unknown>> }[] = [];
  for (const entry of LOOP_PARITY_CASES) {
    results.push({ id: entry.id, observed: await run(entry) });
  }
  return results;
};
