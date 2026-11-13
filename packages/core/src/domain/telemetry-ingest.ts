/**
 * The pure per-step stream counting contract (GH-291 F-1, AC-F1-1, DM-1, NFR-5).
 *
 * One decoded opencode v2.x.y frame becomes at most one step record. The five
 * token classes, the call count, and the per-model cost are counted in the
 * units the harness reports: nothing is converted, re-priced, rounded, or
 * estimated (NG-4). A frame that omits a class or field degrades with a
 * closed-vocabulary warning and the missing value stays absent from every sum
 * — never zero-filled. Frame drift is disclosed and counted; an undecodable
 * frame is a counted failure. Ingest accounting is a value, so an ingest
 * failure can never change a delivery's outcome.
 *
 * Pure: no I/O, clock, randomness, or ambient global. Work per frame is
 * constant and memory is bounded by the one record returned.
 */
import {
  HARNESS_TOKEN_CLASSES,
  type HarnessKind,
  TELEMETRY_FRAME_CALLS_FIELD,
  TELEMETRY_FRAME_COST_FIELD,
  TELEMETRY_FRAME_TOKENS_FIELD,
  TELEMETRY_STEP_FINISH_PART_TYPE,
  TELEMETRY_STEP_FRAME_TYPE,
  TELEMETRY_STEP_SCHEMA_ID,
  TELEMETRY_STORAGE_SCHEMA_VERSION,
  TELEMETRY_WARNING_REASONS,
  type TelemetryIngestCounts,
  type TelemetryStepRecord,
  type TelemetryStepTokens,
  type TelemetryWarning,
  type TelemetryWarningReason,
} from "#contracts";
import {
  attributeStep,
  type TelemetryAttribution,
  type TelemetryClaimedIdentity,
} from "./telemetry-attribution.js";

/** The frame types the delivered opencode stream carries that are not steps. */
export const TELEMETRY_IGNORED_FRAME_TYPES = [
  "step_start",
  "text",
  "tool_use",
  "tool_result",
  "file",
  "reasoning",
  "message",
  "session",
  "error",
] as const;

/** The known `step_finish` part fields; anything else is disclosed as drift. */
const KNOWN_PART_FIELDS = [
  "type",
  "id",
  "messageID",
  "reason",
  "tokens",
  "cost",
  "calls",
  "time",
  "model",
  "snapshot",
] as const;

/** The context one decoded frame is attributed with (composition-supplied). */
export type TelemetryFrameContext = {
  readonly workItemRef: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly harnessKind: HarnessKind;
  readonly harnessVersion: string | null;
  readonly treeRoot: string | null;
  readonly repository: string | null;
  readonly model: string | null;
  readonly claimed: TelemetryClaimedIdentity;
  readonly capturedAt: string;
};

/** One decoded frame: a captured step, an ignored frame, drift, or a failure. */
export type TelemetryFrameOutcome =
  | {
      readonly kind: "captured";
      readonly record: TelemetryStepRecord;
      readonly attribution: TelemetryAttribution;
      readonly degraded: boolean;
    }
  | { readonly kind: "ignored" }
  | { readonly kind: "drift"; readonly warning: TelemetryWarning }
  | { readonly kind: "failed" };

/** The accounting every ingest run discloses (§10): counts plus per-reason counts. */
export type TelemetryIngestTally = {
  readonly counts: TelemetryIngestCounts;
  readonly byReason: Readonly<Record<TelemetryWarningReason, number>>;
};

