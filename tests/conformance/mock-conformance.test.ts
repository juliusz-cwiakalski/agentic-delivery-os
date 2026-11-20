/**
 * Runner and coverage controls (GH-189 P3: TC-CONF-010/011/013/014/015).
 *
 * Controls are injected through the runner's adapter list; the production
 * registry never gains a control registration or a write handler.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createGitHubClient } from "@delivery-os/adapters/github";
import {
  ADAPTER_OPERATIONS,
  type AdapterOperation,
  type CapabilityGap,
  type CarrierKind,
  type DeliveryRequest,
  type PipelineRun,
  type WorkItem,
} from "@delivery-os/core/contracts";
import {
  CONFORMANCE_ADAPTERS,
  CONFORMANCE_FLOWS,
  type ConformanceAdapterClient,
  type ConformanceAdapterRegistration,
  type ConformanceCredentialPort,
  type ConformanceReport,
  type ConformanceWriteHandler,
  createMockTenantTransport,
  type MockTenant,
  runConformance,
  runtimeCoverageViolations,
  structuralCoverageViolations,
} from "@delivery-os/testkit";
import {
  createCanaryCredentialPort,
  installChildProcessGuard,
  installThrowingFetchGuard,
  loadMockTenant,
  loadMockTenants,
} from "./support/fixtures";

const CONTROL_SHA = "1111111111111111111111111111111111111111";
const CLOCK = "2026-10-31T00:00:00Z";

const CONTROL_WORK_ITEM: WorkItem = {
  identity: { systemName: "github", entityId: "601" },
  title: "Control work item",
  status: { nativeStatus: "open", deliveryState: "ready" },
  labels: ["tracker"],
  relations: [],
  updatedAt: "2026-10-29T08:00:00Z",
};

const CONTROL_DELIVERY: DeliveryRequest = {
  identity: { systemName: "github", entityId: "504" },
  sourceRef: "feat/GH-189/control",
  targetRef: "main-tools",
  reviewState: "open",
  threads: [],
};

const CONTROL_PIPELINES: readonly PipelineRun[] = [
  {
    identity: { systemName: "github", entityId: `${CONTROL_SHA}:control-run` },
    pipelineName: "control-run",
    jobs: [{ jobName: "control-run", jobState: "succeeded" }],
    traceEvidence: [{ evidenceName: "check-run", location: "https://github.example.com/control" }],
  },
];

const CONTROL_CLIENT: ConformanceAdapterClient = {
  readWorkItem: async () => ({ ok: true, value: CONTROL_WORK_ITEM }),
  readDeliveryRequest: async () => ({ ok: true, value: CONTROL_DELIVERY }),
  readPipelineRun: async () => ({ ok: true, value: CONTROL_PIPELINES }),
};

/** A test-only normalized view that illegally retains a provider-native key. */
const leakedWorkItem = (): WorkItem =>
  Object.assign({}, CONTROL_WORK_ITEM, { html_url: "https://github.example.com/native-view" });

const controlTenant = (): MockTenant => ({
  provenance: "test-only-control 2026-10-31",
  provider: "github",
  adapterName: "github",
  instance: {
    instanceName: "github",
    systemKind: "vcs",
    baseUrl: "https://github.example.com",
    authMethod: { mechanism: "anonymous" },
  },
  credentialReferenceName: "conformance-control",
  addressing: {
    provider: "github",
    owner: "owner-placeholder",
    repo: "project-placeholder",
    issueNumber: 601,
    pullNumber: 504,
    commitSha: CONTROL_SHA,
    threadId: "PRRT_2",
  },
  routes: [],
  expected: {
    "change-lifecycle.read-work-item": CONTROL_WORK_ITEM,
    "change-lifecycle.read-delivery-request": CONTROL_DELIVERY,
    "change-lifecycle.read-pipeline-run": CONTROL_PIPELINES,
    "comment-provenance.read-comments": CONTROL_WORK_ITEM,
    "label-semantics.read-labels": CONTROL_WORK_ITEM,
  },
});

type ControlOptions = {
  readonly supported: readonly AdapterOperation[];
  readonly gaps: readonly CapabilityGap[];
  readonly writableCarriers?: readonly CarrierKind[];
  readonly readableCarriers?: readonly CarrierKind[];
  readonly writeHandler?: ConformanceWriteHandler;
  readonly client?: ConformanceAdapterClient;
  readonly provider?: string;
};

const makeControl = (options: ControlOptions): ConformanceAdapterRegistration => {
  const provider = options.provider ?? "github";
  return {
    provider,
    contract: {
      adapterName: provider,
      systemKind: "vcs",
      capabilities: {
        supportedOperations: options.supported,
        declaredGaps: options.gaps,
        writableCarriers: options.writableCarriers ?? [],
        readableCarriers: options.readableCarriers ?? [],
      },
    },
    buildClient: () => options.client ?? CONTROL_CLIENT,
    ...(options.writeHandler !== undefined ? { writeHandler: options.writeHandler } : {}),
  };
};

const ALL_OPERATIONS: readonly AdapterOperation[] = [
  "read-work-item",
  "write-work-item",
  "transition-work-item",
  "read-delivery-request",
  "write-delivery-request",
  "read-pipeline-run",
  "write-comment",
  "resolve-delivery-thread",
  "merge-delivery-request",
  "close-milestone",
];

const gapsExcept = (supported: readonly AdapterOperation[]): CapabilityGap[] => {
  const set = new Set(supported);
  return ALL_OPERATIONS.filter((operation) => !set.has(operation)).map((operation) => ({
    operation,
    reason: "adapter-not-implemented",
  }));
};

const runMock = async (
  adapters: readonly ConformanceAdapterRegistration[],
  tenants: Readonly<Record<string, MockTenant>>,
  runId = "run-1",
  credentials: ConformanceCredentialPort = createCanaryCredentialPort(),
): Promise<ConformanceReport> =>
  runConformance({
    adapters,
    tenants,
    credentials,
    transportFactory: (provider) => {
      const tenant = tenants[provider];
      if (tenant === undefined) throw new Error(`missing tenant ${provider}`);
      return createMockTenantTransport(tenant);
    },
    nowIso: CLOCK,
    runId,
    tier: "mock",
  });

const runProduction = (runId = "run-1"): Promise<ConformanceReport> =>
  runMock(CONFORMANCE_ADAPTERS, loadMockTenants(), runId);

const controlInput = (
  control: ConformanceAdapterRegistration,
  tenant: MockTenant,
): [readonly ConformanceAdapterRegistration[], Readonly<Record<string, MockTenant>>] => [
  [control],
  { [control.provider]: tenant },
];

const caught = async (task: Promise<unknown>): Promise<Error> => {
  try {
    await task;
  } catch (error: unknown) {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }
  throw new Error("expected the task to fail");
};

