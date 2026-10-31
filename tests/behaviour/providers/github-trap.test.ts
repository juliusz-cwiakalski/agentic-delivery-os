/**
 * TC-GITHUB-001..003 — the GitHub read slice traps replayed offline.
 *
 * The mutation controls corrupt the normalized views (flatten review state, drop
 * a failed check run, swap the assignee) and must fail naming their trap entry.
 */
import { describe, expect, test } from "bun:test";
import { createEnvironmentCredentialPort } from "../../../packages/adapters/src/credentials/index";
import {
  createGitHubClient,
  type GithubClient,
} from "../../../packages/adapters/src/github/client";
import { GITHUB_UNKNOWN_REVIEW_DECISION_FALLBACK } from "../../../packages/adapters/src/github/review-state";
import type {
  DeliveryRequest,
  ExternalSystemInstance,
  PipelineRun,
  WorkItem,
} from "../../../packages/core/src/contracts/index";
import { fixtureBrand } from "../../fixtures/credentials/cases";
import {
  arrayField,
  createFixtureTransport,
  type FixtureRoute,
  installThrowingFetchGuard,
  isRecord,
  readJson,
  recordField,
  requireValue,
} from "./support";
import {
  runTrapCatalog,
  type TrapAssertions,
  type TrapRun,
  type TrapRunOptions,
} from "./trap-harness";

const FIXTURES = "tests/fixtures/providers/github";
const TRAPS = "tests/fixtures/providers/traps";
const PRS = `${FIXTURES}/pr-review-states.json`;
const CHECK_RUNS = `${FIXTURES}/check-runs-per-sha.json`;
const ISSUES = `${FIXTURES}/issues.json`;
const MIXED_LIST = `${FIXTURES}/issues-list-mixed.json`;
const LIMIT_LIST = `${FIXTURES}/issues-list-limit.json`;
const RELATIONS_ABSENT = `${FIXTURES}/issues-list-relations-absent.json`;
const PULLS_LIST = `${FIXTURES}/pulls-list-review-default.json`;
const SHA_A = "1111111111111111111111111111111111111111";
const SHA_B = "2222222222222222222222222222222222222222";

const instance: ExternalSystemInstance = {
  instanceName: "vcs-github",
  systemKind: "vcs",
  baseUrl: "https://api.github.example.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: {
      referenceName: "github-read",
      sourceKey: { style: "literal", name: "FIXTURE_GITHUB_TOKEN" },
    },
  },
};

const credentials = createEnvironmentCredentialPort({
  environment: { FIXTURE_GITHUB_TOKEN: "canary-github-read-token" },
  brand: fixtureBrand,
});

const repository = { owner: "group-placeholder", name: "project-placeholder" } as const;
const repoPath = `/repos/${repository.owner}/${repository.name}`;

const pullUrl = (number: number): string =>
  `${instance.baseUrl}${repoPath}/pulls/${encodeURIComponent(String(number))}`;
const checkRunsUrl = (sha: string): string =>
  `${instance.baseUrl}${repoPath}/commits/${encodeURIComponent(sha)}/check-runs?per_page=20`;
const issueUrl = (number: number): string =>
  `${instance.baseUrl}${repoPath}/issues/${encodeURIComponent(String(number))}`;
const issuesListUrl = (limit: number): string =>
  `${instance.baseUrl}${repoPath}/issues?state=open&per_page=${encodeURIComponent(String(limit))}&sort=updated&direction=desc`;
const pullsListUrl = (limit: number): string =>
  `${instance.baseUrl}${repoPath}/pulls?state=open&per_page=${encodeURIComponent(String(limit))}&sort=updated&direction=desc`;

const clientFor = (routes: readonly FixtureRoute[]): GithubClient =>
  createGitHubClient({
    instance,
    credentials,
    repository,
    transport: createFixtureTransport(routes),
  });

const pulls = arrayField(readJson(PRS), "pulls");
const shaSections = recordField(readJson(CHECK_RUNS), "shas");
const issues = arrayField(readJson(ISSUES), "issues");

const pullByNumber = (number: number): unknown => {
  const pull = pulls.find((candidate) => {
    const value = isRecord(candidate) ? candidate.number : undefined;
    return value === number;
  });
  if (pull === undefined) throw new Error(`pull ${number} is missing`);
  return pull;
};

