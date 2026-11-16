/**
 * The committed measurement-baseline fixture (GH-296 F-8): the MET-CEREMONY-SHARE
 * row and the one committed comparison entry, parsed without restating values in
 * source.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export const LOG_PATH = "doc/planning/oss-tooling/measurement-baseline.yaml";

export type CommittedLog = {
  readonly schema_version: number;
  readonly source_commit: string;
  readonly window: { readonly start: string; readonly end: string };
  readonly metrics: readonly {
    readonly id: string;
    readonly value: number;
    readonly status: string;
    readonly window: string;
    readonly sample: Record<string, number>;
  }[];
  readonly comparisons: readonly Record<string, unknown>[];
};

export const readCommittedLog = (): CommittedLog =>
  parse(readFileSync(join(process.cwd(), LOG_PATH), "utf8")) as CommittedLog;

export const ceremonyShareRow = (): CommittedLog["metrics"][number] => {
  const row = readCommittedLog().metrics.find((metric) => metric.id === "MET-CEREMONY-SHARE");
  if (row === undefined) throw new Error("MET-CEREMONY-SHARE is missing");
  return row;
};

export const committedComparison = (): Record<string, unknown> => {
  const entry = readCommittedLog().comparisons[0];
  if (entry === undefined) throw new Error("the committed comparison is missing");
  return entry;
};

export const AFTER_WINDOW = {
  start: "2026-11-16T00:00:00.000Z",
  end: "2026-11-16T23:59:59.999Z",
} as const;

export const LIMITATION =
  "No post-boundary sample exists at delivery time, so no direction is claimed; the record is recomputed per delivery.";

export const BEFORE = {
  value: 0.406648,
  window: { start: "2026-02-01T00:00:00Z", end: "2026-10-31T23:59:59Z" },
  sampleSize: 23,
  status: "PARTIAL",
  basis: "pm-notes-self-reported",
} as const;
