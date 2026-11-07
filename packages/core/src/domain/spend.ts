/**
 * The pure spend fold (GH-236 F-1..F-5; DM-1..DM-4; DEC-2..DEC-5, DEC-11).
 *
 * One deterministic pass over a verified `SpendLedgerRead`: five-class token
 * sums (null classes excluded, never fabricated), per-(agent, model) roll-ups,
 * capture-time phase attribution over the transition windows, restart counts
 * over the union of run identities, the TDR-0011 amplification formula with the
 * additive `progressRun` naming rule, and the closed-vocabulary degradation
 * disclosure. Zero I/O, zero clock, zero randomness: records arrive as
 * arguments and identical inputs render identical output.
 */
import {
  CANONICAL_PHASE_IDS,
  HARNESS_TOKEN_CLASSES,
  HARNESS_WARNING_REASONS,
  type HarnessCaptureOutcomeRecord,
  type HarnessTelemetryRecord,
  type HarnessTokenClass,
  type HarnessTokenCounts,
  type HarnessWarningReason,
  type PhaseTransitionRecord,
  SPEND_AMPLIFICATION_CAUSES,
  SPEND_MAX_MACHINE_BYTES,
  SPEND_PHASE_UNKNOWN,
  SPEND_TRUNCATION_MARKER,
  type SpendAgentEntry,
  type SpendAmplification,
  type SpendAmplificationEvent,
  type SpendDegradation,
  type SpendDigestSection,
  type SpendLedgerRead,
  type SpendPhaseEntry,
  type SpendPhaseId,
  type SpendReport,
  type SpendSelection,
  type SpendTruncation,
} from "#contracts";

/** The classified absence: the selection holds no captured telemetry. */
export type SpendAbsence = {
  readonly code: "spend.telemetry-absent";
  readonly workItemRef: string;
  readonly phase?: SpendPhaseId;
};

/** The fold outcome: a bounded report plus its warning channel, or absence. */
export type SpendFoldOutcome =
  | { readonly ok: true; readonly data: SpendReport; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly absence: SpendAbsence };

type Attribution = {
  readonly phase: SpendPhaseId;
  readonly windowStart: string | undefined;
};

type OrderedTransition = {
  readonly phaseId: string;
  readonly timestamp: string;
  readonly order: number;
};

const canonical = new Set<string>(CANONICAL_PHASE_IDS);

const normalizePhase = (phaseId: string): SpendPhaseId =>
  canonical.has(phaseId) ? (phaseId as SpendPhaseId) : SPEND_PHASE_UNKNOWN;

const orderedTransitions = (transitions: readonly PhaseTransitionRecord[]): OrderedTransition[] =>
  transitions
    .map((transition, index) => ({
      phaseId: transition.phaseId,
      timestamp: transition.timestamp,
      order: index,
    }))
    .sort((left, right) => {
      if (left.timestamp !== right.timestamp) return left.timestamp < right.timestamp ? -1 : 1;
      return left.order - right.order;
    });

/**
 * Capture-time attribution (DM-2, PIN-4).
 *
 * A record stamp selects the phase of the earliest transition at or after the
 * stamp; when several transitions share that stamp the last one wins (a
 * `reopen` beats a `complete` at the same instant). A stamp after the final
 * transition attributes to the final transitioned phase; a stamp before the
 * first transition attributes to the first transitioned phase. No history means
 * the single named `unknown` window.
 */
const attributionFor = (stamp: string, ordered: readonly OrderedTransition[]): Attribution => {
  const first = ordered[0];
  const last = ordered.at(-1);
  if (first === undefined || last === undefined) {
    return { phase: SPEND_PHASE_UNKNOWN, windowStart: undefined };
  }
  const eligible = ordered.filter((transition) => transition.timestamp >= stamp);
  const chosenAt =
    eligible.length === 0 ? last.timestamp : (eligible[0] as OrderedTransition).timestamp;
  const atStamp = ordered.filter((transition) => transition.timestamp === chosenAt);
  const chosen = atStamp.at(-1) ?? last;
  const phase = normalizePhase(chosen.phaseId);
  return { phase, windowStart: windowStartOf(phase, ordered) };
};

