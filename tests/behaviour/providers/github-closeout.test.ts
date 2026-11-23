/**
 * GitHub closeout surface: discriminated reads, merged-request selection,
 * bounded reverse dependents, named label writes, assignee clear, close, and
 * GraphQL thread resolution — all over committed fixtures.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

const ROOT = process.cwd();

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

describe("GH-366 the additive matched-identities member (TC-MRG-054)", () => {
  test("a match carries EVERY matched identity beside the delivered signals, computed before the selection", async () => {
    // The multi-identity page is built inline (no committed fixture file): two
    // matching merged requests. The member names BOTH; the delivered ranked
    // selection is untouched and still picks the highest number.
    const body = [
      {
        number: 502,
        state: "closed",
        merged_at: "2026-01-02T00:00:00Z",
        merged: true,
        head: { ref: "feat/GH-183/one", sha: "1111111111111111111111111111111111111111" },
        base: { ref: "main-tools" },
      },
      {
        number: 504,
        state: "closed",
        merged_at: "2026-01-03T00:00:00Z",
        merged: true,
        head: { ref: "feat/GH-183/two", sha: "2222222222222222222222222222222222222222" },
        base: { ref: "main-tools" },
      },
    ];
    const { client } = makeGithubClient([{ method: "GET", url: pullsUrl(20), body }]);
    const result = await client.findMergedDeliveryRequest({ workItemRef: "GH-183", limit: 20 });
    expect(result.observation).toBe("observed");
    if (result.observation === "observed") {
      expect([...result.matchedIdentities].sort()).toEqual(["502", "504"]);
      // The delivered selection is unchanged: closeout's ranking keeps its
      // highest-numeric-wins answer.
      expect(result.value.identity.entityId).toBe("504");
    }
  });

  test("a read page matching nothing carries the EMPTY set on the unavailable outcome", async () => {
    const { client } = makeGithubClient([{ method: "GET", url: pullsUrl(20), body: [] }]);
    const result = await client.findMergedDeliveryRequest({ workItemRef: "GH-999", limit: 20 });
    // The member is present and EMPTY: a decidable zero, never an assumed one.
    expect(result).toEqual({ observation: "unavailable", matchedIdentities: [] });
  });

  test("a faulted read keeps the member ABSENT on the delivered invalid shape", async () => {
    // The delivered read collapses every fault input class into one
    // `{observation: "invalid", detail}` shape (HTTP 502 included): the member
    // is absent, and the domain resolves this arm — and the credential arm's
    // member-absent unavailable — to the one declared provider identity
    // (TC-MRG-052).
    const { client } = makeGithubClient([
      { method: "GET", url: pullsUrl(20), status: 502, body: {} },
    ]);
    const result = await client.findMergedDeliveryRequest({ workItemRef: "GH-183", limit: 20 });
    expect(result).toEqual({ observation: "invalid", detail: "GitHub returned HTTP 502" });
    expect(Object.hasOwn(result, "matchedIdentities")).toBe(false);
  });

  test("a payload-invalid fault stays invalid with the member absent", async () => {
    const { client } = makeGithubClient([
      { method: "GET", url: pullsUrl(20), status: 200, body: "not-an-array" },
    ]);
    const result = await client.findMergedDeliveryRequest({ workItemRef: "GH-183", limit: 20 });
    expect(result.observation).toBe("invalid");
    expect(Object.hasOwn(result, "matchedIdentities")).toBe(false);
  });

  test("closeout consumes neither the member nor any count derived from it", async () => {
    // The structural consumption proof: the closeout domain and its edge
    // wiring never reference the additive member, so the shared read's other
    // consumer is unchanged by construction (TC-MRG-054).
    const domain = readFileSync(join(ROOT, "packages/core/src/domain/closeout.ts"), "utf8");
    const edge = readFileSync(join(ROOT, "packages/cli/src/edge.ts"), "utf8");
    expect(domain).not.toContain("matchedIdentities");
    expect(edge).not.toContain("matchedIdentities");
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
        {
          threadId: "PRRT_1",
          resolved: true,
          commentCount: 2,
          authorLogin: "octocat",
          authorKind: "human",
          authorAssociation: "MEMBER",
        },
        {
          threadId: "PRRT_2",
          resolved: false,
          commentCount: 1,
          authorLogin: "dependabot[bot]",
          authorKind: "non-human",
          authorAssociation: "NONE",
        },
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

describe("TC-FLOOR-001 the delivered closeout terminal write is byte-identical", () => {
  test("the done transition is exactly one state-only PATCH with no label request", async () => {
    const { client, transport } = makeGithubClient();
    const result = await client.transitionWorkItem({ entityId: "183", deliveryState: "done" });
    expect(result.ok).toBe(true);
    const writes = transport.requests.filter((request) => request.method !== "GET");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.method).toBe("PATCH");
    expect(writes[0]?.url).toBe(issueUrl(183));
    expect(writes[0]?.body).toBe('{"state":"closed"}');
    expect(writes.filter((request) => request.body?.includes("labels"))).toHaveLength(0);
  });

  test("the done write succeeds when the label signal is unavailable", async () => {
    const payload = { ...(githubIssueFixture() as Record<string, unknown>) };
    delete payload.labels;
    const { client, transport } = makeGithubClient([
      { method: "GET", url: issueUrl(183), body: payload },
      { method: "PATCH", url: issueUrl(183), body: { number: 183, state: "closed" } },
    ]);
    const observation = await client.readWorkItemObservation("183");
    expect(observation.observation).toBe("observed");
    if (observation.observation === "observed") {
      expect(observation.signals?.labels).toBe("unavailable");
    }
    const requestCount = transport.requests.length;
    const result = await client.transitionWorkItem({ entityId: "183", deliveryState: "done" });
    expect(result.ok).toBe(true);
    const writes = transport.requests.slice(requestCount);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.method).toBe("PATCH");
    expect(writes[0]?.body).toBe('{"state":"closed"}');
  });
});
