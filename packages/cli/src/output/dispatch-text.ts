/**
 * The dispatch text renderers (GH-239 F-1, DEC-8).
 *
 * Text mode emits exactly `result=`, `pr_url=`, `exit_code=`, `last_message=`
 * in that order, with no fifth key and no `closeout_unverified=`. The exit digit
 * comes only from the delivered projection module.
 */
import {
  ATTEMPTS_HUMAN_ROW_BUDGET,
  DELIVERY_RESULT_TAXONOMY,
  type DeliveryResultToken,
  DISPATCH_LOG_MAX_HUMAN_BYTES,
  DISPATCH_LOG_MAX_HUMAN_LINES,
  DISPATCH_MAX_HUMAN_BYTES,
  DISPATCH_MAX_HUMAN_LINES,
  type DispatchAttemptsData,
  type DispatchCorroborationRecord,
  type DispatchDeliveringData,
  type DispatchEnvelopeData,
  type DispatchLastMessageData,
  type DispatchLogData,
  type DispatchResolveData,
  type DispatchStatusData,
  type DispatchSummaryData,
} from "@delivery-os/core/contracts";
import { projectExitCode } from "../projection.js";

/** A local short alias: keeps the parameter type recognizable. */
type DispatchToken = DeliveryResultToken;

const exitFor = (value: DispatchToken): number => {
  const row = DELIVERY_RESULT_TAXONOMY.find((entry) => entry.token === value);
  if (row === undefined) throw new Error("delivery-result token is not in the taxonomy");
  return projectExitCode(row.projectionClass);
};

const singleLine = (value: string): string => value.replace(/[\r\n]+/gu, " ").trim();

/** Exactly the four bash-continuity keys, in bash order. */
export const renderDispatchText = (data: DispatchEnvelopeData): string =>
  `${[
    `result=${data.result}`,
    `pr_url=${data.prUrl}`,
    `exit_code=${exitFor(data.result)}`,
    `last_message=${singleLine(data.lastMessage)}`,
  ].join("\n")}\n`;

/**
 * The bounded verbose human diagnostic (DM-4, F-5): the four delivered keys
 * plus prose naming the underlying harness failure identity. The diagnostic is
 * not a `key=value` line, so the four-key text contract stays intact.
 */
export const renderDispatchVerboseText = (data: DispatchEnvelopeData): string => {
  const detail = data.error?.detail;
  const lines = renderDispatchText(data).trimEnd().split("\n");
  if (detail !== undefined) {
    const field = detail.field === undefined ? "" : ` at ${singleLine(detail.field)}`;
    lines.push(`detail: ${singleLine(detail.kind)} failure ${singleLine(detail.code)}${field}`);
  }
  return `${lines.join("\n")}\n`;
};

/** The multi-line summary text; bounded and deterministic. */
export const renderDispatchSummaryText = (data: DispatchSummaryData): string => {
  const lines = [
    `repository=${data.repository}`,
    `window_start=${data.windowStart}`,
    `window_start_reason=${data.windowStartReason}`,
    `counted_deliveries=${data.countedDeliveries}`,
    `counted_evidence_class=${data.countedEvidenceClass}`,
    `excluded_evidence_classes=${
      data.excludedEvidenceClasses
        .map((entry) => `${entry.evidenceClass}:${entry.count}`)
        .join(",") || "none"
    }`,
    `days=${data.dayCount}`,
    `incidents=${data.incidents}`,
    `divergences=${data.divergences.reported}/${data.divergences.resolved}/${data.divergences.unresolved}`,
    `unresolved_divergences=${data.divergences.unresolvedIds.join(",") || "none"}`,
    `coverage_present=${data.coverage.present.join(",") || "none"}`,
    `coverage_missing=${data.coverage.missing.join(",") || "none"}`,
    `corroboration=${data.corroboration.satisfied}/${data.corroboration.unsatisfied}`,
    `floor=${data.floor.met ? "met" : "unmet"}`,
    `floor_only=true`,
    `floor_rule=floor-only; never substitutes for coverage, incident truth, or corroboration`,
    `eligibility=${data.eligibility ? "true" : "false"}`,
    `verdict=${data.verdict}`,
    `unmet_conditions=${data.unmetConditions.map((entry) => entry.condition).join(",") || "none"}`,
    `clean_dispatches=${data.cleanDispatches}`,
    `consecutive_clean_dispatches=${data.consecutiveCleanDispatches}`,
    `conditions=${data.conditions.map((entry) => `${entry.condition}:${entry.status}`).join(",")}`,
    ...(data.truncation === undefined
      ? []
      : [`truncation=bound:${data.truncation.bound},omitted:${data.truncation.omittedRecords}`]),
  ];
  return `${lines.join("\n")}\n`;
};

