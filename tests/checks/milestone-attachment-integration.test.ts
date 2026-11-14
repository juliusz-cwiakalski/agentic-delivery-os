/**
 * TC-CHK-002..005 — offline integration over an injected tracker port.
 *
 * The fake records every call, so "no duplicate application", "a manual flag
 * removal is respected", "no other mutation", and "zero tracker writes" are
 * asserted on the call list as well as on the resulting state.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type EvaluationInput,
  EXEMPTION_LABEL,
  FLAG_LABEL,
  MARKER_COMMENT_BODY,
} from "../../scripts/checks/milestone-attachment";
import {
  type JobSummarySink,
  type MilestoneTrackerPort,
  runEvaluation,
  type TrackerComment,
  type TrackerIssue,
  type TrackerMilestone,
} from "../../scripts/checks/milestone-attachment-runner";

const ROOT = process.cwd();
const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const MILESTONES: readonly TrackerMilestone[] = [
  { number: 1, title: "M0: Trust substrate", state: "closed" },
  { number: 2, title: "M1: Delivery engine and autonomous dispatch", state: "closed" },
  { number: 3, title: "M2: Ceremonies, measurement, and memory", state: "open" },
];

const eventFixture = (
  name: string,
): {
  action: EvaluationInput["action"];
  number: number;
  state: "open" | "closed";
  labels: readonly string[];
  milestone: string | null;
} => {
  const parsed: unknown = JSON.parse(read(`tests/fixtures/milestone-attachment/events/${name}`));
  if (typeof parsed !== "object" || parsed === null) throw new Error("invalid event fixture");
  const event = parsed as {
    action?: unknown;
    issue?: {
      number?: unknown;
      state?: unknown;
      labels?: readonly { name?: unknown }[];
      milestone?: { title?: unknown } | null;
    };
  };
  const action = event.action;
  const issue = event.issue;
  if (typeof action !== "string" || issue?.number === undefined) {
    throw new Error(`event fixture ${name} is incomplete`);
  }
  const state = issue.state === "closed" ? "closed" : "open";
  const labels = (issue.labels ?? [])
    .map((label) => (typeof label.name === "string" ? label.name : undefined))
    .filter((label): label is string => label !== undefined);
  const title = issue.milestone?.title;
  return {
    action: action as EvaluationInput["action"],
    number: issue.number as number,
    state,
    labels,
    milestone: typeof title === "string" ? title : null,
  };
};

const commentsFixture = (name: string): readonly TrackerComment[] => {
  const parsed: unknown = JSON.parse(read(`tests/fixtures/milestone-attachment/tracker/${name}`));
  if (!Array.isArray(parsed)) throw new Error("invalid comments fixture");
  return parsed.map((entry: unknown, index) => {
    const comment = entry as { id?: unknown; body?: unknown };
    return {
      id: typeof comment.id === "number" ? comment.id : index + 1,
      body: typeof comment.body === "string" ? comment.body : "",
    };
  });
};

class FakeTracker implements MilestoneTrackerPort {
  issue: TrackerIssue;
  comments: TrackerComment[];
  readonly calls: string[] = [];
  failRead = false;

  constructor(issue: TrackerIssue, comments: readonly TrackerComment[]) {
    this.issue = structuredClone(issue);
    this.comments = structuredClone([...comments]);
  }

  async readIssue(issueNumber: number): Promise<TrackerIssue> {
    this.calls.push(`readIssue:${issueNumber}`);
    if (this.failRead) throw new Error("tracker unavailable");
    return structuredClone(this.issue);
  }

  async listComments(issueNumber: number): Promise<readonly TrackerComment[]> {
    this.calls.push(`listComments:${issueNumber}`);
    if (this.failRead) throw new Error("tracker unavailable");
    return structuredClone(this.comments);
  }

  async listMilestones(): Promise<readonly TrackerMilestone[]> {
    this.calls.push("listMilestones");
    return MILESTONES;
  }

  async listIssues(page: number, perPage: number): Promise<readonly TrackerIssue[]> {
    this.calls.push(`listIssues:${page}:${perPage}`);
    return [];
  }

  async addLabel(issueNumber: number, label: string): Promise<void> {
    this.calls.push(`addLabel:${issueNumber}:${label}`);
    if (!this.issue.labels.includes(label)) {
      this.issue = { ...this.issue, labels: [...this.issue.labels, label] };
    }
  }

  async removeLabel(issueNumber: number, label: string): Promise<void> {
    this.calls.push(`removeLabel:${issueNumber}:${label}`);
    this.issue = {
      ...this.issue,
      labels: this.issue.labels.filter((entry) => entry !== label),
    };
  }

  async createComment(issueNumber: number, body: string): Promise<void> {
    this.calls.push(`createComment:${issueNumber}`);
    this.comments = [...this.comments, { id: 9000 + this.comments.length, body }];
  }
}

const summarySink = (): JobSummarySink & { readonly lines: string[] } => {
  const lines: string[] = [];
  return {
    lines,
    append: (text) => {
      lines.push(text);
    },
  };
};

const seed = (
  fixture: string,
  options: { readonly marker?: boolean; readonly flag?: boolean; readonly exemption?: boolean },
): FakeTracker => {
  const event = eventFixture(fixture);
  const labels = new Set(event.labels);
  if (options.flag === true) labels.add(FLAG_LABEL);
  if (options.flag === false) labels.delete(FLAG_LABEL);
  if (options.exemption === true) labels.add(EXEMPTION_LABEL);
  if (options.exemption === false) labels.delete(EXEMPTION_LABEL);
  const issue: TrackerIssue = {
    number: event.number,
    state: event.state,
    labels: [...labels],
    milestone: event.milestone,
  };
  const comments = options.marker === true ? commentsFixture("comments--with-marker.json") : [];
  return new FakeTracker(issue, comments);
};

const run = async (
  tracker: FakeTracker,
  action: EvaluationInput["action"],
  summary: JobSummarySink,
): Promise<Awaited<ReturnType<typeof runEvaluation>>> =>
  runEvaluation({
    action,
    issueNumber: tracker.issue.number,
    tracker,
    summary,
  });

const writeCalls = (tracker: FakeTracker, from = 0): readonly string[] =>
  tracker.calls
    .slice(from)
    .filter(
      (call) =>
        call.startsWith("addLabel") ||
        call.startsWith("removeLabel") ||
        call.startsWith("createComment"),
    );

describe("TC-CHK-002 opened flag path", () => {
  test("no marker: one flag, one comment, and a legible summary", async () => {
    const tracker = seed("issue-opened--change--no-milestone.json", { marker: false });
    const summary = summarySink();
    const result = await run(tracker, "opened", summary);
    expect(result.verdict).toBe("flagged");
    expect(result.writes).toEqual(["addFlag", "postMarkerComment"]);
    expect(tracker.issue.labels).toContain(FLAG_LABEL);
    expect(tracker.comments).toHaveLength(1);
    expect(tracker.comments[0]?.body).toBe(MARKER_COMMENT_BODY);
    expect(tracker.comments[0]?.body).toContain("doc/guides/milestone-management.md");
    expect(tracker.comments[0]?.body).toContain("backlog-capture");
    expect(tracker.comments[0]?.body).toMatch(/does not\s+block work/i);
    expect(summary.lines[0]).toContain(`#${tracker.issue.number}`);
    expect(summary.lines[0]).toContain("flagged");
    expect(summary.lines[0]).toContain("addFlag");
    expect(summary.lines[0]).toContain("postMarkerComment");
    expect(tracker.issue.state).toBe("open");
  });

  test("marker present: the flag only, never a second comment", async () => {
    const tracker = seed("issue-opened--change--no-milestone--marker-present.json", {
      marker: true,
    });
    const summary = summarySink();
    const result = await run(tracker, "opened", summary);
    expect(result.verdict).toBe("flagged");
    expect(result.writes).toEqual(["addFlag"]);
    expect(tracker.comments).toHaveLength(1);
  });

  test("compliant and exempt inputs write nothing", async () => {
    const compliant = seed("issue-opened--change--with-milestone.json", { marker: false });
    const compliantSummary = summarySink();
    expect((await run(compliant, "opened", compliantSummary)).verdict).toBe("compliant");
    expect(writeCalls(compliant)).toEqual([]);

    const exempt = seed("issue-opened--change--exempt.json", { marker: false });
    const exemptSummary = summarySink();
    expect((await run(exempt, "opened", exemptSummary)).verdict).toBe("exempt");
    expect(writeCalls(exempt)).toEqual([]);
    expect(exemptSummary.lines[0]).toContain("none");
  });

  test("only allowed reads and writes appear in the call list", async () => {
    const tracker = seed("issue-opened--change--no-milestone.json", { marker: false });
    await run(tracker, "opened", summarySink());
    const allowed =
      /^(readIssue|listComments|listMilestones|listIssues|addLabel|removeLabel|createComment):?/;
    for (const call of tracker.calls) expect(call).toMatch(allowed);
  });
});

describe("TC-CHK-003 idempotency and manual removal", () => {
  test("replays never write again and never post a second comment", async () => {
    const tracker = seed("issue-opened--change--no-milestone.json", { marker: false });
    const summary = summarySink();
    await run(tracker, "opened", summary);
    const afterFirst = structuredClone(tracker.issue);
    for (let replay = 0; replay < 3; replay += 1) {
      const start = tracker.calls.length;
      const result = await run(tracker, "opened", summary);
      expect(result.verdict).toBe("flagged");
      expect(writeCalls(tracker, start)).toEqual([]);
      expect(tracker.issue).toEqual(afterFirst);
    }
    expect(tracker.comments).toHaveLength(1);
  });

  test("edited and labeled with the flag present write nothing", async () => {
    const tracker = seed("issue-opened--change--no-milestone--flag-present.json", {
      marker: true,
      flag: true,
    });
    for (const action of ["edited", "labeled"] as const) {
      const start = tracker.calls.length;
      const result = await run(tracker, action, summarySink());
      expect(result.verdict).toBe("flagged");
      expect(writeCalls(tracker, start)).toEqual([]);
    }
  });

  test("a human-removed flag is never re-applied by edit, label, unlabel, or reopen", async () => {
    const tracker = seed("issue-opened--change--no-milestone.json", { marker: false });
    await run(tracker, "opened", summarySink());
    tracker.issue = {
      ...tracker.issue,
      labels: tracker.issue.labels.filter((label) => label !== FLAG_LABEL),
    };
    for (const action of ["edited", "labeled", "unlabeled", "reopened"] as const) {
      const start = tracker.calls.length;
      const result = await run(tracker, action, summarySink());
      expect(result.verdict).toBe("out-of-scope");
      expect(writeCalls(tracker, start)).toEqual([]);
      expect(writeCalls(tracker, start).some((call) => call.startsWith("addLabel"))).toBe(false);
    }
    expect(tracker.issue.labels).not.toContain(FLAG_LABEL);
    expect(tracker.comments).toHaveLength(1);
  });

  test("the two legitimate re-add paths each write once and never comment", async () => {
    const tracker = seed("issue-opened--change--no-milestone--marker-present.json", {
      marker: true,
    });
    const first = await run(tracker, "opened", summarySink());
    expect(first.verdict).toBe("flagged");
    expect(first.writes).toEqual(["addFlag"]);
    expect(tracker.comments).toHaveLength(1);

    const start = tracker.calls.length;
    const repeat = await run(tracker, "opened", summarySink());
    expect(repeat.verdict).toBe("flagged");
    expect(writeCalls(tracker, start)).toEqual([]);

    tracker.issue = {
      ...tracker.issue,
      milestone: null,
      labels: tracker.issue.labels.filter((l) => l !== FLAG_LABEL),
    };
    const restored = await run(tracker, "demilestoned", summarySink());
    expect(restored.verdict).toBe("restored");
    expect(restored.writes).toEqual(["addFlag"]);
    expect(tracker.comments).toHaveLength(1);

    const start2 = tracker.calls.length;
    const repeatRestore = await run(tracker, "demilestoned", summarySink());
    expect(repeatRestore.verdict).toBe("restored");
    expect(writeCalls(tracker, start2)).toEqual([]);
    expect(tracker.comments).toHaveLength(1);
  });

  test("no evaluation with the flag present writes addFlag", async () => {
    const tracker = seed("issue-opened--change--no-milestone.json", {
      marker: true,
      flag: true,
    });
    for (const action of [
      "opened",
      "edited",
      "labeled",
      "unlabeled",
      "reopened",
      "demilestoned",
    ] as const) {
      const start = tracker.calls.length;
      await run(tracker, action, summarySink());
      expect(writeCalls(tracker, start).some((call) => call.startsWith("addLabel"))).toBe(false);
    }
  });
});

describe("TC-CHK-004 exemption outranks milestone and flag", () => {
  test("every action on an exempt issue is zero-write", async () => {
    const tracker = seed("issue-opened--change--exempt.json", { marker: false });
    for (const action of [
      "opened",
      "edited",
      "labeled",
      "unlabeled",
      "milestoned",
      "demilestoned",
      "reopened",
    ] as const) {
      const start = tracker.calls.length;
      const result = await run(tracker, action, summarySink());
      expect(result.verdict).toBe("exempt");
      expect(writeCalls(tracker, start)).toEqual([]);
    }
  });

  test("exemption outranks a present milestone and flag and leaves the flag visible", async () => {
    const tracker = seed("issue-opened--change--exempt--milestone-flag.json", {
      marker: true,
      exemption: true,
      flag: true,
    });
    const start = tracker.calls.length;
    const result = await run(tracker, "milestoned", summarySink());
    expect(result.verdict).toBe("exempt");
    expect(writeCalls(tracker, start)).toEqual([]);
    expect(tracker.issue.labels).toContain(FLAG_LABEL);
  });

  test("removing the exemption does not resurrect the flag on an edit", async () => {
    const tracker = seed("issue-opened--change--exempt.json", { marker: false });
    await run(tracker, "opened", summarySink());
    const withMarker = tracker.comments.length;
    tracker.issue = {
      ...tracker.issue,
      labels: tracker.issue.labels.filter((label) => label !== EXEMPTION_LABEL),
    };
    // The flag was never applied (exempt), so simulate a previous flag+marker.
    if (withMarker === 0) {
      tracker.comments = commentsFixture("comments--with-marker.json");
    }
    const start = tracker.calls.length;
    const result = await run(tracker, "edited", summarySink());
    expect(result.verdict).toBe("out-of-scope");
    expect(writeCalls(tracker, start)).toEqual([]);
  });

  test("removability: without the exemption the opened path flags", async () => {
    const tracker = seed("issue-opened--change--no-milestone.json", {
      marker: false,
      exemption: false,
    });
    const result = await run(tracker, "opened", summarySink());
    expect(result.verdict).toBe("flagged");
    expect(result.writes).toEqual(["addFlag", "postMarkerComment"]);
  });
});

describe("TC-CHK-005 attach removes and detach restores", () => {
  test("milestoned removes only a present flag and never comments", async () => {
    const tracker = seed("issue-opened--change--no-milestone.json", { marker: false });
    await run(tracker, "opened", summarySink());
    tracker.issue = { ...tracker.issue, milestone: "M2: Ceremonies, measurement, and memory" };
    const start = tracker.calls.length;
    const removed = await run(tracker, "milestoned", summarySink());
    expect(removed.verdict).toBe("compliant");
    expect(removed.writes).toEqual(["removeFlag"]);
    expect(writeCalls(tracker, start)).toEqual([
      `removeLabel:${tracker.issue.number}:${FLAG_LABEL}`,
    ]);
    expect(tracker.comments).toHaveLength(1);

    const start2 = tracker.calls.length;
    const noFlag = await run(tracker, "milestoned", summarySink());
    expect(noFlag.verdict).toBe("compliant");
    expect(writeCalls(tracker, start2)).toEqual([]);
  });

  test("demilestoned restores only with the marker and never comments", async () => {
    const tracker = seed("issue-opened--change--no-milestone--marker-present.json", {
      marker: true,
    });
    await run(tracker, "opened", summarySink());
    tracker.issue = {
      ...tracker.issue,
      milestone: null,
      labels: tracker.issue.labels.filter((label) => label !== FLAG_LABEL),
    };
    const start = tracker.calls.length;
    const restored = await run(tracker, "demilestoned", summarySink());
    expect(restored.verdict).toBe("restored");
    expect(restored.writes).toEqual(["addFlag"]);
    expect(writeCalls(tracker, start)).toEqual([`addLabel:${tracker.issue.number}:${FLAG_LABEL}`]);
    expect(tracker.comments).toHaveLength(1);

    const start2 = tracker.calls.length;
    const repeat = await run(tracker, "demilestoned", summarySink());
    expect(repeat.verdict).toBe("restored");
    expect(writeCalls(tracker, start2)).toEqual([]);
  });

  test("demilestoned without a marker is never restored", async () => {
    const tracker = seed("issue-demilestoned--change--no-marker.json", { marker: false });
    const start = tracker.calls.length;
    const result = await run(tracker, "demilestoned", summarySink());
    expect(result.verdict).toBe("out-of-scope");
    expect(writeCalls(tracker, start)).toEqual([]);
  });

  test("closed issues are out of scope for both directions", async () => {
    const tracker = seed("issue-opened--change--closed.json", { marker: true });
    tracker.issue = {
      ...tracker.issue,
      milestone: "M2: Ceremonies, measurement, and memory",
      state: "closed",
    };
    for (const action of ["milestoned", "demilestoned"] as const) {
      const start = tracker.calls.length;
      const result = await run(tracker, action, summarySink());
      expect(result.verdict).toBe("out-of-scope");
      expect(writeCalls(tracker, start)).toEqual([]);
    }
  });
});
