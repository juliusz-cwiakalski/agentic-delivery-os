/**
 * The committed watchdog fixture/outcome matrix (GH-221 test-plan §6).
 *
 * This is code-reviewed data, not prose: every fixture ID the suites create is
 * named here with its family and expected outcome, and the Appendix B verdict /
 * exit matrix records which rows are reachable in M1-S1.
 */

export const WATCHDOG_FIXTURES = [
  { id: "FIX-CLEAN", family: "admission", probe: "preflight", expected: "ok" },
  { id: "FIX-DIRTY", family: "admission", probe: "preflight", expected: "refused" },
  { id: "FIX-OFFBASE", family: "admission", probe: "preflight", expected: "refused" },
  { id: "FIX-FOREIGN-WORKTREE", family: "admission", probe: "preflight", expected: "refused" },
  { id: "FIX-SUCCESS-RESIDUE", family: "restoration", probe: "teardown", expected: "restored" },
  { id: "FIX-FAIL-EXIT", family: "restoration", probe: "teardown", expected: "restored" },
  { id: "FIX-INTERRUPTED", family: "restoration", probe: "teardown", expected: "restored" },
  { id: "FIX-MEM-COMMITTED", family: "memory", probe: "teardown", expected: "restored" },
  { id: "FIX-MEM-UNCOMMITTED", family: "memory", probe: "teardown", expected: "preserved" },
  { id: "FIX-UNATTRIBUTED", family: "restoration", probe: "teardown", expected: "preserved" },
  { id: "FIX-NO-SIGNALS", family: "liveness", probe: "liveness", expected: "signals-absent" },
  { id: "FIX-PREFILL", family: "liveness", probe: "liveness", expected: "signals-absent" },
  { id: "FIX-BASE-MISSING", family: "admission", probe: "preflight", expected: "unevaluable" },
  { id: "FIX-TORN", family: "admission", probe: "preflight", expected: "torn" },
] as const;

export type WatchdogFixture = (typeof WATCHDOG_FIXTURES)[number];
export type WatchdogFixtureId = WatchdogFixture["id"];

export const fixtureById = (id: WatchdogFixtureId): WatchdogFixture => {
  const row = WATCHDOG_FIXTURES.find((entry) => entry.id === id);
  if (row === undefined) throw new Error(`unknown watchdog fixture ${id}`);
  return row;
};

/**
 * Appendix B verdict / exit matrix. `reachable` is false for the declared
 * contract values that only become reachable when M1-S15 delivers signal
 * ingestion; the GAP-T2 note records the deferred machine-representation
 * decision for a sourced `stalled` exit.
 */
export const EXIT_MATRIX = [
  {
    outcome: "admission",
    verdict: "ok",
    exit: 0,
    identity: null,
    reachable: true,
    note: "clean on-base checkout admitted",
  },
  {
    outcome: "restoration",
    verdict: "ok",
    exit: 0,
    identity: null,
    reachable: true,
    note: "teardown restored and publications verified",
  },
  {
    outcome: "dirty",
    verdict: "refused",
    exit: 1,
    identity: "watchdog.checkout-dirty",
    reachable: true,
    note: "refusal rides the failure envelope (PIN-1)",
  },
  {
    outcome: "non-base",
    verdict: "refused",
    exit: 1,
    identity: "watchdog.checkout-non-base",
    reachable: true,
    note: "refusal rides the failure envelope (PIN-1)",
  },
  {
    outcome: "stalled",
    verdict: "stalled",
    exit: 1,
    identity: null,
    reachable: false,
    note: "declared contract data; M1-S15 / GAP-T2 must decide the machine representation",
  },
  {
    outcome: "progressing",
    verdict: "progressing",
    exit: 0,
    identity: null,
    reachable: false,
    note: "declared contract data; reachable from M1-S15",
  },
  {
    outcome: "signals-absent",
    verdict: null,
    exit: 2,
    identity: "watchdog.signals-absent",
    reachable: true,
    note: "unknown, never guessed; no verdict is emitted",
  },
  {
    outcome: "grammar",
    verdict: null,
    exit: 1,
    identity: "input.value.rejected",
    reachable: true,
    note: "parser-level failures reuse fallback.invocation",
  },
] as const;

/** The two declared-but-unreachable rows, named for the M1-S15 boundary tests. */
export const DECLARED_ONLY_OUTCOMES = EXIT_MATRIX.filter((row) => !row.reachable);
