/**
 * The sole network-capable milestone-attachment adapter (GH-313 F-3, NFR-3).
 *
 * This module reads issues, labels, comments, and milestones and performs only
 * the writes the core names. It is used by the issue-event workflow and by the
 * operator-run read-only sweep. Nothing reachable from `pnpm check` imports it.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { FLAG_LABEL, MILESTONE_ACTIONS, type MilestoneAction } from "./milestone-attachment";
import {
  type ArtifactWriter,
  type JobSummarySink,
  type MilestoneTrackerPort,
  runEvaluation,
  runSweep,
  SWEEP_ARTIFACT_PATH,
  type TrackerComment,
  type TrackerIssue,
  type TrackerMilestone,
} from "./milestone-attachment-runner";

type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject | undefined =>
  typeof value === "object" && value !== null ? (value as JsonObject) : undefined;

const asArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const parseLabelNames = (value: unknown): readonly string[] =>
  asArray(value)
    .map((entry) => asString(entry) ?? asString(asObject(entry)?.name))
    .filter((name): name is string => name !== undefined);

const parseMilestoneTitle = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  return asString(asObject(value)?.title) ?? null;
};

const parseIssue = (value: unknown): TrackerIssue => {
  const issue = asObject(value);
  const number = asNumber(issue?.number);
  const state = asString(issue?.state);
  if (number === undefined || (state !== "open" && state !== "closed")) {
    throw new Error("GitHub issue payload is missing number or state");
  }
  return {
    number,
    state,
    labels: parseLabelNames(issue?.labels),
    milestone: parseMilestoneTitle(issue?.milestone),
    ...(asString(issue?.title) === undefined ? {} : { title: asString(issue?.title) }),
    ...(asString(issue?.body) === undefined ? {} : { body: asString(issue?.body) }),
    ...(asString(asObject(issue?.user)?.login) === undefined
      ? {}
      : { author: asString(asObject(issue?.user)?.login) }),
  };
};

const parseComment = (value: unknown): TrackerComment => {
  const comment = asObject(value);
  const id = asNumber(comment?.id);
  const body = asString(comment?.body) ?? "";
  if (id === undefined) throw new Error("GitHub comment payload is missing id");
  return { id, body };
};

const parseMilestone = (value: unknown): TrackerMilestone => {
  const milestone = asObject(value);
  const number = asNumber(milestone?.number);
  const title = asString(milestone?.title);
  const state = asString(milestone?.state);
  if (number === undefined || title === undefined || (state !== "open" && state !== "closed")) {
    throw new Error("GitHub milestone payload is missing number, title, or state");
  }
  return { number, title, state };
};

export type GithubAdapterOptions = {
  readonly token: string;
  readonly repository: string;
  readonly apiBase?: string;
};

export const createGithubTracker = (options: GithubAdapterOptions): MilestoneTrackerPort => {
  const apiBase = options.apiBase ?? process.env.GITHUB_API_URL ?? "https://api.github.com";
  const headers = {
    Authorization: `Bearer ${options.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "delivery-os-milestone-check",
  };

  const request = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const response = await fetch(`${apiBase}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      throw new Error(`GitHub API ${method} ${path} failed with status ${response.status}`);
    }
    if (response.status === 204) return undefined;
    const parsed: unknown = await response.json();
    return parsed;
  };

  const issuePath = (issueNumber: number): string =>
    `/repos/${options.repository}/issues/${issueNumber}`;

  return {
    readIssue: async (issueNumber) => {
      const raw = await request("GET", issuePath(issueNumber));
      return parseIssue(raw);
    },
    listComments: async (issueNumber) => {
      const comments: TrackerComment[] = [];
      for (let page = 1; ; page += 1) {
        const raw = await request(
          "GET",
          `${issuePath(issueNumber)}/comments?per_page=100&page=${page}`,
        );
        const batch = asArray(raw).map(parseComment);
        comments.push(...batch);
        if (batch.length < 100) break;
      }
      return comments;
    },
    listMilestones: async () => {
      const raw = await request(
        "GET",
        `/repos/${options.repository}/milestones?state=all&per_page=100`,
      );
      return asArray(raw).map(parseMilestone);
    },
    listIssues: async (page, perPage) => {
      const raw = await request(
        "GET",
        `/repos/${options.repository}/issues?state=all&labels=change&sort=created&direction=asc&per_page=${perPage}&page=${page}`,
      );
      return asArray(raw).map(parseIssue);
    },
    addLabel: async (issueNumber, label) => {
      await request("POST", `${issuePath(issueNumber)}/labels`, { labels: [label] });
    },
    removeLabel: async (issueNumber, label) => {
      await request("DELETE", `${issuePath(issueNumber)}/labels/${encodeURIComponent(label)}`);
    },
    createComment: async (issueNumber, body) => {
      await request("POST", `${issuePath(issueNumber)}/comments`, { body });
    },
  };
};

export const createGithubSummarySink = (path: string): JobSummarySink => ({
  append: (text) => {
    appendFileSync(path, `${text}\n`);
  },
});

export const createGithubArtifactWriter = (): ArtifactWriter => ({
  write: (path, contents) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  },
});

type EventInput = {
  readonly action: MilestoneAction;
  readonly issueNumber: number;
};

const parseEvent = (value: unknown): EventInput => {
  const event = asObject(value);
  const action = asString(event?.action);
  const issueNumber = asNumber(asObject(event?.issue)?.number);
  if (
    action === undefined ||
    issueNumber === undefined ||
    !(MILESTONE_ACTIONS as readonly string[]).includes(action)
  ) {
    throw new Error("issue event is missing a contract action or issue number");
  }
  return { action: action as MilestoneAction, issueNumber };
};

type CliOptions = {
  readonly mode: "evaluate" | "sweep";
  readonly eventPath: string | undefined;
  readonly summaryPath: string | undefined;
  readonly outputPath: string;
};

const parseCli = (argv: readonly string[]): CliOptions => {
  const mode = argv[0];
  if (mode !== "evaluate" && mode !== "sweep") {
    throw new Error(
      "usage: milestone-attachment-github.ts evaluate|sweep [--event path] [--summary path] [--output path]",
    );
  }
  const flag = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    mode,
    eventPath: flag("--event") ?? process.env.GITHUB_EVENT_PATH,
    summaryPath: flag("--summary") ?? process.env.GITHUB_STEP_SUMMARY,
    outputPath: flag("--output") ?? SWEEP_ARTIFACT_PATH,
  };
};

const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`${name} is not set`);
  return value;
};

const main = async (): Promise<number> => {
  const cli = parseCli(process.argv.slice(2));
  if (cli.summaryPath === undefined)
    throw new Error("GITHUB_STEP_SUMMARY or --summary is required");
  const credential = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (credential === undefined || credential.length === 0) {
    throw new Error("GITHUB_TOKEN is not set");
  }
  const tracker = createGithubTracker({
    token: credential,
    repository: required("GITHUB_REPOSITORY"),
  });
  const summary = createGithubSummarySink(cli.summaryPath);

  if (cli.mode === "sweep") {
    const result = await runSweep({
      tracker,
      summary,
      writer: createGithubArtifactWriter(),
      artifactPath: cli.outputPath,
    });
    process.stdout.write(`${result.jobSummary}\n`);
    return 0;
  }

  if (cli.eventPath === undefined) throw new Error("GITHUB_EVENT_PATH or --event is required");
  const rawEvent: unknown = JSON.parse(readFileSync(cli.eventPath, "utf8"));
  const event = parseEvent(rawEvent);
  const result = await runEvaluation({
    action: event.action,
    issueNumber: event.issueNumber,
    tracker,
    summary,
  });
  process.stdout.write(`${result.jobSummary}\n`);
  return 0;
};

if (import.meta.main) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`milestone-attachment-github: ${message}`);
      process.exitCode = 1;
    });
}

export { FLAG_LABEL };