/** The zero tally: nothing captured, nothing degraded, nothing failed. */
export const emptyIngestTally = (): TelemetryIngestTally => ({
  counts: { captured: 0, degraded: 0, failed: 0 },
  byReason: Object.fromEntries(TELEMETRY_WARNING_REASONS.map((reason) => [reason, 0])) as Record<
    TelemetryWarningReason,
    number
  >,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTokenClass = (value: string): boolean =>
  (HARNESS_TOKEN_CLASSES as readonly string[]).includes(value);

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/**
 * Decode the five token classes.
 *
 * A present class counts exactly as reported, including a reported zero. An
 * absent class is `null` with `optional-field-absent`; a non-numeric class is
 * `null` with `non-numeric-value`; an unknown class name beside the known
 * shape is `version-drift`. No branch produces a fabricated figure.
 */
const decodeTokens = (raw: unknown, warnings: TelemetryWarning[]): TelemetryStepTokens => {
  const tokens: Record<string, number | null> = {};
  const source = isRecord(raw) ? raw : undefined;
  if (source !== undefined) {
    for (const key of Object.keys(source)) {
      if (!isTokenClass(key)) {
        warnings.push({ reason: "version-drift", field: `${TELEMETRY_FRAME_TOKENS_FIELD}.${key}` });
      }
    }
  }
  for (const tokenClass of HARNESS_TOKEN_CLASSES) {
    if (source === undefined || !Object.hasOwn(source, tokenClass)) {
      warnings.push({
        reason: "optional-field-absent",
        field: `${TELEMETRY_FRAME_TOKENS_FIELD}.${tokenClass}`,
      });
      tokens[tokenClass] = null;
      continue;
    }
    const value = source[tokenClass];
    if (!isCount(value)) {
      warnings.push({
        reason: "non-numeric-value",
        field: `${TELEMETRY_FRAME_TOKENS_FIELD}.${tokenClass}`,
      });
      tokens[tokenClass] = null;
      continue;
    }
    tokens[tokenClass] = value;
  }
  return tokens as TelemetryStepTokens;
};

/** Decode the optional explicit call count: absent or invalid excludes it. */
const decodeCalls = (
  part: Record<string, unknown>,
  warnings: TelemetryWarning[],
): number | null => {
  if (!Object.hasOwn(part, TELEMETRY_FRAME_CALLS_FIELD)) {
    warnings.push({ reason: "optional-field-absent", field: TELEMETRY_FRAME_CALLS_FIELD });
    return null;
  }
  const value = part[TELEMETRY_FRAME_CALLS_FIELD];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    warnings.push({ reason: "non-numeric-value", field: TELEMETRY_FRAME_CALLS_FIELD });
    return null;
  }
  return value;
};

/** Decode the optional cost in harness-reported units: absent or invalid is null. */
const decodeCost = (part: Record<string, unknown>, warnings: TelemetryWarning[]): number | null => {
  if (!Object.hasOwn(part, TELEMETRY_FRAME_COST_FIELD)) {
    warnings.push({ reason: "cost-missing", field: TELEMETRY_FRAME_COST_FIELD });
    return null;
  }
  const value = part[TELEMETRY_FRAME_COST_FIELD];
  if (!isCount(value)) {
    warnings.push({ reason: "non-numeric-value", field: TELEMETRY_FRAME_COST_FIELD });
    return null;
  }
  return value;
};

const stringOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

/** The frame's own instant as an ISO stamp; an absent stamp stays null. */
const stampOf = (value: unknown): string | null =>
  typeof value === "number" && Number.isFinite(value)
    ? new Date(value).toISOString()
    : stringOrNull(value);

/** The step timing the frame reports: explicit `part.time` first, then the stamp. */
const timingOf = (
  part: Record<string, unknown>,
  frame: Record<string, unknown>,
): { readonly startedAt: string | null; readonly finishedAt: string | null } => {
  const time = isRecord(part.time) ? part.time : undefined;
  const finishedAt = stampOf(time?.end) ?? stampOf(frame.timestamp);
  return { startedAt: stampOf(time?.start), finishedAt };
};

/**
 * Decode one stream frame into its telemetry outcome.
 *
 * A non-step frame the delivered stream carries is `ignored`. An unknown frame
 * type or a `step_finish` without the completion part is drift, disclosed with
 * the closed `version-drift` reason and counted — never silently dropped. A
 * non-object frame is a counted failure.
 */
export const decodeTelemetryStepFrame = (
  frame: unknown,
  context: TelemetryFrameContext,
): TelemetryFrameOutcome => {
  if (!isRecord(frame)) return { kind: "failed" };
  const type = frame.type;
  if (typeof type !== "string" || type.length === 0) {
    return { kind: "drift", warning: { reason: "version-drift", field: "frame.type" } };
  }
  if (type !== TELEMETRY_STEP_FRAME_TYPE) {
    return (TELEMETRY_IGNORED_FRAME_TYPES as readonly string[]).includes(type)
      ? { kind: "ignored" }
      : { kind: "drift", warning: { reason: "version-drift", field: `frame.type(${type})` } };
  }
  if (!isRecord(frame.part) || frame.part.type !== TELEMETRY_STEP_FINISH_PART_TYPE) {
    return { kind: "drift", warning: { reason: "version-drift", field: "part.type" } };
  }
  const part = frame.part;
  const warnings: TelemetryWarning[] = [];
  for (const key of Object.keys(part)) {
    if (!(KNOWN_PART_FIELDS as readonly string[]).includes(key)) {
      warnings.push({ reason: "version-drift", field: `part.${key}` });
    }
  }
  const tokens = decodeTokens(part[TELEMETRY_FRAME_TOKENS_FIELD], warnings);
  const calls = decodeCalls(part, warnings);
  const cost = decodeCost(part, warnings);
  const { startedAt, finishedAt } = timingOf(part, frame);
  const model = stringOrNull(part.model) ?? context.model;
  const attribution = attributeStep({
    workItemRef: context.workItemRef,
    runId: context.runId,
    sessionId: context.sessionId,
    repository: context.repository,
    model,
    claimed: context.claimed,
  });
  const record: TelemetryStepRecord = {
    schemaId: TELEMETRY_STEP_SCHEMA_ID,
    storageVersion: TELEMETRY_STORAGE_SCHEMA_VERSION,
    workItemRef: context.workItemRef,
    runId: context.runId,
    sessionId: context.sessionId,
    harnessKind: context.harnessKind,
    harnessVersion: context.harnessVersion,
    treeRoot: context.treeRoot,
    model: attribution.model,
    ticket: attribution.ticket,
    repository: attribution.repository,
    lane: attribution.lane,
    agentRole: attribution.agentRole,
    tokens,
    calls,
    cost,
    startedAt,
    finishedAt,
    warnings: [...attribution.warnings, ...warnings],
    capturedAt: context.capturedAt,
  };
  return {
    kind: "captured",
    record,
    attribution,
    degraded: record.warnings.length > 0,
  };
};

/** Fold one decoded outcome into the running tally (pure). */
export const tallyFrame = (
  tally: TelemetryIngestTally,
  outcome: TelemetryFrameOutcome,
): TelemetryIngestTally => {
  if (outcome.kind === "ignored") return tally;
  const byReason = { ...tally.byReason };
  if (outcome.kind === "captured") {
    for (const warning of outcome.record.warnings) byReason[warning.reason] += 1;
    const degraded = outcome.degraded ? 1 : 0;
    return {
      counts: {
        captured: tally.counts.captured + 1,
        degraded: tally.counts.degraded + degraded,
        failed: tally.counts.failed,
      },
      byReason,
    };
  }
  if (outcome.kind === "drift") {
    byReason[outcome.warning.reason] += 1;
    return {
      counts: {
        captured: tally.counts.captured,
        degraded: tally.counts.degraded + 1,
        failed: tally.counts.failed,
      },
      byReason,
    };
  }
  return {
    counts: {
      captured: tally.counts.captured,
      degraded: tally.counts.degraded,
      failed: tally.counts.failed + 1,
    },
    byReason,
  };
};

/**
 * The session-close totals read (OQ-T2 §1).
 *
 * The adapter supplies this read-only per-session aggregate over the delivered
 * harness store. An unavailable read answers `undefined`: the baseline record
 * then lands nothing and no figure is fabricated.
 */
export type TelemetrySessionTotals = {
  readonly tokens: TelemetryStepTokens;
  readonly calls: number | null;
  readonly cost: number | null;
};

export type TelemetrySessionTotalsReader = (
  sessionId: string,
) => TelemetrySessionTotals | undefined;
