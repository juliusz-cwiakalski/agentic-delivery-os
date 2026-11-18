/**
 * TC-GITHUB-001..003 — the GitHub read slice traps replayed offline.
 *
 * The mutation controls corrupt the normalized views (flatten review state, drop
 * a failed check run, swap the assignee) and must fail naming their trap entry.
 */
import { describe, expect, test } from "bun:test";
import { createEnvironmentCredentialPort } from "../../../packages/adapters/src/credentials/index";
import {
  createGithubCliTransport,
  type GithubChildRunner,
} from "../../../packages/adapters/src/github/cli-transport";
import {
  createGitHubClient,
  type GithubClient,
} from "../../../packages/adapters/src/github/client";
import {
  createGitHubLogExcerptReader,
  GITHUB_LOG_EXCERPT_MAX_BYTES,
} from "../../../packages/adapters/src/github/log-excerpt";
import { GITHUB_UNKNOWN_REVIEW_DECISION_FALLBACK } from "../../../packages/adapters/src/github/review-state";
import { GITHUB_WORKFLOW_MAP_SEED } from "../../../packages/adapters/src/github/workflow-map";
import type {
  DeliveryRequest,
  ExternalSystemInstance,
  PipelineRun,
  WorkItem,
} from "../../../packages/core/src/contracts/index";
import { makeGithubClient } from "../../fixtures/closeout/github-client";
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
const PR_GATE_FACTS = `${FIXTURES}/pr-gate-facts.json`;
const CHECKRUN_TRAPS = `${FIXTURES}/checkrun-traps.json`;
const CHECKRUN_PAGE_LIMIT = `${FIXTURES}/checkrun-page-limit.json`;
const ISSUE_COMMENTS_ABSENT = `${FIXTURES}/issue-comments-absent.json`;
const READ_FAILURE_STATUSES = `${FIXTURES}/read-failure-statuses.json`;
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
  const serialized: unknown = JSON.parse(JSON.stringify(approved));
  for (const native of ["reviewDecision", "head", "base", "sha"]) {
    expect(isRecord(serialized) && Object.hasOwn(serialized, native), native).toBe(false);
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

const mixedListBody = arrayField(readJson(MIXED_LIST), "issues");
const limitListBody = arrayField(readJson(LIMIT_LIST), "issues");
const relationsAbsentBody = arrayField(readJson(RELATIONS_ABSENT), "issues");
const pullsListBody = arrayField(readJson(PULLS_LIST), "pulls");

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

const closeoutMergedHead = async (): Promise<void> => {
  const { client } = makeGithubClient();
  const result = await client.findMergedDeliveryRequest({ workItemRef: "GH-183", limit: 20 });
  expect(result.observation).toBe("observed");
  if (result.observation === "observed") {
    expect(result.value.identity.entityId).toBe("504");
    expect(result.value.headSha).toBe("2222222222222222222222222222222222222222");
  }
};

const closeoutLabelPreserve = async (): Promise<void> => {
  const { client, transport } = makeGithubClient();
  const result = await client.writeWorkItem({
    entityId: "183",
    remove: ["planning", "review"],
    add: ["delivered"],
  });
  expect(result.ok).toBe(true);
  const patch = transport.requests.find((request) => request.method === "PATCH");
  const body: unknown = patch?.body === undefined ? undefined : JSON.parse(patch.body);
  const labels = isRecord(body) && Array.isArray(body.labels) ? body.labels : [];
  expect(labels).toContain("vendor-label");
  expect(labels).not.toContain("planning");
  expect(labels).toContain("delivered");
};

const closeoutThreadGraphql = async (): Promise<void> => {
  const { client, transport } = makeGithubClient();
  const result = await client.resolveDeliveryThread({
    deliveryRequest: { systemName: "github", entityId: "504" },
    threadId: "PRRT_2",
  });
  expect(result.ok).toBe(true);
  expect(
    transport.requests.some(
      (request) => request.method === "POST" && request.url.endsWith("/graphql"),
    ),
  ).toBe(true);
};

const gatePullPayload = (key: string): Record<string, unknown> =>
  recordField(recordField(readJson(PR_GATE_FACTS), "pulls"), key);

const readGatePull = async (key: string): Promise<DeliveryRequest> => {
  const payload = gatePullPayload(key);
  const number = payload.number;
  if (typeof number !== "number") throw new Error(`${key} has no number`);
  const client = clientFor([{ url: pullUrl(number), body: payload }]);
  return requireValue(await client.readDeliveryRequest(number), key);
};

const checkRunTrapPayload = (key: string): unknown => recordField(readJson(CHECKRUN_TRAPS), key);

const checkRunTrapCheck = async (key: string): Promise<void> => {
  const client = clientFor([{ url: checkRunsUrl(SHA_A), body: checkRunTrapPayload(key) }]);
  const result = requireValue(await client.readPipelineRun(SHA_A), key);
  const expected = key === "allSkipped" ? 2 : 0;
  expect(result.pageItemCount).toBe(expected);
  expect(result.items).toHaveLength(expected);
  if (key === "allSkipped") {
    expect(result.items.flatMap((run) => run.jobs).every((job) => job.jobState === "skipped")).toBe(
      true,
    );
  }
};

const pageLimitCheck = async (): Promise<void> => {
  const body = readJson(CHECKRUN_PAGE_LIMIT);
  const client = clientFor([
    {
      url: `${instance.baseUrl}${repoPath}/commits/${encodeURIComponent(SHA_A)}/check-runs?per_page=100`,
      body,
    },
  ]);
  const result = requireValue(await client.readPipelineRun(SHA_A, 100), "page-limit");
  expect(result.pageItemCount).toBe(100);
  expect(result.items).toHaveLength(100);
};

const issueCommentsAbsentCheck = async (): Promise<void> => {
  const body = recordField(readJson(ISSUE_COMMENTS_ABSENT), "issue");
  const client = clientFor([{ url: issueUrl(601), body }]);
  const item = requireValue(await client.readWorkItem(601), "issue-comments-absent");
  expect(item.labels).toEqual(["change"]);
  expect(item.comments).toBeUndefined();
};

const absenceCheck = async (
  read: (client: GithubClient) => Promise<{ readonly ok: boolean }>,
): Promise<void> => {
  const client = clientFor([
    { url: pullUrl(178), body: {}, status: 404 },
    { url: pullsListUrl(100), body: {}, status: 404 },
    { url: issueUrl(178), body: {}, status: 404 },
    { url: checkRunsUrl(SHA_A), body: {}, status: 404 },
  ]);
  const result = await read(client);
  expect(result.ok).toBe(false);
  if (!result.ok) expect((result as { code?: string }).code).toBe("provider.not-found");
};

const httpStatusTrapCheck = async (): Promise<void> => {
  const shapes = recordField(readJson(READ_FAILURE_STATUSES), "responses");
  for (const [key, expectedStatus] of [
    ["401", 401],
    ["403", 403],
    ["500", 500],
    ["503", 503],
  ] as const) {
    const shape = recordField(shapes, key);
    const client = clientFor([{ url: issueUrl(178), body: {}, status: expectedStatus }]);
    const result = await client.readWorkItem(178);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider.payload.invalid");
      expect((result as { readonly httpStatus?: number }).httpStatus).toBe(expectedStatus);
      expect(JSON.stringify(result)).not.toContain(String(shape.prose ?? ""));
    }
  }
  const notFound = await clientFor([{ url: issueUrl(178), body: {}, status: 404 }]).readWorkItem(
    178,
  );
  expect(notFound.ok).toBe(false);
  if (!notFound.ok) {
    expect(notFound.code).toBe("provider.not-found");
    expect((notFound as { readonly httpStatus?: number }).httpStatus).toBe(404);
  }
  const transport = createFixtureTransport([]);
  const throwing = createGitHubClient({
    instance,
    credentials,
    repository,
    transport: {
      send: async () => {
        throw new TypeError("synthetic transport failure");
      },
    },
  });
  const transportFailure = await throwing.readWorkItem(178);
  expect(transportFailure.ok).toBe(false);
  if (!transportFailure.ok) {
    expect(transportFailure.code).toBe("provider.payload.invalid");
    expect((transportFailure as { readonly httpStatus?: number }).httpStatus).toBeUndefined();
  }
  expect(transport.requests).toEqual([]);

  // A received-but-malformed 2xx is status-present: the bounded read stamps the
  // status it received onto the decode failure, so it stays distinguishable from
  // the status-absent transport throw above.
  const malformedTransport = createFixtureTransport([
    { url: issueUrl(178), body: { number: 178 }, status: 200 },
  ]);
  const malformed = await createGitHubClient({
    instance,
    credentials,
    repository,
    transport: malformedTransport,
  }).readWorkItem(178);
  expect(malformed.ok).toBe(false);
  if (!malformed.ok) {
    expect(malformed.code).toBe("provider.payload.invalid");
    expect((malformed as { readonly httpStatus?: number }).httpStatus).toBe(200);
  }
  expect(malformedTransport.requests).toHaveLength(1);
};

