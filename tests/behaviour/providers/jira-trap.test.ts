/**
 * TC-JIRA-001..004 — the Jira trap catalog replayed offline through the
 * production client seed against committed sanitized fixtures.
 *
 * Every assertion is keyed by the trap name; the shared harness prefixes a
 * failure with the name and fixture reference. The mutation controls corrupt the
 * normalization subject (never the committed fixtures) and must fail by name.
 */
import { describe, expect, test } from "bun:test";
import { createEnvironmentCredentialPort } from "../../../packages/adapters/src/credentials/index";
import { JIRA_ADAPTER_CONTRACT } from "../../../packages/adapters/src/jira/capabilities";
import { createJiraClient, type JiraClient } from "../../../packages/adapters/src/jira/client";
import {
  applyJiraCustomFields,
  JIRA_CUSTOM_FIELD_MAPPINGS,
} from "../../../packages/adapters/src/jira/custom-fields";
import {
  jiraNormalizationContext,
  normalizeJiraIssue,
} from "../../../packages/adapters/src/jira/normalize";
import {
  JIRA_WORKFLOW_MAP,
  validateWorkflowMap,
} from "../../../packages/adapters/src/jira/workflow-map";
import type { ExternalSystemInstance, WorkItem } from "../../../packages/core/src/contracts/index";
import { makeJiraClient } from "../../fixtures/closeout/jira-client";
import { fixtureBrand } from "../../fixtures/credentials/cases";
import {
  arrayField,
  createFixtureTransport,
  type FixtureRoute,
  installThrowingFetchGuard,
  readJson,
  recordField,
  requireValue,
  stringField,
} from "./support";
import {
  runTrapCatalog,
  type TrapAssertions,
  type TrapRun,
  type TrapRunOptions,
} from "./trap-harness";

const FIXTURES = "tests/fixtures/providers/jira";
const TRAPS = "tests/fixtures/providers/traps";
const BEFORE = `${FIXTURES}/labels-replace-before.json`;
const AFTER = `${FIXTURES}/labels-replace-after.json`;
const CUSTOM_FIELDS = `${FIXTURES}/custom-fields.json`;
const TRANSITIONS = `${FIXTURES}/transitions.json`;
const WORKFLOW_MAP_FIXTURE = `${FIXTURES}/workflow-map.json`;
const COMMENTS_OMITTED = `${FIXTURES}/comments-omitted.json`;
const COMMENTS_EMPTY = `${FIXTURES}/comments-empty.json`;
const STALLS = `${FIXTURES}/stalls.json`;

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

const issueUrl = (key: string): string =>
  `${instance.baseUrl}/rest/api/2/issue/${encodeURIComponent(key)}`;

const issueBody = (relativePath: string): Record<string, unknown> =>
  recordField(readJson(relativePath), "issue");

const clientFor = (routes: readonly FixtureRoute[]): JiraClient =>
  createJiraClient({ instance, credentials, transport: createFixtureTransport(routes) });

const readThroughClient = async (relativePath: string, key: string): Promise<WorkItem> => {
  const client = clientFor([{ url: issueUrl(key), body: issueBody(relativePath) }]);
  return requireValue(await client.readWorkItem(key), relativePath);
};

const context = jiraNormalizationContext(instance.instanceName, JIRA_WORKFLOW_MAP);
const normalize = (payload: unknown) => normalizeJiraIssue(payload, context);

const itemAt = <T>(items: readonly T[], index: number): T => {
  const item = items[index];
  if (item === undefined) throw new Error(`fixture item ${index} is missing`);
  return item;
};

type Corrupter = (item: WorkItem) => WorkItem;

const corruptedNormalize = (corrupt: Corrupter) => (payload: unknown) => {
  const result = normalize(payload);
  return result.ok ? { ok: true, value: corrupt(result.value) } : result;
};

// --- TC-JIRA-001: label replace semantics -----------------------------------

const labelReplaceCheck = async (
  reader: (relativePath: string) => Promise<readonly string[]>,
): Promise<void> => {
  const before = new Set(await reader(BEFORE));
  const after = new Set(await reader(AFTER));
  expect([...before].sort()).toEqual(["hand-back", "tracker"]);
  expect([...after].sort()).toEqual(["blocked", "tracker"]);
  expect(after.has("hand-back")).toBe(false);
  const repeated = new Set(await reader(AFTER));
  expect([...repeated].sort()).toEqual([...after].sort());
};

