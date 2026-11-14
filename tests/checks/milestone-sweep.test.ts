/**
 * TC-SWEEP-001 / TC-SWEEP-002 — advisory sweep over paged fixtures.
 *
 * The recorded call list proves zero tracker writes; the artifact is the only
 * file output; the page size and read bound are structural; an API failure is
 * loud and leaves no artifact.
 */
import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  type ArtifactWriter,
  type JobSummarySink,
  type MilestoneTrackerPort,
  runEvaluation,
  runSweep,
  SWEEP_PAGE_SIZE,
  type TrackerComment,
  type TrackerIssue,
  type TrackerMilestone,
} from "../../scripts/checks/milestone-attachment-runner";

const ROOT = process.cwd();

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;

/** The GitHub issues endpoint mixes pull requests into the issue list. */
const loadPullRequestEntry = (): TrackerIssue => {
  const parsed: unknown = JSON.parse(
    readFileSync(
      join(
        ROOT,
        "tests/fixtures/milestone-attachment/tracker/issues--pull-request-no-milestone.json",
      ),
      "utf8",
    ),
  );
  const first = Array.isArray(parsed) ? parsed[0] : undefined;
  const entry = asRecord(first);
  if (
    entry === undefined ||
    typeof entry.number !== "number" ||
    (entry.state !== "open" && entry.state !== "closed")
  ) {
    throw new Error("invalid pull-request fixture");
  }
  const labels = Array.isArray(entry.labels)
    ? entry.labels
        .map((label) => asRecord(label)?.name)
        .filter((name): name is string => typeof name === "string")
    : [];
  return {
    number: entry.number,
    state: entry.state,
    labels,
    milestone: null,
    ...(Object.hasOwn(entry, "pull_request") ? { pullRequest: true } : {}),
  };
};

const loadPage = (prefix: string, page: number): readonly TrackerIssue[] => {
  const parsed: unknown = JSON.parse(
    readFileSync(
      join(ROOT, `tests/fixtures/milestone-attachment/sweep/${prefix}-page-${page}.json`),
      "utf8",
    ),
  );
  if (!Array.isArray(parsed)) throw new Error("invalid sweep fixture");
  return parsed as readonly TrackerIssue[];
};

class PagedFakeTracker implements MilestoneTrackerPort {
  readonly calls: Array<{ readonly page: number; readonly perPage: number }> = [];
  readonly writeCalls: string[] = [];
  failRead = false;

  constructor(private readonly pages: readonly (readonly TrackerIssue[])[]) {}

  async readIssue(): Promise<TrackerIssue> {
    throw new Error("readIssue is not part of the sweep");
  }

  async listComments(): Promise<readonly TrackerComment[]> {
    return [];
  }

  async listMilestones(): Promise<readonly TrackerMilestone[]> {
    return [];
  }

  async listIssues(page: number, perPage: number): Promise<readonly TrackerIssue[]> {
    this.calls.push({ page, perPage });
    if (this.failRead) throw new Error("tracker unavailable");
    return this.pages[page - 1] ?? [];
  }

  async addLabel(issueNumber: number, label: string): Promise<void> {
    this.writeCalls.push(`addLabel:${issueNumber}:${label}`);
  }

  async removeLabel(issueNumber: number, label: string): Promise<void> {
    this.writeCalls.push(`removeLabel:${issueNumber}:${label}`);
  }

  async createComment(issueNumber: number): Promise<void> {
    this.writeCalls.push(`createComment:${issueNumber}`);
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

const fileWriter = (): ArtifactWriter & { readonly writes: string[] } => {
  const writes: string[] = [];
  return {
    writes,
    write: (path, contents) => {
      writes.push(path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, contents);
    },
  };
};

const tempOutputDir = (): string => {
  const base = join(ROOT, "tmp/tmpdir");
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, "milestone-sweep-"));
};