const CLI_STATUS_FIXTURE = `${FIXTURES}/cli-status-blocks.json`;
const CLI_ARGV_FIXTURE = `${FIXTURES}/cli-argv.json`;

const cliStatusCase = (index: number): Record<string, unknown> => {
  const cases = (readJson(CLI_STATUS_FIXTURE) as { readonly cases?: unknown }).cases;
  if (!Array.isArray(cases)) throw new Error("cli-status-blocks fixture has no cases");
  const entry = cases[index];
  if (!isRecord(entry)) throw new Error(`cli-status-blocks case ${index} is missing`);
  return entry;
};

const cliArgvRoute = (index: number): Record<string, unknown> => {
  const routes = (readJson(CLI_ARGV_FIXTURE) as { readonly routes?: unknown }).routes;
  if (!Array.isArray(routes)) throw new Error("cli-argv fixture has no routes");
  const entry = routes[index];
  if (!isRecord(entry)) throw new Error(`cli-argv route ${index} is missing`);
  return entry;
};

const cliRunnerReturning = (
  stdout: string,
): { readonly runner: GithubChildRunner; readonly calls: string[] } => {
  const calls: string[] = [];
  const runner: GithubChildRunner = async (_file, args) => {
    calls.push(args.join(" "));
    return { stdout, stderr: "", status: 0, timedOut: false };
  };
  return { runner, calls };
};