const issueByNumber = (number: number): unknown => {
  const issue = issues.find((candidate) => {
    const value = isRecord(candidate) ? candidate.number : undefined;
    return value === number;
  });
  if (issue === undefined) throw new Error(`issue ${number} is missing`);
  return issue;
};

// --- TC-GITHUB-001: review-state mapping ------------------------------------

const EXPECTED_REVIEW_STATES: Readonly<Record<number, DeliveryRequest["reviewState"]>> = {
  501: "draft",
  502: "open",
  503: "changes-requested",
  504: "approved",
  505: "merged",
  506: "closed",
  507: "closed",
};

const defaultPullReader = async (number: number): Promise<DeliveryRequest> => {
  const client = clientFor([{ url: pullUrl(number), body: pullByNumber(number) }]);
  return requireValue(await client.readDeliveryRequest(number), `pull ${number}`);
};

const reviewStateCheck = async (
  read: (number: number) => Promise<DeliveryRequest>,
): Promise<void> => {
  for (const [rawNumber, expected] of Object.entries(EXPECTED_REVIEW_STATES)) {
    const number = Number(rawNumber);
    const view = await read(number);
    expect(view.identity).toEqual({ systemName: instance.instanceName, entityId: String(number) });
    expect(view.reviewState, `pull ${number}`).toBe(expected);
    if (expected === "merged" || expected === "closed") {
      expect(view.reviewState).not.toBe("open");
    }
  }
  const approved = await read(504);
  expect(approved.threads).toEqual([
    { threadId: "PRRT_1", resolved: true, commentCount: 2 },
    { threadId: "PRRT_2", resolved: false, commentCount: 1 },
  ]);
  expect(approved.sourceRef).toBe("feat/GH-188/client-seeds-trap-catalogs");
  const serialized = JSON.stringify(approved);
  for (const native of ["reviewDecision", "head", "base", "sha"]) {
    expect(serialized).not.toContain(native);
  }
};

const flattenReviewStates = async (number: number): Promise<DeliveryRequest> => ({
  ...(await defaultPullReader(number)),
  reviewState: "open",
});

const unknownDecisionPull = (number: number, state: "open" | "closed"): unknown => ({
  number,
  title: "Unrecognized review decision",
  state,
  draft: false,
  merged: false,
  reviewDecision: "SOLICITED_REVIEW",
  head: { ref: `feat/GH-${number}/unknown`, sha: SHA_A },
  base: { ref: "main-tools" },
  review_threads: [],
});

const unknownReviewDecisionCheck = async (): Promise<void> => {
  expect(GITHUB_UNKNOWN_REVIEW_DECISION_FALLBACK).toBe("open");
  const client = clientFor([
    { url: pullUrl(508), body: unknownDecisionPull(508, "open") },
    { url: pullUrl(509), body: unknownDecisionPull(509, "closed") },
  ]);
  const unknown = requireValue(await client.readDeliveryRequest(508), "unknown review decision");
  expect(unknown.reviewState).toBe(GITHUB_UNKNOWN_REVIEW_DECISION_FALLBACK);
  const closed = requireValue(await client.readDeliveryRequest(509), "closed unknown decision");
  expect(closed.reviewState).toBe("closed");
};

// --- TC-GITHUB-002: check runs per SHA --------------------------------------

const checkRunsBody = (sha: string): unknown => recordField(shaSections, sha);

type CheckRunRead = {
  readonly items: readonly PipelineRun[];
  readonly pageItemCount: number;
};

const defaultCheckRunReader = async (sha: string): Promise<CheckRunRead> => {
  const client = clientFor([{ url: checkRunsUrl(sha), body: checkRunsBody(sha) }]);
  const result = requireValue(await client.readPipelineRun(sha), `check runs ${sha}`);
  return { items: result.items, pageItemCount: result.pageItemCount };
};

const JOB_STATES: readonly string[] = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
  "skipped",
];

const checkRunSet = (
  runs: readonly PipelineRun[],
): {
  readonly identities: string[];
  readonly jobStates: string[];
  readonly everyRunHasOneJob: boolean;
} => ({
  identities: runs.map((run) => run.identity.entityId).sort(),
  jobStates: runs.flatMap((run) => run.jobs.map((job) => job.jobState)),
  everyRunHasOneJob: runs.every((run) => run.jobs.length === 1),
});

