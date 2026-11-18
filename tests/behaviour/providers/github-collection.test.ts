/**
 * TC-STATUS-021 read side — bounded GitHub collection reads, PR exclusion,
 * absent review/relation signals, credential-port-only auth, and no second
 * page. The composition-level anonymous guard lives in `status-command.test.ts`.
 */
import { describe, expect, test } from "bun:test";
import { createEnvironmentCredentialPort } from "../../../packages/adapters/src/credentials/index";
import { createGitHubClient } from "../../../packages/adapters/src/github/client";
import { normalizeGithubIssue } from "../../../packages/adapters/src/github/normalize";
import type { ExternalSystemInstance } from "../../../packages/core/src/contracts/index";
import { fixtureBrand } from "../../fixtures/credentials/cases";
import {
  arrayField,
  createFixtureTransport,
  installThrowingFetchGuard,
  isRecord,
  readJson,
  recordField,
  requireRecord,
  requireValue,
} from "../providers/support";

const FIXTURES = "tests/fixtures/providers/github";
const MIXED = `${FIXTURES}/issues-list-mixed.json`;
const LIMIT = `${FIXTURES}/issues-list-limit.json`;
const RELATIONS = `${FIXTURES}/issues-list-relations-absent.json`;
const PULLS = `${FIXTURES}/pulls-list-review-default.json`;
const CHECKS = `${FIXTURES}/check-runs-per-sha.json`;
const SHA_A = "1111111111111111111111111111111111111111";

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
const issuesUrl = (limit: number): string =>
  `${instance.baseUrl}${repoPath}/issues?state=open&per_page=${encodeURIComponent(String(limit))}&sort=updated&direction=desc`;
const pullsUrl = (limit: number): string =>
  `${instance.baseUrl}${repoPath}/pulls?state=open&per_page=${encodeURIComponent(String(limit))}&sort=updated&direction=desc`;
const checksUrl = (sha: string, limit: number): string =>
  `${instance.baseUrl}${repoPath}/commits/${encodeURIComponent(sha)}/check-runs?per_page=${encodeURIComponent(String(limit))}`;

const asArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

const mixedBody = arrayField(readJson(MIXED), "issues");
const limitBody = arrayField(readJson(LIMIT), "issues");
const relationsBody = arrayField(readJson(RELATIONS), "issues");
const pullsBody = arrayField(readJson(PULLS), "pulls");
const checksBody = readJson(CHECKS);
const checkRunsForA =
  isRecord(checksBody) && isRecord(checksBody.shas) ? checksBody.shas[SHA_A] : undefined;

