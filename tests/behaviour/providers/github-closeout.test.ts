/**
 * GitHub closeout surface: discriminated reads, merged-request selection,
 * bounded reverse dependents, named label writes, assignee clear, close, and
 * GraphQL thread resolution — all over committed fixtures.
 */
import { describe, expect, test } from "bun:test";
import {
  defaultGithubRoutes,
  dependenciesUrl,
  githubIssueFixture,
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
  test("an observed issue returns the discriminated observation", async () => {
    const { client } = makeGithubClient();
    const result = await client.readWorkItemObservation("183");
    expect(result.observation).toBe("observed");
    if (result.observation === "observed") {
      expect(result.value.identity.entityId).toBe("183");
      expect(result.value.labels).toContain("vendor-label");
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

  test("an absent surface is unavailable, never an empty observed set", async () => {
    const { client } = makeGithubClient([
      { method: "GET", url: dependenciesUrl(183, 200), status: 404, body: {} },
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