const checkRunsCheck = async (read: (sha: string) => Promise<CheckRunRead>): Promise<void> => {
  const readA = await read(SHA_A);
  expect(readA.pageItemCount).toBe(4);
  const runsA = readA.items;
  expect(runsA).toHaveLength(4);
  const setA = checkRunSet(runsA);
  expect(setA.everyRunHasOneJob).toBe(true);
  for (const state of setA.jobStates) expect(JOB_STATES).toContain(state);
  // The green check-suite roll-up must not hide the failed run.
  expect(setA.jobStates).toContain("failed");
  expect(setA.jobStates).toContain("queued");
  expect(setA.jobStates).toContain("skipped");
  for (const run of runsA) {
    if (run.identity.entityId.endsWith(":9001") || run.identity.entityId.endsWith(":9002")) {
      expect(run.traceEvidence.length).toBe(1);
      expect(run.traceEvidence[0]?.location).toContain("https://api.github.example.com");
    }
  }
  const readB = await read(SHA_B);
  expect(readB.pageItemCount).toBe(1);
  const runsB = readB.items;
  const setB = checkRunSet(runsB);
  expect(setB.identities.filter((identity) => setA.identities.includes(identity))).toEqual([]);
  expect(setB.jobStates).toEqual(["succeeded"]);
};

const dropFailedCheckRun = async (sha: string): Promise<CheckRunRead> => {
  const body = checkRunsBody(sha);
  const checkRuns = arrayField(body, "check_runs").filter(
    (candidate) => !(isRecord(candidate) && candidate.name === "test"),
  );
  const client = clientFor([{ url: checkRunsUrl(sha), body: { check_runs: checkRuns } }]);
  const result = requireValue(await client.readPipelineRun(sha), "dropped-failure control");
  return { items: result.items, pageItemCount: result.pageItemCount };
};

// --- TC-GITHUB-003: issue to WorkItem ---------------------------------------

const defaultIssueReader = async (number: number): Promise<WorkItem> => {
  const client = clientFor([{ url: issueUrl(number), body: issueByNumber(number) }]);
  return requireValue(await client.readWorkItem(number), `issue ${number}`);
};

const issueCheck = async (read: (number: number) => Promise<WorkItem>): Promise<void> => {
  const primary = await read(601);
  expect(primary.identity).toEqual({ systemName: instance.instanceName, entityId: "601" });
  expect(primary.status).toEqual({ nativeStatus: "open", deliveryState: "ready" });
  expect(primary.labels).toEqual(["tracker", "hand-back"]);
  expect(primary.assignee).toBe("owner-placeholder");
  expect(primary.updatedAt).toBe("2026-10-29T08:00:00Z");
  expect(Number.isFinite(Date.parse(primary.updatedAt ?? ""))).toBe(true);
  expect(primary.relations).toEqual([
    { relationKind: "blocks", target: { systemName: instance.instanceName, entityId: "602" } },
  ]);

  const closed = await read(602);
  expect(closed.status).toEqual({ nativeStatus: "closed", deliveryState: "done" });
  expect(closed.assignee).toBeUndefined();
  expect(closed.updatedAt).toBeUndefined();
  expect(closed.labels).toEqual([]);
  expect(closed.relations).toEqual([]);

  const blocked = await read(603);
  expect(blocked.relations).toEqual([
    { relationKind: "blocked-by", target: { systemName: instance.instanceName, entityId: "601" } },
  ]);

  const serialized = JSON.stringify(primary);
  for (const native of ["issue_links", "updated_at", "login"]) {
    expect(serialized).not.toContain(native);
  }
};

const swapAssignee = async (number: number): Promise<WorkItem> => ({
  ...(await defaultIssueReader(number)),
  assignee: number === 601 ? "reviewer-placeholder" : "owner-placeholder",
});

// --- TC-STATUS-021 read side: bounded collection reads -----------------------

const mixedListBody = readJson(MIXED_LIST);
const limitListBody = readJson(LIMIT_LIST);
const relationsAbsentBody = readJson(RELATIONS_ABSENT);
const pullsListBody = readJson(PULLS_LIST);

