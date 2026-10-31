/**
 * TC-JIRA-005..008 — the four M0-S6 tracker query families answered from
 * normalized `WorkItem` data alone.
 *
 * The collector itself is the downstream M0-S6 story; the predicates here are
 * test-local stand-ins that consume only normalized port fields. Time is
 * injected explicitly (no real clock, no sleeps).
 */
import { describe, expect, test } from "bun:test";
import { createEnvironmentCredentialPort } from "../../../packages/adapters/src/credentials/index";
import { createJiraClient } from "../../../packages/adapters/src/jira/client";
import type { ExternalSystemInstance, WorkItem } from "../../../packages/core/src/contracts/index";
import { fixtureBrand } from "../../fixtures/credentials/cases";
import {
  arrayField,
  createFixtureTransport,
  readJson,
  recordField,
  requireValue,
  stringField,
} from "./support";

const TRACKER_QUERIES = "tests/fixtures/providers/jira/tracker-queries.json";
const STALLS = "tests/fixtures/providers/jira/stalls.json";
const STALL_JQL = "project = TRACK ORDER BY updated DESC";

const instance: ExternalSystemInstance = {
  instanceName: "tracker-primary",
  systemKind: "tracker",
  baseUrl: "https://jira.example.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: {
      referenceName: "jira-read",
      sourceKey: { style: "literal", name: "FIXTURE_JIRA_TOKEN" },
    },
  },
};

const credentials = createEnvironmentCredentialPort({
  environment: { FIXTURE_JIRA_TOKEN: "canary-jira-read-token" },
  brand: fixtureBrand,
});

const searchUrl = (jql: string): string =>
  `${instance.baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}`;

const section = (name: string): Record<string, unknown> =>
  recordField(readJson(TRACKER_QUERIES), name);

const familyClient = (name: string) => {
  const value = section(name);
  const jql = stringField(value, "jql");
  if (jql === undefined) throw new Error(`fixture section ${name} has no jql`);
  const transport = createFixtureTransport([
    { url: searchUrl(jql), body: { issues: arrayField(value, "issues") } },
  ]);
  return { client: createJiraClient({ instance, credentials, transport }), jql };
};

const readFamily = async (name: string): Promise<readonly WorkItem[]> => {
  const { client, jql } = familyClient(name);
  return requireValue(await client.searchWorkItems(jql), name);
};

const readStalls = async (): Promise<readonly WorkItem[]> => {
  const transport = createFixtureTransport([
    { url: searchUrl(STALL_JQL), body: { issues: arrayField(readJson(STALLS), "issues") } },
  ]);
  const client = createJiraClient({ instance, credentials, transport });
  return requireValue(await client.searchWorkItems(STALL_JQL), STALLS);
};

const ids = (items: readonly WorkItem[]): string[] =>
  items.map((item) => item.identity.entityId).sort();

const itemById = (items: readonly WorkItem[], entityId: string): WorkItem => {
  const item = items.find((candidate) => candidate.identity.entityId === entityId);
  if (item === undefined) throw new Error(`fixture item ${entityId} is missing`);
  return item;
};

// --- TC-JIRA-005: owner hand-backs ------------------------------------------

/** A hand-back or unowned item needs owner attention (normalized fields only). */
const isOwnerHandBack = (item: WorkItem): boolean =>
  item.labels.includes("hand-back") || item.assignee === undefined;

describe("TC-JIRA-005 owner hand-backs", () => {
  test("assignee and ownership labels are normalized on the view", async () => {
    const items = await readFamily("owner-hand-backs");
    for (const item of items) {
      expect(item.identity.systemName).toBe(instance.instanceName);
      expect(item.status.nativeStatus.length).toBeGreaterThan(0);
      if (item.assignee !== undefined) expect(typeof item.assignee).toBe("string");
    }
    expect(itemById(items, "TRACK-301").labels).toContain("hand-back");
    expect(itemById(items, "TRACK-302").assignee).toBeUndefined();
  });

  test("the predicate answers the family from normalized fields alone", async () => {
    const items = await readFamily("owner-hand-backs");
    expect(ids(items.filter(isOwnerHandBack))).toEqual(["TRACK-301", "TRACK-302"]);
    const normalizedKeys = [
      "identity",
      "title",
      "status",
      "labels",
      "assignee",
      "relations",
      "comments",
      "updatedAt",
    ];
    for (const item of items) {
      for (const key of Object.keys(item)) {
        expect(normalizedKeys).toContain(key);
      }
    }
  });

  test("reverse-order replay yields the same result set", async () => {
    const items = await readFamily("owner-hand-backs");
    const forward = ids(items.filter(isOwnerHandBack));
    const reverse = ids([...items].reverse().filter(isOwnerHandBack));
    expect(reverse).toEqual(forward);
  });
});

// --- TC-JIRA-006: blocked dependencies -------------------------------------

const isBlocked = (item: WorkItem): boolean =>
  item.relations.some((relation) => relation.relationKind === "blocked-by");

