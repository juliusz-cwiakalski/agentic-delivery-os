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
  DISPATCH_MAX_HUMAN_BYTES,
  DISPATCH_MAX_HUMAN_LINES,
  type DeliveryResultToken,
  type DispatchAttemptsData,
  type DispatchCorroborationRecord,
  type DispatchEnvelopeData,
  type DispatchResolveData,
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
