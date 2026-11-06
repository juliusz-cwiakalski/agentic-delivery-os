/**
 * Deterministic human renderer for `verify deploy` (GH-225 F-6, NFR-3/NFR-4).
 *
 * `verdict=verified` is the continuity key. The summary is bounded to 24 lines
 * and 4 096 bytes; step and artifact lists carry explicit `+N` marks.
 */
import {
  type BrandIdentity,
  DEPLOY_MAX_HUMAN_BYTES,
  DEPLOY_MAX_HUMAN_LINES,
  DEPLOY_MAX_NAME_CHARS,
  type DeployReport,
} from "@delivery-os/core/contracts";

const clamp = (value: string, maximum: number): string =>
  value.length > maximum ? value.slice(0, maximum) : value;

const bound = (lines: readonly string[]): string => {
  const kept = lines.slice(0, DEPLOY_MAX_HUMAN_LINES);
  let text = kept.join("\n");
  if (text.length > DEPLOY_MAX_HUMAN_BYTES) text = text.slice(0, DEPLOY_MAX_HUMAN_BYTES);
  return `${text}\n`;
};

/** Render one verified deploy summary. */
export const renderDeployHuman = (report: DeployReport, brand: BrandIdentity): string => {
  const head = report.headSha === undefined ? "-" : report.headSha.slice(0, 7);
  const shownSteps = report.steps.slice(0, 12);
  const shownArtifacts = report.artifacts.slice(0, 6);
  const stepOmitted = report.stepsOmitted + (report.steps.length - shownSteps.length);
  const artifactOmitted =
    report.artifactsOmitted + (report.artifacts.length - shownArtifacts.length);
  const lines = [
    `${brand.binaryName} verify deploy ${report.changeRef}  verified`,
    "verdict=verified",
    `change=${report.changeRef}`,
    `job=${clamp(report.jobId, DEPLOY_MAX_NAME_CHARS)} pipeline=${clamp(report.pipelineName, DEPLOY_MAX_NAME_CHARS)} head=${head}`,
    `expectation=${report.expectation.source} steps=${report.expectation.steps.length} artifacts=${report.expectation.artifacts.length}`,
    `steps=${report.steps.length}${stepOmitted > 0 ? ` +${stepOmitted}` : ""}`,
    ...shownSteps.map((step) => `step ${clamp(step.name, DEPLOY_MAX_NAME_CHARS)} ${step.status}`),
    `artifacts=${report.artifacts.length}${artifactOmitted > 0 ? ` +${artifactOmitted}` : ""}`,
    ...shownArtifacts.map((artifact) => `artifact ${clamp(artifact.name, DEPLOY_MAX_NAME_CHARS)}`),
  ];
  return bound(lines);
};