const CLI_TRANSPORT_ENVIRONMENT = { PATH: "/opt/example/bin", TMPDIR: "/tmp/example-tmp" };

const LANDING_FIXTURE = `${FIXTURES}/landing-responses.json`;

/** Build a landing client over one declared landing fixture case. */
const landingClient = (
  caseName: string,
): {
  readonly client: GithubClient;
  readonly transport: ReturnType<typeof createFixtureTransport>;
} => {
  const fixture = recordField(readJson(LANDING_FIXTURE), caseName);
  const status = typeof fixture.status === "number" ? fixture.status : 200;
  const routes: FixtureRoute[] = [
    {
      method: "PUT",
      url: `${instance.baseUrl}${repoPath}/pulls/504/merge`,
      status,
      body: fixture.body,
    },
  ];
  if (isRecord(fixture.readBack)) {
    routes.push({
      method: "GET",
      url: `${instance.baseUrl}${repoPath}/pulls/504`,
      body: fixture.readBack,
    });
  }
  const transport = createFixtureTransport(routes);
  return {
    client: createGitHubClient({ instance, credentials, repository, transport }),
    transport,
  };
};

const landingInput = {
  deliveryRequest: { systemName: "github", entityId: "504" },
  strategy: "squash" as const,
  commitTitle: "feat(GH-338): crafted squash title",
  commitMessage: "Crafted squash message",
};

const ISSUE_WRITES = `${FIXTURES}/issue-writes.json`;
const WORKFLOW_MAP_CASES = `${FIXTURES}/workflow-map-cases.json`;
const TIMINGS_FIXTURE = `${FIXTURES}/check-run-timings.json`;
const EXCERPT_FIXTURE = `${FIXTURES}/check-run-log-excerpt.json`;