const defaultLabels = async (relativePath: string): Promise<readonly string[]> =>
  (await readThroughClient(relativePath, "TRACK-101")).labels;

const accumulatingReader = (() => {
  const accumulated: string[] = [];
  return async (relativePath: string): Promise<readonly string[]> => {
    accumulated.push(...(await defaultLabels(relativePath)));
    return [...accumulated];
  };
})();

// --- TC-JIRA-002: custom-field typing ---------------------------------------

const customFieldCheck = async (
  normalizeIssue: (payload: unknown) => ReturnType<typeof normalize>,
  clientView?: WorkItem,
): Promise<void> => {
  const payload = issueBody(CUSTOM_FIELDS);
  const normalized = normalizeIssue(payload);
  expect(normalized.ok).toBe(true);
  if (!normalized.ok) return;
  const value = normalized.value;
  expect(new Set(value.labels)).toEqual(new Set(["hygiene", "team:platform", "story-points:8"]));
  expect([...value.labels].join("\n")).not.toContain("008");
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain("customfield_");
  expect(serialized).not.toContain("unmapped-raw-value");
  expect(applyJiraCustomFields(recordField(payload, "fields"))).toEqual([
    "team:platform",
    "story-points:8",
  ]);
  expect(JIRA_CUSTOM_FIELD_MAPPINGS.map((mapping) => mapping.fieldId)).toEqual([
    "customfield_10020",
    "customfield_10021",
  ]);
  if (clientView !== undefined) {
    expect(new Set(clientView.labels)).toEqual(new Set(value.labels));
  }
};

const stringifiedCustomFields = (item: WorkItem): WorkItem => ({
  ...item,
  labels: item.labels.map((label) =>
    label.startsWith("story-points:") ? "story-points:008" : 'team:{"value":"platform"}',
  ),
});

// --- TC-JIRA-003: transitions as data ---------------------------------------

const transitionsAsDataCheck = (validator: (map: unknown) => string[], mapLike: unknown): void => {
  expect(validator(mapLike)).toEqual([]);
  const states = arrayField(mapLike, "states");
  for (const state of states) {
    expect(stringField(state, "nativeStatus")).toBeDefined();
    expect(stringField(state, "transitionMechanism")).toBeDefined();
  }
  const fixtureStates = arrayField(readJson(WORKFLOW_MAP_FIXTURE), "states");
  for (const state of fixtureStates) {
    const nativeStatus = stringField(state, "nativeStatus");
    const mapping = JIRA_WORKFLOW_MAP.states.find(
      (candidate) => candidate.nativeStatus === nativeStatus,
    );
    expect(mapping, `native status ${String(nativeStatus)} must map`).toBeDefined();
    expect(mapping?.transitionMechanism).toBe(stringField(state, "transitionMechanism"));
  }
  const transitions = arrayField(readJson(TRANSITIONS), "transitions");
  for (const transition of transitions) {
    const target = stringField(recordField(transition, "to"), "name");
    expect(JIRA_WORKFLOW_MAP.states.some((state) => state.nativeStatus === target)).toBe(true);
  }
  expect(
    JIRA_ADAPTER_CONTRACT.capabilities.supportedOperations.includes("transition-work-item"),
  ).toBe(true);
};

const mapWithoutMechanisms = {
  systemName: JIRA_WORKFLOW_MAP.systemName,
  states: JIRA_WORKFLOW_MAP.states.map(({ nativeStatus, deliveryState }) => ({
    nativeStatus,
    deliveryState,
  })),
};

// --- TC-JIRA-004: comment omission ------------------------------------------

const commentOmissionCheck = async (
  normalizeIssue: (payload: unknown) => ReturnType<typeof normalize>,
): Promise<void> => {
  const omitted = normalizeIssue(issueBody(COMMENTS_OMITTED));
  const empty = normalizeIssue(issueBody(COMMENTS_EMPTY));
  expect(omitted.ok).toBe(true);
  expect(empty.ok).toBe(true);
  if (!omitted.ok || !empty.ok) return;
  expect("comments" in omitted.value).toBe(false);
  expect("comments" in empty.value).toBe(true);
  expect(empty.value.comments).toEqual([]);

  const omittedView = await readThroughClient(COMMENTS_OMITTED, "TRACK-107");
  const emptyView = await readThroughClient(COMMENTS_EMPTY, "TRACK-108");
  expect("comments" in omittedView).toBe(false);
  expect(emptyView.comments).toEqual([]);
};

