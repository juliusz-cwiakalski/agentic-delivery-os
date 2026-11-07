/**
 * Deterministic human renderers for the merge and dry-run surfaces (GH-225
 * F-8, DEC-4, NFR-1, NFR-4).
 *
 * Success keeps the delivered `result=` / `squash=` continuity shape. The
 * summary is bounded to 24 lines and 4 096 UTF-8 bytes; decisive lines come
 * first and every omitted gate is marked.
 */
import {
  type BrandIdentity,
  MERGE_MAX_EVIDENCE_NAME_CHARS,
  MERGE_MAX_HUMAN_BYTES,
  MERGE_MAX_HUMAN_LINES,
  type MergeDryRunReport,
  type MergeGateVerdictRecord,
  type MergeReport,
} from "@delivery-os/core/contracts";

const clamp = (value: string, maximum: number): string =>
  value.length > maximum ? value.slice(0, maximum) : value;

const shortSha = (value: string): string => (value.length === 0 ? "-" : value.slice(0, 7));

const list = (values: readonly string[]): string =>
  values.length === 0
    ? "-"
    : values.map((value) => clamp(value, MERGE_MAX_EVIDENCE_NAME_CHARS)).join(",");

const postLandingText = (report: MergeReport): string =>
  report.postLanding.length === 0
    ? "-"
    : report.postLanding.map((step) => `${step.id}:${step.status}`).join(",");

const gateLines = (gates: readonly MergeGateVerdictRecord[]): string[] =>
  gates.map(
    (gate) =>
      `gate ${clamp(gate.id, MERGE_MAX_EVIDENCE_NAME_CHARS)} ${gate.verdict} reason=${gate.reason}`,
  );

const bound = (lines: readonly string[]): string => {
  const kept = lines.slice(0, MERGE_MAX_HUMAN_LINES);
  let text = kept.join("\n");
  if (text.length > MERGE_MAX_HUMAN_BYTES) text = text.slice(0, MERGE_MAX_HUMAN_BYTES);
  return `${text}\n`;
};

/** Render one merged transaction summary. */
export const renderMergeHuman = (report: MergeReport, brand: BrandIdentity): string => {
  const passed = report.gates.filter((gate) => gate.verdict === "pass").length;
  const lines = [
    `${brand.binaryName} merge ${report.changeRef}  merged`,
    "result=merged",
    `change=${report.changeRef}`,
    `squash=${shortSha(report.squashSha)}`,
    `landing=sha-on-base:${report.landing.shaOnBase ? "yes" : "no"} request-state=${report.landing.requestState}`,
    `refresh=attempts=${report.refresh.attempts} outcome=${report.refresh.outcome}`,
    `waivers=${list(report.waiverRefs)}`,
    `post-landing=${postLandingText(report)}`,
    `gates=${passed}/${report.gates.length + report.gatesOmitted} passed`,
    ...(report.gatesOmitted > 0 ? [`gates-omitted=+${report.gatesOmitted}`] : []),
    ...gateLines(report.gates),
  ];
  return bound(lines);
};

/** Render one dry-run verification summary (never merged and never squash). */
export const renderDryRunHuman = (report: MergeDryRunReport, brand: BrandIdentity): string => {
  const passed = report.gates.filter((gate) => gate.verdict === "pass").length;
  const lines = [
    `${brand.binaryName} merge ${report.changeRef}  verified (dry-run)`,
    "result=verified",
    `change=${report.changeRef}`,
    `head=${shortSha(report.headSha)}`,
    `gates=${passed}/${report.gates.length + report.gatesOmitted} passed`,
    ...(report.gatesOmitted > 0 ? [`gates-omitted=+${report.gatesOmitted}`] : []),
    ...report.authorizations.map(
      (authorization) =>
        `waiver=${authorization.gateId}:${authorization.authorized ? "authorized" : "unauthorized"}`,
    ),
    ...gateLines(report.gates),
  ];
  return bound(lines);
};
