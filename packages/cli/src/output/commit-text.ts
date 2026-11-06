/**
 * Deterministic human rendering for the `commit` surface (GH-227 NFR-4).
 *
 * Same data yields the same bytes: paths are already normalized and sorted by
 * the act; nothing here reads a clock, environment, or locale.
 */
import type { CommitEnvelopeData } from "@delivery-os/core/contracts";

const linesFor = (label: string, values: readonly string[]): string[] =>
  values.length === 0 ? [] : [`${label}:`, ...values.map((value) => `  ${value}`)];

/** Render one commit outcome for a human caller. */
export const renderCommitHuman = (data: CommitEnvelopeData): string => {
  const lines = [
    ...(data.dryRun === true ? ["dry run (nothing changed)"] : []),
    `subject: ${data.subject}`,
    ...(data.body === undefined ? [] : ["body:", ...data.body.split("\n").map((line) => `  ${line}`)]),
    ...linesFor("staged", data.stagedFiles),
    ...linesFor("excluded (forbidden)", data.excluded.forbiddenPaths),
    ...linesFor("excluded (oversized binaries)", data.excluded.oversizedBinaries),
    ...linesFor("excluded (stray, untracked)", data.excluded.untrackedNotStaged),
    ...linesFor("excluded (generated noise)", data.excluded.noiseStripped),
    ...linesFor("scope drift (staged, tracked)", data.excluded.scopeDrift),
    `message source: ${data.messageSource}`,
    `transport: ${data.transport}`,
    ...(data.commitSha === undefined ? [] : [`commit: ${data.commitSha}`]),
    ...(data.atomic ? ["atomic completion: true"] : []),
    ...(data.telemetry.emitted ? [] : ["telemetry emission: not recorded"]),
  ];
  return `${lines.join("\n")}\n`;
};