const listWorkItemsCheck = async (): Promise<void> => {
  const transport = createFixtureTransport([{ url: issuesListUrl(100), body: mixedListBody }]);
  const client = createGitHubClient({ instance, credentials, repository, transport });
  const result = requireValue(await client.listWorkItems(100), "mixed issue list");
  expect(transport.requests).toHaveLength(1);
  expect(transport.requests[0]?.url).toBe(issuesListUrl(100));
  expect(transport.requests[0]?.url).toContain("state=open");
  expect(transport.requests[0]?.url).toContain("per_page=100");
  expect(transport.requests[0]?.url).toContain("sort=updated");
  expect(result.pageItemCount).toBe(5);
  expect(result.items.map((item) => item.identity.entityId)).toEqual(["610", "612", "614"]);
  expect(JSON.stringify(result)).not.toContain("pull_request");
};

const listPageLimitCheck = async (): Promise<void> => {
  const transport = createFixtureTransport([{ url: issuesListUrl(100), body: limitListBody }]);
  const client = createGitHubClient({ instance, credentials, repository, transport });
  const result = requireValue(await client.listWorkItems(100), "at-limit issue list");
  expect(transport.requests).toHaveLength(1);
  expect(result.items).toHaveLength(100);
  expect(result.pageItemCount).toBe(100);
};

const issueRelationsAbsentCheck = async (): Promise<void> => {
  const transport = createFixtureTransport([
    { url: issuesListUrl(100), body: relationsAbsentBody },
  ]);
  const client = createGitHubClient({ instance, credentials, repository, transport });
  const result = requireValue(await client.listWorkItems(100), "relations-absent list");
  expect(result.items).toHaveLength(2);
  for (const item of result.items) expect(item.relations).toEqual([]);
  expect(JSON.stringify(result)).not.toContain("issue_links");
};

const prListReviewDefaultCheck = async (): Promise<void> => {
  const transport = createFixtureTransport([{ url: pullsListUrl(100), body: pullsListBody }]);
  const client = createGitHubClient({ instance, credentials, repository, transport });
  const result = requireValue(await client.listDeliveryRequests(100), "pull list");
  expect(transport.requests).toHaveLength(1);
  expect(result.pageItemCount).toBe(2);
  expect(result.items.map((item) => item.identity.entityId)).toEqual(["701", "702"]);
  expect(result.items.map((item) => item.sourceRef)).toEqual([
    "feat/GH-701/list",
    "feat/GH-702/list",
  ]);
  const raw = JSON.stringify(pullsListBody);
  expect(raw).not.toContain("reviewDecision");
  expect(raw).not.toContain("review_threads");
  for (const item of result.items) expect(item.threads).toEqual([]);
};

const mutatedListWorkItems = async (limit: number): Promise<void> => {
  const transport = createFixtureTransport([{ url: issuesListUrl(limit), body: mixedListBody }]);
  const client = createGitHubClient({ instance, credentials, repository, transport });
  const result = requireValue(await client.listWorkItems(limit), "mutated issue list");
  expect(transport.requests[0]?.url).toContain("per_page=100");
  expect(result.items.map((item) => item.identity.entityId)).not.toContain("611");
};

const unfilteredIssueList = async (): Promise<void> => {
  const items = Array.isArray(mixedListBody) ? mixedListBody : [];
  const normalized = items.map((entry) =>
    normalizeGithubIssue(entry, { systemName: instance.instanceName }),
  );
  const ids = normalized.flatMap((entry) => (entry.ok ? [entry.value.identity.entityId] : []));
  expect(ids).not.toContain("611");
};

const relationsPresent = async (): Promise<void> => {
  const items = Array.isArray(relationsAbsentBody) ? relationsAbsentBody : [];
  const normalized = items.map((entry) =>
    normalizeGithubIssue(entry, { systemName: instance.instanceName }),
  );
  for (const entry of normalized) {
    if (entry.ok) expect(entry.value.relations.length).toBeGreaterThan(0);
  }
};

const trustedReviewPayload = async (): Promise<void> => {
  const trusted = normalizePullRequest(
    {
      number: 703,
      state: "open",
      draft: false,
      merged: false,
      reviewDecision: "APPROVED",
      head: { ref: "feat/GH-703/x" },
      base: { ref: "main-tools" },
      review_threads: [],
    },
    { systemName: instance.instanceName },
  );
  expect(JSON.stringify(trusted)).not.toContain("reviewDecision");
};

// --- The catalog ------------------------------------------------------------