const evidenceTimingsCheck = async (): Promise<void> => {
  const body = recordField(recordField(readJson(TIMINGS_FIXTURE), "cases"), "bothPresent");
  const transport = createFixtureTransport([{ url: checkRunsUrl(SHA_A), body }]);
  const client = createGitHubClient({ instance, credentials, repository, transport });
  const read = requireValue(await client.readPipelineRun(SHA_A), "timings");
  const jobs = read.items.flatMap((run) => run.jobs);
  expect(jobs[0]?.startedAt).toBe("2026-11-17T10:00:00Z");
  expect(jobs[0]?.completedAt).toBe("2026-11-17T10:04:12Z");
  expect(jobs[1]?.startedAt).toBe("2026-11-17T10:04:13Z");
  expect(jobs[1]?.completedAt).toBe("2026-11-17T10:11:59Z");
  for (const job of jobs) expect(Object.hasOwn(job, "durationMs")).toBe(false);
};

const logExcerptCapCheck = async (): Promise<void> => {
  const fixture = recordField(recordField(readJson(EXCERPT_FIXTURE), "cases"), "over8192Ascii");
  const transport = createFixtureTransport([
    {
      url: `${instance.baseUrl}${repoPath}/actions/jobs/9002/logs`,
      body: fixture.body,
    },
  ]);
  const reader = createGitHubLogExcerptReader({
    instance,
    credentials,
    repository,
    transport,
  });
  const value = requireValue(await reader.readLogExcerpt("9002"), "excerpt");
  expect(value.byteLength).toBe(GITHUB_LOG_EXCERPT_MAX_BYTES);
  expect(value.truncated).toBe(true);
  expect(Buffer.byteLength(value.excerpt, "utf8")).toBe(GITHUB_LOG_EXCERPT_MAX_BYTES);
};

const commentCarrierFreeCheck = async (): Promise<void> => {
  const comment = recordField(recordField(readJson(ISSUE_WRITES), "comment"), "commentCreated");
  const transport = createFixtureTransport([
    {
      method: "POST",
      url: `${instance.baseUrl}${repoPath}/issues/601/comments`,
      status: 201,
      body: recordField(comment, "response"),
    },
  ]);
  const client = createGitHubClient({ instance, credentials, repository, transport });
  const result = await client.writeComment({
    entityId: String(comment.entityId),
    body: String(comment.body),
  });
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.value).toEqual(recordField(comment, "expected"));
  const body = JSON.parse(transport.requests[0]?.body ?? "{}") as unknown;
  expect(body).toEqual(recordField(recordField(comment, "request"), "body"));
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain("<!--");
  expect(serialized).not.toContain("provenance");
  expect(serialized).not.toContain("schema");
};

const contentWriteNeverLandsCheck = async (): Promise<void> => {
  const created = recordField(recordField(readJson(ISSUE_WRITES), "contentWrite"), "pullCreated");
  const transport = createFixtureTransport([
    {
      method: "POST",
      url: `${instance.baseUrl}${repoPath}/pulls`,
      status: 201,
      body: recordField(created, "response"),
    },
  ]);
  const client = createGitHubClient({ instance, credentials, repository, transport });
  const result = await client.writeDeliveryRequest({
    kind: "create",
    sourceRef: "feat/GH-338/backlog-content-write",
    targetRef: "main-tools",
    title: "Backlog content write",
    body: "Content body",
  });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.identity.entityId).toBe("610");
    expect(result.value.sourceRef).toBe("feat/GH-338/backlog-content-write");
  }
  expect(transport.requests.some((request) => request.url.endsWith("/merge"))).toBe(false);
  expect(transport.requests.some((request) => request.method === "PUT")).toBe(false);
};

const workflowMapSeedCheck = async (): Promise<void> => {
  const rows = arrayField(readJson(WORKFLOW_MAP_CASES), "seedRows");
  expect(GITHUB_WORKFLOW_MAP_SEED.states).toEqual(rows);
  const transport = createFixtureTransport([
    {
      url: issueUrl(601),
      body: {
        number: 601,
        title: "Seed precedence",
        state: "open",
        labels: [{ name: "change" }, { name: "review" }],
      },
    },
  ]);
  const client = createGitHubClient({ instance, credentials, repository, transport });
  const item = requireValue(await client.readWorkItem(601), "seed precedence");
  expect(item.status.deliveryState).toBe("in-review");
};

