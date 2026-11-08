/**
 * The dispatch text renderers (GH-239 F-1, DEC-8).
 *
 * Text mode emits exactly `result=`, `pr_url=`, `exit_code=`, `last_message=`
 * in that order, with no fifth key and no `closeout_unverified=`. The exit digit
 * comes only from the delivered projection module.
 */
import {
  DELIVERY_RESULT_TAXONOMY,
  type DeliveryResultToken,
  type DispatchEnvelopeData,
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
  [
    `result=${data.result}`,
    `pr_url=${data.prUrl}`,
    `exit_code=${exitFor(data.result)}`,
    `last_message=${singleLine(data.lastMessage)}`,
  ].join("\n") + "\n";

/** The multi-line summary text; bounded and deterministic. */
export const renderDispatchSummaryText = (data: DispatchSummaryData): string => {
  const lines = [
    `repository=${data.repository}`,
    `window_start=${data.windowStart}`,
    `window_start_reason=${data.windowStartReason}`,
    `counted_deliveries=${data.countedDeliveries}`,
    `counted_evidence_class=${data.countedEvidenceClass}`,
    `excluded_evidence_classes=${data.excludedEvidenceClasses
      .map((entry) => `${entry.evidenceClass}:${entry.count}`)
      .join(",") || "none"}`,
    `days=${data.dayCount}`,
    `incidents=${data.incidents}`,
    `divergences=${data.divergences.reported}/${data.divergences.resolved}/${data.divergences.unresolved}`,
    `unresolved_divergences=${data.divergences.unresolvedIds.join(",") || "none"}`,
    `coverage_present=${data.coverage.present.join(",") || "none"}`,
    `coverage_missing=${data.coverage.missing.join(",") || "none"}`,
    `corroboration=${data.corroboration.satisfied}/${data.corroboration.unsatisfied}`,
    `floor=${data.floor.met ? "met" : "unmet"}`,
    `floor_only=true`,
    `eligibility=${data.eligibility ? "true" : "false"}`,
    `verdict=${data.verdict}`,
    `unmet_conditions=${data.unmetConditions.map((entry) => entry.condition).join(",") || "none"}`,
    ...(data.truncation === undefined
      ? []
      : [
          `truncation=bound:${data.truncation.bound},omitted:${data.truncation.omittedRecords}`,
        ]),
  ];
  return `${lines.join("\n")}\n`;
};

/** The handover/reversal text. */
export const renderDispatchHandoverText = (data: {
  readonly repository: string;
  readonly operation: "authoritative" | "dual-run";
  readonly recorded: boolean;
  readonly noop: boolean;
}): string =>
  [
    `repository=${data.repository}`,
    `operation=${data.operation}`,
    `recorded=${data.recorded ? "true" : "false"}`,
    `noop=${data.noop ? "true" : "false"}`,
  ].join("\n") + "\n";