const expectedPopulation = (
  issues: readonly TrackerIssue[],
): {
  readonly inspected: number;
  readonly exempt: number;
  readonly unattached: readonly number[];
} => {
  const openChange = issues.filter(
    (issue) => issue.state === "open" && issue.labels.includes("change"),
  );
  const exempt = openChange.filter((issue) => issue.labels.includes("backlog-capture"));
  const unattached = openChange.filter(
    (issue) =>
      !issue.labels.includes("backlog-capture") &&
      !(issue.milestone !== null && issue.milestone.length > 0),
  );
  return {
    inspected: issues.length,
    exempt: exempt.length,
    unattached: unattached.map((i) => i.number),
  };
};

describe("TC-SWEEP-001 advisory sweep contract", () => {
  test("reports the unattached population with zero tracker writes and one artifact", async () => {
    const pages = [1, 2, 3].map((page) => loadPage("issues-n250", page));
    const issues = pages.flat();
    const tracker = new PagedFakeTracker(pages);
    const summary = summarySink();
    const directory = tempOutputDir();
    const artifactPath = join(directory, "milestone-attachment-sweep.json");
    try {
      const result = await runSweep({
        tracker,
        summary,
        writer: fileWriter(),
        artifactPath,
      });
      expect(result.artifact.unattachedCount).toBeGreaterThan(0);
      expect(tracker.writeCalls).toEqual([]);
      const files = readdirSync(directory);
      expect(files).toEqual(["milestone-attachment-sweep.json"]);
      const artifact: unknown = JSON.parse(readFileSync(artifactPath, "utf8"));
      expect(typeof artifact).toBe("object");
      const expected = expectedPopulation(issues);
      const record = artifact as Record<string, unknown>;
      expect(record.totalInspected).toBe(expected.inspected);
      expect(record.exemptedCount).toBe(expected.exempt);
      expect(record.unattachedCount).toBe(expected.unattached.length);
      expect(record.unattachedIssueNumbers).toEqual(expected.unattached);
      expect(record.trackerWrites).toBe(0);
      expect(String(record.note)).toMatch(/No tracker write occurred/i);
      expect(String(record.note)).toContain("local artifact");
      expect(record.artifactPath).toBe(artifactPath);
      expect(summary.lines[0]).toMatch(/tracker writes: 0/);
      expect(summary.lines[0]).toContain("exempted");
      expect(summary.lines[0]).toContain("unattached");
      const serialized = JSON.stringify(record);
      expect(serialized).not.toContain("Issue 1 title");
      expect(serialized).not.toContain("Issue 1 body");
      expect(serialized).not.toContain("author-1");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("closed, non-change, milestoned, and exempt issues are excluded correctly", async () => {
    const issues = [1, 2, 3].flatMap((page) => loadPage("issues-n250", page));
    const tracker = new PagedFakeTracker([issues]);
    const summary = summarySink();
    const directory = tempOutputDir();
    try {
      const artifactPath = join(directory, "artifact.json");
      const result = await runSweep({ tracker, summary, writer: fileWriter(), artifactPath });
      const expected = expectedPopulation(issues);
      const exemptNumbers = issues
        .filter((issue) => issue.state === "open" && issue.labels.includes("backlog-capture"))
        .map((issue) => issue.number);
      const milestonedOpen = issues
        .filter((issue) => issue.state === "open" && issue.milestone !== null)
        .map((issue) => issue.number);
      for (const number of exemptNumbers) {
        expect(result.artifact.unattachedIssueNumbers).not.toContain(number);
      }
      for (const number of milestonedOpen) {
        expect(result.artifact.unattachedIssueNumbers).not.toContain(number);
      }
      expect(result.artifact.exemptedCount).toBe(expected.exempt);
      expect(result.artifact.unattachedCount).toBe(expected.unattached.length);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("an API error fails loud and writes no artifact", async () => {
    const tracker = new PagedFakeTracker([loadPage("issues-n250", 1)]);
    tracker.failRead = true;
    const directory = tempOutputDir();
    try {
      const artifactPath = join(directory, "artifact.json");
      await expect(
        runSweep({ tracker, summary: summarySink(), writer: fileWriter(), artifactPath }),
      ).rejects.toThrow("tracker unavailable");
      expect(existsSync(artifactPath)).toBe(false);
      expect(readdirSync(directory)).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("TC-SWEEP-002 sweep bounds", () => {
  test("N=250 uses page size 100 and at most ceil(N/100)+3 reads", async () => {
    const pages = [1, 2, 3].map((page) => loadPage("issues-n250", page));
    const tracker = new PagedFakeTracker(pages);
    const directory = tempOutputDir();
    try {
      await runSweep({
        tracker,
        summary: summarySink(),
        writer: fileWriter(),
        artifactPath: join(directory, "artifact.json"),
      });
      expect(tracker.calls.every((call) => call.perPage === SWEEP_PAGE_SIZE)).toBe(true);
      expect(tracker.calls.length).toBeLessThanOrEqual(6);
      expect(new Set(tracker.calls.map((call) => call.page)).size).toBe(tracker.calls.length);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("N=500 uses the same page size and at most ceil(N/100)+3 reads", async () => {
    const pages = [1, 2, 3, 4, 5].map((page) => loadPage("issues-n500", page));
    const tracker = new PagedFakeTracker(pages);
    const directory = tempOutputDir();
    try {
      await runSweep({
        tracker,
        summary: summarySink(),
        writer: fileWriter(),
        artifactPath: join(directory, "artifact.json"),
      });
      expect(tracker.calls.every((call) => call.perPage === 100)).toBe(true);
      expect(tracker.calls.length).toBeLessThanOrEqual(8);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("the read bound is independent of the finding count", async () => {
    const clean = Array.from({ length: 500 }, (_, index) => ({
      number: 1000 + index,
      state: "open" as const,
      labels: ["change"],
      milestone: "M2: Ceremonies, measurement, and memory",
    }));
    const pages = [0, 1, 2, 3, 4].map((page) => clean.slice(page * 100, (page + 1) * 100));
    const tracker = new PagedFakeTracker(pages);
    const directory = tempOutputDir();
    try {
      const result = await runSweep({
        tracker,
        summary: summarySink(),
        writer: fileWriter(),
        artifactPath: join(directory, "artifact.json"),
      });
      expect(result.artifact.unattachedCount).toBe(0);
      expect(result.artifact.exemptedCount).toBe(0);
      expect(tracker.calls.length).toBeLessThanOrEqual(8);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("pull-request entries are excluded", () => {
  test("a pull request returned by the issues endpoint is not a sweep candidate", async () => {
    const pullRequest = loadPullRequestEntry();
    expect(pullRequest.pullRequest).toBe(true);
    expect(pullRequest.milestone).toBeNull();
    const normal: TrackerIssue = {
      number: 5001,
      state: "open",
      labels: ["change"],
      milestone: null,
    };
    const tracker = new PagedFakeTracker([[pullRequest, normal]]);
    const directory = tempOutputDir();
    try {
      const result = await runSweep({
        tracker,
        summary: summarySink(),
        writer: fileWriter(),
        artifactPath: join(directory, "artifact.json"),
      });
      expect(result.artifact.totalInspected).toBe(1);
      expect(result.artifact.openChangeCount).toBe(1);
      expect(result.artifact.unattachedCount).toBe(1);
      expect(result.artifact.unattachedIssueNumbers).toEqual([5001]);
      expect(tracker.writeCalls).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("a pull-request entry is out of scope for evaluation and writes nothing", async () => {
    const pullRequest = loadPullRequestEntry();
    const writes: string[] = [];
    const tracker: MilestoneTrackerPort = {
      readIssue: async () => pullRequest,
      listComments: async () => [],
      listMilestones: async () => [],
      listIssues: async () => [],
      addLabel: async (issueNumber, label) => {
        writes.push(`addLabel:${issueNumber}:${label}`);
      },
      removeLabel: async (issueNumber, label) => {
        writes.push(`removeLabel:${issueNumber}:${label}`);
      },
      createComment: async (issueNumber) => {
        writes.push(`createComment:${issueNumber}`);
      },
    };
    const result = await runEvaluation({
      action: "opened",
      issueNumber: pullRequest.number,
      tracker,
      summary: summarySink(),
    });
    expect(result.verdict).toBe("out-of-scope");
    expect(result.writes).toEqual([]);
    expect(writes).toEqual([]);
  });
});
