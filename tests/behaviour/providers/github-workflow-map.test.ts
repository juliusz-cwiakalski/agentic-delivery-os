/**
 * TC-BACKLOG-003..008/010 — one injected, seeded workflow map drives read
 * normalization and the mechanism-scoped transition write.
 *
 * The current-read precondition is adapter-local INPUT data: a `label-swap`
 * refusal must issue ZERO provider requests, so the caller supplies the read it
 * already holds rather than the adapter issuing one. Round-trip read-back uses
 * the stateful single-issue transport; the conformance tenant stays stateless.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEnvironmentCredentialPort } from "../../../packages/adapters/src/credentials/index";
import {
  createGitHubClient,
  type GithubClient,
  type GithubTransitionWorkItemInput,
} from "../../../packages/adapters/src/github/client";
import {
  GITHUB_WORKFLOW_MAP_SEED,
  githubWritableAliases,
  planGithubTransition,
  resolveGithubReadStatus,
  validateGithubWorkflowMap,
} from "../../../packages/adapters/src/github/workflow-map";
import type {
  CloseoutReadObservation,
  ExternalSystemInstance,
  WorkflowMap,
  WorkItem,
} from "../../../packages/core/src/contracts/index";
import { fixtureBrand } from "../../fixtures/credentials/cases";
import {
  arrayField,
  createFixtureTransport,
  createStatefulIssueTransport,
  readJson,
  recordField,
  requireRecord,
  requireValue,
} from "./support";

const FIXTURES = "tests/fixtures/providers/github";
const CASES = `${FIXTURES}/workflow-map-cases.json`;
const WRITES = `${FIXTURES}/issue-writes.json`;
const ISSUE_NUMBER = 601;

const instance: ExternalSystemInstance = {
  instanceName: "github",
  systemKind: "vcs",
  baseUrl: "https://api.github.example.com",
  authMethod: { mechanism: "anonymous" },
};

const credentials = createEnvironmentCredentialPort({ environment: {}, brand: fixtureBrand });
const repository = { owner: "group-placeholder", name: "project-placeholder" } as const;
const issueUrl = `${instance.baseUrl}/repos/${repository.owner}/${repository.name}/issues/${ISSUE_NUMBER}`;

const cases = requireRecord(readJson(CASES), "workflow-map cases");
const issueWrites = requireRecord(readJson(WRITES), "issue writes");
const seedRows = arrayField(cases, "seedRows");
const readOutcomes = arrayField(cases, "readOutcomes");
const maps = recordField(cases, "maps");
const issues = recordField(cases, "issues");
const invalidMaps = arrayField(cases, "invalidMaps");
const writableRoundTrips = arrayField(cases, "writableRoundTrips");

type IssueWrite = { readonly state?: string; readonly labels?: readonly string[] };

const payloadFor = (input: {
  readonly state: string;
  readonly labels?: readonly string[];
}): Record<string, unknown> => ({
  number: ISSUE_NUMBER,
  title: "Workflow-map case issue",
  state: input.state,
  ...(input.labels === undefined ? {} : { labels: input.labels.map((name) => ({ name })) }),
});

const clientFor = (input: {
  readonly transport: ReturnType<typeof createFixtureTransport>;
  readonly workflowMap?: WorkflowMap;
}): GithubClient =>
  createGitHubClient({
    instance,
    credentials,
    repository,
    transport: input.transport,
    ...(input.workflowMap === undefined ? {} : { workflowMap: input.workflowMap }),
  });

const writableBodies = (
  requests: readonly { readonly method: string; readonly body?: string }[],
): IssueWrite[] =>
  requests
    .filter((request) => request.method === "PATCH" && request.body !== undefined)
    .map((request) => JSON.parse(request.body ?? "{}") as IssueWrite);

const currentFrom = (observation: CloseoutReadObservation<WorkItem>) => {
  if (observation.observation !== "observed") {
    throw new Error(`expected an observed issue, got ${observation.observation}`);
  }
  return {
    deliveryState: observation.value.status.deliveryState,
    ...(observation.signals?.labels === "observed" ? { labels: observation.value.labels } : {}),
  };
};

const issuesWithLabels = (current: {
  readonly deliveryState: string;
  readonly labels?: readonly string[];
}): Record<string, unknown> =>
  current.deliveryState === "done"
    ? payloadFor({
        state: "closed",
        ...(current.labels === undefined ? {} : { labels: current.labels }),
      })
    : payloadFor({
        state: "open",
        ...(current.labels === undefined ? {} : { labels: current.labels }),
      });

describe("TC-BACKLOG-003 the declared four-row seed has load-bearing precedence", () => {
  test("the seed is exactly the declared rows in precedence order", () => {
    expect(GITHUB_WORKFLOW_MAP_SEED.systemName).toBe("github");
    expect(GITHUB_WORKFLOW_MAP_SEED.states).toEqual(seedRows);
    expect(GITHUB_WORKFLOW_MAP_SEED.states.map((row) => row.deliveryState)).toEqual([
      "done",
      "in-review",
      "in-progress",
      "ready",
    ]);
  });

  test("a closed issue carrying a lower-precedence label still resolves done", async () => {
    // A `closed` payload carrying `open` and `review` labels: terminal truth wins.
    const transport = createFixtureTransport([
      {
        url: issueUrl,
        body: payloadFor({ state: "closed", labels: ["open", "review"] }),
      },
    ]);
    const result = requireValue(
      await clientFor({ transport }).readWorkItem(ISSUE_NUMBER),
      "terminal precedence",
    );
    expect(result.status.deliveryState).toBe("done");
    expect(result.labels).toEqual(["open", "review"]);
  });

  test("precedence order is load-bearing between two label rows", async () => {
    const transport = createFixtureTransport([
      {
        url: issueUrl,
        body: payloadFor({ state: "open", labels: ["in-progress", "review"] }),
      },
    ]);
    const result = requireValue(
      await clientFor({ transport }).readWorkItem(ISSUE_NUMBER),
      "precedence",
    );
    // `review` precedes `in-progress`, so it wins even though both are present.
    expect(result.status.deliveryState).toBe("in-review");
    expect(result.labels).toEqual(["in-progress", "review"]);
  });
});

describe("TC-BACKLOG-004 the writable set round-trips where admitted; the refusals refuse", () => {
  test("the writable set is done plus each declared label-swap alias", () => {
    expect(githubWritableAliases(GITHUB_WORKFLOW_MAP_SEED).sort()).toEqual([
      "done",
      "in-progress",
      "in-review",
    ]);
  });

  for (const entry of writableRoundTrips) {
    const record = entry as {
      readonly alias: string;
      readonly current: { readonly deliveryState: string; readonly labels?: readonly string[] };
    };
    test(`${record.alias} writes and reads back through the same map`, async () => {
      const transport = createStatefulIssueTransport({
        issueUrl,
        issue: issuesWithLabels(record.current),
      });
      const client = clientFor({ transport });
      const before = await client.readWorkItemObservation(String(ISSUE_NUMBER));
      const current = currentFrom(before);
      const requestCount = transport.requests.length;
      const write = await client.transitionWorkItem({
        entityId: String(ISSUE_NUMBER),
        deliveryState: record.alias as GithubTransitionWorkItemInput["deliveryState"],
        current,
      });
      expect(write.ok).toBe(true);
      expect(transport.requests.length - requestCount).toBe(1);
      const after = requireValue(await client.readWorkItem(ISSUE_NUMBER), "read-back");
      expect(after.status.deliveryState).toBe(record.alias);
    });
  }

  test("a transition to the non-terminal field-update alias ready refuses with zero requests", async () => {
    const transport = createFixtureTransport([]);
    const client = clientFor({ transport });
    const result = await client.transitionWorkItem({
      entityId: String(ISSUE_NUMBER),
      deliveryState: "ready",
      current: { deliveryState: "ready", labels: [] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider.payload.invalid");
      expect(result.detail).toContain("ready");
      expect(result.detail).toContain("field-update");
    }
    expect(transport.requests).toEqual([]);
  });

  test("a label-swap write on a done-resolving issue refuses with zero requests, regardless of labels", async () => {
    for (const key of ["labelless-closed-issue", "labelled-closed-issue"]) {
      const transport = createFixtureTransport([{ url: issueUrl, body: recordField(issues, key) }]);
      const client = clientFor({ transport });
      const current = currentFrom(await client.readWorkItemObservation(String(ISSUE_NUMBER)));
      expect(current.deliveryState).toBe("done");
      const requestCount = transport.requests.length;
      const result = await client.transitionWorkItem({
        entityId: String(ISSUE_NUMBER),
        deliveryState: "in-review",
        current,
      });
      expect(result.ok, key).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("provider.payload.invalid");
        expect(result.detail).toContain("in-review");
        expect(result.detail).toContain("resolves to done");
      }
      expect(transport.requests.length - requestCount, key).toBe(0);
    }
  });

  test("the terminal refusal and the non-terminal refusal are distinguished by their details", async () => {
    const terminal = planGithubTransition({
      map: GITHUB_WORKFLOW_MAP_SEED,
      deliveryState: "in-review",
      current: { deliveryState: "done" },
    });
    const nonTerminal = planGithubTransition({
      map: GITHUB_WORKFLOW_MAP_SEED,
      deliveryState: "ready",
      current: { deliveryState: "ready", labels: [] },
    });
    expect(terminal.ok).toBe(false);
    expect(nonTerminal.ok).toBe(false);
    if (!terminal.ok && !nonTerminal.ok) {
      expect(terminal.detail).not.toBe(nonTerminal.detail);
      expect(terminal.detail).toContain("resolves to done");
      expect(nonTerminal.detail).toContain("field-update");
    }
  });
});

describe("TC-BACKLOG-005 label swap removes declared tokens only", () => {
  test("the written array preserves unrelated labels and drops only declared tokens", async () => {
    const transport = createStatefulIssueTransport({
      issueUrl,
      issue: recordField(issues, "label-swap-before"),
    });
    const client = clientFor({ transport });
    const current = currentFrom(await client.readWorkItemObservation(String(ISSUE_NUMBER)));
    const write = await client.transitionWorkItem({
      entityId: String(ISSUE_NUMBER),
      deliveryState: "in-review",
      current,
    });
    expect(write.ok).toBe(true);
    const bodies = writableBodies(transport.requests);
    const last = bodies[bodies.length - 1];
    expect(last?.labels).toBeDefined();
    const expected = (recordField(cases, "labelSwap").expectedAfter as readonly string[]) ?? [];
    expect([...(last?.labels ?? [])].sort()).toEqual([...expected].sort());
    expect(last?.labels).toContain("vendor-label");
    expect(last?.labels).not.toContain("in-progress");
  });

  test("a field-update row's token is never treated as a label removal", () => {
    const plan = planGithubTransition({
      map: GITHUB_WORKFLOW_MAP_SEED,
      deliveryState: "in-review",
      current: { deliveryState: "in-progress", labels: ["change", "closed", "in-progress"] },
    });
    expect(plan.ok).toBe(true);
    if (plan.ok && plan.write.kind === "label-swap") {
      expect(plan.write.labels).toEqual(["change", "closed", "review"]);
    }
  });
});

describe("TC-BACKLOG-006 label-swap refuses on an unavailable signal or a terminal read", () => {
  test("a labelless open issue refuses a label-swap write with the unavailable-signal detail", async () => {
    const transport = createFixtureTransport([
      { url: issueUrl, body: recordField(issues, "labelless-open-issue") },
    ]);
    const client = clientFor({ transport });
    const observation = await client.readWorkItemObservation(String(ISSUE_NUMBER));
    expect(observation.observation).toBe("observed");
    if (observation.observation === "observed") {
      expect(observation.signals?.labels).toBe("unavailable");
    }
    const current = currentFrom(observation);
    const requestCount = transport.requests.length;
    const result = await client.transitionWorkItem({
      entityId: String(ISSUE_NUMBER),
      deliveryState: "in-review",
      current,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider.payload.invalid");
      expect(result.detail).toContain("in-review");
      expect(result.detail).toContain("unavailable");
      expect(result.detail).not.toContain("resolves to done");
    }
    expect(transport.requests.length - requestCount).toBe(0);
  });

  test("the labelless open fixture is a signal case only because its native state is open", async () => {
    const observation = await clientFor({
      transport: createFixtureTransport([
        { url: issueUrl, body: recordField(issues, "labelless-open-issue") },
      ]),
    }).readWorkItemObservation(String(ISSUE_NUMBER));
    const current = currentFrom(observation);
    expect(current.deliveryState).toBe("ready");
    expect("labels" in current).toBe(false);
  });

  test("the field-update done write on the same labelless open issue stays one state-only PATCH", async () => {
    const expected = recordField(
      recordField(recordField(issueWrites, "doneWrite"), "doneWriteLabelless"),
      "expected",
    );
    const transport = createStatefulIssueTransport({
      issueUrl,
      issue: recordField(issues, "labelless-open-issue"),
    });
    const client = clientFor({ transport });
    await client.readWorkItemObservation(String(ISSUE_NUMBER));
    const requestCount = transport.requests.length;
    const result = await client.transitionWorkItem({
      entityId: String(ISSUE_NUMBER),
      deliveryState: "done",
    });
    expect(result.ok).toBe(true);
    const writes = transport.requests.slice(requestCount);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.method).toBe(expected.method);
    expect(JSON.parse(writes[0]?.body ?? "{}")).toEqual(expected.body);
    expect(writes.filter((request) => request.body?.includes("labels"))).toHaveLength(
      Number(expected.labelRequestCount),
    );
  });
});

describe("TC-BACKLOG-007 an undeclared alias refuses with zero writes", () => {
  for (const alias of arrayField(cases, "unmappedAliases")) {
    test(`${String(alias)} is a named typed refusal with zero provider requests`, async () => {
      const transport = createFixtureTransport([]);
      const client = clientFor({ transport });
      const result = await client.transitionWorkItem({
        entityId: String(ISSUE_NUMBER),
        deliveryState: String(alias) as GithubTransitionWorkItemInput["deliveryState"],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("provider.payload.invalid");
        expect(result.detail).toContain(String(alias));
        expect(result.detail).toContain("not declared");
      }
      expect(transport.requests).toEqual([]);
    });
  }
});

describe("TC-BACKLOG-008 the seven-row read truth table", () => {
  for (const entry of readOutcomes) {
    const record = entry as {
      readonly name: string;
      readonly nativeStatus: string;
      readonly labels?: readonly string[];
      readonly expected?: string;
      readonly map?: string;
      readonly refusalMentions?: readonly string[];
    };
    test(`${record.name} resolves as declared`, async () => {
      const workflowMap =
        record.map === undefined
          ? undefined
          : (recordField(maps, record.map) as unknown as WorkflowMap);
      const transport = createFixtureTransport([
        {
          url: issueUrl,
          body: payloadFor({
            state: record.nativeStatus,
            ...(record.labels === undefined ? {} : { labels: record.labels }),
          }),
        },
      ]);
      const result = await clientFor({
        transport,
        ...(workflowMap === undefined ? {} : { workflowMap }),
      }).readWorkItem(ISSUE_NUMBER);
      if (record.expected !== undefined) {
        expect(result.ok, record.name).toBe(true);
        if (result.ok) {
          expect(result.value.status.deliveryState).toBe(record.expected);
          if (record.labels !== undefined) {
            expect(result.value.labels).toEqual(record.labels);
          }
        }
        return;
      }
      expect(result.ok, record.name).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("provider.payload.invalid");
        for (const mention of record.refusalMentions ?? []) {
          expect(result.detail).toContain(mention);
        }
      }
    });
  }

  test("the anti-vacuity mutation: case-folding both sides resolves the collision row instead of refusing", async () => {
    const fused = resolveGithubReadStatus({
      map: {
        ...GITHUB_WORKFLOW_MAP_SEED,
        states: GITHUB_WORKFLOW_MAP_SEED.states.map((row) => ({
          ...row,
          nativeStatus: row.nativeStatus.toLowerCase(),
        })),
      },
      nativeStatus: "open",
      labels: ["In-Progress".toLowerCase()],
    });
    // The mutation would resolve In-Progress to in-progress; the real client refuses.
    expect(fused.ok).toBe(true);
    if (fused.ok) expect(fused.row.deliveryState).toBe("in-progress");
    const transport = createFixtureTransport([
      { url: issueUrl, body: payloadFor({ state: "open", labels: ["In-Progress"] }) },
    ]);
    const real = await clientFor({ transport }).readWorkItem(ISSUE_NUMBER);
    expect(real.ok).toBe(false);
  });
});

describe("TC-BACKLOG-010 an injected map overrides the seed; an invalid map is captured once", () => {
  test("the injected map drives both directions and a seed-only alias refuses", async () => {
    const workflowMap = recordField(maps, "injected-map") as unknown as WorkflowMap;
    const transport = createStatefulIssueTransport({
      issueUrl,
      issue: payloadFor({ state: "open", labels: ["readiness-passed"] }),
    });
    const client = clientFor({ transport, workflowMap });
    const current = currentFrom(await client.readWorkItemObservation(String(ISSUE_NUMBER)));
    expect(current.deliveryState).toBe("ready");
    const write = await client.transitionWorkItem({
      entityId: String(ISSUE_NUMBER),
      deliveryState: "ready",
      current,
    });
    expect(write.ok).toBe(true);
    const after = requireValue(await client.readWorkItem(ISSUE_NUMBER), "injected read-back");
    expect(after.status.deliveryState).toBe("ready");

    const requestCount = transport.requests.length;
    const seedAlias = await client.transitionWorkItem({
      entityId: String(ISSUE_NUMBER),
      deliveryState: "in-review",
      current: { deliveryState: "ready", labels: ["readiness-passed"] },
    });
    expect(seedAlias.ok).toBe(false);
    if (!seedAlias.ok) expect(seedAlias.detail).toContain("not declared");
    expect(transport.requests.length - requestCount).toBe(0);
  });

  test("the declared seed passes exactly the checks an injected map faces", () => {
    expect(validateGithubWorkflowMap(GITHUB_WORKFLOW_MAP_SEED)).toEqual({ ok: true });
  });

  for (const entry of invalidMaps) {
    const record = entry as {
      readonly name: string;
      readonly map: unknown;
      readonly mentions: readonly string[];
    };
    test(`invalid map ${record.name} is captured at construction and refused by name`, async () => {
      const transport = createFixtureTransport([]);
      let client: GithubClient | undefined;
      expect(() => {
        client = createGitHubClient({
          instance,
          credentials,
          repository,
          transport,
          workflowMap: record.map as WorkflowMap,
        });
      }).not.toThrow();
      if (client === undefined) throw new Error("client was not constructed");
      const first = await client.readWorkItem(ISSUE_NUMBER);
      expect(first.ok).toBe(false);
      if (!first.ok) {
        expect(first.code).toBe("provider.payload.invalid");
        for (const mention of record.mentions) expect(first.detail).toContain(mention);
      }
      const second = await client.writeWorkItem({
        entityId: String(ISSUE_NUMBER),
        assignee: "none",
      });
      expect(second.ok).toBe(false);
      if (!second.ok && !first.ok) expect(second.detail).toBe(first.detail);
      expect(transport.requests).toEqual([]);
    });
  }

  test("the validator is invoked exactly once per construction, never inside an operation", () => {
    const source = readFileSync(
      join(process.cwd(), "packages/adapters/src/github/client.ts"),
      "utf8",
    );
    const invocations = source.match(/validateGithubWorkflowMap\(/gu) ?? [];
    expect(invocations).toHaveLength(1);
  });
});

describe("the map validator names the offending row for every rejection rule", () => {
  test("a non-object map is rejected", () => {
    expect(validateGithubWorkflowMap("not a map").ok).toBe(false);
  });

  test("an invalid row's failure detail is non-empty and row-scoped", () => {
    const invalid = {
      systemName: "project",
      states: [
        { nativeStatus: "closed", deliveryState: "done", transitionMechanism: "field-update" },
        { nativeStatus: "review", deliveryState: "in-review", transitionMechanism: "teleport" },
      ],
    };
    const result = validateGithubWorkflowMap(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detail).toContain("row 1");
      expect(result.detail).toContain("teleport");
    }
  });
});