const collapseComments = (item: WorkItem): WorkItem =>
  "comments" in item ? item : { ...item, comments: [] };

// --- TC-JIRA-007 stall signal (JIRA-UPDATED-ABSENT) -------------------------

type StallClass = "active" | "stalled" | "unknown";

const classifyStall = (item: WorkItem, nowMs: number, thresholdMs: number): StallClass => {
  if (item.updatedAt === undefined) return "unknown";
  const updatedMs = Date.parse(item.updatedAt);
  if (!Number.isFinite(updatedMs)) return "unknown";
  return nowMs - updatedMs <= thresholdMs ? "active" : "stalled";
};

const stallViews = (
  normalizeIssue: (payload: unknown) => ReturnType<typeof normalize>,
): WorkItem[] =>
  arrayField(readJson(STALLS), "issues").map((issue) => {
    const normalized = normalizeIssue(issue);
    if (!normalized.ok) throw new Error(normalized.detail);
    return normalized.value;
  });

const updatedAbsentCheck = async (
  normalizeIssue: (payload: unknown) => ReturnType<typeof normalize>,
): Promise<void> => {
  const views = stallViews(normalizeIssue);
  const active = itemAt(views, 0);
  const absentWithComments = itemAt(views, 1);
  const absentWithoutComments = itemAt(views, 2);
  const presentWithoutComments = itemAt(views, 3);

  expect(active.updatedAt).toBeDefined();
  expect(Number.isFinite(Date.parse(active.updatedAt ?? ""))).toBe(true);
  expect(absentWithComments.updatedAt).toBeUndefined();
  expect("comments" in absentWithComments).toBe(true);
  expect(absentWithoutComments.updatedAt).toBeUndefined();
  expect("comments" in absentWithoutComments).toBe(false);
  expect(presentWithoutComments.updatedAt).toBeDefined();
  expect("comments" in presentWithoutComments).toBe(false);

  const nowMs = Date.parse("2026-10-31T00:00:00.000Z");
  const thresholdMs = 72 * 60 * 60 * 1000;
  expect(classifyStall(active, nowMs, thresholdMs)).toBe("active");
  expect(classifyStall(presentWithoutComments, nowMs, thresholdMs)).toBe("stalled");
  expect(classifyStall(absentWithComments, nowMs, thresholdMs)).toBe("unknown");
  expect(classifyStall(absentWithoutComments, nowMs, thresholdMs)).toBe("unknown");

  const absentBody = itemAt(arrayField(readJson(STALLS), "issues"), 1);
  const client = clientFor([{ url: issueUrl("TRACK-202"), body: absentBody }]);
  const viaClient = requireValue(await client.readWorkItem("TRACK-202"), "TRACK-202");
  expect(viaClient.updatedAt).toBeUndefined();
};

// --- The catalog ------------------------------------------------------------

const closeoutDoneTransition = async (): Promise<void> => {
  const { client, transport } = makeJiraClient();
  const result = await client.transitionWorkItem({ issueKey: "TRACK-101", deliveryState: "done" });
  expect(result.ok).toBe(true);
  const post = transport.requests.find(
    (request) => request.method === "POST" && request.url.endsWith("/transitions"),
  );
  if (post?.body === undefined) throw new Error("missing transition body");
  const body: unknown = JSON.parse(post.body);
  if (typeof body !== "object" || body === null) throw new Error("invalid transition body");
  expect((body as Record<string, unknown>).transition).toEqual({ id: "31" });
};

const closeoutLabelPreserve = async (): Promise<void> => {
  const { client, transport } = makeJiraClient();
  const result = await client.writeWorkItem({
    issueKey: "TRACK-101",
    remove: ["planning", "spec-ready", "in-progress", "review", "blocked"],
    add: ["delivered"],
  });
  expect(result.ok).toBe(true);
  const put = transport.requests.find((request) => request.method === "PUT");
  if (put?.body === undefined) throw new Error("missing label body");
  const body: unknown = JSON.parse(put.body);
  if (typeof body !== "object" || body === null) throw new Error("invalid label body");
  const fields = (body as Record<string, unknown>).fields;
  if (typeof fields !== "object" || fields === null) throw new Error("invalid fields");
  expect((fields as Record<string, unknown>).labels).toEqual([
    "change",
    "vendor-label",
    "delivered",
  ]);
};