const defaultAssertions: TrapAssertions = {
  "GH-REVIEW-STATE": async () => {
    await reviewStateCheck(defaultPullReader);
    await unknownReviewDecisionCheck();
  },
  "GH-CHECK-RUNS-PER-SHA": () => checkRunsCheck(defaultCheckRunReader),
  "GITHUB-LANDING-CRAFTED-METADATA": async () => {
    const { client, transport } = landingClient("landedWithSha");
    const result = await client.mergeDeliveryRequest(landingInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.merged).toBe(true);
    expect(result.value.mergeCommitSha).toBe("4444444444444444444444444444444444444444");
    const landing = transport.requests.find((request) => request.method === "PUT");
    const body = JSON.parse(landing?.body ?? "{}") as Record<string, unknown>;
    expect(body.commit_title).toBe("feat(GH-338): crafted squash title");
    expect(body.commit_message).toBe("Crafted squash message");
  },
  "GITHUB-LANDING-IDENTITY-ABSENT": async () => {
    const { client } = landingClient("landedWithoutSha");
    const result = await client.mergeDeliveryRequest(landingInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.hasOwn(result.value, "mergeCommitSha")).toBe(false);
  },
  "GITHUB-LANDING-GUARD-REFUSAL": async () => {
    const { client, transport } = landingClient("headMismatch");
    const result = await client.mergeDeliveryRequest({
      ...landingInput,
      expectedHeadSha: "1111111111111111111111111111111111111111",
    });
    expect(result.ok).toBe(false);
    expect(transport.requests).toHaveLength(1);
  },
  "GITHUB-CLI-STATUS-RECOVERY": async () => {
    const fixture = cliStatusCase(6);
    const { runner } = cliRunnerReturning(String(fixture.stdout));
    const transport = createGithubCliTransport({
      runner,
      environment: CLI_TRANSPORT_ENVIRONMENT,
    });
    const response = await transport.send({
      url: `${instance.baseUrl}${repoPath}/issues/601`,
      method: "GET",
      headers: { Accept: "application/vnd.github+json" },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ number: 601 });
  },
  "GITHUB-CLI-CREDENTIAL-ABSENCE": async () => {
    const fixture = cliArgvRoute(0);
    const { runner, calls } = cliRunnerReturning(
      "HTTP/2.0 200 OK\ncontent-type: application/json\n\n{}\n",
    );
    const transport = createGithubCliTransport({
      runner,
      environment: CLI_TRANSPORT_ENVIRONMENT,
    });
    await transport.send({
      url: String(fixture.url),
      method: "GET",
      headers: {
        ...(recordField(fixture, "headers") as Record<string, string>),
        Authorization: "Bearer canary-trap-cli-token",
      },
    });
    const serialized = calls.join(" ");
    expect(serialized).not.toContain("canary-trap-cli-token");
    expect(serialized).toContain("--hostname");
    expect(serialized).not.toContain("--paginate");
  },
  "GITHUB-COMMENT-CARRIER-FREE": commentCarrierFreeCheck,
  "GITHUB-CONTENT-WRITE-NEVER-LANDS": contentWriteNeverLandsCheck,
  "GITHUB-WORKFLOW-MAP-SEED-PRECEDENCE": workflowMapSeedCheck,
  "GITHUB-CHECK-RUN-TIMINGS": evidenceTimingsCheck,
  "GITHUB-LOG-EXCERPT-CAP": logExcerptCapCheck,
  "GITHUB-LANDING-ALREADY-MERGED-READBACK": async () => {
    const { client, transport } = landingClient("alreadyMergedThenMergedTrue");
    const result = await client.mergeDeliveryRequest(landingInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mergeCommitSha).toBe("5555555555555555555555555555555555555555");
    expect(transport.requests).toHaveLength(2);
    const unmerged = landingClient("alreadyMergedThenMergedFalse");
    const refused = await unmerged.client.mergeDeliveryRequest(landingInput);
    expect(refused.ok).toBe(false);
  },
  "GH-ISSUE-TO-WORKITEM": () => issueCheck(defaultIssueReader),
  "GITHUB-LIST-EXCLUDES-PRS": listWorkItemsCheck,
  "GITHUB-LIST-PAGE-LIMIT": listPageLimitCheck,
  "GITHUB-ISSUE-RELATIONS-ABSENT": issueRelationsAbsentCheck,
  "GITHUB-PR-LIST-REVIEW-DEFAULT": prListReviewDefaultCheck,
  "GH-CLOSEOUT-MERGED-HEAD": closeoutMergedHead,
  "GH-CLOSEOUT-LABEL-PRESERVE": closeoutLabelPreserve,
  "GH-CLOSEOUT-THREAD-GRAPHQL": closeoutThreadGraphql,
  "GITHUB-PR-MERGEABLE-NULL": async () => {
    expect((await readGatePull("nullMergeable")).mergeableState).toBe("unknown");
  },
  "GITHUB-PR-MERGEABLE-DIRTY": async () => {
    expect((await readGatePull("dirty")).mergeableState).toBe("conflicting");
  },
  "GITHUB-PR-MERGEABLE-BLOCKED": async () => {
    expect((await readGatePull("blockedTrue")).mergeableState).toBe("not-mergeable");
  },
  "GITHUB-PR-HEAD-SHA-ABSENT": async () => {
    expect((await readGatePull("headAbsent")).sourceHeadSha).toBeUndefined();
  },
  "GITHUB-PR-COMMIT-SURFACE-ABSENT": async () => {
    const view = await readGatePull("surfaceAbsent");
    expect(view.commitCount).toBeUndefined();
    expect(view.changedFileCount).toBeUndefined();
  },
  "GITHUB-PR-ZERO-COMMITS": async () => {
    expect((await readGatePull("zeroCommits")).commitCount).toBe(0);
  },
  "GITHUB-CHECKRUN-EMPTY": () => checkRunTrapCheck("empty"),
  "GITHUB-CHECKRUN-ALL-SKIPPED": () => checkRunTrapCheck("allSkipped"),
  "GITHUB-CHECKRUN-PAGE-LIMIT": pageLimitCheck,
  "GITHUB-ISSUE-COMMENTS-ABSENT": issueCommentsAbsentCheck,
  "GITHUB-PR-LIST-404": () => absenceCheck((client) => client.listDeliveryRequests(100)),
  "GITHUB-PR-DETAIL-404": () => absenceCheck((client) => client.readDeliveryRequest(178)),
  "GITHUB-CHECKRUN-404": () => absenceCheck((client) => client.readPipelineRun(SHA_A)),
  "GITHUB-ISSUE-404": () => absenceCheck((client) => client.readWorkItem(178)),
  "GH-PAYLOAD-HTTP-STATUS": httpStatusTrapCheck,
};

