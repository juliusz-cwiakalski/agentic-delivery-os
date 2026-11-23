/**
 * Deterministic human renderers for the merge and dry-run surfaces (GH-225
 * F-8, DEC-4, NFR-1, NFR-4).
 *
 * Success keeps the delivered `result=` / `squash=` continuity shape. The
 * summary is bounded to 24 lines and 4 096 UTF-8 bytes; decisive lines come
 * first and every omitted gate is marked.
 */

import { type MergeFailure, renderMergeFailure } from "@delivery-os/core";
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

/**
 * The rendered containment token (DM-3, AC-F1-2).
 *
 * `true` is a local read that answered positively, `false` one that answered
 * negatively, and `unknown` a read that could not answer at all — the state a
 * provider landing produces when its merge commit is not in the checkout.
 */
const shaOnBaseToken = (value: MergeReport["landing"]["shaOnBase"]): string =>
  value === true ? "yes" : value === false ? "no" : "unknown";

/**
 * The resolved object's human line (DM-2, GH-366 F-5): which branch, which
 * resolution source, which request identity, how many candidates were observed,
 * and which head the verdict describes — or, for a converged replay, the
 * replay's own identity with no resolution source.
 */
const resolutionLine = (resolution: MergeDryRunReport["resolution"]): string =>
  resolution === undefined
    ? ""
    : `resolution=${resolution.source} branch=${clamp(resolution.branch, MERGE_MAX_EVIDENCE_NAME_CHARS)} request=${clamp(resolution.requestIdentity, MERGE_MAX_EVIDENCE_NAME_CHARS)} candidates=${String(resolution.candidateCount)} head=${shortSha(resolution.headSha)}`;

/**
 * Render one merge refusal with its three dedicated fields (DEC-11, AC-F3-1).
 *
 * The summary is the human AND the scripted refusal text: the condition line,
 * then `command=merge`, `ref=<ref>` carrying the invocation's ref, and
 * `operation=<token>` validated against the closed vocabulary at this rendering
 * site — an out-of-vocabulary token fails the rendering by name instead of
 * being passed through. Delegation keeps the evidence and remediation lines in
 * the one declared renderer.
 */
export const renderMergeRefusal = (failure: MergeFailure, ref: string): string =>
  renderMergeFailure(failure, { command: "merge", ref });

/** Render one merged transaction summary. */
export const renderMergeHuman = (report: MergeReport, brand: BrandIdentity): string => {
  const passed = report.gates.filter((gate) => gate.verdict === "pass").length;
  const lines = [
    `${brand.binaryName} merge ${report.changeRef}  merged`,
    "result=merged",
    `change=${report.changeRef}`,
    `squash=${shortSha(report.squashSha)}`,
    `landing=sha-on-base:${shaOnBaseToken(report.landing.shaOnBase)} request-state=${report.landing.requestState}`,
    `refresh=attempts=${report.refresh.attempts} outcome=${report.refresh.outcome}`,
    `waivers=${list(report.waiverRefs)}`,
    `post-landing=${postLandingText(report)}`,
    ...(report.resolution === undefined ? [] : [resolutionLine(report.resolution)]),
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
    ...(report.replayed === true
      ? [
          `replayed=true request=${clamp(report.requestIdentity ?? "-", MERGE_MAX_EVIDENCE_NAME_CHARS)}`,
        ]
      : report.resolution === undefined
        ? []
        : [resolutionLine(report.resolution)]),
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