describe("TC-STATUS-021 bounded GitHub collection reads", () => {
  test("one bounded issues page excludes every pull-request object", async () => {
    const transport = createFixtureTransport([{ url: issuesUrl(100), body: mixedBody }]);
    const client = createGitHubClient({ instance, credentials, repository, transport });
    const result = requireValue(await client.listWorkItems(100), "mixed list");
    expect(transport.requests).toHaveLength(1);
    expect(transport.requests[0]?.url).toBe(issuesUrl(100));
    expect(transport.requests[0]?.method).toBe("GET");
    expect(result.pageItemCount).toBe(asArray(mixedBody).length);
    expect(result.items.map((item) => item.identity.entityId)).toEqual(["610", "612", "614"]);
    expect(JSON.stringify(result)).not.toContain("pull_request");
  });

  test("the raw page size is preserved at and below the declared limit", async () => {
    const atLimit = createFixtureTransport([{ url: issuesUrl(100), body: limitBody }]);
    const atClient = createGitHubClient({
      instance,
      credentials,
      repository,
      transport: atLimit,
    });
    const atResult = requireValue(await atClient.listWorkItems(100), "at-limit list");
    expect(atResult.pageItemCount).toBe(100);
    expect(atResult.items).toHaveLength(100);

    const below = createFixtureTransport([{ url: issuesUrl(100), body: relationsBody }]);
    const belowClient = createGitHubClient({
      instance,
      credentials,
      repository,
      transport: below,
    });
    const belowResult = requireValue(await belowClient.listWorkItems(100), "below-limit list");
    expect(belowResult.pageItemCount).toBe(2);
  });

  test("an issue without structured links normalizes to an empty relation set", async () => {
    const transport = createFixtureTransport([{ url: issuesUrl(100), body: relationsBody }]);
    const client = createGitHubClient({ instance, credentials, repository, transport });
    const result = requireValue(await client.listWorkItems(100), "relations list");
    for (const item of result.items) expect(item.relations).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("issue_links");
  });

  test("one bounded pull-list page normalizes refs/draft/state without review defaults", async () => {
    const transport = createFixtureTransport([{ url: pullsUrl(100), body: pullsBody }]);
    const client = createGitHubClient({ instance, credentials, repository, transport });
    const result = requireValue(await client.listDeliveryRequests(100), "pull list");
    expect(transport.requests).toHaveLength(1);
    expect(result.pageItemCount).toBe(2);
    expect(result.items.map((item) => item.identity.entityId)).toEqual(["701", "702"]);
    expect(result.items.map((item) => item.sourceRef)).toEqual([
      "feat/GH-701/list",
      "feat/GH-702/list",
    ]);
    for (const item of result.items) expect(item.threads).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("reviewDecision");
    expect(JSON.stringify(result)).not.toContain("review_threads");
  });

  test("no provider-native key crosses the subpath surface", async () => {
    const transport = createFixtureTransport([
      { url: issuesUrl(100), body: mixedBody },
      { url: pullsUrl(100), body: pullsBody },
    ]);
    const client = createGitHubClient({ instance, credentials, repository, transport });
    const issues = requireValue(await client.listWorkItems(100), "issues");
    const pulls = requireValue(await client.listDeliveryRequests(100), "pulls");
    const serialized: unknown = JSON.parse(JSON.stringify({ issues, pulls }));
    const keys = new Set<string>();
    const collect = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const entry of value) collect(entry);
        return;
      }
      if (typeof value === "object" && value !== null) {
        for (const [key, entry] of Object.entries(value)) {
          keys.add(key);
          collect(entry);
        }
      }
    };
    collect(serialized);
    for (const native of [
      "reviewDecision",
      "head",
      "base",
      "sha",
      "issue_links",
      "check_suite",
      "check_runs",
      "updated_at",
    ]) {
      expect(keys.has(native), native).toBe(false);
    }
  });

  test("a missing credential is a classified read failure with zero requests", async () => {
    const noCredentials = createEnvironmentCredentialPort({ environment: {}, brand: fixtureBrand });
    const transport = createFixtureTransport([{ url: issuesUrl(100), body: mixedBody }]);
    const client = createGitHubClient({
      instance,
      credentials: noCredentials,
      repository,
      transport,
    });
    const result = await client.listWorkItems(100);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result).toMatchObject({ code: "config.credential.missing" });
    }
    expect(transport.requests).toHaveLength(0);
  });

  test("the check-runs read is one page at per_page=20 with the raw page size", async () => {
    const transport = createFixtureTransport([{ url: checksUrl(SHA_A, 20), body: checkRunsForA }]);
    const client = createGitHubClient({ instance, credentials, repository, transport });
    const result = requireValue(await client.readPipelineRun(SHA_A), "check runs");
    expect(transport.requests).toHaveLength(1);
    expect(transport.requests[0]?.url).toBe(checksUrl(SHA_A, 20));
    expect(result.pageItemCount).toBe(4);
    expect(result.items).toHaveLength(4);
    const guard = installThrowingFetchGuard();
    try {
      await expect(
        transport.send({
          url: `${instance.baseUrl}${repoPath}/commits/${SHA_A}/check-runs?per_page=20&page=2`,
          method: "GET",
          headers: {},
        }),
      ).rejects.toThrow(/unfixtured provider request/);
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
    }
  });

  test("negative controls: unfixtured URL, non-GET, removed PR filter, omitted per_page", async () => {
    const transport = createFixtureTransport([{ url: issuesUrl(100), body: mixedBody }]);
    await expect(
      transport.send({ url: issuesUrl(99), method: "GET", headers: {} }),
    ).rejects.toThrow(/unfixtured provider request/);

    const strictTransport = {
      send: async (request: { readonly method: string }) => {
        if (request.method !== "GET") throw new Error("non-GET method rejected");
        return { status: 200, body: mixedBody };
      },
    };
    const nonGet = {
      url: issuesUrl(100),
      method: "POST",
      headers: {},
    } as unknown as Parameters<typeof strictTransport.send>[0];
    await expect(strictTransport.send(nonGet)).rejects.toThrow(/non-GET/);

    const listTransport = createFixtureTransport([{ url: issuesUrl(100), body: mixedBody }]);
    const client = createGitHubClient({
      instance,
      credentials,
      repository,
      transport: listTransport,
    });
    const result = requireValue(await client.listWorkItems(100), "list");
    expect(listTransport.requests.every((request) => request.method === "GET")).toBe(true);
    expect(listTransport.requests[0]?.url).toContain("per_page=100");
    expect(result.items.map((item) => item.identity.entityId)).not.toContain("611");

    const prObject = asArray(mixedBody).find(
      (entry) => isRecord(entry) && Object.hasOwn(entry, "pull_request"),
    );
    expect(prObject).toBeDefined();

    const failingTransport = createFixtureTransport([]);
    const failingClient = createGitHubClient({
      instance,
      credentials,
      repository,
      transport: failingTransport,
    });
    const failing = await failingClient.listWorkItems(100);
    expect(failing.ok).toBe(false);
  });
});
describe("GH-178 collection 404 absence", () => {
  test("a 404 list read returns provider.not-found", async () => {
    const transport = createFixtureTransport([{ url: pullsUrl(100), body: {}, status: 404 }]);
    const client = createGitHubClient({ instance, credentials, repository, transport });
    const result = await client.listDeliveryRequests(100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("provider.not-found");
    expect(transport.requests).toHaveLength(1);
  });
});

const TRAP_CATALOG = "tests/fixtures/providers/traps/github.traps.json";
const READ_FAILURE_FIXTURE = "tests/fixtures/providers/github/read-failure-statuses.json";

describe("TC-DOCTOR-031 GH-PAYLOAD-HTTP-STATUS trap coverage", () => {
  const catalog = readJson(TRAP_CATALOG) as {
    readonly entries: readonly Record<string, unknown>[];
  };

  test("exactly one four-field entry points at the committed read-failure fixture", () => {
    const matches = catalog.entries.filter((entry) => entry.trapName === "GH-PAYLOAD-HTTP-STATUS");
    expect(matches).toHaveLength(1);
    const entry = matches[0];
    if (entry === undefined) throw new Error("trap entry missing");
    expect(Object.keys(entry).sort()).toEqual([
      "expectedNormalizedOutcome",
      "fixtureReference",
      "providerBehavior",
      "trapName",
    ]);
    expect(entry.fixtureReference).toBe(READ_FAILURE_FIXTURE);
    expect(String(entry.providerBehavior).length).toBeGreaterThan(0);
    expect(String(entry.expectedNormalizedOutcome)).toContain("httpStatus");
  });

  test("the fixture carries the 401/403/404/500/503, timeout, transport, and absent shapes", () => {
    const fixture = readJson(READ_FAILURE_FIXTURE) as {
      readonly responses: Record<string, { readonly status: number | null }>;
    };
    expect(Object.keys(fixture.responses).sort()).toEqual([
      "401",
      "403",
      "404",
      "500",
      "503",
      "absent",
      "timeout",
      "transport",
    ]);
    for (const key of ["401", "403", "404", "500", "503"]) {
      expect(fixture.responses[key]?.status).toBe(Number(key));
    }
    expect(fixture.responses.timeout?.status).toBeNull();
    expect(fixture.responses.transport?.status).toBeNull();
  });

  test("the read slice supplies the structured status and keeps the closed operation set", async () => {
    const statuses: Array<[number, string]> = [
      [401, "provider.payload.invalid"],
      [403, "provider.payload.invalid"],
      [500, "provider.payload.invalid"],
      [503, "provider.payload.invalid"],
      [404, "provider.not-found"],
    ];
    for (const [status, identity] of statuses) {
      const transport = createFixtureTransport([{ url: issuesUrl(50), body: {}, status }]);
      const client = createGitHubClient({ instance, credentials, repository, transport });
      const result = await client.listWorkItems(50);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe(identity);
        expect((result as { readonly httpStatus?: number }).httpStatus).toBe(status);
      }
      expect(transport.requests).toHaveLength(1);
      expect(transport.requests[0]?.method).toBe("GET");
    }
    const { ADAPTER_OPERATIONS } = await import("../../../packages/core/src/contracts/index");
    const { GITHUB_ADAPTER_CONTRACT } = await import("../../../packages/adapters/src/github/index");
    expect(ADAPTER_OPERATIONS).toHaveLength(9);
    expect(ADAPTER_OPERATIONS).not.toContain("doctor-read");
    expect(GITHUB_ADAPTER_CONTRACT.capabilities.supportedOperations).not.toContain(
      "doctor-read" as never,
    );
  });
});