/** The opening stamp of a phase's first window; the `unknown` window has none. */
const windowStartOf = (
  phase: SpendPhaseId,
  ordered: readonly OrderedTransition[],
): string | undefined => {
  if (phase === SPEND_PHASE_UNKNOWN) return undefined;
  const index = ordered.findIndex((transition) => normalizePhase(transition.phaseId) === phase);
  if (index < 0) return undefined;
  const previous = index === 0 ? undefined : ordered[index - 1];
  return previous?.timestamp ?? (ordered[index] as OrderedTransition).timestamp;
};

const zeroTokens = (): Record<HarnessTokenClass, number> => ({
  input: 0,
  output: 0,
  reasoning: 0,
  cacheRead: 0,
  cacheWrite: 0,
});

/** Add one record's non-null classes into the totals (null never becomes 0). */
const addTokens = (totals: Record<HarnessTokenClass, number>, counts: HarnessTokenCounts): void => {
  for (const tokenClass of HARNESS_TOKEN_CLASSES) {
    const value = counts[tokenClass];
    if (value === null) continue;
    totals[tokenClass] += value;
  }
};

/** The five-class sum of one record, excluding null classes. */
const sumOf = (counts: HarnessTokenCounts): number =>
  HARNESS_TOKEN_CLASSES.reduce((sum, tokenClass) => sum + (counts[tokenClass] ?? 0), 0);

const hasNullClass = (counts: HarnessTokenCounts): boolean =>
  HARNESS_TOKEN_CLASSES.some((tokenClass) => counts[tokenClass] === null);

type RunAggregate = {
  runId: string;
  capturedAt: string;
  spend: number;
};

/**
 * The amplification block exactly per TDR-0011 as amended (DM-3, DEC-11).
 *
 * `paid` is the five-class sum over the selected records; `progress` is the
 * latest record-bearing run's spend (captured-at descending, run id ascending).
 * A zero-token progress run reports `ratio: null` and names the run in
 * `progressRun`; the no-record-bearing-run boundary is null/null.
 */
const amplificationOf = (
  runs: readonly RunAggregate[],
  earliestTransition: string | undefined,
): SpendAmplification => {
  const chronological = [...runs].sort((left, right) => {
    if (left.capturedAt !== right.capturedAt) return left.capturedAt < right.capturedAt ? -1 : 1;
    return left.runId < right.runId ? -1 : left.runId > right.runId ? 1 : 0;
  });
  // The progress run is the latest captured run: captured-at descending with an
  // ascending run-id tie-break (TDR-0011 C-4), so equal stamps select the
  // smallest id, which is not necessarily the last chronological entry.
  const progress = [...runs].sort((left, right) => {
    if (left.capturedAt !== right.capturedAt) return left.capturedAt < right.capturedAt ? 1 : -1;
    return left.runId < right.runId ? -1 : left.runId > right.runId ? 1 : 0;
  })[0];
  const paid = chronological.reduce((sum, run) => sum + run.spend, 0);
  if (progress === undefined) {
    return {
      ratio: null,
      progressRun: null,
      events: [],
    };
  }
  const progressRun = progress.spend === 0 ? progress.runId : null;
  const ratio = progress.spend === 0 ? null : paid / progress.spend;
  const events: { readonly event: SpendAmplificationEvent; readonly runId: string }[] = [];
  for (const [index, run] of chronological.entries()) {
    if (run.runId === progress.runId) continue;
    if (run.spend <= 0) continue;
    const previous = index === 0 ? undefined : chronological[index - 1];
    const start = previous?.capturedAt ?? earliestTransition ?? run.capturedAt;
    events.push({
      event: {
        cause: SPEND_AMPLIFICATION_CAUSES[0],
        window: { start, end: run.capturedAt },
        tokensWasted: run.spend,
      },
      runId: run.runId,
    });
  }
  events.sort((left, right) => {
    if (left.event.window.start !== right.event.window.start) {
      return left.event.window.start < right.event.window.start ? -1 : 1;
    }
    return left.runId < right.runId ? -1 : left.runId > right.runId ? 1 : 0;
  });
  return { ratio, progressRun, events: events.map((entry) => entry.event) };
};

const degradationOf = (
  records: readonly HarnessTelemetryRecord[],
  outcomes: readonly HarnessCaptureOutcomeRecord[],
): SpendDegradation => {
  const byReason = Object.fromEntries(
    HARNESS_WARNING_REASONS.map((reason) => [reason, 0]),
  ) as Record<HarnessWarningReason, number>;
  let count = 0;
  for (const record of records) {
    const degraded = record.warnings.length > 0 || hasNullClass(record.tokens);
    if (degraded) count += 1;
    for (const warning of record.warnings) byReason[warning.reason] += 1;
  }
  for (const outcome of outcomes) {
    if (outcome.warnings.length > 0) count += 1;
    for (const warning of outcome.warnings) byReason[warning.reason] += 1;
  }
  return { records: count, byReason };
};

