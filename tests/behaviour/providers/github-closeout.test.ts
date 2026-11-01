/**
 * GitHub closeout surface: discriminated reads, merged-request selection,
 * bounded reverse dependents, named label writes, assignee clear, close, and
 * GraphQL thread resolution — all over committed fixtures.
 */
import { describe, expect, test } from "bun:test";
import { normalizeMergedDeliveryRequestList } from "../../../packages/adapters/src/github/normalize";
import {
  blockersUrl,
  dependenciesUrl,
  githubBlockersFixture,
  githubIssueFixture,
  githubPullsFixture,
  graphqlUrl,
  issueUrl,
  makeGithubClient,
  pullsUrl,
} from "../../fixtures/closeout/github-client";
import { methodAwareMismatch } from "./github-closeout-support";
import { readJson } from "./support";

const parsed = (body: string | undefined): Record<string, unknown> => {
  if (body === undefined) throw new Error("expected a request body");
  const value: unknown = JSON.parse(body);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected a JSON object body");
  }
  return value as Record<string, unknown>;
};

describe("TC-CLOSE-067 GitHub read observation", () => {
  test("an observed issue returns the discriminated observation and label signal", async () => {
    const { client } = makeGithubClient();
    const result = await client.readWorkItemObservation("183");
    expect(result.observation).toBe("observed");
    if (result.observation === "observed") {
      expect(result.value.identity.entityId).toBe("183");
      expect(result.value.labels).toContain("vendor-label");
      expect(result.signals?.labels).toBe("observed");
      expect(result.signals?.relations).toBe("observed");
    }
  });

  test("blockers come from the dependency surface, not an invented issue_links field", async () => {
    const { client, transport } = makeGithubClient([
      {
        method: "GET",
        url: issueUrl(301),
        body: {
          number: 301,
          title: "Dependent",
          state: "open",
          labels: [{ name: "change" }],
          issue_links: [{ type: "blocks", number: 999 }],
        },
      },
      {
        method: "GET",
        url: blockersUrl(301, 200),
        body: githubBlockersFixture(301),
      },
    ]);
    const result = await client.readWorkItemObservation("301");
    expect(result.observation).toBe("observed");
    if (result.observation === "observed") {
      expect(result.signals?.relations).toBe("observed");
      expect(result.value.relations).toEqual([
        { relationKind: "blocked-by", target: { systemName: "github", entityId: "401" } },
      ]);
    }
    expect(transport.requests.some((request) => request.url === blockersUrl(301, 200))).toBe(true);
  });

  test("an omitted label container is an unavailable signal, never an empty set", async () => {
    const payload = { ...(githubIssueFixture() as Record<string, unknown>) };
    delete payload.labels;
    const { client } = makeGithubClient([{ method: "GET", url: issueUrl(183), body: payload }]);
    const result = await client.readWorkItemObservation("183");
    expect(result.observation).toBe("observed");
    if (result.observation === "observed") {
      expect(result.signals?.labels).toBe("unavailable");
    }
    const write = await client.writeWorkItem({ entityId: "183", add: ["delivered"] });
    expect(write.ok).toBe(false);
  });

  test("401/403/500 are invalid, not an unavailable surface", async () => {
    for (const status of [401, 403, 500]) {
      const { client } = makeGithubClient([
        { method: "GET", url: issueUrl(183), status, body: {} },
      ]);
      const result = await client.readWorkItemObservation("183");
      expect(result.observation, String(status)).toBe("invalid");
    }
  });

  test("an explicit 404 is not-found, never a payload failure", async () => {
    const { client } = makeGithubClient([
      {
        method: "GET",
        url: issueUrl(183),
        status: 404,
        body: readJson("tests/fixtures/providers/github/closeout-read-not-found.json"),
      },
    ]);
    expect((await client.readWorkItemObservation("183")).observation).toBe("not-found");
  });

  test("a malformed 2xx payload is invalid, never not-found", async () => {
    const { client } = makeGithubClient([
      {
        method: "GET",
        url: issueUrl(183),
        status: 200,
        body: readJson("tests/fixtures/providers/github/closeout-read-malformed.json"),
      },
    ]);
    expect((await client.readWorkItemObservation("183")).observation).toBe("invalid");
  });
});

describe("TC-CLOSE-057 merged-request selection", () => {
  test("the highest numeric matching merged request wins and carries headSha", async () => {
    const { client, transport } = makeGithubClient();
    const result = await client.findMergedDeliveryRequest({ workItemRef: "GH-183", limit: 20 });
    expect(result.observation).toBe("observed");
    if (result.observation === "observed") {
      expect(result.value.identity.entityId).toBe("504");
      expect(result.value.headSha).toBe("2222222222222222222222222222222222222222");
    }
    expect(transport.requests.some((request) => request.url === pullsUrl(20))).toBe(true);
  });
});

