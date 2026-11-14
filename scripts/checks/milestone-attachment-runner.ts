/**
 * Port-injected milestone-attachment orchestration (GH-313 F-3, NFR-6).
 *
 * The runner owns the side effects through injected ports: one issue-event
 * evaluation performs only the writes the pure core names, and the advisory
 * sweep performs zero tracker writes. It imports no network or filesystem API.
 */
import {
  type EvaluationInput,
  type EvaluationResult,
  EXEMPTION_LABEL,
  evaluate,
  FLAG_LABEL,
  isMarkerComment,
  MARKER_COMMENT_BODY,
  renderJobSummary,
  type TrackerWrite,
  type Verdict,
} from "./milestone-attachment";

export type TrackerIssue = {
  readonly number: number;
  readonly state: "open" | "closed";
  readonly labels: readonly string[];
  readonly milestone: string | null;
  readonly title?: string;
  readonly body?: string;
  readonly author?: string;
};

export type TrackerComment = {
  readonly id: number;
  readonly body: string;
};

export type TrackerMilestone = {
  readonly number: number;
  readonly title: string;
  readonly state: "open" | "closed";
};

/** The tracker port; every method is injected, so the runner stays offline. */
export interface MilestoneTrackerPort {
  readIssue(issueNumber: number): Promise<TrackerIssue>;
  listComments(issueNumber: number): Promise<readonly TrackerComment[]>;
  listMilestones(): Promise<readonly TrackerMilestone[]>;
  listIssues(page: number, perPage: number): Promise<readonly TrackerIssue[]>;
  addLabel(issueNumber: number, label: string): Promise<void>;
  removeLabel(issueNumber: number, label: string): Promise<void>;
  createComment(issueNumber: number, body: string): Promise<void>;
}

/** The job-summary sink writes to an injected target, never a tracker. */
export interface JobSummarySink {
  append(text: string): void | Promise<void>;
}

/** The artifact writer is the sweep's only file output. */
export interface ArtifactWriter {
  write(path: string, contents: string): void | Promise<void>;
}

export const SWEEP_PAGE_SIZE = 100;
export const SWEEP_ARTIFACT_PATH = "tmp/milestone-attachment-sweep.json";

export type EvaluationRun = {
  readonly verdict: Verdict;
  readonly writes: readonly TrackerWrite[];
  readonly jobSummary: string;
};

export type EvaluationOptions = {
  readonly action: EvaluationInput["action"];
  readonly issueNumber: number;
  readonly tracker: MilestoneTrackerPort;
  readonly summary: JobSummarySink;
};

const normalise = (
  action: EvaluationInput["action"],
  issue: TrackerIssue,
  comments: readonly TrackerComment[],
): EvaluationInput => ({
  action,
  state: issue.state,
  changeLabel: issue.labels.includes("change"),
  exemption: issue.labels.includes(EXEMPTION_LABEL),
  milestone: issue.milestone !== null && issue.milestone.length > 0,
  flag: issue.labels.includes(FLAG_LABEL),
  markerCommentPresent: comments.some((comment) => isMarkerComment(comment.body)),
});

const applyWrites = async (
  tracker: MilestoneTrackerPort,
  issueNumber: number,
  evaluation: EvaluationResult,
): Promise<readonly TrackerWrite[]> => {
  const trackerWrites = evaluation.writes.filter(
    (write): write is TrackerWrite => write !== "writeJobSummary",
  );
  for (const write of trackerWrites) {
    if (write === "addFlag") await tracker.addLabel(issueNumber, FLAG_LABEL);
    if (write === "removeFlag") await tracker.removeLabel(issueNumber, FLAG_LABEL);
    if (write === "postMarkerComment") {
      await tracker.createComment(issueNumber, MARKER_COMMENT_BODY);
    }
  }
  return trackerWrites;
};

/** Evaluate one issue event and act only on the core's closed write set. */
export const runEvaluation = async (options: EvaluationOptions): Promise<EvaluationRun> => {
  const issue = await options.tracker.readIssue(options.issueNumber);
  const comments = await options.tracker.listComments(options.issueNumber);
  const evaluation = evaluate(normalise(options.action, issue, comments));
  const writes = await applyWrites(options.tracker, options.issueNumber, evaluation);
  const jobSummary = renderJobSummary(options.issueNumber, evaluation);
  await options.summary.append(jobSummary);
  return { verdict: evaluation.verdict, writes, jobSummary };
};

export type SweepArtifact = {
  readonly schemaVersion: "milestone-attachment-sweep.v1";
  readonly totalInspected: number;
  readonly openChangeCount: number;
  readonly exemptedCount: number;
  readonly unattachedCount: number;
  readonly unattachedIssueNumbers: readonly number[];
  readonly trackerWrites: 0;
  readonly artifactPath: string;
  readonly note: string;
};

export type SweepOptions = {
  readonly tracker: MilestoneTrackerPort;
  readonly summary: JobSummarySink;
  readonly writer: ArtifactWriter;
  readonly artifactPath?: string;
};

export type SweepRun = {
  readonly artifact: SweepArtifact;
  readonly jobSummary: string;
};

const isOpenChange = (issue: TrackerIssue): boolean =>
  issue.state === "open" && issue.labels.includes("change");

const hasMilestone = (issue: TrackerIssue): boolean =>
  issue.milestone !== null && issue.milestone.length > 0;

const isExempt = (issue: TrackerIssue): boolean => issue.labels.includes(EXEMPTION_LABEL);

/** Read every page, report the advisory population, write one local artifact. */
export const runSweep = async (options: SweepOptions): Promise<SweepRun> => {
  const issues: TrackerIssue[] = [];
  for (let page = 1; ; page += 1) {
    const batch = await options.tracker.listIssues(page, SWEEP_PAGE_SIZE);
    issues.push(...batch);
    if (batch.length < SWEEP_PAGE_SIZE) break;
  }

  const openChange = issues.filter(isOpenChange);
  const exempted = openChange.filter(isExempt);
  const unattached = openChange.filter((issue) => !isExempt(issue) && !hasMilestone(issue));
  const artifactPath = options.artifactPath ?? SWEEP_ARTIFACT_PATH;
  const artifact: SweepArtifact = {
    schemaVersion: "milestone-attachment-sweep.v1",
    totalInspected: issues.length,
    openChangeCount: openChange.length,
    exemptedCount: exempted.length,
    unattachedCount: unattached.length,
    unattachedIssueNumbers: unattached.map((issue) => issue.number),
    trackerWrites: 0,
    artifactPath,
    note: "No tracker write occurred; this local artifact is the only write of the sweep.",
  };
  await options.writer.write(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  const jobSummary = `Milestone attachment sweep — inspected ${artifact.totalInspected}; exempted ${artifact.exemptedCount}; unattached ${artifact.unattachedCount}; tracker writes: 0; artifact: ${artifactPath}`;
  await options.summary.append(jobSummary);
  return { artifact, jobSummary };
};