const perAgentOf = (records: readonly HarnessTelemetryRecord[]): readonly SpendAgentEntry[] => {
  const groups = new Map<string, { agent: string; model: string; calls: number; tokens: number }>();
  for (const record of records) {
    const key = `${record.agent}\u0000${record.model}`;
    const current = groups.get(key);
    if (current === undefined) {
      groups.set(key, {
        agent: record.agent,
        model: record.model,
        calls: record.calls,
        tokens: sumOf(record.tokens),
      });
    } else {
      current.calls += record.calls;
      current.tokens += sumOf(record.tokens);
    }
  }
  return [...groups.values()].sort((left, right) => {
    if (left.tokens !== right.tokens) return right.tokens - left.tokens;
    if (left.agent !== right.agent) return left.agent < right.agent ? -1 : 1;
    return left.model < right.model ? -1 : left.model > right.model ? 1 : 0;
  });
};

const perPhaseOf = (
  records: readonly HarnessTelemetryRecord[],
  attribute: (record: HarnessTelemetryRecord) => Attribution,
  totalTokens: number,
): readonly SpendPhaseEntry[] => {
  const entries = new Map<
    SpendPhaseId,
    { calls: number; tokens: number; windowStart: string | undefined }
  >();
  for (const record of records) {
    const { phase, windowStart } = attribute(record);
    const current = entries.get(phase);
    if (current === undefined) {
      entries.set(phase, { calls: record.calls, tokens: sumOf(record.tokens), windowStart });
    } else {
      current.calls += record.calls;
      current.tokens += sumOf(record.tokens);
    }
  }
  return [...entries.entries()]
    .map(([phase, entry]) => ({
      phase,
      calls: entry.calls,
      tokens: entry.tokens,
      share: totalTokens === 0 ? 0 : Math.floor((entry.tokens * 100) / totalTokens),
      windowStart: entry.windowStart,
    }))
    .sort((left, right) => {
      if (left.phase === SPEND_PHASE_UNKNOWN) return right.phase === SPEND_PHASE_UNKNOWN ? 0 : 1;
      if (right.phase === SPEND_PHASE_UNKNOWN) return -1;
      const leftStart = left.windowStart ?? "";
      const rightStart = right.windowStart ?? "";
      if (leftStart !== rightStart) return leftStart < rightStart ? -1 : 1;
      return left.phase < right.phase ? -1 : left.phase > right.phase ? 1 : 0;
    })
    .map(({ phase, calls, tokens, share }) => ({ phase, calls, tokens, share }));
};