describe("TC-CLOSE-057 merged_at list shape", () => {
  test("a non-null merged_at is merged and a null merged_at is not", () => {
    const normalized = normalizeMergedDeliveryRequestList(githubPullsFixture(), {
      systemName: "github",
    });
    expect(normalized.ok).toBe(true);
    if (normalized.ok) {
      expect(normalized.value.map((request) => request.identity.entityId)).toEqual(["42", "504"]);
    }
  });

  test("the selected merged request carries GraphQL review threads", async () => {
    const { client, transport } = makeGithubClient();
    const result = await client.findMergedDeliveryRequest({ workItemRef: "GH-183", limit: 20 });
    expect(result.observation).toBe("observed");
    if (result.observation === "observed") {
      expect(result.signals?.threads).toBe("observed");
      expect(result.value.threads).toEqual([
        { threadId: "PRRT_1", resolved: true, commentCount: 2 },
        { threadId: "PRRT_2", resolved: false, commentCount: 1 },
      ]);
    }
    const graphql = transport.requests.find(
      (request) => request.method === "POST" && request.url === graphqlUrl,
    );
    expect(graphql?.body).toContain("reviewThreads");
  });

  test("a failed thread read is an unavailable signal, never an observed empty set", async () => {
    const { client } = makeGithubClient([
      { method: "GET", url: pullsUrl(20), body: githubPullsFixture() },
    ]);
    const result = await client.findMergedDeliveryRequest({ workItemRef: "GH-183", limit: 20 });
    expect(result.observation).toBe("observed");
    if (result.observation === "observed") {
      expect(result.signals?.threads).toBe("unavailable");
      expect(result.value.threads).toEqual([]);
    }
  });
});

describe("TC-CLOSE-031 GitHub reverse dependents", () => {
  test("an observed bounded page returns the dependent issues", async () => {
    const { client, transport } = makeGithubClient();
    const result = await client.listBlockedByDependents({ entityId: "183", limit: 200 });
    expect(result.observation).toBe("observed");
    if (result.observation === "observed") expect(result.value).toHaveLength(2);
    expect(transport.requests.some((request) => request.url === dependenciesUrl(183, 200))).toBe(
      true,
    );
  });

  test("an absent surface is no-surface, never unavailable or an empty observed set", async () => {
    const { client } = makeGithubClient([
      { method: "GET", url: dependenciesUrl(183, 200), status: 404, body: {} },
    ]);
    expect(
      (await client.listBlockedByDependents({ entityId: "183", limit: 200 })).observation,
    ).toBe("no-surface");
  });

  test("an existing surface whose current read fails is unavailable, not a provider gap", async () => {
    const { client } = makeGithubClient([
      { method: "GET", url: dependenciesUrl(183, 200), status: 500, body: {} },
    ]);
    expect(
      (await client.listBlockedByDependents({ entityId: "183", limit: 200 })).observation,
    ).toBe("unavailable");
  });
});

describe("TC-CLOSE-020/023/027 GitHub writes", () => {
  test("the done transition patches the issue closed", async () => {
    const { client, transport } = makeGithubClient();
    const result = await client.transitionWorkItem({ entityId: "183", deliveryState: "done" });
    expect(result.ok).toBe(true);
    const patch = transport.requests.find(
      (request) => request.method === "PATCH" && request.url === issueUrl(183),
    );
    expect(parsed(patch?.body).state).toBe("closed");
  });

  test("label remove/add preserves unnamed labels", async () => {
    const { client, transport } = makeGithubClient();
    const result = await client.writeWorkItem({
      entityId: "183",
      remove: ["planning", "review"],
      add: ["delivered"],
    });
    expect(result.ok).toBe(true);
    const patch = transport.requests.find(
      (request) => request.method === "PATCH" && request.url === issueUrl(183),
    );
    const labels = parsed(patch?.body).labels;
    expect(Array.isArray(labels)).toBe(true);
    if (Array.isArray(labels)) {
      expect(labels).not.toContain("planning");
      expect(labels).not.toContain("review");
      expect(labels).toContain("delivered");
      expect(labels).toContain("vendor-label");
      expect(labels).toContain("change");
    }
  });

  test("assignee clear is explicit even when the signal is absent", async () => {
    const { client, transport } = makeGithubClient();
    const result = await client.writeWorkItem({ entityId: "183", assignee: "none" });
    expect(result.ok).toBe(true);
    const patch = transport.requests.find(
      (request) => request.method === "PATCH" && request.url === issueUrl(183),
    );
    expect(parsed(patch?.body).assignee).toBeNull();
  });
});

describe("TC-CLOSE-037 GitHub thread resolution", () => {
  test("the GraphQL mutation posts the thread id and succeeds", async () => {
    const { client, transport } = makeGithubClient();
    const result = await client.resolveDeliveryThread({
      deliveryRequest: { systemName: "github", entityId: "504" },
      threadId: "PRRT_2",
    });
    expect(result.ok).toBe(true);
    const post = transport.requests.find(
      (request) => request.method === "POST" && request.url === graphqlUrl,
    );
    expect(post).toBeDefined();
    const body = parsed(post?.body);
    expect(body.variables).toEqual({ threadId: "PRRT_2" });
    expect(String(body.query)).toContain("resolveReviewThread");
  });

  test("a mutation that leaves the thread unresolved is a classified failure", async () => {
    const { client } = makeGithubClient([
      {
        method: "POST",
        url: graphqlUrl,
        requestBodyContains: "resolveReviewThread",
        body: readJson("tests/fixtures/providers/github/graphql-resolve-thread-unresolved.json"),
      },
    ]);
    const result = await client.resolveDeliveryThread({
      deliveryRequest: { systemName: "github", entityId: "504" },
      threadId: "PRRT_2",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("provider.payload.invalid");
  });
});

describe("TC-CLOSE-006 fixture route method awareness", () => {
  test("a GET route never satisfies a PATCH write", async () => {
    const { client } = makeGithubClient([
      { method: "GET", url: issueUrl(183), body: githubIssueFixture() },
    ]);
    const result = await client.writeWorkItem({ entityId: "183", assignee: "none" });
    expect(result.ok).toBe(false);
    expect(methodAwareMismatch("PATCH", "GET")).toBe(true);
  });
});
