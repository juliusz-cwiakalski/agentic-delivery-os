/**
 * The pure spend fold (GH-236 F-1..F-5; GH-291 F-3, F-5, F-6; DM-1..DM-6).
 *
 * One deterministic pass over a verified `SpendLedgerRead`: five-class token
 * sums (null classes excluded, never fabricated), per-(role, model) roll-ups,
 * capture-time phase attribution over the transition windows, restart counts
 * over the union of run identities, the TDR-0011 amplification formula with the
 * additive `progressRun` naming rule, and the closed-vocabulary degradation
 * disclosure — extended additively by the telemetry v2 read side: five-dimension
 * breakdowns, cost-bearing totals, per-phase timing summaries joined from the
 * delivered transition and economics records, the telemetry-state disclosure,
 * and the declared-tolerance reconciliation against captured harness baselines.
 *
 * The six v1 keys keep their names and semantics; the five v2 keys sit beside
 * them under the same `delivery.spend.v1` identity (DEC-6). Zero I/O, zero
 * clock, zero randomness: records arrive as arguments and identical inputs
 * render identical output.
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
  SPEND_BREAKDOWN_FIELDS,
  SPEND_MAX_MACHINE_BYTES,
  SPEND_PHASE_UNKNOWN,
  SPEND_TRUNCATION_MARKER,
  type SpendAgentEntry,
  type SpendAmplification,
  type SpendAmplificationEvent,
  type SpendBreakdownEntry,
  type SpendBreakdownField,
  type SpendBreakdowns,
  type SpendCostTotals,
  type SpendDegradation,
  type SpendDigestSection,
  type SpendLedgerRead,
  type SpendModelCost,
  type SpendPhaseEntry,
  type SpendPhaseId,
  type SpendPhaseTiming,
  type SpendReport,
  type SpendSelection,
  type SpendTruncation,
  TELEMETRY_RECONCILIATION_TOLERANCE,
  TELEMETRY_STATE_PRESENT,
  TELEMETRY_VERDICT_OUTSIDE,
  TELEMETRY_VERDICT_UNAVAILABLE,
  TELEMETRY_VERDICT_WITHIN,
  type TelemetryBaselineRecord,
  type TelemetryReadingBasis,
  type TelemetryReconciliation,
  type TelemetryReconciliationVerdict,
  type TelemetryStepRecord,
  type TelemetryStepTokens,
} from "#contracts";

/** The classified absence: the selection holds no captured telemetry. */
export type SpendAbsence = {
  readonly code: "spend.telemetry-absent";
  readonly workItemRef: string;
  readonly phase?: SpendPhaseId;
};

/** The fold outcome: a bounded report plus its warning channel, or absence. */
export type SpendFoldOutcome =
  | {
      readonly ok: true;
      readonly data: SpendReport;
      readonly warnings: readonly string[];
      /** The declared machine truncation, when the bound cut any tail (NFR-2). */
      readonly truncation?: SpendTruncation;
    }
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