describe("TC-ATT-004 mapped milestone provenance", () => {
  const context = { systemName: "github" } as const;
  const baseIssue = {
    number: 700,
    title: "Issue",
    state: "open",
    labels: [{ name: "epic:payments" }, { name: "points:5" }],
    updated_at: "2026-10-30T00:00:00Z",
  };

  test("a present milestone title maps additively onto the work-item view", () => {
    const result = requireValue(
      normalizeGithubIssue({ ...baseIssue, milestone: { title: "Sprint 12" } }, context),
      "milestone present",
    );
    expect(result.milestone).toBe("Sprint 12");
    expect(result.labels).toEqual(["epic:payments", "points:5"]);
    expect(result.updatedAt).toBe("2026-10-30T00:00:00Z");
  });

  test("an absent or null milestone leaves the field absent, never fabricated", () => {
    const absent = requireValue(normalizeGithubIssue(baseIssue, context), "milestone absent");
    expect("milestone" in absent).toBe(false);
    const nullMilestone = requireValue(
      normalizeGithubIssue({ ...baseIssue, milestone: null }, context),
      "milestone null",
    );
    expect("milestone" in nullMilestone).toBe(false);
    const malformed = requireValue(
      normalizeGithubIssue({ ...baseIssue, milestone: "Sprint 12" }, context),
      "milestone malformed",
    );
    expect("milestone" in malformed).toBe(false);
  });

  test("the page shape is unchanged by the additive mapping", async () => {
    const body = [
      { ...baseIssue, milestone: { title: "Sprint 12" } },
      { ...baseIssue, number: 701 },
    ];
    const transport = createFixtureTransport([{ url: issuesUrl(100), body }]);
    const client = createGitHubClient({ instance, credentials, repository, transport });
    const result = requireValue(await client.listWorkItems(100), "milestone page");
    expect(result.pageItemCount).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.milestone).toBe("Sprint 12");
    expect("milestone" in (result.items[1] ?? {})).toBe(false);
    expect(transport.requests).toHaveLength(1);
  });
});

