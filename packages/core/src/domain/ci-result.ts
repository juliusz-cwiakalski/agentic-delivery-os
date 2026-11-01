/**
 * Shared pure CI result classification (GH-176 D5).
 *
 * Extracted verbatim from the delivered status aggregator so `status` and
 * `queue ready` cannot diverge. No I/O, clock, randomness, or environment.
 */

import type { PipelineRun, StatusCiResult } from "#contracts";

/** Classify a bounded check-runs page into the delivered CI result vocabulary. */
export const classifyPipelineRuns = (runs: readonly PipelineRun[]): StatusCiResult => {
  const states = runs.flatMap((run) => run.jobs.map((job) => job.jobState));
  if (states.includes("failed")) return "failed";
  if (states.includes("running") || states.includes("queued")) return "pending";
  if (states.includes("canceled")) return "canceled";
  if (states.includes("succeeded")) {
    return states.every((state) => state === "succeeded" || state === "skipped")
      ? "succeeded"
      : "none";
  }
  return "none";
};
