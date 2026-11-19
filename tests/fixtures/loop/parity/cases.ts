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

/** The `single-instance` group's rows (phase 3). */
const SINGLE_INSTANCE_CASES: readonly LoopParityCase[] = [
  {
    id: "instance-two-starts",
    group: "single-instance",
    declaredSeam: "S-lease",
    scenario: { starts: 2, liveHolder: true },
    expected: { admitted: 1, refused: 1, exit: 2 },
  },
  {
    id: "instance-dead-holder-join",
    group: "single-instance",
    declaredSeam: "S-lease",
    scenario: { holderAlive: false, recordedSession: "live" },
    expected: { takeoverRecords: 1, spawns: 0 },
  },
  {
    id: "instance-ended-replaced",
    group: "single-instance",
    declaredSeam: "S-refind",
    scenario: { recordedSession: "ended" },
    expected: { spawns: 1, resumesForPrevious: 0 },
  },
  {
    id: "instance-distinct-identity",
    group: "single-instance",
    declaredSeam: "S-lease",
    scenario: { identities: ["loop-main", "coordinator-main"] },
    expected: { admittedBoth: true, foreignRecordsRead: 0 },
  },
  {
    id: "instance-pidless-resume",
    group: "single-instance",
    declaredSeam: "S-refind",
    scenario: { recordedSession: "active", pid: null },
    expected: { resumes: 1, spawns: 0, degradations: ["session-pid-unknown"] },
  },
];

/** The whole registry; every phase appends its own group. */
const STUCK_CASES: readonly LoopParityCase[] = [
  {
    id: "stuck-two-signal-verdict",
    group: "stuck",
    declaredSeam: "S-verdict",
    scenario: { traffic: "zero", delivery: "none", windowElapsed: true },
    expected: { verdict: "stuck", records: 2, kills: 1 },
  },
  {
    id: "stuck-positive-progress",
    group: "stuck",
    declaredSeam: "S-verdict",
    scenario: { traffic: "positive" },
    expected: { verdict: "progressing", records: 0, kills: 0 },
  },
  {
    id: "stuck-delivery-veto",
    group: "stuck",
    declaredSeam: "S-corroborator",
    scenario: { traffic: "zero", delivery: "in-progress" },
    expected: { verdict: "progressing", kills: 0 },
  },
  {
    id: "stuck-unreadable-progress",
    group: "stuck",
    declaredSeam: "S-verdict",
    scenario: { traffic: "unknown" },
    expected: { verdict: "unevaluable", records: 1, kills: 0 },
  },
  {
    id: "stuck-unreadable-corroborator",
    group: "stuck",
    declaredSeam: "S-corroborator",
    scenario: { delivery: "unknown" },
    expected: { verdict: "unevaluable", kills: 0 },
  },
  {
    id: "stuck-seeded-observation",
    group: "stuck",
    declaredSeam: "S-verdict",
    scenario: { restartJustHappened: true },
    expected: { verdictDelayed: true },
  },
  {
    id: "stuck-decision-table",
    group: "stuck",
    declaredSeam: "S-corroborator",
    scenario: { rows: 16 },
    expected: { total: true, noneRequiresReadableStore: true },
  },
];

const KILL_CASES: readonly LoopParityCase[] = [
  {
    id: "kill-term-before-kill",
    group: "kill",
    declaredSeam: "S-terminate",
    scenario: { graceMs: 20_000, treeListed: true },
    expected: { termFirst: true, killAfterGrace: true },
  },
  {
    id: "kill-exact-target",
    group: "kill",
    declaredSeam: "S-terminate",
    scenario: { mismatch: true },
    expected: { signals: 0, reason: "identity-mismatch" },
  },
  {
    id: "kill-unconfirmed-terminal",
    group: "kill",
    declaredSeam: "S-terminate",
    scenario: { confirmed: false },
    expected: { exit: 2, restarts: 0, spawns: 1 },
  },
];