const mutationsForNewTraps = [
  {
    trapName: "GITHUB-COMMENT-CARRIER-FREE",
    assertion: async (): Promise<void> => {
      const comment = recordField(recordField(readJson(ISSUE_WRITES), "comment"), "commentCreated");
      const transport = createFixtureTransport([
        {
          method: "POST",
          url: `${instance.baseUrl}${repoPath}/issues/601/comments`,
          status: 201,
          body: recordField(comment, "response"),
        },
      ]);
      const client = createGitHubClient({ instance, credentials, repository, transport });
      await client.writeComment({ entityId: "601", body: String(comment.body) });
      const body = JSON.parse(transport.requests[0]?.body ?? "{}") as Record<string, unknown>;
      // The mutated normalization claims a metadata envelope on a human comment.
      expect(body.provenance).toBeDefined();
    },
  },
  {
    trapName: "GITHUB-CONTENT-WRITE-NEVER-LANDS",
    assertion: async (): Promise<void> => {
      const created = recordField(
        recordField(readJson(ISSUE_WRITES), "contentWrite"),
        "pullCreated",
      );
      const transport = createFixtureTransport([
        {
          method: "POST",
          url: `${instance.baseUrl}${repoPath}/pulls`,
          status: 201,
          body: recordField(created, "response"),
        },
      ]);
      const client = createGitHubClient({ instance, credentials, repository, transport });
      await client.writeDeliveryRequest({
        kind: "create",
        sourceRef: "feat/GH-338/backlog-content-write",
        targetRef: "main-tools",
        title: "Backlog content write",
        body: "Content body",
      });
      // The mutated normalization lands the request.
      expect(transport.requests.some((request) => request.method === "PUT")).toBe(true);
    },
  },
  {
    trapName: "GITHUB-WORKFLOW-MAP-SEED-PRECEDENCE",
    assertion: async (): Promise<void> => {
      const rows = arrayField(readJson(WORKFLOW_MAP_CASES), "seedRows");
      // The mutated seed reverses precedence.
      expect(GITHUB_WORKFLOW_MAP_SEED.states).toEqual([...rows].reverse());
    },
  },
  {
    trapName: "GITHUB-CHECK-RUN-TIMINGS",
    assertion: async (): Promise<void> => {
      await evidenceTimingsCheck();
      // The mutated normalization derives a duration from the timings.
      const body = recordField(recordField(readJson(TIMINGS_FIXTURE), "cases"), "bothPresent");
      const transport = createFixtureTransport([{ url: checkRunsUrl(SHA_A), body }]);
      const client = createGitHubClient({ instance, credentials, repository, transport });
      const read = requireValue(await client.readPipelineRun(SHA_A), "timings mutation");
      expect(Object.hasOwn(read.items[0]?.jobs[0] ?? {}, "durationMs")).toBe(true);
    },
  },
  {
    trapName: "GITHUB-LOG-EXCERPT-CAP",
    assertion: async (): Promise<void> => {
      await logExcerptCapCheck();
      // The mutated bound truncates one byte early (a character-count bound).
      const fixture = recordField(recordField(readJson(EXCERPT_FIXTURE), "cases"), "over8192Ascii");
      const transport = createFixtureTransport([
        { url: `${instance.baseUrl}${repoPath}/actions/jobs/9002/logs`, body: fixture.body },
      ]);
      const reader = createGitHubLogExcerptReader({ instance, credentials, repository, transport });
      const value = requireValue(await reader.readLogExcerpt("9002"), "cap mutation");
      expect(value.byteLength).toBe(GITHUB_LOG_EXCERPT_MAX_BYTES - 1);
    },
  },
];

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
      "GH-CLOSEOUT-MERGED-HEAD",
      "GH-CLOSEOUT-LABEL-PRESERVE",
      "GH-CLOSEOUT-THREAD-GRAPHQL",
      "GITHUB-PR-MERGEABLE-NULL",
      "GITHUB-PR-MERGEABLE-DIRTY",
      "GITHUB-PR-MERGEABLE-BLOCKED",
      "GITHUB-PR-HEAD-SHA-ABSENT",
      "GITHUB-PR-COMMIT-SURFACE-ABSENT",
      "GITHUB-PR-ZERO-COMMITS",
      "GITHUB-CHECKRUN-EMPTY",
      "GITHUB-CHECKRUN-ALL-SKIPPED",
      "GITHUB-CHECKRUN-PAGE-LIMIT",
      "GITHUB-ISSUE-COMMENTS-ABSENT",
      "GITHUB-PR-LIST-404",
      "GITHUB-PR-DETAIL-404",
      "GITHUB-CHECKRUN-404",
      "GITHUB-ISSUE-404",
      "GH-PAYLOAD-HTTP-STATUS",
      "GITHUB-LANDING-CRAFTED-METADATA",
      "GITHUB-LANDING-IDENTITY-ABSENT",
      "GITHUB-LANDING-GUARD-REFUSAL",
      "GITHUB-LANDING-ALREADY-MERGED-READBACK",
      "GITHUB-CLI-STATUS-RECOVERY",
      "GITHUB-CLI-CREDENTIAL-ABSENCE",
      "GITHUB-COMMENT-CARRIER-FREE",
      "GITHUB-CONTENT-WRITE-NEVER-LANDS",
      "GITHUB-WORKFLOW-MAP-SEED-PRECEDENCE",
      "GITHUB-CHECK-RUN-TIMINGS",
      "GITHUB-LOG-EXCERPT-CAP",
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
      ...mutationsForNewTraps,
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
