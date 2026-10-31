/**
 * TC-GITLAB-001..003 — the GitLab trap catalog replayed offline.
 *
 * The merge-status table is exercised through the production resolver; the
 * mutation controls build a corrupted resolver (async → terminal, fallback
 * before detailed) and must fail naming the trap entry.
 */
import { describe, expect, test } from "bun:test";
import { createEnvironmentCredentialPort } from "../../../packages/adapters/src/credentials/index";
import {
  createGitLabClient,
  type GitLabClient,
} from "../../../packages/adapters/src/gitlab/client";
import {
  createGitLabReviewStateResolver,
  GITLAB_MERGE_STATUS_RULES,
  type GitLabMergeStatusInput,
  type GitLabMergeStatusResolution,
  resolveGitLabReviewState,
} from "../../../packages/adapters/src/gitlab/merge-status";
import {
  type GitLabNormalizationContext,
  normalizePipelines,
} from "../../../packages/adapters/src/gitlab/normalize";
import type {
  DeliveryRequest,
  ExternalSystemInstance,
  PipelineRun,
} from "../../../packages/core/src/contracts/index";
import { fixtureBrand } from "../../fixtures/credentials/cases";
import {
  arrayField,
  createFixtureTransport,
  type FixtureRoute,
  installThrowingFetchGuard,
  readJson,
  requireRecord,
  requireValue,
  stringField,
} from "./support";
import {
  runTrapCatalog,
  type TrapAssertions,
  type TrapRun,
  type TrapRunOptions,
} from "./trap-harness";

const FIXTURES = "tests/fixtures/providers/gitlab";
const TRAPS = "tests/fixtures/providers/traps";
const MERGE_REQUESTS = `${FIXTURES}/merge-requests.json`;
const PIPELINES = `${FIXTURES}/pipelines-per-commit.json`;
const MERGE_ASYNC = `${FIXTURES}/merge-status-async.json`;
const MERGE_MULTIVALUED = `${FIXTURES}/merge-status-multivalued.json`;
const PROJECT_PATH = "group-placeholder/project-placeholder";
const ENCODED_PROJECT = encodeURIComponent(PROJECT_PATH);

const instance: ExternalSystemInstance = {
  instanceName: "vcs-primary",
  systemKind: "vcs",
  baseUrl: "https://gitlab.example.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: {
      referenceName: "gitlab-read",
      sourceKey: { style: "literal", name: "FIXTURE_GITLAB_TOKEN" },
    },
  },
};

const credentials = createEnvironmentCredentialPort({
  environment: { FIXTURE_GITLAB_TOKEN: "canary-gitlab-read-token" },
  brand: fixtureBrand,
});

const context: GitLabNormalizationContext = { systemName: instance.instanceName };

const mergeRequestUrl = (iid: number): string =>
  `${instance.baseUrl}/api/v4/projects/${ENCODED_PROJECT}/merge_requests/${iid}`;

const pipelinesUrl = (sha: string): string =>
  `${instance.baseUrl}/api/v4/projects/${ENCODED_PROJECT}/pipelines?sha=${encodeURIComponent(sha)}`;

const clientFor = (routes: readonly FixtureRoute[]): GitLabClient =>
  createGitLabClient({
    instance,
    credentials,
    projectPath: PROJECT_PATH,
    transport: createFixtureTransport(routes),
  });

const mergeRequests = arrayField(readJson(MERGE_REQUESTS), "merge_requests");
const pipelineFixture = readJson(PIPELINES);
const pipelines = arrayField(pipelineFixture, "pipelines");
const pipelineSha = stringField(pipelineFixture, "sha");

const itemAt = <T>(items: readonly T[], index: number): T => {
  const item = items[index];
  if (item === undefined) throw new Error(`fixture item ${index} is missing`);
  return item;
};

const mergeInput = (value: unknown): GitLabMergeStatusInput => {
  const record = requireRecord(value, "merge-status fixture");
  const mrState = stringField(record, "state");
  if (mrState === undefined) throw new Error("merge-status fixture has no state");
  const mergeStatus = stringField(record, "merge_status");
  const detailedMergeStatus = stringField(record, "detailed_merge_status");
  return {
    mrState,
    draft: record.draft === true,
    approvals: typeof record.approvals === "number" ? record.approvals : 0,
    ...(mergeStatus !== undefined ? { mergeStatus } : {}),
    ...(detailedMergeStatus !== undefined ? { detailedMergeStatus } : {}),
  };
};

// --- TC-GITLAB-001: MR reads ------------------------------------------------

const mergedRequestView = async (iid: number, body: unknown): Promise<DeliveryRequest> => {
  const client = clientFor([{ url: mergeRequestUrl(iid), body }]);
  return requireValue(await client.readDeliveryRequest(iid), `MR !${iid}`);
};

