/**
 * TC-STATUS-021 read side — bounded GitHub collection reads, PR exclusion,
 * absent review/relation signals, credential-port-only auth, and no second
 * page. The composition-level anonymous guard lives in `status-command.test.ts`.
 */
import { describe, expect, test } from "bun:test";
import { createEnvironmentCredentialPort } from "../../../packages/adapters/src/credentials/index";
import { createGitHubClient } from "../../../packages/adapters/src/github/client";
import type { ExternalSystemInstance } from "../../../packages/core/src/contracts/index";
import { fixtureBrand } from "../../fixtures/credentials/cases";
import {
  arrayField,
  createFixtureTransport,
  installThrowingFetchGuard,
  isRecord,
  readJson,
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
