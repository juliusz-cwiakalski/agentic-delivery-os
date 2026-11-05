/**
 * Text-mode plan renderers (GH-226 F-8, F-9, F-10).
 *
 * Pure formatting only: no stream writes and no redaction. The machine payload
 * stays authoritative; text may summarize a list.
 */
import type { PlanDiffData, PlanOverlapData, PlanValidateData } from "@delivery-os/core/contracts";

const phaseSuffix = (phase: number | undefined): string =>
  phase === undefined ? "" : ` phase=${phase}`;

/** Text summary for `plan validate`; the machine payload stays authoritative. */
export const serializePlanValidateText = (data: PlanValidateData): string => {
  const lines = [`verdict=${data.verdict}`];
  if (data.artifact !== undefined)
    lines.push(`artifact=${data.artifact.kind}:${data.artifact.path}`);
  if (data.tier !== undefined) lines.push(`tier=${data.tier}`);
  lines.push(`readyForDevelopment=${String(data.readyForDevelopment)}`);
  for (const error of data.errors) {
    lines.push(`error=${error.code} field=${error.field}${phaseSuffix(error.phase)}`);
  }
  if (data.truncated) lines.push(`truncated=true totalErrors=${data.totalErrors}`);
  return `${lines.join("\n")}\n`;
};

/** Text summary for `plan overlap`; every shared path is printed. */
export const serializePlanOverlapText = (data: PlanOverlapData): string => {
  const lines = [`verdict=${data.verdict}`];
  for (const path of data.overlappingPaths) lines.push(`overlapping=${path}`);
  if (data.reason !== undefined) lines.push(`reason=${data.reason}`);
  if (data.ordering !== undefined) lines.push(`ordering=${data.ordering}`);
  if (data.truncated) {
    lines.push(`truncated=true totalOverlappingPaths=${data.totalOverlappingPaths}`);
  }
  return `${lines.join("\n")}\n`;
};

/** Text summary for `plan diff`; one line per path. */
export const serializePlanDiffText = (data: PlanDiffData): string => {
  const lines = [`verdict=${data.verdict}`, `against=${data.against}`];
  for (const entry of data.entries) {
    lines.push(`${entry.classification} ${entry.path}${phaseSuffix(entry.phase)}`);
  }
  if (data.truncated) lines.push(`truncated=true totalEntries=${data.totalEntries}`);
  return `${lines.join("\n")}\n`;
};