describe("TC-GITLAB-001 MR reads normalize to DeliveryRequest", () => {
  test("identity, refs, review state, and threads normalize truthfully", async () => {
    const view = await mergedRequestView(42, itemAt(mergeRequests, 0));
    expect(view.identity).toEqual({ systemName: instance.instanceName, entityId: "42" });
    expect(view.sourceRef).toBe("feat/GH-188/client-seeds-trap-catalogs");
    expect(view.targetRef).toBe("main-tools");
    expect(view.reviewState).toBe("approved");
    expect(view.threads).toEqual([
      { threadId: "thread-1", resolved: true, commentCount: 2 },
      { threadId: "thread-2", resolved: false, commentCount: 1 },
    ]);
  });

  test("a draft MR stays draft and no provider-native field leaks", async () => {
    const view = await mergedRequestView(43, itemAt(mergeRequests, 1));
    expect(view.reviewState).toBe("draft");
    expect(Object.keys(view).sort()).toEqual(
      ["identity", "reviewState", "sourceRef", "targetRef", "threads"].sort(),
    );
    const serialized = JSON.stringify(view);
    for (const native of ["detailed_merge_status", "source_branch", "web_url", "iid"]) {
      expect(serialized).not.toContain(native);
    }
  });

  test("replay is deterministic", async () => {
    const first = await mergedRequestView(42, itemAt(mergeRequests, 0));
    const second = await mergedRequestView(42, itemAt(mergeRequests, 0));
    expect(second).toEqual(first);
  });
});

// --- TC-GITLAB-002: pipeline multiplicity -----------------------------------

const pipelineCheck = async (
  read: (sha: string) => Promise<readonly PipelineRun[]>,
): Promise<void> => {
  if (pipelineSha === undefined) throw new Error("pipeline fixture has no sha");
  const runs = await read(pipelineSha);
  const identities = runs.map((run) => run.identity.entityId).sort();
  expect(identities).toEqual(["501", "502"]);
  for (const run of runs) {
    expect(run.identity.systemName).toBe(instance.instanceName);
    expect(run.jobs.length).toBeGreaterThan(0);
    for (const job of run.jobs) {
      expect(["queued", "running", "succeeded", "failed", "canceled", "skipped"]).toContain(
        job.jobState,
      );
    }
    expect(run.traceEvidence.length).toBeGreaterThan(0);
  }
  // Order-insensitive: the same set from a reversed payload.
  const reversed = normalizePipelines(
    { pipelines: [...pipelines].reverse() },
    context,
    pipelineSha,
  );
  const reversedRuns = requireValue(reversed, "reversed pipelines");
  expect(reversedRuns.map((run) => run.identity.entityId).sort()).toEqual(identities);
};

const defaultPipelineReader = async (sha: string): Promise<readonly PipelineRun[]> => {
  const client = clientFor([{ url: pipelinesUrl(sha), body: pipelineFixture }]);
  return requireValue(await client.readPipelineRun(sha), PIPELINES);
};

const dropOnePipelineReader = async (sha: string): Promise<readonly PipelineRun[]> => {
  const client = clientFor([
    {
      url: pipelinesUrl(sha),
      body: { provenance: "mutation-control", sha, pipelines: pipelines.slice(0, 1) },
    },
  ]);
  return requireValue(await client.readPipelineRun(sha), "dropped pipeline control");
};

describe("TC-GITLAB-002 pipeline multiplicity per commit", () => {
  test("every reported pipeline is present with jobs and trace evidence", async () => {
    await pipelineCheck(defaultPipelineReader);
  });

  test("fixture reports distinct jobs and traces per pipeline", () => {
    expect(pipelines.length).toBe(2);
    expect(pipelines[0]).not.toEqual(pipelines[1]);
  });
});

// --- TC-GITLAB-003: merge status --------------------------------------------

type Resolver = (input: GitLabMergeStatusInput) => GitLabMergeStatusResolution;

const mergeAsyncCheck = (resolve: Resolver): void => {
  const input = mergeInput(readJson(MERGE_ASYNC));
  const resolution = resolve(input);
  expect(resolution.ok).toBe(true);
  if (!resolution.ok) return;
  expect(["merged", "closed"]).not.toContain(resolution.reviewState);
  expect(resolution.terminal).toBe(false);
  expect(resolution.reviewState).toBe("open");
  for (const native of [input.mergeStatus, input.detailedMergeStatus]) {
    if (native === undefined) continue;
    expect(
      GITLAB_MERGE_STATUS_RULES.some((rule) => rule.nativeValue === native),
      `${native} must be in the declared mapping`,
    ).toBe(true);
  }
};

const mergeMultivaluedCheck = (resolve: Resolver): void => {
  const input = mergeInput(readJson(MERGE_MULTIVALUED));
  const resolution = resolve(input);
  expect(resolution.ok).toBe(true);
  if (!resolution.ok) return;
  // detailed_merge_status ("mergeable") is authoritative over merge_status.
  expect(resolution.reviewState).toBe("open");
  expect(resolution.terminal).toBe(false);
  const unknown = resolve({
    mrState: input.mrState,
    draft: input.draft,
    approvals: input.approvals,
    detailedMergeStatus: "some_future_value",
  });
  expect(unknown.ok).toBe(false);
  if (!unknown.ok) expect(unknown.detail).toContain("some_future_value");
};

