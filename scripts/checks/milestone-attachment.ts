/**
 * Milestone-attachment evaluation core (GH-313 F-3, AC-F3-1..AC-F3-7).
 *
 * Pure and offline: the evaluator takes the normalised contract-v1 input and
 * returns exactly one verdict plus the closed write vocabulary. No clock, no
 * environment, no port, and no network. The issue text never enters the input.
 */

export const MILESTONE_ACTIONS = [
  "opened",
  "edited",
  "labeled",
  "unlabeled",
  "milestoned",
  "demilestoned",
  "reopened",
] as const;

export type MilestoneAction = (typeof MILESTONE_ACTIONS)[number];

export type IssueState = "open" | "closed";

export type Verdict = "compliant" | "exempt" | "flagged" | "restored" | "out-of-scope";

export const VERDICTS: readonly Verdict[] = [
  "compliant",
  "exempt",
  "flagged",
  "restored",
  "out-of-scope",
];

export type TrackerWrite = "addFlag" | "removeFlag" | "postMarkerComment";

export type WriteVerb = TrackerWrite | "writeJobSummary";

export const TRACKER_WRITES: readonly TrackerWrite[] = [
  "addFlag",
  "removeFlag",
  "postMarkerComment",
];

export const WRITE_VERBS: readonly WriteVerb[] = [...TRACKER_WRITES, "writeJobSummary"];

export const FLAG_LABEL = "needs-milestone";
export const EXEMPTION_LABEL = "backlog-capture";
export const MARKER_TOKEN = "<!-- needs-milestone-check -->";

/** The one fixed comment body; every issue gets exactly these bytes. */
export const MARKER_COMMENT_BODY = `${MARKER_TOKEN}
This \`change\` issue has no milestone.

Attach an existing milestone to clear the \`needs-milestone\` flag. If this is
pure backlog capture, add the \`backlog-capture\` exemption. The flag does not
block work; it only makes the missing attachment visible.

See \`doc/guides/milestone-management.md\` for the operating rule.`;

/** The seven-field normalised input; no raw webhook payload and no issue text. */
export type EvaluationInput = {
  readonly action: MilestoneAction;
  readonly state: IssueState;
  readonly changeLabel: boolean;
  readonly exemption: boolean;
  readonly milestone: boolean;
  readonly flag: boolean;
  readonly markerCommentPresent: boolean;
};

export type EvaluationResult = {
  readonly verdict: Verdict;
  /** Tracker writes in execution order plus exactly one `writeJobSummary`. */
  readonly writes: readonly WriteVerb[];
};

/** The one run-legibility write; never a tracker write. */
const JOB_SUMMARY: WriteVerb = "writeJobSummary";

const result = (
  verdict: Verdict,
  trackerWrites: readonly TrackerWrite[] = [],
): EvaluationResult => ({
  verdict,
  writes: [...trackerWrites, JOB_SUMMARY],
});

/**
 * Ordered, first-match evaluation (contract v1):
 * 1 not open or not `change` → out-of-scope; 2 exemption → exempt;
 * 3 milestone present → compliant (remove a stray flag); 4 flagging rules.
 */
export const evaluate = (input: EvaluationInput): EvaluationResult => {
  if (!input.changeLabel || input.state !== "open") return result("out-of-scope");

  if (input.exemption) return result("exempt");

  if (input.milestone) {
    return input.flag ? result("compliant", ["removeFlag"]) : result("compliant");
  }

  switch (input.action) {
    case "opened": {
      if (input.flag) return result("flagged");
      if (input.markerCommentPresent) return result("flagged", ["addFlag"]);
      return result("flagged", ["addFlag", "postMarkerComment"]);
    }
    case "demilestoned": {
      if (!input.markerCommentPresent) return result("out-of-scope");
      if (input.flag) return result("restored");
      return result("restored", ["addFlag"]);
    }
    case "edited":
    case "labeled":
    case "unlabeled":
    case "reopened": {
      if (input.flag) return result("flagged");
      return result("out-of-scope");
    }
    case "milestoned": {
      // A `milestoned` event with no milestone is not a flag-write path.
      return result("out-of-scope");
    }
    default: {
      const exhaustive: never = input.action;
      return exhaustive;
    }
  }
};

export const isMarkerComment = (body: string): boolean => body.includes(MARKER_TOKEN);

/** Render one job summary line; only the issue number, verdict, and writes. */
export const renderJobSummary = (issueNumber: number, evaluation: EvaluationResult): string => {
  const trackerWrites = evaluation.writes.filter((write) => write !== JOB_SUMMARY);
  return `Milestone attachment check — issue #${issueNumber}: ${evaluation.verdict}; writes: ${
    trackerWrites.length > 0 ? trackerWrites.join(", ") : "none"
  }`;
};