const ISSUE_WRITES = `${FIXTURES}/issue-writes.json`;
const issueWrites = requireRecord(readJson(ISSUE_WRITES), "issue writes");
const contentWriteCases = recordField(issueWrites, "contentWrite");
const contentWriteCase = (key: string): Record<string, unknown> =>
  recordField(contentWriteCases, key);

type RecordedWrite = { readonly method: string; readonly url: string; readonly body?: string };

const createWriteClient = (
  routes: Parameters<typeof createFixtureTransport>[0],
): {
  readonly client: ReturnType<typeof createGitHubClient>;
  readonly transport: ReturnType<typeof createFixtureTransport>;
} => {
  const transport = createFixtureTransport(routes);
  return {
    client: createGitHubClient({ instance, credentials, repository, transport }),
    transport,
  };
};

const writeBody = (request: RecordedWrite | undefined): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(request?.body ?? "{}");
  if (!isRecord(parsed)) throw new Error("expected a JSON object write body");
  return parsed;
};

describe("TC-BACKLOG-001 the comment write is supported and carrier-free", () => {
  const comment = recordField(recordField(issueWrites, "comment"), "commentCreated");

  test("the recorded request carries exactly the human text and returns the provider identity", async () => {
    const response = recordField(comment, "response");
    const { client, transport } = createWriteClient([
      {
        method: "POST",
        url: `${instance.baseUrl}${repoPath}/issues/601/comments`,
        body: response,
        status: 201,
      },
    ]);
    const result = await client.writeComment({
      entityId: String(comment.entityId),
      body: String(comment.body),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(recordField(comment, "expected"));
    const request = transport.requests[0] as RecordedWrite | undefined;
    expect(request?.method).toBe("POST");
    expect(writeBody(request)).toEqual(recordField(recordField(comment, "request"), "body"));
    const serialized = JSON.stringify(writeBody(request));
    for (const carrier of ["<!--", "schema", "provenance", "envelope", "payload"]) {
      expect(serialized, carrier).not.toContain(carrier);
    }
  });
});

describe("TC-BACKLOG-002 the content write creates and updates, never lands", () => {
  test("a create transmits both refs, the title, the body and no fabricated draft", async () => {
    const created = contentWriteCase("pullCreated");
    const { client, transport } = createWriteClient([
      {
        method: "POST",
        url: `${instance.baseUrl}${repoPath}/pulls`,
        body: recordField(created, "response"),
        status: 201,
      },
    ]);
    const result = await client.writeDeliveryRequest(
      created.input as Parameters<ReturnType<typeof createGitHubClient>["writeDeliveryRequest"]>[0],
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.identity.entityId).toBe("610");
      expect(result.value.sourceRef).toBe("feat/GH-338/backlog-content-write");
      expect(result.value.targetRef).toBe("main-tools");
      expect(result.value.reviewState).toBe("open");
    }
    const request = transport.requests[0] as RecordedWrite | undefined;
    expect(request?.method).toBe("POST");
    expect(writeBody(request)).toEqual(recordField(recordField(created, "request"), "body"));
    expect(transport.requests.some((entry) => entry.url.endsWith("/merge"))).toBe(false);
    expect(transport.requests.some((entry) => entry.method === "PUT")).toBe(false);
  });

  test("an absent draft is absent, never fabricated", async () => {
    const created = contentWriteCase("pullCreatedDefaultDraft");
    const { client, transport } = createWriteClient([
      {
        method: "POST",
        url: `${instance.baseUrl}${repoPath}/pulls`,
        body: recordField(created, "response"),
        status: 201,
      },
    ]);
    const result = await client.writeDeliveryRequest(
      created.input as Parameters<ReturnType<typeof createGitHubClient>["writeDeliveryRequest"]>[0],
    );
    expect(result.ok).toBe(true);
    const body = writeBody(transport.requests[0] as RecordedWrite | undefined);
    expect(Object.hasOwn(body, "draft")).toBe(false);
    expect(body).toEqual(recordField(recordField(created, "request"), "body"));
  });

  test("an update targets the declared identity with only the supplied fields and never creates", async () => {
    const updated = contentWriteCase("pullUpdated");
    const { client, transport } = createWriteClient([
      {
        method: "PATCH",
        url: `${instance.baseUrl}${repoPath}/pulls/504`,
        body: recordField(updated, "response"),
      },
    ]);
    const result = await client.writeDeliveryRequest(
      updated.input as Parameters<ReturnType<typeof createGitHubClient>["writeDeliveryRequest"]>[0],
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.identity.entityId).toBe("504");
      expect(result.value.sourceRef).toBe("feat/GH-338/existing-request");
      expect(result.value.reviewState).toBe("open");
    }
    const request = transport.requests[0] as RecordedWrite | undefined;
    expect(request?.method).toBe("PATCH");
    expect(request?.url).toBe(`${instance.baseUrl}${repoPath}/pulls/504`);
    expect(writeBody(request)).toEqual(recordField(recordField(updated, "request"), "body"));
    expect(transport.requests.some((entry) => entry.method === "POST")).toBe(false);
  });

  for (const key of [
    "pullCreateMissingRef",
    "pullCreateMissingTargetRef",
    "pullCreateEmptyTitle",
    "pullUpdateEmpty",
  ]) {
    test(`${key} is a named refusal naming the missing field with zero provider requests`, async () => {
      const entry = contentWriteCase(key);
      const { client, transport } = createWriteClient([]);
      const result = await client.writeDeliveryRequest(
        entry.input as Parameters<ReturnType<typeof createGitHubClient>["writeDeliveryRequest"]>[0],
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("provider.payload.invalid");
        for (const mention of arrayField(entry, "mentions")) {
          expect(result.detail).toContain(String(mention));
        }
      }
      expect(transport.requests).toEqual([]);
    });
  }
});