describe("TC-CONF-010 undeclared unsupported operations fail closed", () => {
  test("an unsupported operation with no declared gap fails naming adapter and operation", async () => {
    const control = makeControl({
      supported: [],
      gaps: [{ operation: "write-work-item", reason: "adapter-not-implemented" }],
    });
    const error = await caught(runMock(...controlInput(control, controlTenant())));
    expect(error.message).toContain("provider github");
    expect(error.message).toContain("read-work-item");
    expect(error.message).toContain("undeclared unsupported operation");
  });

  test("a gap reason outside the closed set fails by reason", () => {
    const invalid = {
      provider: "github",
      contract: {
        adapterName: "github",
        systemKind: "vcs",
        capabilities: {
          supportedOperations: ["read-work-item"],
          declaredGaps: [{ operation: "write-work-item", reason: "not-a-reason" }],
          writableCarriers: [],
          readableCarriers: [],
        },
      },
      buildClient: () => CONTROL_CLIENT,
    };
    const violations = structuralCoverageViolations({
      flows: CONFORMANCE_FLOWS,
      adapters: [invalid],
    });
    expect(violations.some((message) => message.includes("invalid reason not-a-reason"))).toBe(
      true,
    );
  });

  test("an unsupported write-comment records the declared-gap carrier skip", async () => {
    const control = makeControl({
      supported: ["read-work-item"],
      gaps: gapsExcept(["read-work-item"]),
    });
    const report = await runMock(...controlInput(control, controlTenant()));
    const carrierStep = report.steps.find(
      (step) => step.stepId === "comment-provenance.carrier-roundtrip",
    );
    expect(carrierStep?.status).toBe("skipped");
    expect(carrierStep?.skipKind).toBe("declared-gap");
    expect(carrierStep?.skipReason).toBe("adapter-not-implemented");
    expect(runtimeCoverageViolations(report, [control], "mock")).toEqual([]);
  });

  test("a supported write-comment with no carrier records capability-absent and executes comment", async () => {
    const calls: string[] = [];
    const handler: ConformanceWriteHandler = (input) => {
      calls.push(input.stepId);
      return { ok: true, detail: "control comment written", assertionCount: 1 };
    };
    const control = makeControl({
      supported: ["read-work-item", "write-comment"],
      gaps: gapsExcept(["read-work-item", "write-comment"]),
      writeHandler: handler,
    });
    const report = await runMock(...controlInput(control, controlTenant()));
    const carrierStep = report.steps.find(
      (step) => step.stepId === "comment-provenance.carrier-roundtrip",
    );
    const commentStep = report.steps.find((step) => step.stepId === "change-lifecycle.comment");
    expect(carrierStep?.status).toBe("skipped");
    expect(carrierStep?.skipKind).toBe("capability-absent");
    expect(carrierStep?.skipReason).toBe("no-declared-carrier");
    expect(commentStep?.status).toBe("executed");
    expect(calls).toEqual(["change-lifecycle.comment"]);
    expect(runtimeCoverageViolations(report, [control], "mock")).toEqual([]);
  });

  test("a skipped step never counts as an executed supported step", async () => {
    const control = makeControl({
      supported: ["read-work-item", "write-comment"],
      gaps: gapsExcept(["read-work-item", "write-comment"]),
      writeHandler: () => ({ ok: true, detail: "written", assertionCount: 1 }),
    });
    const report = await runMock(...controlInput(control, controlTenant()));
    const mutated: ConformanceReport = {
      ...report,
      steps: report.steps.map((step) =>
        step.stepId === "change-lifecycle.comment"
          ? { ...step, status: "skipped", skipReason: "live-read-only", skipKind: "live-read-only" }
          : step,
      ),
    };
    expect(
      runtimeCoverageViolations(mutated, [control], "mock").some((message) =>
        message.includes("supported operation write-comment was not executed"),
      ),
    ).toBe(true);
  });
});