const defaultAssertions: TrapAssertions = {
  "JIRA-LABEL-REPLACE": () => labelReplaceCheck(defaultLabels),
  "JIRA-CUSTOM-FIELD-TYPING": async () => {
    await customFieldCheck(normalize, await readThroughClient(CUSTOM_FIELDS, "TRACK-105"));
  },
  "JIRA-TRANSITIONS-AS-DATA": () => {
    transitionsAsDataCheck(validateWorkflowMap, JIRA_WORKFLOW_MAP);
  },
  "JIRA-COMMENT-OMISSION": () => commentOmissionCheck(normalize),
  "JIRA-UPDATED-ABSENT": () => updatedAbsentCheck(normalize),
  "JIRA-CLOSEOUT-DONE-TRANSITION": closeoutDoneTransition,
  "JIRA-CLOSEOUT-LABEL-PRESERVE": closeoutLabelPreserve,
};

const runWithGuard = async (options: Omit<TrapRunOptions, "provider">): Promise<TrapRun> => {
  const guard = installThrowingFetchGuard();
  try {
    const run = await runTrapCatalog({ ...options, provider: "jira" });
    expect(guard.calls).toEqual([]);
    return run;
  } finally {
    guard.restore();
  }
};

describe("TC-TRAP-002 Jira trap catalog replays offline", () => {
  test("every Jira trap entry passes and names its fixture", async () => {
    const run = await runWithGuard({
      catalogRoot: TRAPS,
      assertions: defaultAssertions,
    });
    expect(run.failures).toEqual([]);
    expect(run.results.map((result) => result.trapName)).toEqual([
      "JIRA-LABEL-REPLACE",
      "JIRA-CUSTOM-FIELD-TYPING",
      "JIRA-TRANSITIONS-AS-DATA",
      "JIRA-COMMENT-OMISSION",
      "JIRA-UPDATED-ABSENT",
      "JIRA-CLOSEOUT-DONE-TRANSITION",
      "JIRA-CLOSEOUT-LABEL-PRESERVE",
    ]);
  });

  test("double replay is identical and order-independent", async () => {
    const first = await runWithGuard({ catalogRoot: TRAPS, assertions: defaultAssertions });
    const second = await runWithGuard({ catalogRoot: TRAPS, assertions: defaultAssertions });
    expect(second.results).toEqual(first.results);
  });

  test("mutated normalization fails naming the trap entry and fixture", async () => {
    const mutations: Array<{ trapName: string; assertion: () => Promise<void> | void }> = [
      {
        trapName: "JIRA-LABEL-REPLACE",
        assertion: () => labelReplaceCheck(accumulatingReader),
      },
      {
        trapName: "JIRA-CUSTOM-FIELD-TYPING",
        assertion: () => customFieldCheck(corruptedNormalize(stringifiedCustomFields)),
      },
      {
        trapName: "JIRA-TRANSITIONS-AS-DATA",
        assertion: () => transitionsAsDataCheck(() => [], mapWithoutMechanisms),
      },
      {
        trapName: "JIRA-COMMENT-OMISSION",
        assertion: () => commentOmissionCheck(corruptedNormalize(collapseComments)),
      },
      {
        trapName: "JIRA-UPDATED-ABSENT",
        assertion: () =>
          updatedAbsentCheck(
            corruptedNormalize((item) =>
              item.updatedAt === undefined
                ? { ...item, updatedAt: "2026-10-31T00:00:00.000Z" }
                : item,
            ),
          ),
      },
    ];

    for (const mutation of mutations) {
      const run = await runWithGuard({
        catalogRoot: TRAPS,
        assertions: { ...defaultAssertions, [mutation.trapName]: mutation.assertion },
      });
      const failure = run.failures.find((message) => message.startsWith(mutation.trapName));
      expect(failure, `${mutation.trapName} mutation must fail`).toBeDefined();
      expect(failure).toContain(mutation.trapName);
      expect(failure).toContain("tests/fixtures/providers/jira/");
    }
  });

  test("an unfixtured provider path fails loudly, never reaching the network", async () => {
    const transport = createFixtureTransport([]);
    const client = createJiraClient({ instance, credentials, transport });
    const guard = installThrowingFetchGuard();
    try {
      const result = await client.readWorkItem("TRACK-999");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("provider.payload.invalid");
        if ("detail" in result) {
          expect(result.detail).toContain("Jira request failed");
        }
      }
      expect(guard.calls).toEqual([]);
      await expect(
        transport.send({ url: issueUrl("TRACK-999"), method: "GET", headers: {} }),
      ).rejects.toThrow(/unfixtured provider request/);
    } finally {
      guard.restore();
    }
  });
});