/** The closed three-value corroboration derivation (GH-289 F-6). */
const corroborationCell = (corroboration: DispatchCorroborationRecord): string => {
  const states = [corroboration.pmNotes, corroboration.tracker, corroboration.ci];
  if (states.includes("unsatisfied")) return "uncorroborated";
  if (states.every((state) => state === "not-applicable")) return "vacuous";
  return "corroborated";
};

/** The UTF-8 byte length of a rendered digest, without any runtime buffer. */
const utf8Bytes = (text: string): number => {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

/** The section budgets the digest is bounded to (the delivered dispatch set). */
const DIGEST_LINE_BUDGET = DISPATCH_MAX_HUMAN_LINES;
const DIGEST_BYTE_BUDGET = DISPATCH_MAX_HUMAN_BYTES;

/**
 * The bounded deterministic attempts digest (GH-289 F-6, AC-F6-1..AC-F6-4):
 * one summary line, one row per attempt newest first, an optional human
 * truncation line with at most 37 rows beside it, and the coverage/floor
 * pointer. Rows are dropped from the oldest end; `has_more` is untouched.
 */
export const renderDispatchAttemptsText = (data: DispatchAttemptsData): string => {
  const summary = `attempts=${data.attempts.length}; repository=${data.repository}; ref=${data.ref}; has_more=${data.hasMore ? "true" : "false"}`;
  const rows = data.attempts.map(
    (row) =>
      `${row.startedAt} ${row.ref} ${row.token} ${corroborationCell(row.corroboration)} ${row.divergenceRef ?? "none"} ${row.harness} ${row.evidenceClass}`,
  );
  const pointer = `next: dispatch dual-run summary --repo ${data.repository} (coverage and floor)`;
  const render = (kept: number): string => {
    const dropped = rows.length - kept;
    const body = rows.slice(0, kept);
    const lines = [
      summary,
      ...body,
      ...(dropped === 0 ? [] : [`truncation=human:bound:${body.length},omitted:${dropped}`]),
      pointer,
    ];
    return `${lines.join("\n")}\n`;
  };
  let kept = Math.min(rows.length, ATTEMPTS_HUMAN_ROW_BUDGET + 1);
  while (kept > 0) {
    const text = render(kept);
    const lineCount = text.trimEnd().split("\n").length;
    if (lineCount <= DIGEST_LINE_BUDGET && utf8Bytes(text) <= DIGEST_BYTE_BUDGET) {
      return text;
    }
    kept -= 1;
  }
  return render(0);
};

/** The one deterministic resolve line (GH-289 F-6, AC-F6-5). */
export const renderDispatchResolveText = (data: DispatchResolveData): string =>
  `divergence=${data.divergenceId}; state=${data.state}; appended=${data.resolved ? "true" : "false"}; unresolved=${data.divergences.unresolved}; mode=local-evidence; repository=${data.repository}\n`;

/** The handover/reversal text. */
export const renderDispatchHandoverText = (data: {
  readonly repository: string;
  readonly operation: "authoritative" | "dual-run";
  readonly recorded: boolean;
  readonly noop: boolean;
}): string =>
  `${[
    `repository=${data.repository}`,
    `operation=${data.operation}`,
    `recorded=${data.recorded ? "true" : "false"}`,
    `noop=${data.noop ? "true" : "false"}`,
  ].join("\n")}\n`;

/** `status` as the declared key=value set plus its lane facts (DM-5). */
export const renderDispatchStatusText = (data: DispatchStatusData): string => {
  const lane = data.lane;
  const lines = [
    `query=${data.query}`,
    `ref=${data.ref}`,
    `repository=${data.repository}`,
    `delivering=${data.delivering ? "true" : "false"}`,
    `stale=${data.stale ? "true" : "false"}`,
    `marker=${data.marker}`,
    `probe=${data.probe}`,
    `pid=${data.pid === null ? "none" : String(data.pid)}`,
    `sessionId=${data.sessionId ?? "none"}`,
    ...(lane === null
      ? []
      : [
          `attemptId=${lane.attemptId}`,
          `harness=${lane.harness}`,
          `iterationOrdinal=${lane.iterationOrdinal}`,
          `restartsConsumed=${lane.restartsConsumed}`,
          `ownerStartedAt=${lane.ownerStartedAt}`,
          `lastToken=${lane.lastToken ?? "none"}`,
          `lastOutcome=${lane.lastOutcome ?? "none"}`,
          `recordedAt=${lane.recordedAt}`,
        ]),
    // The lane's worktree path (GH-404 F-7, TC-SURFACES-001): rendered only
    // when the record carries the context; a context-less lane renders
    // exactly as today (DEC-8, the byte-for-byte exception-mode basis).
    ...(data.worktreePath === undefined ? [] : [`worktreePath=${data.worktreePath}`]),
  ];
  return `${lines.join("\n")}\n`;
};

/** `is-delivering` as the declared key=value set. */
export const renderDispatchDeliveringText = (data: DispatchDeliveringData): string => {
  const lines = [
    `query=${data.query}`,
    `delivering=${data.delivering ? "true" : "false"}`,
    `repository=${data.repository}`,
    `ref=${data.ref ?? "none"}`,
    ...(data.refs === undefined ? [] : [`refs=${data.refs.join(",") || "none"}`]),
    ...(data.truncation === undefined
      ? []
      : [`truncation=bound:${data.truncation.bound},omitted:${data.truncation.omitted}`]),
  ];
  return `${lines.join("\n")}\n`;
};

/**
 * `last-message` as the declared key set: `available`, `final`, `reason` when
 * present, and `last_message` (§8.5, DEC-8).
 */
export const renderDispatchLastMessageText = (data: DispatchLastMessageData): string =>
  `${[
    `available=${data.available ? "true" : "false"}`,
    `final=${data.final ? "true" : "false"}`,
    ...(data.reason === undefined ? [] : [`reason=${data.reason}`]),
    `last_message=${data.message ?? ""}`,
  ].join("\n")}\n`;

/**
 * `log` as the RAW tail plus at most one `truncation=` line (DEC-8, §8.5).
 *
 * The machine payload is byte-bounded only, so the declared HUMAN bounds are
 * applied here: the 200-line bound first, then the 32 768-byte bound, so the
 * scope names the bound that actually bound. A binding line bound is a
 * `tail`-scope fact naming the human 200-line bound; a binding byte bound is a
 * `bytes`-scope fact. `omitted` is the total dropped: the runtime's own
 * omission plus the human-bound drops.
 */
export const renderDispatchLogText = (data: DispatchLogData): string => {
  if (!data.available) return `reason=${data.reason ?? "no-log"}\n`;
  const machineLines = [...data.lines];
  const kept =
    machineLines.length > DISPATCH_LOG_MAX_HUMAN_LINES
      ? machineLines.slice(machineLines.length - DISPATCH_LOG_MAX_HUMAN_LINES)
      : machineLines;
  const droppedByLineBound = machineLines.length - kept.length;
  const lines = [...kept];
  let omitted = data.truncation?.omittedLines ?? 0;
  const humanBytes = (candidate: readonly string[]): number =>
    candidate.reduce((total, line) => total + utf8Bytes(line) + 1, 0);
  let droppedByHuman = 0;
  while (lines.length > 0 && humanBytes(lines) > DISPATCH_LOG_MAX_HUMAN_BYTES) {
    lines.shift();
    droppedByHuman += 1;
  }
  omitted += droppedByLineBound + droppedByHuman;
  const fact =
    droppedByHuman > 0
      ? `truncation=scope:bytes,bound:${DISPATCH_LOG_MAX_HUMAN_BYTES},omitted:${omitted}`
      : droppedByLineBound > 0
        ? `truncation=scope:tail,bound:${DISPATCH_LOG_MAX_HUMAN_LINES},omitted:${omitted}`
        : data.truncation === undefined
          ? undefined
          : `truncation=scope:${data.truncation.scope},bound:${data.truncation.bound},omitted:${data.truncation.omittedLines}`;
  return `${[...lines, ...(fact === undefined ? [] : [fact])].join("\n")}${lines.length === 0 && fact === undefined ? "" : "\n"}`;
};