/** One measured record from either capture plane, normalized for the fold. */
type MeasuredRecord = {
  readonly plane: "stream" | "closeout";
  readonly sessionId: string;
  readonly runId: string;
  readonly stamp: string;
  readonly capturedAt: string;
  readonly ticket: string | null;
  readonly repository: string | null;
  readonly lane: string | null;
  readonly agentRole: string | null;
  readonly model: string | null;
  readonly tokens: HarnessTokenCounts;
  readonly calls: number | null;
  readonly cost: number | null;
  readonly warningReasons: readonly HarnessWarningReason[];
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

const tokensTotal = (totals: Record<HarnessTokenClass, number>): number =>
  HARNESS_TOKEN_CLASSES.reduce((sum, tokenClass) => sum + totals[tokenClass], 0);

const hasNullClass = (counts: HarnessTokenCounts): boolean =>
  HARNESS_TOKEN_CLASSES.some((tokenClass) => counts[tokenClass] === null);

// ---------------------------------------------------------------------------
// Record normalization (both planes) and the OQ-T4 session selection.
// ---------------------------------------------------------------------------

const streamRecord = (record: TelemetryStepRecord): MeasuredRecord => ({
  plane: "stream",
  sessionId: record.sessionId,
  runId: record.runId,
  stamp: record.finishedAt ?? record.capturedAt,
  capturedAt: record.capturedAt,
  ticket: record.ticket,
  repository: record.repository,
  lane: record.lane,
  agentRole: record.agentRole,
  model: record.model,
  tokens: record.tokens,
  calls: record.calls,
  cost: record.cost,
  warningReasons: record.warnings
    .map((warning) => warning.reason)
    .filter((reason): reason is HarnessWarningReason =>
      (HARNESS_WARNING_REASONS as readonly string[]).includes(reason),
    ),
});

const closeoutRecord = (record: HarnessTelemetryRecord): MeasuredRecord => ({
  plane: "closeout",
  sessionId: record.sessionId,
  runId: record.runId,
  stamp: record.capturedAt,
  capturedAt: record.capturedAt,
  ticket: record.workItemRef,
  // v1 capture carries no repository dimension; a tree path is not an identity
  // reference and never enters a report (NFR-7).
  repository: null,
  lane: null,
  agentRole: record.agent,
  model: record.model,
  tokens: record.tokens,
  calls: record.calls,
  cost: record.cost,
  warningReasons: record.warnings.map((warning) => warning.reason),
});

/** The declared combination arithmetic (OQ-T4): one session, one plane's figures. */
const selectedRecords = (measured: readonly MeasuredRecord[]): readonly MeasuredRecord[] => {
  const sessions = new Map<string, MeasuredRecord[]>();
  for (const record of measured) {
    const key = record.sessionId;
    const current = sessions.get(key);
    if (current === undefined) sessions.set(key, [record]);
    else current.push(record);
  }
  const selected: MeasuredRecord[] = [];
  for (const records of sessions.values()) {
    const stream = records.filter((record) => record.plane === "stream");
    selected.push(...(stream.length > 0 ? stream : records));
  }
  return selected;
};

const sessionGroups = (measured: readonly MeasuredRecord[]): Map<string, MeasuredRecord[]> => {
  const groups = new Map<string, MeasuredRecord[]>();
  for (const record of measured) {
    const current = groups.get(record.sessionId);
    if (current === undefined) groups.set(record.sessionId, [record]);
    else current.push(record);
  }
  return groups;
};

// ---------------------------------------------------------------------------
// Reconciliation (DEC-2, DEC-5, OQ-T2, OQ-T4).
// ---------------------------------------------------------------------------

const stepTokensOf = (totals: Record<HarnessTokenClass, number>): TelemetryStepTokens => ({
  input: totals.input,
  output: totals.output,
  reasoning: totals.reasoning,
  cacheRead: totals.cacheRead,
  cacheWrite: totals.cacheWrite,
});

/**
 * The maximum per-class deviation from the baseline; 0 when no class has a base.
 *
 * A class the baseline reports as zero while the observed steps carry it is
 * schema drift, not a tolerance-shaped difference: it counts as an immediate
 * full deviation, exactly as an all-zero baseline does. Skipping it would let
 * headline totals diverge arbitrarily through a zero-base class while the
 * verdict still rendered `within`.
 */
const deviationOf = (
  observed: Record<HarnessTokenClass, number>,
  baseline: Record<HarnessTokenClass, number>,
): number => {
  let worst = 0;
  for (const tokenClass of HARNESS_TOKEN_CLASSES) {
    const base = baseline[tokenClass];
    const observedValue = observed[tokenClass];
    if (base <= 0) {
      if (observedValue > 0) worst = 1;
      continue;
    }
    const deviation = Math.abs(observedValue - base) / base;
    if (deviation > worst) worst = deviation;
  }
  const baseTotal = tokensTotal(baseline);
  if (baseTotal === 0) return tokensTotal(observed) === 0 ? 0 : 1;
  return worst;
};

/**
 * Compose the reconciliation block (DEC-5).
 *
 * The baseline is the sum of every attributed session's harness-reported total:
 * the captured baseline record when present, else that session's delivered
 * closeout group sums. A session with neither is excluded and counted, never
 * counted as zero. No contribution at all is the classified unavailability —
 * never the `within` verdict.
 */
const reconciliationOf = (input: {
  readonly measured: readonly MeasuredRecord[];
  readonly baselines: readonly TelemetryBaselineRecord[];
  readonly observed: Record<HarnessTokenClass, number>;
  readonly basis: TelemetryReadingBasis;
}): { readonly block: TelemetryReconciliation; readonly excluded: number } => {
  const groups = sessionGroups(input.measured);
  const captured = new Map<string, TelemetryBaselineRecord>();
  for (const baseline of input.baselines) {
    if (!captured.has(baseline.sessionId)) captured.set(baseline.sessionId, baseline);
  }
  const sessionIds = new Set<string>([...groups.keys(), ...captured.keys()]);
  const baseline = zeroTokens();
  let contributorSessions = 0;
  let excluded = 0;
  for (const sessionId of sessionIds) {
    const record = captured.get(sessionId);
    if (record !== undefined) {
      addTokens(baseline, record.tokens);
      contributorSessions += 1;
      continue;
    }
    const closeout = (groups.get(sessionId) ?? []).filter((entry) => entry.plane === "closeout");
    if (closeout.length > 0) {
      for (const entry of closeout) addTokens(baseline, entry.tokens);
      contributorSessions += 1;
      continue;
    }
    excluded += 1;
  }
  const verdict: TelemetryReconciliationVerdict =
    contributorSessions === 0
      ? TELEMETRY_VERDICT_UNAVAILABLE
      : deviationOf(input.observed, baseline) <= TELEMETRY_RECONCILIATION_TOLERANCE
        ? TELEMETRY_VERDICT_WITHIN
        : TELEMETRY_VERDICT_OUTSIDE;
  return {
    block: {
      basis: input.basis,
      harnessTotals: contributorSessions === 0 ? null : stepTokensOf(baseline),
      observedTotals: stepTokensOf(input.observed),
      tolerance: TELEMETRY_RECONCILIATION_TOLERANCE,
      verdict,
      excludedBaselineSessions: excluded,
    },
    excluded,
  };
};

/** The declared reading basis, naming which planes contributed figures. */
const basisOf = (measured: readonly MeasuredRecord[]): TelemetryReadingBasis => {
  const stream = measured.some((record) => record.plane === "stream");
  const closeout = measured.some((record) => record.plane === "closeout");
  if (stream && closeout) return "combined";
  return stream ? "stream-ingest" : "closeout-capture";
};

// ---------------------------------------------------------------------------
// Breakdowns, cost totals, timing.
// ---------------------------------------------------------------------------

type Aggregate = {
  value: string | null;
  calls: number;
  tokens: number;
  cost: number | null;
  priced: number;
};

const dimensionValue = (record: MeasuredRecord, field: SpendBreakdownField): string | null => {
  switch (field) {
    case "ticket":
      return record.ticket;
    case "repository":
      return record.repository;
    case "lane":
      return record.lane;
    case "role":
      return record.agentRole;
    case "model":
      return record.model;
    default:
      return null;
  }
};

const breakdownOf = (records: readonly MeasuredRecord[]): SpendBreakdowns => {
  const result: Record<string, readonly SpendBreakdownEntry[]> = {};
  for (const field of SPEND_BREAKDOWN_FIELDS) {
    const groups = new Map<string, Aggregate>();
    for (const record of records) {
      const value = dimensionValue(record, field);
      const key = value === null ? "\u0000null" : value;
      const current = groups.get(key);
      const cost = record.cost;
      if (current === undefined) {
        groups.set(key, {
          value,
          calls: record.calls ?? 0,
          tokens: sumOf(record.tokens),
          cost: cost === null ? null : cost,
          priced: cost === null ? 0 : 1,
        });
        continue;
      }
      current.calls += record.calls ?? 0;
      current.tokens += sumOf(record.tokens);
      if (cost !== null) {
        current.cost = (current.cost ?? 0) + cost;
        current.priced += 1;
      }
    }
    result[field] = [...groups.values()]
      .map((entry) => ({
        value: entry.value,
        calls: entry.calls,
        tokens: entry.tokens,
        cost: entry.cost,
      }))
      .sort((left, right) => {
        if (left.tokens !== right.tokens) return right.tokens - left.tokens;
        if (left.value === null) return right.value === null ? 0 : 1;
        if (right.value === null) return -1;
        return left.value < right.value ? -1 : left.value > right.value ? 1 : 0;
      });
  }
  return result as SpendBreakdowns;
};

const costTotalsOf = (records: readonly MeasuredRecord[]): SpendCostTotals => {
  const models = new Map<string, { model: string | null; cost: number | null; priced: number }>();
  let total = 0;
  let priced = 0;
  let sparse = false;
  for (const record of records) {
    if (record.cost === null) {
      sparse = true;
    } else {
      total += record.cost;
      priced += 1;
    }
    const key = record.model === null ? "\u0000null" : record.model;
    const current = models.get(key);
    if (current === undefined) {
      models.set(key, {
        model: record.model,
        cost: record.cost === null ? null : record.cost,
        priced: record.cost === null ? 0 : 1,
      });
      continue;
    }
    if (record.cost !== null) {
      current.cost = (current.cost ?? 0) + record.cost;
      current.priced += 1;
    }
  }
  const modelList: SpendModelCost[] = [...models.values()]
    .map((entry) => ({ model: entry.model, cost: entry.cost }))
    .sort((left, right) => {
      if (left.model === null) return right.model === null ? 0 : 1;
      if (right.model === null) return -1;
      return left.model < right.model ? -1 : left.model > right.model ? 1 : 0;
    });
  return { total: priced === 0 ? null : total, models: modelList, sparse };
};

const STALL_REASON = "watchdog.liveness-stalled";

const phaseTimingOf = (
  ordered: readonly OrderedTransition[],
  restarts: readonly { readonly reason: string; readonly recordedAt: string }[],
): readonly SpendPhaseTiming[] => {
  const entries: SpendPhaseTiming[] = [];
  for (const [index, transition] of ordered.entries()) {
    const phase = normalizePhase(transition.phaseId);
    if (entries.some((entry) => entry.phase === phase)) continue;
    const start = transition.timestamp;
    const next = ordered[index + 1];
    const end = next === undefined ? null : next.timestamp;
    // A window is start-inclusive and end-exclusive: a restart stamped at the
    // closing transition belongs to the phase it opened, counted once.
    const within = restarts.filter(
      (restart) => restart.recordedAt >= start && (end === null || restart.recordedAt < end),
    );
    entries.push({
      phase,
      start,
      end,
      durationMs: end === null ? null : Math.max(0, Date.parse(end) - Date.parse(start)),
      stalls: within.filter((restart) => restart.reason === STALL_REASON).length,
      restarts: within.length,
    });
  }
  return entries;
};

// ---------------------------------------------------------------------------
// v1 blocks (names and semantics preserved).
// ---------------------------------------------------------------------------

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
  const progress = [...runs].sort((left, right) => {
    if (left.capturedAt !== right.capturedAt) return left.capturedAt < right.capturedAt ? 1 : -1;
    return left.runId < right.runId ? -1 : left.runId > right.runId ? 1 : 0;
  })[0];
  const paid = chronological.reduce((sum, run) => sum + run.spend, 0);
  if (progress === undefined) {
    return { ratio: null, progressRun: null, events: [] };
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
  measured: readonly MeasuredRecord[],
  outcomes: readonly HarnessCaptureOutcomeRecord[],
): SpendDegradation => {
  const byReason = Object.fromEntries(
    HARNESS_WARNING_REASONS.map((reason) => [reason, 0]),
  ) as Record<HarnessWarningReason, number>;
  let count = 0;
  for (const record of measured) {
    const degraded = record.warningReasons.length > 0 || hasNullClass(record.tokens);
    if (degraded) count += 1;
    for (const reason of record.warningReasons) byReason[reason] += 1;
  }
  for (const outcome of outcomes) {
    if (outcome.warnings.length > 0) count += 1;
    for (const warning of outcome.warnings) byReason[warning.reason] += 1;
  }
  return { records: count, byReason };
};

const perAgentOf = (records: readonly MeasuredRecord[]): readonly SpendAgentEntry[] => {
  const groups = new Map<string, { agent: string; model: string; calls: number; tokens: number }>();
  for (const record of records) {
    if (record.agentRole === null || record.model === null) continue;
    const key = `${record.agentRole}\u0000${record.model}`;
    const current = groups.get(key);
    if (current === undefined) {
      groups.set(key, {
        agent: record.agentRole,
        model: record.model,
        calls: record.calls ?? 0,
        tokens: sumOf(record.tokens),
      });
    } else {
      current.calls += record.calls ?? 0;
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
  records: readonly MeasuredRecord[],
  attribute: (record: MeasuredRecord) => Attribution,
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
      entries.set(phase, {
        calls: record.calls ?? 0,
        tokens: sumOf(record.tokens),
        windowStart,
      });
    } else {
      current.calls += record.calls ?? 0;
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

// ---------------------------------------------------------------------------
// Bounds (NFR-2): totals and the reconciliation block are never truncated.
// ---------------------------------------------------------------------------

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

const trimBreakdowns = (breakdowns: SpendBreakdowns, keep: number): SpendBreakdowns => {
  const trimmed: Record<string, readonly SpendBreakdownEntry[]> = {};
  for (const field of SPEND_BREAKDOWN_FIELDS) {
    const entries = breakdowns[field] ?? [];
    trimmed[field] = entries.slice(0, Math.max(0, entries.length - keep));
  }
  return trimmed as SpendBreakdowns;
};

const breakdownCount = (breakdowns: SpendBreakdowns): number =>
  SPEND_BREAKDOWN_FIELDS.reduce((sum, field) => sum + (breakdowns[field]?.length ?? 0), 0);

/**
 * The largest prefix of `entries` whose rebuilt report fits the byte bound.
 *
 * Size is monotonic in the retained count, so a binary search needs only
 * O(log n) serializations per tail instead of one per dropped entry — the bound
 * stays cheap at 10,000 records (NFR-2, NFR-4).
 */
const largestFitting = <T>(
  entries: readonly T[],
  fits: (kept: readonly T[]) => boolean,
): readonly T[] => {
  if (fits(entries)) return entries;
  let low = 0;
  let high = entries.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(entries.slice(0, middle))) low = middle;
    else high = middle - 1;
  }
  return entries.slice(0, low);
};

/**
 * Bound the machine payload (PIN-2, PIN-3, DM-6): drop trailing `perAgent[]`
 * entries first, then trailing breakdown rows, then trailing `perPhase[]`
 * entries, then trailing amplification events, and record the dropped counts.
 * The totals, restarts, ratio, and the reconciliation block are never cut.
 */
const boundReport = (
  report: SpendReport,
): { readonly report: SpendReport; readonly truncation: SpendTruncation } => {
  let agents = report.perAgent;
  let breakdowns = report.breakdowns;
  let phases = report.perPhase;
  let events = report.amplification.events;
  const build = (
    agentRows: typeof agents,
    breakdownRows: typeof breakdowns,
    phaseRows: typeof phases,
    eventRows: typeof events,
  ): SpendReport => ({
    ...report,
    perAgent: agentRows,
    breakdowns: breakdownRows,
    perPhase: phaseRows,
    amplification: { ...report.amplification, events: eventRows },
  });
  const fits = (
    agentRows: typeof agents,
    breakdownRows: typeof breakdowns,
    phaseRows: typeof phases,
    eventRows: typeof events,
  ): boolean =>
    utf8Bytes(JSON.stringify(build(agentRows, breakdownRows, phaseRows, eventRows))) <=
    SPEND_MAX_MACHINE_BYTES;
  agents = largestFitting(agents, (kept) => fits(kept, breakdowns, phases, events));
  let dropped = 0;
  while (breakdownCount(breakdowns) > 0 && !fits(agents, breakdowns, phases, events)) {
    dropped += 1;
    breakdowns = trimBreakdowns(report.breakdowns, dropped);
  }
  phases = largestFitting(phases, (kept) => fits(agents, breakdowns, kept, events));
  events = largestFitting(events, (kept) => fits(agents, breakdowns, phases, kept));
  return {
    report: build(agents, breakdowns, phases, events),
    truncation: {
      agents: report.perAgent.length - agents.length,
      breakdowns: breakdownCount(report.breakdowns) - breakdownCount(breakdowns),
      phases: report.perPhase.length - phases.length,
      events: report.amplification.events.length - events.length,
    },
  };
};

/** The truncation warning text, carried in the envelope's warning channel. */
export const spendTruncationWarning = (truncation: SpendTruncation): string =>
  `${SPEND_TRUNCATION_MARKER}: perAgent ${String(truncation.agents)} entries omitted, breakdowns ${String(truncation.breakdowns)} entries omitted, perPhase ${String(truncation.phases)} entries omitted, events ${String(truncation.events)} omitted`;

/**
 * Fold one verified read into the spend report (PIN-6: one selection, one fold).
 *
 * A `--phase` selection scopes every block to the phase-attributed record
 * subset. An empty canonical window is the classified `spend.telemetry-absent`
 * scoped to the phase; a records-exist all-null fold is a success report, never
 * absence.
 */
export const computeSpendReport = (
  read: SpendLedgerRead,
  selection: SpendSelection = { workItemRef: read.workItemRef },
): SpendFoldOutcome => {
  const steps = read.steps ?? [];
  // Absence keys off telemetry records of either plane — step records, closeout
  // session records, or a capture outcome for the ref. A baseline record alone
  // is a cross-check input, never evidence that telemetry exists (DEC-4, S-06).
  if (steps.length === 0 && read.records.length === 0 && read.outcomes.length === 0) {
    return { ok: false, absence: absenceFor(selection) };
  }
  const ordered = orderedTransitions(read.transitions);
  const attribute = (record: MeasuredRecord): Attribution => attributionFor(record.stamp, ordered);

  const baselines = read.baselines ?? [];
  const restarts = read.restarts ?? [];
  const all: MeasuredRecord[] = [...steps.map(streamRecord), ...read.records.map(closeoutRecord)];
  let outcomes = read.outcomes;
  let measured = all;
  if (selection.phase !== undefined) {
    measured = measured.filter((record) => attribute(record).phase === selection.phase);
    if (measured.length === 0) {
      return { ok: false, absence: absenceFor(selection) };
    }
    const runIds = new Set(measured.map((record) => record.runId));
    outcomes = outcomes.filter((outcome) => runIds.has(outcome.runId));
  }

  const selected = selectedRecords(measured);
  const observed = zeroTokens();
  for (const record of selected) addTokens(observed, record.tokens);
  const totalTokens = tokensTotal(observed);

  const runs = new Map<string, RunAggregate>();
  for (const record of selected) {
    const current = runs.get(record.runId);
    const spend = sumOf(record.tokens);
    if (current === undefined) {
      runs.set(record.runId, { runId: record.runId, capturedAt: record.capturedAt, spend });
    } else {
      current.spend += spend;
      if (record.capturedAt > current.capturedAt) current.capturedAt = record.capturedAt;
    }
  }
  const runIdentities = new Set<string>(selected.map((record) => record.runId));
  if (selection.phase === undefined) {
    for (const outcome of read.outcomes) runIdentities.add(outcome.runId);
  }
  const restartCount = Math.max(0, runIdentities.size - 1);

  const earliestTransition = ordered[0]?.timestamp;
  const basis = basisOf(measured);
  const reconciliation = reconciliationOf({ measured, baselines, observed, basis });
  const bounded = boundReport({
    tokensByClass: observed,
    perPhase: perPhaseOf(selected, attribute, totalTokens),
    perAgent: perAgentOf(selected),
    restarts: restartCount,
    amplification: amplificationOf([...runs.values()], earliestTransition),
    degradation: degradationOf(selected, outcomes),
    costTotals: costTotalsOf(selected),
    breakdowns: breakdownOf(selected),
    phaseTiming: phaseTimingOf(ordered, restarts),
    telemetryState: TELEMETRY_STATE_PRESENT,
    reconciliation: reconciliation.block,
  });
  const warnings: string[] = [];
  if (
    bounded.truncation.agents !== 0 ||
    bounded.truncation.breakdowns !== 0 ||
    bounded.truncation.phases !== 0 ||
    bounded.truncation.events !== 0
  ) {
    warnings.push(spendTruncationWarning(bounded.truncation));
  }
  if (reconciliation.excluded > 0) {
    warnings.push(
      `baseline-session-excluded: ${String(reconciliation.excluded)} session(s) without a harness-reported total`,
    );
  }
  const truncated =
    bounded.truncation.agents !== 0 ||
    bounded.truncation.breakdowns !== 0 ||
    bounded.truncation.phases !== 0 ||
    bounded.truncation.events !== 0;
  return {
    ok: true,
    data: bounded.report,
    warnings,
    ...(truncated ? { truncation: bounded.truncation } : {}),
  };
};

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
    telemetryState: folded.data.telemetryState,
    reconciliation: folded.data.reconciliation,
    byRole: folded.data.breakdowns.role,
    byModel: folded.data.breakdowns.model,
    phaseTiming: folded.data.phaseTiming,
  };
};