const BACKOFF_BUDGET_CASES: readonly LoopParityCase[] = [
  {
    id: "backoff-schedule",
    group: "backoff-budget",
    declaredSeam: "S-backoff",
    scenario: { ordinals: 10 },
    expected: { total: 1_110_000, capped: [300_000, 300_000] },
  },
  {
    id: "backoff-one-ordinal",
    group: "backoff-budget",
    declaredSeam: "S-backoff",
    scenario: { stuckRestarts: 1 },
    expected: { restartRecords: 1, spawns: 2 },
  },
  {
    id: "backoff-clean-end",
    group: "backoff-budget",
    declaredSeam: "S-backoff",
    scenario: { selfEnded: true },
    expected: { restartRecords: 0, backoffWaits: 0 },
  },
  {
    id: "backoff-exhaustion",
    group: "backoff-budget",
    declaredSeam: "S-backoff",
    scenario: { atBound: true },
    expected: { exit: 1, remediation: "loop start --foreground --fresh-budget" },
  },
  {
    id: "backoff-fresh-budget",
    group: "backoff-budget",
    declaredSeam: "S-backoff",
    scenario: { exhaustedThenFresh: true },
    expected: { epoch: "epoch-2", count: 0 },
  },
  {
    id: "backoff-cancelled-wait",
    group: "backoff-budget",
    declaredSeam: "S-backoff",
    scenario: { cancelled: true },
    expected: { sessionEffect: false },
  },
];

const STOP_CASES: readonly LoopParityCase[] = [
  {
    id: "stop-idempotent",
    group: "stop",
    declaredSeam: "S-stop",
    scenario: { stops: 2 },
    expected: { records: 1, exit: 0 },
  },
  {
    id: "stop-folded-start",
    group: "stop",
    declaredSeam: "S-stop",
    scenario: { folded: "requested" },
    expected: { state: "stopped", leaseRecords: 0, sessions: 0 },
  },
  {
    id: "stop-torn-fold",
    group: "stop",
    declaredSeam: "S-stop",
    scenario: { fold: "unreadable" },
    expected: { exit: 2, sessionEffects: 0 },
  },
  {
    id: "stop-reset",
    group: "stop",
    declaredSeam: "S-stop",
    scenario: { folded: "requested", resets: 2 },
    expected: { cleared: 1, total: 2 },
  },
  {
    id: "stop-drain",
    group: "stop",
    declaredSeam: "S-stop",
    scenario: { mode: "drain" },
    expected: { terminations: 0 },
  },
  {
    id: "stop-immediate",
    group: "stop",
    declaredSeam: "S-stop",
    scenario: { mode: "immediate", verified: true },
    expected: { terminations: 1, boundMs: 50_000, liveSessions: 1 },
  },
  {
    id: "stop-unverified",
    group: "stop",
    declaredSeam: "S-stop",
    scenario: { mode: "immediate", verified: false },
    expected: { signals: 0, degradation: "session-pid-unknown" },
  },
];

const VERBS_CASES: readonly LoopParityCase[] = [
  {
    id: "verbs-green-rows",
    group: "verbs",
    declaredSeam: "S-verb",
    scenario: { rows: 10 },
    expected: { refused: 0, exit: 0 },
  },
  {
    id: "verbs-refusals",
    group: "verbs",
    declaredSeam: "S-verb",
    scenario: { malformed: 10 },
    expected: { exit: 1, appends: 0, reason: "grammar" },
  },
  {
    id: "verbs-status-block",
    group: "verbs",
    declaredSeam: "S-status",
    scenario: { worlds: ["running", "stopped", "absent"] },
    expected: { keys: 14, booleans: 3, noneTokens: 0 },
  },
  {
    id: "verbs-log-read",
    group: "verbs",
    declaredSeam: "S-log",
    scenario: { bounds: [1, 50, 100] },
    expected: { bounded: true, truncationFlag: true },
  },
  {
    id: "verbs-globals-accepted",
    group: "verbs",
    declaredSeam: "S-verb",
    scenario: { flags: ["--json", "--verbose", "--pretty"] },
    expected: { refused: 0 },
  },
];

export const LOOP_PARITY_CASES: readonly LoopParityCase[] = [
  ...SPAWN_CASES,
  ...LOG_CASES,
  ...SINGLE_INSTANCE_CASES,
  ...STUCK_CASES,
  ...KILL_CASES,
  ...BACKOFF_BUDGET_CASES,
  ...STOP_CASES,
  ...VERBS_CASES,
];

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
