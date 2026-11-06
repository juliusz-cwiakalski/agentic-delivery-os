/**
 * Pure post-verification probe classification (GH-225 F-3, AC-F3-1, GAP-6).
 *
 * The probe compares the recorded verification's observed posture and CI
 * evidence with the bounded merge-time reads. A tracker transition into an
 * owner-attention posture after verification and a newly failing job on the
 * verified head are the two transition classes. No I/O and no waiting: the
 * caller supplies parsed facts.
 */
import {
  type MergeTrackerPosture,
  type PipelineRun,
  STATUS_OWNER_ATTENTION_LABELS,
  type VerifyGateCount,
  type VerifyGateNameList,
  type VerifyGateReason,
  type VerifyGateVerdict,
} from "#contracts";

/** A parsed work-item posture read. */
export type MergePosture = {
  readonly labels: readonly string[];
  readonly ownerLabels: readonly string[];
  readonly updatedAt?: string;
};

/** The owner-attention labels present in a label set, in declared order. */
export const ownerAttentionLabels = (labels: readonly string[]): string[] =>
  STATUS_OWNER_ATTENTION_LABELS.filter((owner) =>
    labels.some((label) => label.toLowerCase() === owner.toLowerCase()),
  );

/** The posture snapshot from a label set. */
export const postureOf = (labels: readonly string[], updatedAt?: string): MergePosture => ({
  labels,
  ownerLabels: ownerAttentionLabels(labels),
  ...(updatedAt === undefined ? {} : { updatedAt }),
});

/** The tracker-transition classification. */
export type MergeTrackerTransition = {
  readonly changed: boolean;
  readonly before: readonly string[];
  readonly after: readonly string[];
  readonly ageMs?: number;
};

const parseIsoMs = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Classify a post-verification tracker transition.
 *
 * A label present at verification is not a transition. The transition age is
 * the provider-observed update time relative to the verification time; an
 * unparseable or absent timestamp yields no fabricated age.
 */
export const classifyTrackerTransition = (input: {
  readonly recorded: MergeTrackerPosture;
  readonly current: MergePosture;
  readonly verifiedAt: string;
}): MergeTrackerTransition => {
  const before = new Set(input.recorded.ownerLabels);
  const after = input.current.ownerLabels.filter((label) => !before.has(label));
  const changed = after.length > 0;
  if (!changed) {
    return { changed: false, before: input.recorded.ownerLabels, after: [] };
  }
  const updatedAt = parseIsoMs(input.current.updatedAt);
  const verifiedAt = parseIsoMs(input.verifiedAt);
  const ageMs =
    updatedAt === undefined || verifiedAt === undefined
      ? undefined
      : Math.max(0, updatedAt - verifiedAt);
  return {
    changed: true,
    before: input.recorded.ownerLabels,
    after,
    ...(ageMs === undefined ? {} : { ageMs }),
  };
};

/** The failed job names present on a check-run page (deduplicated, ordered). */
export const failedJobNames = (runs: readonly PipelineRun[]): string[] => {
  const names: string[] = [];
  for (const run of runs) {
    if (run.jobs.some((job) => job.jobState === "failed") && !names.includes(run.pipelineName)) {
      names.push(run.pipelineName);
    }
  }
  return names;
};

/** The recorded failed job names from an EVT-1 citation, if recorded. */
export const recordedFailedJobs = (names: readonly VerifyGateNameList[] | undefined): string[] => {
  const list = names?.find((entry) => entry.kind === "failed-jobs");
  return list === undefined ? [] : [...list.values];
};

/**
 * New failing jobs on the verified head that the recorded verification did not
 * observe. A page for another SHA is not head evidence and yields no jobs.
 */
export const newRedJobs = (input: {
  readonly recordedFailed: readonly string[];
  readonly currentRuns: readonly PipelineRun[];
  readonly pageSha: string | undefined;
  readonly headSha: string;
}): string[] => {
  if (input.pageSha !== undefined && input.pageSha !== input.headSha) return [];
  const recorded = new Set(input.recordedFailed);
  return failedJobNames(input.currentRuns).filter((name) => !recorded.has(name));
};

/** One required-job gate evaluation (a declarative repo-declared recipe). */
export type RequiredJobEvaluation = {
  readonly verdict: VerifyGateVerdict;
  readonly reason: VerifyGateReason;
  readonly counts: readonly VerifyGateCount[];
  readonly names: readonly VerifyGateNameList[];
};

const jobStateOf = (runs: readonly PipelineRun[], jobName: string): string | undefined => {
  let worst: string | undefined;
  const rank = (state: string): number =>
    state === "failed"
      ? 0
      : state === "canceled"
        ? 1
        : state === "pending" || state === "running" || state === "queued"
          ? 2
          : state === "skipped"
            ? 3
            : 4;
  for (const run of runs) {
    for (const job of run.jobs) {
      const matches = job.jobName === jobName || run.pipelineName === jobName;
      if (!matches) continue;
      const state =
        job.jobState === "running" || job.jobState === "queued" ? "pending" : job.jobState;
      if (worst === undefined || rank(state) < rank(worst)) worst = state;
    }
  }
  return worst;
};

/** Evaluate one `required-ci-job` gate entry against the bounded page. */
export const evaluateRequiredJobGate = (input: {
  readonly jobName: string;
  readonly runs: readonly PipelineRun[];
  readonly pageSha: string | undefined;
  readonly headSha: string;
}): RequiredJobEvaluation => {
  const count = (name: VerifyGateCount["name"], value: number): VerifyGateCount => ({
    name,
    value: Math.max(0, Math.trunc(value)),
  });
  const nameList = (kind: VerifyGateNameList["kind"], values: readonly string[]) => ({
    kind,
    values,
    omitted: 0,
  });
  if (input.pageSha !== undefined && input.pageSha !== input.headSha) {
    return {
      verdict: "unknown",
      reason: "head-unresolved",
      counts: [count("expected", 1), count("missing", 1)],
      names: [nameList("missing-jobs", [input.jobName])],
    };
  }
  const state = jobStateOf(input.runs, input.jobName);
  if (state === undefined) {
    return {
      verdict: "fail",
      reason: "ci-missing-jobs",
      counts: [count("expected", 1), count("missing", 1)],
      names: [nameList("missing-jobs", [input.jobName])],
    };
  }
  if (state === "failed") {
    return {
      verdict: "fail",
      reason: "ci-failed",
      counts: [count("expected", 1), count("failed", 1)],
      names: [nameList("failed-jobs", [input.jobName])],
    };
  }
  if (state === "pending") {
    return {
      verdict: "fail",
      reason: "ci-pending",
      counts: [count("expected", 1), count("pending", 1)],
      names: [nameList("pending-jobs", [input.jobName])],
    };
  }
  if (state === "canceled") {
    return {
      verdict: "fail",
      reason: "ci-canceled",
      counts: [count("expected", 1), count("canceled", 1)],
      names: [],
    };
  }
  if (state === "skipped") {
    return {
      verdict: "fail",
      reason: "ci-all-skipped",
      counts: [count("expected", 1), count("skipped", 1)],
      names: [],
    };
  }
  return {
    verdict: "pass",
    reason: "ci-green",
    counts: [count("expected", 1), count("succeeded", 1)],
    names: [],
  };
};