const utf8Bytes = (text: string): number => {
  let bytes = 0;
  for (const character of text) {
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x7f) bytes += 1;
    else if (point <= 0x7ff) bytes += 2;
    else if (point <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

/**
 * Bound the machine payload (PIN-2, PIN-3): drop trailing `perAgent[]` entries
 * first, then trailing `perPhase[]` entries, then trailing amplification events,
 * and record the dropped counts. The totals, restarts, ratio and progress-run
 * identity are never truncated.
 */
const boundReport = (
  report: SpendReport,
): { readonly report: SpendReport; readonly truncation: SpendTruncation } => {
  let agents = report.perAgent;
  let phases = report.perPhase;
  let events = report.amplification.events;
  const build = (): SpendReport => ({
    ...report,
    perAgent: agents,
    perPhase: phases,
    amplification: { ...report.amplification, events },
  });
  while (agents.length > 0 && utf8Bytes(JSON.stringify(build())) > SPEND_MAX_MACHINE_BYTES) {
    agents = agents.slice(0, -1);
  }
  while (phases.length > 0 && utf8Bytes(JSON.stringify(build())) > SPEND_MAX_MACHINE_BYTES) {
    phases = phases.slice(0, -1);
  }
  while (events.length > 0 && utf8Bytes(JSON.stringify(build())) > SPEND_MAX_MACHINE_BYTES) {
    events = events.slice(0, -1);
  }
  return {
    report: build(),
    truncation: {
      agents: report.perAgent.length - agents.length,
      phases: report.perPhase.length - phases.length,
      events: report.amplification.events.length - events.length,
    },
  };
};

/** The truncation warning text, carried in the envelope's warning channel. */
export const spendTruncationWarning = (truncation: SpendTruncation): string =>
  `${SPEND_TRUNCATION_MARKER}: perAgent ${String(truncation.agents)} entries omitted, perPhase ${String(truncation.phases)} entries omitted, events ${String(truncation.events)} omitted`;

/**
 * Fold one verified read into the spend report (PIN-6: one selection, one fold).
 *
 * A `--phase` selection scopes `tokensByClass`, calls, `perAgent[]`,
 * `perPhase[]`, restarts and the amplification block to the phase-attributed
 * record subset. An empty canonical window is the classified
 * `spend.telemetry-absent` scoped to the phase; a records-exist all-null fold is
 * a success report, never absence.
 */
export const computeSpendReport = (
  read: SpendLedgerRead,
  selection: SpendSelection = { workItemRef: read.workItemRef },
): SpendFoldOutcome => {
  if (read.verifiedEmpty) {
    return { ok: false, absence: absenceFor(selection) };
  }
  const ordered = orderedTransitions(read.transitions);
  const attribute = (record: HarnessTelemetryRecord): Attribution =>
    attributionFor(record.capturedAt, ordered);

  let records = read.records;
  let outcomes = read.outcomes;
  if (selection.phase !== undefined) {
    records = records.filter((record) => attribute(record).phase === selection.phase);
    if (records.length === 0) {
      return { ok: false, absence: absenceFor(selection) };
    }
    const runIds = new Set(records.map((record) => record.runId));
    outcomes = outcomes.filter((outcome) => runIds.has(outcome.runId));
  }

  const totals = zeroTokens();
  for (const record of records) {
    addTokens(totals, record.tokens);
  }
  const totalTokens = HARNESS_TOKEN_CLASSES.reduce(
    (sum, tokenClass) => sum + totals[tokenClass],
    0,
  );

  const runs = new Map<string, RunAggregate>();
  for (const record of records) {
    const current = runs.get(record.runId);
    const spend = sumOf(record.tokens);
    if (current === undefined) {
      runs.set(record.runId, {
        runId: record.runId,
        capturedAt: record.capturedAt,
        spend,
      });
    } else {
      current.spend += spend;
      if (record.capturedAt > current.capturedAt) current.capturedAt = record.capturedAt;
    }
  }
  const runIdentities = new Set<string>(readsRunIdSet(records));
  if (selection.phase === undefined) {
    for (const outcome of read.outcomes) runIdentities.add(outcome.runId);
  }
  const restarts = Math.max(0, runIdentities.size - 1);

  const earliestTransition = ordered[0]?.timestamp;
  const bounded = boundReport({
    tokensByClass: totals,
    perPhase: perPhaseOf(records, attribute, totalTokens),
    perAgent: perAgentOf(records),
    restarts,
    amplification: amplificationOf([...runs.values()], earliestTransition),
    degradation: degradationOf(records, outcomes),
  });
  const warnings =
    bounded.truncation.agents === 0 &&
    bounded.truncation.phases === 0 &&
    bounded.truncation.events === 0
      ? []
      : [spendTruncationWarning(bounded.truncation)];
  return { ok: true, data: bounded.report, warnings };
};

const readsRunIdSet = (records: readonly HarnessTelemetryRecord[]): Set<string> =>
  new Set(records.map((record) => record.runId));

const absenceFor = (selection: SpendSelection): SpendAbsence => ({
  code: "spend.telemetry-absent",
  workItemRef: selection.workItemRef,
  ...(selection.phase === undefined ? {} : { phase: selection.phase }),
});

/**
 * Project the same fold onto the status digest (DM-6, DEC-8).
 *
 * Captured telemetry is `observed` with the summary figures; a verified-empty
 * read is `observed` with `captured: false` (never a zero-spend claim); a state
 * failure is the caller's `unknown` projection.
 */
export const spendDigestSection = (read: SpendLedgerRead): SpendDigestSection => {
  const folded = computeSpendReport(read, { workItemRef: read.workItemRef });
  if (!folded.ok) return { state: "observed", captured: false };
  return {
    state: "observed",
    captured: true,
    tokensByClass: folded.data.tokensByClass,
    restarts: folded.data.restarts,
    ratio: folded.data.amplification.ratio,
  };
};