const defaultAssertions: TrapAssertions = {
  "GH-REVIEW-STATE": async () => {
    await reviewStateCheck(defaultPullReader);
    await unknownReviewDecisionCheck();
  },
  "GH-CHECK-RUNS-PER-SHA": () => checkRunsCheck(defaultCheckRunReader),
  "GH-ISSUE-TO-WORKITEM": () => issueCheck(defaultIssueReader),
  "GITHUB-LIST-EXCLUDES-PRS": listWorkItemsCheck,
  "GITHUB-LIST-PAGE-LIMIT": listPageLimitCheck,
  "GITHUB-ISSUE-RELATIONS-ABSENT": issueRelationsAbsentCheck,
  "GITHUB-PR-LIST-REVIEW-DEFAULT": prListReviewDefaultCheck,
};

const runWithGuard = async (options: Omit<TrapRunOptions, "provider">): Promise<TrapRun> => {
  const guard = installThrowingFetchGuard();
  try {
    const run = await runTrapCatalog({ ...options, provider: "github" });
    expect(guard.calls).toEqual([]);
    return run;
  } finally {
    guard.restore();
  }
};

describe("TC-TRAP-002 GitHub trap catalog replays offline", () => {
  test("every GitHub trap entry passes", async () => {
    const run = await runWithGuard({ catalogRoot: TRAPS, assertions: defaultAssertions });
    expect(run.failures).toEqual([]);
    expect(run.results.map((result) => result.trapName)).toEqual([
      "GH-REVIEW-STATE",
      "GH-CHECK-RUNS-PER-SHA",
      "GH-ISSUE-TO-WORKITEM",
      "GITHUB-LIST-EXCLUDES-PRS",
      "GITHUB-LIST-PAGE-LIMIT",
      "GITHUB-ISSUE-RELATIONS-ABSENT",
      "GITHUB-PR-LIST-REVIEW-DEFAULT",
    ]);
  });

  test("every PR variant maps to a closed review state", async () => {
    const closed = new Set(["draft", "open", "changes-requested", "approved", "merged", "closed"]);
    for (const number of Object.keys(EXPECTED_REVIEW_STATES)) {
      const view = await defaultPullReader(Number(number));
      expect(closed.has(view.reviewState)).toBe(true);
    }
  });

  test("double replay is identical", async () => {
    const first = await runWithGuard({ catalogRoot: TRAPS, assertions: defaultAssertions });
    const second = await runWithGuard({ catalogRoot: TRAPS, assertions: defaultAssertions });
    expect(second.results).toEqual(first.results);
  });

  test("mutated normalization fails naming the trap entry and fixture", async () => {
    const mutations: Array<{ trapName: string; assertion: () => Promise<void> | void }> = [
      { trapName: "GH-REVIEW-STATE", assertion: () => reviewStateCheck(flattenReviewStates) },
      { trapName: "GH-CHECK-RUNS-PER-SHA", assertion: () => checkRunsCheck(dropFailedCheckRun) },
      { trapName: "GH-ISSUE-TO-WORKITEM", assertion: () => issueCheck(swapAssignee) },
      { trapName: "GITHUB-LIST-EXCLUDES-PRS", assertion: unfilteredIssueList },
      { trapName: "GITHUB-LIST-PAGE-LIMIT", assertion: () => mutatedListWorkItems(99) },
      { trapName: "GITHUB-ISSUE-RELATIONS-ABSENT", assertion: relationsPresent },
      { trapName: "GITHUB-PR-LIST-REVIEW-DEFAULT", assertion: trustedReviewPayload },
    ];
    for (const mutation of mutations) {
      const run = await runWithGuard({
        catalogRoot: TRAPS,
        assertions: { ...defaultAssertions, [mutation.trapName]: mutation.assertion },
      });
      const failure = run.failures.find((message) => message.startsWith(mutation.trapName));
      expect(failure, `${mutation.trapName} mutation must fail`).toBeDefined();
      expect(failure).toContain("tests/fixtures/providers/github/");
    }
  });

  test("an unfixtured path fails loudly", async () => {
    const transport = createFixtureTransport([]);
    const client = createGitHubClient({ instance, credentials, repository, transport });
    const guard = installThrowingFetchGuard();
    try {
      const result = await client.readWorkItem(999);
      expect(result.ok).toBe(false);
      expect(guard.calls).toEqual([]);
      await expect(
        transport.send({ url: issueUrl(999), method: "GET", headers: {} }),
      ).rejects.toThrow(/unfixtured provider request/);
    } finally {
      guard.restore();
    }
  });
});