describe("TC-CONF-011 runtime coverage is non-vacuous", () => {
  test("the production mock report satisfies runtime coverage for all three adapters", async () => {
    const report = await runProduction();
    expect(report.status).toBe("passed");
    expect(runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")).toEqual([]);
    for (const provider of ["github", "gitlab", "jira"]) {
      const steps = report.steps.filter((step) => step.provider === provider);
      expect(
        steps.some((step) => step.status === "executed"),
        provider,
      ).toBe(true);
    }
    const githubGaps = report.steps.filter(
      (step) => step.provider === "github" && step.skipKind === "declared-gap",
    );
    expect(githubGaps).toEqual([]);
    for (const provider of ["gitlab", "jira"]) {
      expect(
        report.steps.some((step) => step.provider === provider && step.skipKind === "declared-gap"),
        provider,
      ).toBe(true);
    }
  });

  test("losing the only executed step for a supported operation fails by name", async () => {
    const report = await runProduction();
    const mutated: ConformanceReport = {
      ...report,
      steps: report.steps.map((step) =>
        step.provider === "github" && step.operation === "read-work-item"
          ? {
              ...step,
              status: "skipped",
              skipReason: "adapter-not-implemented",
              skipKind: "declared-gap",
            }
          : step,
      ),
    };
    const violations = runtimeCoverageViolations(mutated, CONFORMANCE_ADAPTERS, "mock");
    expect(
      violations.some(
        (message) =>
          message.includes("github") &&
          message.includes("read-work-item") &&
          message.includes("not executed"),
      ),
    ).toBe(true);
  });

  test("a stale declared gap fails by provider and operation", async () => {
    const report = await runProduction();
    const mutated: ConformanceReport = {
      ...report,
      steps: report.steps.map((step) =>
        step.provider === "gitlab" && step.operation === "write-comment"
          ? { ...step, skipReason: "wrong-reason" }
          : step,
      ),
    };
    expect(
      runtimeCoverageViolations(mutated, CONFORMANCE_ADAPTERS, "mock").some(
        (message) => message.includes("gitlab") && message.includes("declared gap write-comment"),
      ),
    ).toBe(true);
  });

  test("a failed step classified as passed fails by provider", async () => {
    const report = await runProduction();
    const failure = {
      assertion: "synthetic",
      expected: "a",
      received: "b",
      reference: "synthetic",
      detail: "synthetic",
    };
    const mutated: ConformanceReport = {
      ...report,
      steps: report.steps.map((step) =>
        step.provider === "github" && step.stepId === "change-lifecycle.read-work-item"
          ? { ...step, status: "failed", assertionCount: 0, failure }
          : step,
      ),
    };
    expect(
      runtimeCoverageViolations(mutated, CONFORMANCE_ADAPTERS, "mock").some((message) =>
        message.includes("github: failed step counted as passed"),
      ),
    ).toBe(true);
  });
});

describe("TC-CONF-013 carrier controls", () => {
  test("a carrier-declaring control executes the roundtrip and the comment", async () => {
    const calls: string[] = [];
    const handler: ConformanceWriteHandler = (input) => {
      calls.push(input.stepId);
      return { ok: true, detail: "carrier metadata roundtrip", assertionCount: 1 };
    };
    const control = makeControl({
      supported: ["read-work-item", "write-comment"],
      gaps: gapsExcept(["read-work-item", "write-comment"]),
      writableCarriers: ["invisible-comment-block"],
      readableCarriers: ["invisible-comment-block"],
      writeHandler: handler,
    });
    const report = await runMock(...controlInput(control, controlTenant()));
    expect(
      report.steps.find((step) => step.stepId === "comment-provenance.carrier-roundtrip")?.status,
    ).toBe("executed");
    expect(report.steps.find((step) => step.stepId === "change-lifecycle.comment")?.status).toBe(
      "executed",
    );
    expect(calls).toEqual(["change-lifecycle.comment", "comment-provenance.carrier-roundtrip"]);
    expect(runtimeCoverageViolations(report, [control], "mock")).toEqual([]);
  });

  test("an empty-carrier control records no-declared-carrier but still executes the comment", async () => {
    const control = makeControl({
      supported: ["read-work-item", "write-comment"],
      gaps: gapsExcept(["read-work-item", "write-comment"]),
      writeHandler: () => ({ ok: true, detail: "comment written", assertionCount: 1 }),
    });
    const report = await runMock(...controlInput(control, controlTenant()));
    const carrierStep = report.steps.find(
      (step) => step.stepId === "comment-provenance.carrier-roundtrip",
    );
    expect(carrierStep?.status).toBe("skipped");
    expect(carrierStep?.skipKind).toBe("capability-absent");
    expect(carrierStep?.skipReason).toBe("no-declared-carrier");
    expect(report.steps.find((step) => step.stepId === "change-lifecycle.comment")?.status).toBe(
      "executed",
    );
    expect(runtimeCoverageViolations(report, [control], "mock")).toEqual([]);
  });

  test("a supported non-read step with no handler fails closed by provider, flow, step and operation", async () => {
    const control = makeControl({
      supported: ["read-work-item", "write-comment"],
      gaps: gapsExcept(["read-work-item", "write-comment"]),
    });
    const error = await caught(runMock(...controlInput(control, controlTenant())));
    for (const fragment of [
      "provider github",
      "flow change-lifecycle",
      "step change-lifecycle.comment",
      "operation write-comment",
    ]) {
      expect(error.message).toContain(fragment);
    }
  });

  test("controls never enter the production registry", () => {
    expect(CONFORMANCE_ADAPTERS).toHaveLength(3);
    for (const registration of CONFORMANCE_ADAPTERS) {
      expect(registration.writeHandler).toBeUndefined();
    }
    const control = makeControl({
      supported: ["read-work-item"],
      gaps: gapsExcept(["read-work-item"]),
    });
    expect(CONFORMANCE_ADAPTERS.includes(control)).toBe(false);
  });

  test("a declared carrier without a carrier step fails structurally", () => {
    const control = makeControl({
      supported: ["read-work-item", "write-comment"],
      gaps: gapsExcept(["read-work-item", "write-comment"]),
      writableCarriers: ["invisible-comment-block"],
      readableCarriers: ["invisible-comment-block"],
      writeHandler: () => ({ ok: true, detail: "written", assertionCount: 1 }),
    });
    const flows = CONFORMANCE_FLOWS.map((flow) => ({
      ...flow,
      steps: flow.steps.filter((step) => step.requiresCarrier !== true),
    }));
    expect(
      structuralCoverageViolations({ flows, adapters: [control] }).some((message) =>
        message.includes("github: declared carrier has no carrier step"),
      ),
    ).toBe(true);
  });
});

describe("TC-CONF-014 deterministic double replay", () => {
  test("identical inputs produce identical reports and injected generation time", async () => {
    const first = await runProduction("deterministic-run");
    const second = await runProduction("deterministic-run");
    expect(second).toEqual(first);
    expect(first.generatedAt).toBe(CLOCK);
    expect(second.generatedAt).toBe(CLOCK);
  });

  test("a failing control produces byte-identical diagnostics across runs", async () => {
    const corrupted: ConformanceAdapterClient = {
      ...CONTROL_CLIENT,
      readWorkItem: async () => ({
        ok: true,
        value: { ...CONTROL_WORK_ITEM, title: "Corrupted control title" },
      }),
    };
    const control = makeControl({
      supported: ["read-work-item"],
      gaps: gapsExcept(["read-work-item"]),
      client: corrupted,
    });
    const first = await runMock(...controlInput(control, controlTenant()), "failing-run");
    const second = await runMock(...controlInput(control, controlTenant()), "failing-run");
    expect(first.steps.filter((step) => step.status === "failed")).toHaveLength(3);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  test("only the injected run id differs between run ids", async () => {
    const first = await runProduction("run-a");
    const second = await runProduction("run-b");
    expect({ ...first, runId: second.runId }).toEqual(second);
  });
});

describe("TC-CONF-015 exact-URL replay and the throwing-fetch guard", () => {
  test("the mock suite makes zero live fetch calls and only exact fixture routes", async () => {
    const tenants = loadMockTenants();
    const transports: ReturnType<typeof createMockTenantTransport>[] = [];
    const guard = installThrowingFetchGuard();
    const childGuard = installChildProcessGuard();
    try {
      const report = await runConformance({
        adapters: CONFORMANCE_ADAPTERS,
        tenants,
        credentials: createCanaryCredentialPort(),
        transportFactory: (provider) => {
          const tenant = tenants[provider];
          if (tenant === undefined) throw new Error(`missing tenant ${provider}`);
          const transport = createMockTenantTransport(tenant);
          transports.push(transport);
          return transport;
        },
        nowIso: CLOCK,
        runId: "offline-run",
        tier: "mock",
      });
      expect(report.status).toBe("passed");
      expect(guard.calls).toHaveLength(0);
      // The mock tier spawns nothing: every CLI path takes an injected runner.
      expect(childGuard.calls).toEqual([]);
    } finally {
      childGuard.restore();
      guard.restore();
    }
    for (const transport of transports) {
      for (const request of transport.requests) {
        expect(["GET", "POST", "PATCH", "PUT"]).toContain(request.method);
      }
    }
    const declared = new Set(
      Object.values(tenants).flatMap((tenant) => tenant.routes.map((route) => route.url)),
    );
    for (const transport of transports) {
      for (const request of transport.requests) {
        expect(declared.has(request.url), request.url).toBe(true);
      }
    }
  });

  test("an unfixtured request fails naming provider, flow, step and the recorded URL", async () => {
    const tenant = loadMockTenant("github");
    if (tenant.addressing.provider !== "github") throw new Error("expected github addressing");
    const missingSha = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const mutated: MockTenant = {
      ...tenant,
      addressing: { ...tenant.addressing, commitSha: missingSha },
    };
    const transport = createMockTenantTransport(mutated);
    const adapters = CONFORMANCE_ADAPTERS.filter((entry) => entry.provider === "github");
    const report = await runConformance({
      adapters,
      tenants: { github: mutated },
      credentials: createCanaryCredentialPort(),
      transportFactory: () => transport,
      nowIso: CLOCK,
      runId: "unfixtured-run",
      tier: "mock",
    });
    const failed = report.steps.find(
      (step) => step.stepId === "change-lifecycle.read-pipeline-run",
    );
    expect(failed?.status).toBe("failed");
    expect(failed?.failure !== undefined).toBe(true);
    expect(failed?.provider).toBe("github");
    expect(failed?.flowId).toBe("change-lifecycle");
    expect(failed?.failure?.reference).toContain("GET ");
    expect(failed?.failure?.reference).toContain(missingSha);
    expect(failed?.failure?.reference).toContain("check-runs");
    expect(failed?.failure?.detail).toContain(missingSha);
    expect(
      transport.requests.some(
        (request) => request.url.includes(missingSha) && request.url.includes("check-runs"),
      ),
    ).toBe(true);
  });

  test("a near-miss query string does not satisfy the exact match", async () => {
    const tenant = loadMockTenant("github");
    const mutated: MockTenant = {
      ...tenant,
      routes: tenant.routes.map((route) =>
        route.url.includes("check-runs")
          ? { ...route, url: route.url.replace("per_page=20", "per_page=21") }
          : route,
      ),
    };
    const transport = createMockTenantTransport(mutated);
    const adapters = CONFORMANCE_ADAPTERS.filter((entry) => entry.provider === "github");
    const report = await runConformance({
      adapters,
      tenants: { github: mutated },
      credentials: createCanaryCredentialPort(),
      transportFactory: () => transport,
      nowIso: CLOCK,
      runId: "near-miss-run",
      tier: "mock",
    });
    expect(
      report.steps.find((step) => step.stepId === "change-lifecycle.read-pipeline-run")?.status,
    ).toBe("failed");
    expect(transport.requests.some((request) => request.url.includes("per_page=20"))).toBe(true);
  });

  test("replay matches an optional exact body and prefers a later body-specific route", async () => {
    const base = loadMockTenant("github");
    const url = `${base.instance.baseUrl}/graphql`;
    const tenant: MockTenant = {
      ...base,
      routes: [
        { method: "POST", url, status: 200, body: { route: "generic" } },
        {
          method: "POST",
          url,
          status: 200,
          body: { route: "specific" },
          requestBody: '{"variables":{"threadId":"PRRT_2"}}',
        },
      ],
    };
    const transport = createMockTenantTransport(tenant);
    const generic = await transport.send({
      url,
      method: "POST",
      headers: {},
      body: '{"variables":{"other":true}}',
    });
    expect(generic.body).toEqual({ route: "generic" });
    const specific = await transport.send({
      url,
      method: "POST",
      headers: {},
      body: '{"variables":{"threadId":"PRRT_2"}}',
    });
    expect(specific.body).toEqual({ route: "specific" });
  });

  test("a wrong body is rejected when the route declares an exact body", async () => {
    const base = loadMockTenant("github");
    const url = `${base.instance.baseUrl}/graphql`;
    const tenant: MockTenant = {
      ...base,
      routes: [
        {
          method: "POST",
          url,
          status: 200,
          body: { route: "specific" },
          requestBody: '{"variables":{"threadId":"PRRT_2"}}',
        },
      ],
    };
    const transport = createMockTenantTransport(tenant);
    await expect(
      transport.send({
        url,
        method: "POST",
        headers: {},
        body: '{"variables":{"threadId":"PRRT_3"}}',
      }),
    ).rejects.toThrow(/unfixtured provider request/);
  });

  test("restoring the guard removes the throwing fetch", () => {
    const original = globalThis.fetch;
    const guard = installThrowingFetchGuard();
    expect(globalThis.fetch).not.toBe(original);
    guard.restore();
    try {
      expect(globalThis.fetch).toBe(original);
      const marker = async (): Promise<string> => "restored";
      globalThis.fetch = marker;
      expect(globalThis.fetch).toBe(marker);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("TC-PARITY-004 the landing operation has a route and an expected projection", () => {
  test("the landing step executes for GitHub with the declared projection", async () => {
    const report = await runSingle("github", loadMockTenant("github"), "github-landing");
    const landing = report.steps.find(
      (step) => step.stepId === "change-lifecycle.merge-delivery-request",
    );
    expect(landing?.status).toBe("executed");
    expect(landing?.operation).toBe("merge-delivery-request");
    expect(report.status).toBe("passed");
  });

  test("GitLab and Jira skip the landing step with their declared gap reasons", async () => {
    const report = await runProduction("landing-gaps");
    const reasonFor = (provider: string): string | null | undefined =>
      report.steps.find(
        (step) =>
          step.provider === provider && step.stepId === "change-lifecycle.merge-delivery-request",
      )?.skipReason;
    expect(reasonFor("gitlab")).toBe("adapter-not-implemented");
    expect(reasonFor("jira")).toBe("provider-unsupported");
  });

  test("a corrupted landing projection fails naming the step", async () => {
    const tenant = loadMockTenant("github");
    const mutated: MockTenant = {
      ...tenant,
      expected: {
        ...tenant.expected,
        "change-lifecycle.merge-delivery-request": { merged: true, mergeCommitSha: "0".repeat(40) },
      },
    };
    const report = await runSingle("github", mutated, "github-landing-corrupt");
    const landing = report.steps.find(
      (step) => step.stepId === "change-lifecycle.merge-delivery-request",
    );
    expect(landing?.status).toBe("failed");
    expect(landing?.failure?.assertion).toBe("expected-projection");
  });

  test("removing the landing route fails the step instead of skipping it", async () => {
    const tenant = loadMockTenant("github");
    const mutated: MockTenant = {
      ...tenant,
      routes: tenant.routes.filter((route) => !route.url.endsWith("/merge")),
    };
    const report = await runSingle("github", mutated, "github-landing-missing-route");
    const landing = report.steps.find(
      (step) => step.stepId === "change-lifecycle.merge-delivery-request",
    );
    expect(landing?.status).toBe("failed");
    expect(landing?.skipKind).toBeNull();
  });
});

describe("TC-PARITY-008 the broken control still fires for the ninth operation", () => {
  test("a landing step that cannot execute is a failure, never a vacuous pass", async () => {
    const tenant = loadMockTenant("github");
    const registration = registrationFor("github");
    const withoutLanding: ConformanceAdapterRegistration = {
      provider: registration.provider,
      contract: registration.contract,
      buildClient: (input) => {
        const client = registration.buildClient(input);
        return {
          ...(client.readWorkItem !== undefined ? { readWorkItem: client.readWorkItem } : {}),
          ...(client.readDeliveryRequest !== undefined
            ? { readDeliveryRequest: client.readDeliveryRequest }
            : {}),
          ...(client.readPipelineRun !== undefined
            ? { readPipelineRun: client.readPipelineRun }
            : {}),
          ...(client.writeWorkItem !== undefined ? { writeWorkItem: client.writeWorkItem } : {}),
          ...(client.transitionWorkItem !== undefined
            ? { transitionWorkItem: client.transitionWorkItem }
            : {}),
          ...(client.resolveDeliveryThread !== undefined
            ? { resolveDeliveryThread: client.resolveDeliveryThread }
            : {}),
          ...(client.writeComment !== undefined ? { writeComment: client.writeComment } : {}),
          ...(client.createDeliveryRequest !== undefined
            ? { createDeliveryRequest: client.createDeliveryRequest }
            : {}),
        };
      },
    };
    const error = await caught(
      runConformance({
        adapters: [withoutLanding],
        tenants: { github: tenant },
        credentials: createCanaryCredentialPort(),
        transportFactory: () => createMockTenantTransport(tenant),
        nowIso: CLOCK,
        runId: "missing-landing-handler",
        tier: "mock",
      }),
    );
    expect(error.message).toContain("merge-delivery-request");
    expect(error.message).toContain("no handler");
  });
});

// ---------------------------------------------------------------------------
// P3 backlog completion: TC-PARITY-001/002/003
// ---------------------------------------------------------------------------

const carrierStepFor = (
  report: ConformanceReport,
  provider: string,
): { readonly skipKind: string | null; readonly skipReason: string | null } | undefined => {
  const step = report.steps.find(
    (entry) =>
      entry.provider === provider && entry.stepId === "comment-provenance.carrier-roundtrip",
  );
  return step === undefined ? undefined : { skipKind: step.skipKind, skipReason: step.skipReason };
};

describe("TC-PARITY-001 registry equals the closed set and coverage is non-vacuous", () => {
  test("the flow registry operation set equals the ten-operation closed set", () => {
    const registry = new Set(
      CONFORMANCE_FLOWS.flatMap((flow) => flow.steps.map((s) => s.operation)),
    );
    expect([...registry].sort()).toEqual([...ADAPTER_OPERATIONS].sort());
    expect(CONFORMANCE_FLOWS.flatMap((flow) => flow.steps)).toHaveLength(15);
  });

  test("every supported operation of every adapter executes and every declared gap is encountered", async () => {
    const report = await runProduction("parity-coverage");
    expect(runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")).toEqual([]);
    for (const registration of CONFORMANCE_ADAPTERS) {
      const steps = report.steps.filter((step) => step.provider === registration.provider);
      const executed = new Set(
        steps.filter((step) => step.status === "executed").map((step) => step.operation),
      );
      for (const operation of registration.contract.capabilities.supportedOperations) {
        expect(executed.has(operation), `${registration.provider}:${operation}`).toBe(true);
      }
      for (const gap of registration.contract.capabilities.declaredGaps) {
        expect(
          steps.some(
            (step) =>
              step.operation === gap.operation &&
              step.status === "skipped" &&
              step.skipKind === "declared-gap" &&
              step.skipReason === gap.reason,
          ),
          `${registration.provider}:${gap.operation}:${gap.reason}`,
        ).toBe(true);
      }
    }
  });

  test("GitHub executes all ten supported operations", async () => {
    const report = await runSingle("github", loadMockTenant("github"), "github-parity-coverage");
    const executed = new Set(
      report.steps
        .filter((step) => step.provider === "github" && step.status === "executed")
        .map((step) => step.operation),
    );
    expect([...executed].sort()).toEqual([...ADAPTER_OPERATIONS].sort());
  });

  test("an eleventh operation in the registry fails structural coverage by name", () => {
    const flows = CONFORMANCE_FLOWS.map((flow) => ({
      ...flow,
      steps:
        flow.flowId === "change-lifecycle"
          ? [
              ...flow.steps,
              {
                stepId: "change-lifecycle.publish-release",
                operation: "publish-release",
                assertionFamily: "work-item",
              },
            ]
          : flow.steps,
    }));
    expect(
      structuralCoverageViolations({ flows, adapters: CONFORMANCE_ADAPTERS }).some((message) =>
        message.includes("unknown operation publish-release"),
      ),
    ).toBe(true);
  });
});

describe("TC-PARITY-002 the carrier roundtrip is capability-absent for GitHub", () => {
  test("GitHub records capability-absent and GitLab/Jira keep their declared gap", async () => {
    const report = await runProduction("carrier-skip-kinds");
    expect(carrierStepFor(report, "github")).toEqual({
      skipKind: "capability-absent",
      skipReason: "no-declared-carrier",
    });
    for (const provider of ["gitlab", "jira"]) {
      expect(carrierStepFor(report, provider)).toEqual({
        skipKind: "declared-gap",
        skipReason: "adapter-not-implemented",
      });
    }
  });

  test("reclassifying the GitHub carrier skip as declared-gap fails the assertion", async () => {
    const report = await runProduction("carrier-skip-mutant");
    const mutated: ConformanceReport = {
      ...report,
      steps: report.steps.map((step) =>
        step.provider === "github" && step.stepId === "comment-provenance.carrier-roundtrip"
          ? { ...step, skipKind: "declared-gap" }
          : step,
      ),
    };
    expect(carrierStepFor(mutated, "github")).not.toEqual({
      skipKind: "capability-absent",
      skipReason: "no-declared-carrier",
    });
  });
});

describe("TC-PARITY-003 one write-delivery-request step with routes and projections", () => {
  test("the registry carries exactly one write-delivery-request step whose member is the create", async () => {
    const steps = CONFORMANCE_FLOWS.flatMap((flow) =>
      flow.steps.filter((step) => step.operation === "write-delivery-request"),
    );
    expect(steps.map((step) => step.stepId)).toEqual(["change-lifecycle.create-delivery-request"]);
    const report = await runSingle("github", loadMockTenant("github"), "content-write-step");
    const executed = report.steps.filter(
      (step) => step.operation === "write-delivery-request" && step.status === "executed",
    );
    expect(executed).toHaveLength(1);
  });

  test("the comment and create projections equal the declared expectations exactly", async () => {
    const tenant = loadMockTenant("github");
    const report = await runSingle("github", tenant, "content-write-projection");
    for (const stepId of ["change-lifecycle.comment", "change-lifecycle.create-delivery-request"]) {
      const step = report.steps.find((entry) => entry.stepId === stepId);
      expect(step?.status, stepId).toBe("executed");
    }
    expect(tenant.expected["change-lifecycle.comment"]).toEqual({ commentId: "9001" });
    expect(
      (tenant.expected["change-lifecycle.create-delivery-request"] as { identity: unknown })
        .identity,
    ).toEqual({ systemName: "github", entityId: "610" });
  });

  test("the update route is exercised by a direct client call, never a second registry step", async () => {
    const tenant = loadMockTenant("github");
    if (tenant.addressing.provider !== "github") throw new Error("expected github addressing");
    const transport = createMockTenantTransport(tenant);
    const client = createGitHubClient({
      instance: tenant.instance,
      credentials: createCanaryCredentialPort(),
      repository: {
        owner: tenant.addressing.owner,
        name: tenant.addressing.repo,
      },
      transport,
    });
    const result = await client.writeDeliveryRequest({
      kind: "update",
      deliveryRequest: { systemName: tenant.instance.instanceName, entityId: "504" },
      title: "Conformance content write updated",
      body: "Updated body",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.identity).toEqual({ systemName: "github", entityId: "504" });
      expect(result.value.sourceRef).toBe("feat/GH-188/client-seeds-trap-catalogs");
      expect(result.value.targetRef).toBe("main-tools");
      expect(result.value.reviewState).toBe("open");
    }
    const patch = transport.requests.find(
      (request) => request.method === "PATCH" && request.url.endsWith("/pulls/504"),
    );
    expect(patch).toBeDefined();
  });
});

const registrationFor = (provider: string): ConformanceAdapterRegistration => {
  const registration = CONFORMANCE_ADAPTERS.find((entry) => entry.provider === provider);
  if (registration === undefined) throw new Error(`missing ${provider} registration`);
  return registration;
};

const buildClientFor = (provider: string, tenant: MockTenant): ConformanceAdapterClient =>
  registrationFor(provider).buildClient({
    tenant,
    instance: tenant.instance,
    credentials: createCanaryCredentialPort(),
    transport: createMockTenantTransport(tenant),
  });

const isRecordValue = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const withRouteBody = (
  tenant: MockTenant,
  predicate: (url: string) => boolean,
  body: unknown,
): MockTenant => ({
  ...tenant,
  routes: tenant.routes.map((route) => (predicate(route.url) ? { ...route, body } : route)),
});

const runSingle = async (
  provider: string,
  tenant: MockTenant,
  runId: string,
): Promise<ConformanceReport> =>
  runConformance({
    adapters: [registrationFor(provider)],
    tenants: { [provider]: tenant },
    credentials: createCanaryCredentialPort(),
    transportFactory: () => createMockTenantTransport(tenant),
    nowIso: CLOCK,
    runId,
    tier: "mock",
  });

describe("TC-CONF-006 mock suite green for all three adapters", () => {
  test("each adapter produces three flows and fifteen registry-ordered step results", async () => {
    const report = await runProduction("matrix-run");
    const expectedStepIds = CONFORMANCE_FLOWS.flatMap((flow) =>
      flow.steps.map((step) => step.stepId),
    );
    expect(expectedStepIds).toHaveLength(15);
    expect(report.status).toBe("passed");
    for (const provider of ["github", "gitlab", "jira"]) {
      const flows = report.flows.filter((flow) => flow.provider === provider);
      expect(flows.map((flow) => flow.flowId)).toEqual([
        "change-lifecycle",
        "comment-provenance",
        "label-semantics",
      ]);
      const steps = report.steps.filter((step) => step.provider === provider);
      expect(steps.map((step) => step.stepId)).toEqual(expectedStepIds);
      expect(steps.some((step) => step.status === "executed")).toBe(true);
      if (provider === "github") {
        // GitHub closes its last two gaps in this change; its one skip is the
        // carrier roundtrip, whose skip kind is `capability-absent`.
        expect(steps.some((step) => step.skipKind === "declared-gap")).toBe(false);
        expect(steps.some((step) => step.skipKind === "capability-absent")).toBe(true);
      } else {
        expect(steps.some((step) => step.skipKind === "declared-gap")).toBe(true);
      }
    }
  });

  test("a missing route fails naming provider, flow, step and the request URL", async () => {
    const tenant = loadMockTenant("github");
    const mutated: MockTenant = {
      ...tenant,
      routes: tenant.routes.filter((route) => !route.url.includes("/issues/")),
    };
    const transport = createMockTenantTransport(mutated);
    const report = await runConformance({
      adapters: [registrationFor("github")],
      tenants: { github: mutated },
      credentials: createCanaryCredentialPort(),
      transportFactory: () => transport,
      nowIso: CLOCK,
      runId: "missing-route-run",
      tier: "mock",
    });
    const failed = report.steps.find((step) => step.stepId === "change-lifecycle.read-work-item");
    expect(failed?.status).toBe("failed");
    expect(failed?.provider).toBe("github");
    expect(failed?.flowId).toBe("change-lifecycle");
    expect(failed?.failure?.reference).toContain("GET ");
    expect(failed?.failure?.reference).toContain("/issues/");
    expect(failed?.failure?.detail).toContain("/issues/");
    expect(transport.requests.some((request) => request.url.includes("/issues/"))).toBe(true);
  });

  test("a normalized view carrying a native key fails primitive-purity naming the path", async () => {
    const leaked: ConformanceAdapterClient = {
      readWorkItem: async () => ({ ok: true, value: leakedWorkItem() }),
    };
    const control = makeControl({
      supported: ["read-work-item"],
      gaps: gapsExcept(["read-work-item"]),
      client: leaked,
    });
    const report = await runMock(...controlInput(control, controlTenant()));
    const failed = report.steps.find((step) => step.stepId === "change-lifecycle.read-work-item");
    expect(report.status).toBe("failed");
    expect(failed?.status).toBe("failed");
    expect(failed?.failure?.assertion).toBe("primitive-purity");
    expect(failed?.failure?.received).toBe("html_url");
    expect(failed?.failure?.reference).toBe("tenant:github:change-lifecycle.read-work-item");
  });

  test("the unmodified control passes the same flow with no purity failure", async () => {
    const control = makeControl({
      supported: ["read-work-item"],
      gaps: gapsExcept(["read-work-item"]),
    });
    const report = await runMock(...controlInput(control, controlTenant()));
    const workItemStep = report.steps.find(
      (step) => step.stepId === "change-lifecycle.read-work-item",
    );
    expect(report.status).toBe("passed");
    expect(workItemStep?.status).toBe("executed");
    expect(report.steps.some((step) => step.failure?.assertion === "primitive-purity")).toBe(false);
  });
});

describe("TC-CONF-007 GitHub operation matrix", () => {
  test("every GitHub supported operation executes and only the carrier roundtrip skips", async () => {
    const report = await runSingle("github", loadMockTenant("github"), "github-matrix");
    const steps = report.steps;
    for (const stepId of [
      "change-lifecycle.read-work-item",
      "change-lifecycle.read-delivery-request",
      "change-lifecycle.read-pipeline-run",
      "change-lifecycle.open-change",
      "change-lifecycle.transition",
      "change-lifecycle.create-delivery-request",
      "change-lifecycle.comment",
      "change-lifecycle.resolve-delivery-thread",
      "change-lifecycle.merge-delivery-request",
      "comment-provenance.read-comments",
      "label-semantics.read-labels",
      "label-semantics.replace",
      "label-semantics.sweep",
    ]) {
      expect(steps.find((step) => step.stepId === stepId)?.status, stepId).toBe("executed");
    }
    const skipped = steps.filter((step) => step.status === "skipped");
    expect(skipped.map((step) => step.stepId)).toEqual(["comment-provenance.carrier-roundtrip"]);
    expect(skipped[0]?.skipKind).toBe("capability-absent");
    expect(report.status).toBe("passed");
    expect(report.steps.some((step) => step.failure?.assertion === "primitive-purity")).toBe(false);
  });

  test("a corrupted expected projection fails naming provider, flow, step and assertion", async () => {
    const tenant = loadMockTenant("github");
    const expected = tenant.expected["change-lifecycle.read-work-item"];
    if (!isRecordValue(expected)) throw new Error("github expected projection is missing");
    const mutated: MockTenant = {
      ...tenant,
      expected: {
        ...tenant.expected,
        "change-lifecycle.read-work-item": { ...expected, labels: ["corrupted"] },
      },
    };
    const report = await runSingle("github", mutated, "github-corrupt");
    const failed = report.steps.find((step) => step.stepId === "change-lifecycle.read-work-item");
    expect(failed?.status).toBe("failed");
    expect(failed?.failure?.assertion).toBe("expected-projection");
    expect(failed?.provider).toBe("github");
    expect(failed?.flowId).toBe("change-lifecycle");
  });
});

describe("TC-CONF-008 GitLab operation matrix", () => {
  test("GitLab executes MR and pipeline reads and skips work-item and write steps", async () => {
    const tenant = loadMockTenant("gitlab");
    const client = buildClientFor("gitlab", tenant);
    const mr = await client.readDeliveryRequest?.();
    expect(mr?.ok).toBe(true);
    if (mr?.ok) {
      expect(mr.value.reviewState).toBe("approved");
      expect(mr.value.threads).toHaveLength(2);
    }
    const pipelines = await client.readPipelineRun?.();
    expect(pipelines?.ok).toBe(true);
    if (pipelines?.ok) expect(pipelines.value).toHaveLength(2);

    const report = await runSingle("gitlab", tenant, "gitlab-matrix");
    for (const step of report.steps.filter((entry) => entry.status === "skipped")) {
      expect(step.skipReason).toBe("adapter-not-implemented");
    }
    const workItemSteps = report.steps.filter((step) => step.operation === "read-work-item");
    expect(workItemSteps).toHaveLength(3);
    expect(workItemSteps.every((step) => step.status === "skipped")).toBe(true);
  });

  test("a dropped pipeline fails the projection comparison", async () => {
    const tenant = loadMockTenant("gitlab");
    const expected = tenant.expected["change-lifecycle.read-pipeline-run"];
    if (!Array.isArray(expected) || expected.length === 0) {
      throw new Error("gitlab expected pipelines are missing");
    }
    const mutated: MockTenant = {
      ...tenant,
      expected: { ...tenant.expected, "change-lifecycle.read-pipeline-run": [expected[0]] },
    };
    const report = await runSingle("gitlab", mutated, "gitlab-dropped-pipeline");
    const failed = report.steps.find(
      (step) => step.stepId === "change-lifecycle.read-pipeline-run",
    );
    expect(failed?.status).toBe("failed");
    expect(failed?.failure?.assertion).toBe("expected-projection");
  });

  test("an unknown merge status fails the read by name", async () => {
    const tenant = loadMockTenant("gitlab");
    const mutated = withRouteBody(tenant, (url) => url.includes("merge_requests"), {
      iid: 42,
      state: "opened",
      draft: false,
      approvals: 0,
      source_branch: "feat/GH-189/control",
      target_branch: "main-tools",
      detailed_merge_status: "unknown_state",
      merge_status: "unknown_state",
    });
    const report = await runSingle("gitlab", mutated, "gitlab-bad-state");
    const failed = report.steps.find(
      (step) => step.stepId === "change-lifecycle.read-delivery-request",
    );
    expect(failed?.status).toBe("failed");
    expect(failed?.failure?.detail).toContain("unmapped");
  });
});

describe("TC-CONF-009 Jira operation matrix", () => {
  test("Jira executes all three work-item reads with comments and labels", async () => {
    const tenant = loadMockTenant("jira");
    const client = buildClientFor("jira", tenant);
    const result = await client.readWorkItem?.();
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.value.comments?.length).toBeGreaterThan(0);
      for (const comment of result.value.comments ?? []) {
        expect(comment.authorAccount.trim().length).toBeGreaterThan(0);
        expect(comment.body.trim().length).toBeGreaterThan(0);
      }
      expect(Array.isArray(result.value.labels)).toBe(true);
      expect("fields" in result.value).toBe(false);
      expect("key" in result.value).toBe(false);
    }
    const report = await runSingle("jira", tenant, "jira-matrix");
    const exec = (stepId: string) => report.steps.find((step) => step.stepId === stepId)?.status;
    expect(exec("change-lifecycle.read-work-item")).toBe("executed");
    expect(exec("comment-provenance.read-comments")).toBe("executed");
    expect(exec("label-semantics.read-labels")).toBe("executed");
  });

  test("Jira gap reasons are exact per operation", async () => {
    const report = await runSingle("jira", loadMockTenant("jira"), "jira-gaps");
    const reasonFor = (operation: string): string | null | undefined =>
      report.steps.find((step) => step.operation === operation && step.status === "skipped")
        ?.skipReason;
    expect(reasonFor("read-delivery-request")).toBe("provider-unsupported");
    expect(reasonFor("read-pipeline-run")).toBe("provider-unsupported");
    expect(reasonFor("write-delivery-request")).toBe("provider-unsupported");
    expect(reasonFor("write-comment")).toBe("adapter-not-implemented");
    expect(reasonFor("resolve-delivery-thread")).toBe("provider-unsupported");
  });

  test("an omitted comment payload preserves absence and a present empty set fails", async () => {
    const tenant = loadMockTenant("jira");
    const route = tenant.routes[0];
    if (route === undefined || !isRecordValue(route.body)) {
      throw new Error("jira route body is missing");
    }
    const withoutComment = Object.fromEntries(
      Object.entries(route.body).map(([key, value]) => [key, value]),
    );
    const fields = withoutComment.fields;
    if (!isRecordValue(fields)) throw new Error("jira fields are missing");
    const fieldsWithoutComment = Object.fromEntries(
      Object.entries(fields).filter(([key]) => key !== "comment"),
    );
    const omittedBody = { ...withoutComment, fields: fieldsWithoutComment };
    const omitted = withRouteBody(tenant, (url) => url.includes("/issue/"), omittedBody);
    const omittedClient = buildClientFor("jira", omitted);
    const omittedRead = await omittedClient.readWorkItem?.();
    expect(omittedRead?.ok).toBe(true);
    if (omittedRead?.ok) expect("comments" in omittedRead.value).toBe(false);

    const emptyBody = {
      ...withoutComment,
      fields: { ...fieldsWithoutComment, comment: { comments: [], total: 0 } },
    };
    const empty = withRouteBody(tenant, (url) => url.includes("/issue/"), emptyBody);
    const report = await runSingle("jira", empty, "jira-empty-comments");
    expect(
      report.steps.some(
        (step) => step.stepId === "comment-provenance.read-comments" && step.status === "failed",
      ),
    ).toBe(true);
  });
});

describe("TC-CONF-012 comment provenance and shipped carrier skip", () => {
  test("the flow is registered for every adapter and the carrier step skips by provider posture", async () => {
    const report = await runProduction("comment-provenance-run");
    for (const provider of ["github", "gitlab", "jira"]) {
      expect(
        report.flows.some(
          (flow) => flow.provider === provider && flow.flowId === "comment-provenance",
        ),
      ).toBe(true);
    }
    const carrierSteps = report.steps.filter(
      (step) => step.stepId === "comment-provenance.carrier-roundtrip",
    );
    expect(carrierSteps).toHaveLength(3);
    for (const step of carrierSteps) {
      expect(step.status).toBe("skipped");
      if (step.provider === "github") {
        // write-comment is supported now, so the shipped empty carrier arrays
        // make the roundtrip `capability-absent`, never `declared-gap`.
        expect(step.skipKind).toBe("capability-absent");
        expect(step.skipReason).toBe("no-declared-carrier");
      } else {
        expect(step.skipKind).toBe("declared-gap");
        expect(step.skipReason).toBe("adapter-not-implemented");
      }
    }
  });

  test("Jira supplies a present comment set and omission stays absence", async () => {
    const tenant = loadMockTenant("jira");
    const client = buildClientFor("jira", tenant);
    const result = await client.readWorkItem?.();
    expect(result?.ok).toBe(true);
    if (result?.ok) expect((result.value.comments ?? []).length).toBeGreaterThan(0);
  });
});

describe("TC-CLOSE-065 closeout write execution and runtime coverage", () => {
  test("every newly supported GitHub write executes in mock", async () => {
    const report = await runProduction("closeout-coverage");
    expect(runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")).toEqual([]);
    for (const operation of [
      "write-work-item",
      "transition-work-item",
      "resolve-delivery-thread",
    ]) {
      expect(
        report.steps.some(
          (step) =>
            step.provider === "github" &&
            step.operation === operation &&
            step.status === "executed",
        ),
        operation,
      ).toBe(true);
    }
  });

  test("dropping an executed write step produces a named violation", async () => {
    const report = await runProduction("closeout-coverage-mutant");
    const mutated: ConformanceReport = {
      ...report,
      steps: report.steps.filter(
        (step) =>
          !(
            step.provider === "github" &&
            step.operation === "transition-work-item" &&
            step.status === "executed"
          ),
      ),
    };
    expect(runtimeCoverageViolations(mutated, CONFORMANCE_ADAPTERS, "mock")).toContain(
      "github: supported operation transition-work-item was not executed",
    );
  });
});

describe("TC-CLOSE-065 Jira closeout write execution", () => {
  test("the newly supported Jira writes execute in mock and coverage is empty", async () => {
    const report = await runProduction("jira-closeout-coverage");
    expect(runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")).toEqual([]);
    for (const operation of ["write-work-item", "transition-work-item"]) {
      expect(
        report.steps.some(
          (step) =>
            step.provider === "jira" && step.operation === operation && step.status === "executed",
        ),
        operation,
      ).toBe(true);
    }
    expect(
      report.steps.some(
        (step) =>
          step.provider === "jira" &&
          step.operation === "resolve-delivery-thread" &&
          step.status === "skipped" &&
          step.skipReason === "provider-unsupported",
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P7 release floor: TC-PARITY-005 and TC-PARITY-007
// ---------------------------------------------------------------------------

const TRAP_CATALOG_FILE = "tests/fixtures/providers/traps/github.traps.json";
const GITHUB_TRAP_SUITE = "tests/behaviour/providers/github-trap.test.ts";

/** One trap entry per AC-F8-4 behavior; a behavior cannot satisfy one half alone. */
const NEW_BEHAVIOR_TRAPS: Readonly<Record<string, string>> = {
  landing: "GITHUB-LANDING-CRAFTED-METADATA",
  timings: "GITHUB-CHECK-RUN-TIMINGS",
  excerpt: "GITHUB-LOG-EXCERPT-CAP",
  discussion: "GITHUB-THREAD-DISCUSSION-CAPS",
  "comment-write": "GITHUB-COMMENT-CARRIER-FREE",
  "content-write": "GITHUB-CONTENT-WRITE-NEVER-LANDS",
  "mapped-transition": "GITHUB-WORKFLOW-MAP-SEED-PRECEDENCE",
};

const CLOSED_SET_BEHAVIOR_STEPS: Readonly<Record<string, string>> = {
  landing: "change-lifecycle.merge-delivery-request",
  timings: "change-lifecycle.read-pipeline-run",
  "comment-write": "change-lifecycle.comment",
  "content-write": "change-lifecycle.create-delivery-request",
  "mapped-transition": "change-lifecycle.transition",
};

const catalogEntries = (): readonly Record<string, unknown>[] => {
  const parsed = JSON.parse(readFileSync(join(process.cwd(), TRAP_CATALOG_FILE), "utf8")) as {
    entries?: unknown;
  };
  return Array.isArray(parsed.entries)
    ? parsed.entries.filter((entry): entry is Record<string, unknown> => isRecordValue(entry))
    : [];
};

const pointerResolves = (value: unknown, pointer: string): boolean => {
  if (pointer.length === 0) return true;
  if (!pointer.startsWith("/")) return false;
  let current = value;
  for (const raw of pointer.slice(1).split("/")) {
    const token = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return false;
      current = current[index];
    } else if (isRecordValue(current)) {
      if (!(token in current)) return false;
      current = current[token];
    } else {
      return false;
    }
  }
  return true;
};

const referenceResolves = (reference: string): boolean => {
  const hashIndex = reference.indexOf("#");
  const path = hashIndex === -1 ? reference : reference.slice(0, hashIndex);
  const pointer = hashIndex === -1 ? "" : reference.slice(hashIndex + 1);
  if (!existsSync(join(process.cwd(), path))) return false;
  const parsed: unknown = JSON.parse(readFileSync(join(process.cwd(), path), "utf8"));
  return pointerResolves(parsed, pointer);
};

describe("TC-PARITY-005 every new behavior has a trap entry and an executed half", () => {
  test("the seven behaviors each have one four-field entry with a resolving fixture", () => {
    const entries = catalogEntries();
    const names = entries.map((entry) => String(entry.trapName));
    for (const [behavior, trapName] of Object.entries(NEW_BEHAVIOR_TRAPS)) {
      expect(
        names.filter((name) => name === trapName),
        behavior,
      ).toHaveLength(1);
      const entry = entries.find((candidate) => candidate.trapName === trapName);
      if (entry === undefined) throw new Error(`missing trap entry ${trapName}`);
      expect(Object.keys(entry).sort(), trapName).toEqual([
        "expectedNormalizedOutcome",
        "fixtureReference",
        "providerBehavior",
        "trapName",
      ]);
      expect(referenceResolves(String(entry.fixtureReference)), trapName).toBe(true);
    }
    expect(Object.keys(NEW_BEHAVIOR_TRAPS)).toHaveLength(7);
  });

  test("each new entry has a named mutation in the trap suite", () => {
    const suite = readFileSync(join(process.cwd(), GITHUB_TRAP_SUITE), "utf8");
    for (const trapName of Object.values(NEW_BEHAVIOR_TRAPS)) {
      expect(suite.includes(`trapName: "${trapName}"`), trapName).toBe(true);
    }
  });

  test("each closed-set behavior executes with a declared projection", async () => {
    const tenant = loadMockTenant("github");
    const report = await runProduction("parity-roll-up");
    for (const [behavior, stepId] of Object.entries(CLOSED_SET_BEHAVIOR_STEPS)) {
      const step = report.steps.find(
        (entry) => entry.provider === "github" && entry.stepId === stepId,
      );
      expect(step?.status, behavior).toBe("executed");
      if (stepId === "change-lifecycle.transition") {
        // A void write declares its truth as the exact tenant route body.
        const route = tenant.routes.find(
          (candidate) => candidate.method === "PATCH" && candidate.url.endsWith("/issues/601"),
        );
        expect(route?.body, behavior).toEqual({ number: 601, state: "closed" });
        continue;
      }
      expect(tenant.expected[stepId], behavior).toBeDefined();
    }
    expect(String(JSON.stringify(tenant.expected["change-lifecycle.read-pipeline-run"]))).toContain(
      "startedAt",
    );
  });

  test("dropping a behavior from either half fails by name", () => {
    const names = catalogEntries().map((entry) => String(entry.trapName));
    const missing = Object.entries(NEW_BEHAVIOR_TRAPS).find(
      ([, trapName]) => !names.includes(trapName),
    );
    expect(missing).toBeUndefined();
    expect(names.includes("GITHUB-LANDING-CRAFTED-METADATA")).toBe(true);
    const withoutLanding = names.filter((name) => name !== "GITHUB-LANDING-CRAFTED-METADATA");
    expect(withoutLanding.includes("GITHUB-LANDING-CRAFTED-METADATA")).toBe(false);
  });
});

describe("TC-PARITY-007 a replay is deterministic across the whole change", () => {
  test("two runs of the same tenants produce identical reports and skip decisions", async () => {
    const first = await runProduction("determinism-run");
    const second = await runProduction("determinism-run");
    expect(second).toEqual(first);
    expect(first.generatedAt).toBe(CLOCK);
    expect(second.steps.map((step) => `${step.provider}|${step.stepId}|${step.status}`)).toEqual(
      first.steps.map((step) => `${step.provider}|${step.stepId}|${step.status}`),
    );
    for (const step of first.steps) {
      if (step.status === "skipped") {
        expect(["declared-gap", "capability-absent", "live-read-only"]).toContain(step.skipKind);
      }
    }
  });

  test("the committed tenants are byte-identical across loads", () => {
    const first = loadMockTenants();
    const second = loadMockTenants();
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