describe("TC-JIRA-006 blocked dependencies", () => {
  test("typed relations preserve both directions and provider-qualified targets", async () => {
    const items = await readFamily("blocked-dependencies");
    const blocked = itemById(items, "TRACK-311");
    const blocker = itemById(items, "TRACK-312");
    expect(blocked.relations).toEqual([
      {
        relationKind: "blocked-by",
        target: { systemName: instance.instanceName, entityId: "TRACK-312" },
      },
    ]);
    expect(blocker.relations).toEqual([
      {
        relationKind: "blocks",
        target: { systemName: instance.instanceName, entityId: "TRACK-311" },
      },
    ]);
  });

  test("the blocked predicate needs typed relations, never key parsing", async () => {
    const items = await readFamily("blocked-dependencies");
    expect(ids(items.filter(isBlocked))).toEqual(["TRACK-311"]);
    const unrelated = itemById(items, "TRACK-313");
    expect(unrelated.relations).toEqual([]);
  });
});

// --- TC-JIRA-007: stalls -----------------------------------------------------

type StallClass = "active" | "stalled" | "unknown";

const classifyStall = (item: WorkItem, nowMs: number, thresholdMs: number): StallClass => {
  if (item.updatedAt === undefined) return "unknown";
  const updatedMs = Date.parse(item.updatedAt);
  if (!Number.isFinite(updatedMs)) return "unknown";
  return nowMs - updatedMs <= thresholdMs ? "active" : "stalled";
};

const NOW_MS = Date.parse("2026-10-31T00:00:00.000Z");
const THRESHOLD_MS = 72 * 60 * 60 * 1000;

const assertAbsentIsUnknown = (items: readonly WorkItem[]): void => {
  for (const entityId of ["TRACK-202", "TRACK-203"]) {
    if (itemById(items, entityId).updatedAt !== undefined) {
      throw new Error(`JIRA-UPDATED-ABSENT: ${entityId} carries a fabricated timestamp`);
    }
  }
};

describe("TC-JIRA-007 stalls via updatedAt (absent = unknown)", () => {
  test("known activity classifies deterministically; absence stays unknown", async () => {
    const items = await readStalls();
    const recent = itemById(items, "TRACK-201");
    const old = itemById(items, "TRACK-204");
    expect(Number.isFinite(Date.parse(recent.updatedAt ?? ""))).toBe(true);
    expect(Number.isFinite(Date.parse(old.updatedAt ?? ""))).toBe(true);
    expect(classifyStall(recent, NOW_MS, THRESHOLD_MS)).toBe("active");
    expect(classifyStall(old, NOW_MS, THRESHOLD_MS)).toBe("stalled");
    expect(classifyStall(itemById(items, "TRACK-202"), NOW_MS, THRESHOLD_MS)).toBe("unknown");
    expect(classifyStall(itemById(items, "TRACK-203"), NOW_MS, THRESHOLD_MS)).toBe("unknown");
  });

  test("comments and ordering never supply a timestamp", async () => {
    const items = await readStalls();
    const absentWithComments = itemById(items, "TRACK-202");
    expect(absentWithComments.comments?.length).toBeGreaterThan(0);
    expect(absentWithComments.updatedAt).toBeUndefined();
    expect("comments" in itemById(items, "TRACK-204")).toBe(false);
    expect(() => assertAbsentIsUnknown(items)).not.toThrow();
  });

  test("a fabrication regression fails naming JIRA-UPDATED-ABSENT", async () => {
    const items = await readStalls();
    const fabricated = items.map((item) =>
      item.updatedAt === undefined ? { ...item, updatedAt: "2026-10-31T00:00:00.000Z" } : item,
    );
    expect(() => assertAbsentIsUnknown(fabricated)).toThrow(/JIRA-UPDATED-ABSENT/);
  });

  test("reverse-order replay yields the same classification", async () => {
    const items = await readStalls();
    const forward = [...items].map((item) => classifyStall(item, NOW_MS, THRESHOLD_MS));
    const reverse = [...items].reverse().map((item) => classifyStall(item, NOW_MS, THRESHOLD_MS));
    expect([...reverse].reverse()).toEqual(forward);
  });
});

// --- TC-JIRA-008: ticket hygiene --------------------------------------------

const isHygienic = (item: WorkItem): boolean =>
  item.title.trim().length > 0 && item.labels.length > 0 && item.labels.includes("tracker");

describe("TC-JIRA-008 ticket hygiene", () => {
  test("native and delivery status are both present and typed", async () => {
    const items = await readFamily("ticket-hygiene");
    for (const item of items) {
      expect(item.status.nativeStatus.length).toBeGreaterThan(0);
      expect(["backlog", "ready", "in-progress", "in-review", "done", "canceled"]).toContain(
        item.status.deliveryState,
      );
    }
  });

  test("the hygiene predicate identifies the expected non-conforming items", async () => {
    const items = await readFamily("ticket-hygiene");
    const findings = ids(items.filter((item) => !isHygienic(item)));
    expect(findings).toEqual(["TRACK-322", "TRACK-323"]);
    for (const item of items) {
      expect(Object.keys(item)).not.toContain("fields");
      expect(Object.keys(item)).not.toContain("issuelinks");
    }
  });

  test("a removed label is absent on the normalized read (replace cross-check)", async () => {
    const items = await readFamily("ticket-hygiene");
    const removed = itemById(items, "TRACK-324");
    expect(removed.labels).toEqual(["tracker"]);
    expect(removed.labels).not.toContain("hand-back");
  });
});