const asyncAsTerminalResolver = createGitLabReviewStateResolver(
  GITLAB_MERGE_STATUS_RULES.map((rule) =>
    rule.nativeValue === "checking" || rule.nativeValue === "unchecked"
      ? { ...rule, terminal: true, reviewStateWhenOpen: "merged" as const }
      : rule,
  ),
);

/** A corrupted precedence rule: merge_status wins over detailed_merge_status. */
const fallbackFirstResolver: Resolver = (input) => {
  const native = input.mergeStatus ?? input.detailedMergeStatus;
  if (input.mrState === "merged") return { ok: true, reviewState: "merged", terminal: true };
  if (input.mrState === "closed") return { ok: true, reviewState: "closed", terminal: true };
  if (input.draft) return { ok: true, reviewState: "draft", terminal: false };
  const rule = GITLAB_MERGE_STATUS_RULES.find((candidate) => candidate.nativeValue === native);
  if (rule === undefined) return { ok: false, detail: "unmapped" };
  return { ok: true, reviewState: rule.reviewStateWhenOpen, terminal: rule.terminal };
};

describe("TC-GITLAB-003 merge-status normalization", () => {
  test("the declared table covers the fixture value set", () => {
    const values = new Set<string>();
    for (const value of [readJson(MERGE_ASYNC), readJson(MERGE_MULTIVALUED)]) {
      const record = requireRecord(value, "merge-status fixture");
      const mergeStatus = stringField(record, "merge_status");
      const detailed = stringField(record, "detailed_merge_status");
      if (mergeStatus !== undefined) values.add(mergeStatus);
      if (detailed !== undefined) values.add(detailed);
    }
    for (const value of values) {
      expect(
        GITLAB_MERGE_STATUS_RULES.some((rule) => rule.nativeValue === value),
        `mapping is missing ${value}`,
      ).toBe(true);
    }
  });

  test("async values are non-terminal and multivalued values use the detailed field", () => {
    mergeAsyncCheck(resolveGitLabReviewState);
    mergeMultivaluedCheck(resolveGitLabReviewState);
  });
});

// --- The catalog ------------------------------------------------------------

const defaultAssertions: TrapAssertions = {
  "GL-PIPELINE-MULTIPLICITY": () => pipelineCheck(defaultPipelineReader),
  "GL-MERGE-STATUS-ASYNC": () => {
    mergeAsyncCheck(resolveGitLabReviewState);
  },
  "GL-MERGE-STATUS-MULTIVALUED": () => {
    mergeMultivaluedCheck(resolveGitLabReviewState);
  },
};

const runWithGuard = async (options: Omit<TrapRunOptions, "provider">): Promise<TrapRun> => {
  const guard = installThrowingFetchGuard();
  try {
    const run = await runTrapCatalog({ ...options, provider: "gitlab" });
    expect(guard.calls).toEqual([]);
    return run;
  } finally {
    guard.restore();
  }
};

describe("TC-TRAP-002 GitLab trap catalog replays offline", () => {
  test("every GitLab trap entry passes", async () => {
    const run = await runWithGuard({ catalogRoot: TRAPS, assertions: defaultAssertions });
    expect(run.failures).toEqual([]);
    expect(run.results.map((result) => result.trapName)).toEqual([
      "GL-PIPELINE-MULTIPLICITY",
      "GL-MERGE-STATUS-ASYNC",
      "GL-MERGE-STATUS-MULTIVALUED",
    ]);
  });

  test("mutated normalization fails naming the trap entry and fixture", async () => {
    const mutations: Array<{ trapName: string; assertion: () => Promise<void> | void }> = [
      {
        trapName: "GL-PIPELINE-MULTIPLICITY",
        assertion: () => pipelineCheck(dropOnePipelineReader),
      },
      {
        trapName: "GL-MERGE-STATUS-ASYNC",
        assertion: () => {
          mergeAsyncCheck(asyncAsTerminalResolver);
        },
      },
      {
        trapName: "GL-MERGE-STATUS-MULTIVALUED",
        assertion: () => {
          mergeMultivaluedCheck(fallbackFirstResolver);
        },
      },
    ];
    for (const mutation of mutations) {
      const run = await runWithGuard({
        catalogRoot: TRAPS,
        assertions: { ...defaultAssertions, [mutation.trapName]: mutation.assertion },
      });
      const failure = run.failures.find((message) => message.startsWith(mutation.trapName));
      expect(failure, `${mutation.trapName} mutation must fail`).toBeDefined();
      expect(failure).toContain("tests/fixtures/providers/gitlab/");
    }
  });

  test("an unfixtured pipeline path fails loudly", async () => {
    const transport = createFixtureTransport([]);
    const client = createGitLabClient({
      instance,
      credentials,
      projectPath: PROJECT_PATH,
      transport,
    });
    const guard = installThrowingFetchGuard();
    try {
      const result = await client.readPipelineRun("deadbeef");
      expect(result.ok).toBe(false);
      expect(guard.calls).toEqual([]);
      await expect(
        transport.send({ url: pipelinesUrl("deadbeef"), method: "GET", headers: {} }),
      ).rejects.toThrow(/unfixtured provider request/);
    } finally {
      guard.restore();
    }
  });
});
