/** Jira closeout writes: done transition, label replace preservation, clear. */
import { describe, expect, test } from "bun:test";
import {
  issueUrl,
  jiraInstance,
  jiraIssueFixture,
  makeJiraClient,
} from "../../fixtures/closeout/jira-client";
import { readJson, requireRecord } from "./support";

const dependentsUrl = (key: string, limit: number): string =>
  `${jiraInstance.baseUrl}/rest/api/2/search?jql=${encodeURIComponent(
    `issue in linkedIssues("${key}") AND statusCategory != Done ORDER BY key ASC`,
  )}&maxResults=${limit}`;

const parsed = (body: string | undefined): Record<string, unknown> => {
  if (body === undefined) throw new Error("expected a request body");
  const value: unknown = JSON.parse(body);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected an object body");
  }
  return value as Record<string, unknown>;
};

describe("TC-CLOSE-067 Jira read observation", () => {
  test("an observed issue returns the discriminated observation and label signal", async () => {
    const { client } = makeJiraClient();
    const result = await client.readWorkItemObservation("TRACK-101");
    expect(result.observation).toBe("observed");
    if (result.observation === "observed") {
      expect(result.value.identity.entityId).toBe("TRACK-101");
      expect(result.signals?.labels).toBe("observed");
      expect(result.signals?.relations).toBe("observed");
    }
  });

  test("an omitted label container is unavailable and never a full-array replace", async () => {
    const issue = JSON.parse(JSON.stringify(jiraIssueFixture())) as {
      fields: Record<string, unknown>;
    };
    delete issue.fields.labels;
    const { client } = makeJiraClient([{ method: "GET", url: issueUrl("TRACK-101"), body: issue }]);
    const result = await client.readWorkItemObservation("TRACK-101");
    expect(result.observation).toBe("observed");
    if (result.observation === "observed") {
      expect(result.signals?.labels).toBe("unavailable");
    }
    const write = await client.writeWorkItem({
      issueKey: "TRACK-101",
      add: ["delivered"],
    });
    expect(write.ok).toBe(false);
  });

  test("401/403/500 are invalid, not an unavailable surface", async () => {
    for (const status of [401, 403, 500]) {
      const { client } = makeJiraClient([
        { method: "GET", url: issueUrl("TRACK-101"), status, body: {} },
      ]);
      expect((await client.readWorkItemObservation("TRACK-101")).observation, String(status)).toBe(
        "invalid",
      );
    }
  });

  test("404 is not-found and a malformed 2xx is invalid", async () => {
    const notFound = makeJiraClient([
      {
        method: "GET",
        url: issueUrl("TRACK-101"),
        status: 404,
        body: readJson("tests/fixtures/providers/jira/closeout-read-not-found.json"),
      },
    ]);
    expect((await notFound.client.readWorkItemObservation("TRACK-101")).observation).toBe(
      "not-found",
    );
    const malformed = makeJiraClient([
      {
        method: "GET",
        url: issueUrl("TRACK-101"),
        status: 200,
        body: readJson("tests/fixtures/providers/jira/closeout-read-malformed.json"),
      },
    ]);
    expect((await malformed.client.readWorkItemObservation("TRACK-101")).observation).toBe(
      "invalid",
    );
  });
});

describe("TC-CLOSE-020 Jira done transition", () => {
  test("the transition is data-driven and posts the mapped native status", async () => {
    const { client, transport } = makeJiraClient();
    const result = await client.transitionWorkItem({
      issueKey: "TRACK-101",
      deliveryState: "done",
    });
    expect(result.ok).toBe(true);
    const post = transport.requests.find(
      (request) => request.method === "POST" && request.url.endsWith("/transitions"),
    );
    const body = parsed(post?.body);
    expect(body.transition).toEqual({ name: "Done" });
  });
});

describe("TC-CLOSE-026 Jira full-array label replace preserves unnamed labels", () => {
  test("only named labels are removed and delivered is added", async () => {
    const { client, transport } = makeJiraClient();
    const result = await client.writeWorkItem({
      issueKey: "TRACK-101",
      remove: ["planning", "spec-ready", "in-progress", "review", "blocked"],
      add: ["delivered"],
    });
    expect(result.ok).toBe(true);
    const put = transport.requests.find((request) => request.method === "PUT");
    const body = parsed(put?.body);
    const fields = body.fields;
    if (typeof fields !== "object" || fields === null) throw new Error("missing fields");
    const expected = requireRecord(
      readJson("tests/fixtures/providers/jira/closeout-labels-replace-write-after.json"),
      "after",
    ).labels;
    expect((fields as Record<string, unknown>).labels).toEqual(expected);
    expect((fields as Record<string, unknown>).labels).toContain("vendor-label");
  });
});

describe("TC-CLOSE-027 Jira assignee clear", () => {
  test("the clear is explicit and preserves labels", async () => {
    const { client, transport } = makeJiraClient();
    const result = await client.writeWorkItem({ issueKey: "TRACK-101", assignee: "none" });
    expect(result.ok).toBe(true);
    const put = transport.requests.find((request) => request.method === "PUT");
    const fields = parsed(put?.body).fields;
    if (typeof fields !== "object" || fields === null) throw new Error("missing fields");
    expect((fields as Record<string, unknown>).assignee).toBeNull();
    expect((fields as Record<string, unknown>).labels).toContain("vendor-label");
  });
});

describe("TC-CLOSE-031 Jira reverse dependents", () => {
  test("the bounded JQL read returns observed dependents", async () => {
    const { client } = makeJiraClient();
    const result = await client.listBlockedByDependents({ issueKey: "TRACK-101", limit: 200 });
    expect(result.observation).toBe("observed");
    if (result.observation === "observed") {
      expect(result.value.map((item) => item.identity.entityId)).toEqual([
        "TRACK-102",
        "TRACK-103",
      ]);
    }
  });

  test("an absent search surface is no-surface, never an empty observed set", async () => {
    const { client } = makeJiraClient([
      {
        method: "GET",
        url: dependentsUrl("TRACK-101", 200),
        status: 404,
        body: {},
      },
    ]);
    const result = await client.listBlockedByDependents({ issueKey: "TRACK-101", limit: 200 });
    expect(result.observation).toBe("no-surface");
  });

  test("a read failure on an existing surface is unavailable", async () => {
    const { client } = makeJiraClient([
      { method: "GET", url: issueUrl("TRACK-101"), body: jiraIssueFixture() },
    ]);
    const result = await client.listBlockedByDependents({ issueKey: "TRACK-101", limit: 200 });
    expect(result.observation).toBe("unavailable");
  });
});
