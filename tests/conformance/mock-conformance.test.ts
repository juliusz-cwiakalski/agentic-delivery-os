/**
 * Runner and coverage controls (GH-189 P3: TC-CONF-010/011/013/014/015).
 *
 * Controls are injected through the runner's adapter list; the production
 * registry never gains a control registration or a write handler.
 */
import { describe, expect, test } from "bun:test";
import type {
  AdapterOperation,
  CapabilityGap,
  CarrierKind,
  DeliveryRequest,
  PipelineRun,
  WorkItem,
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
      expect(
        steps.some((step) => step.status === "skipped" && step.skipKind === "declared-gap"),
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
        step.provider === "github" && step.operation === "write-work-item"
          ? { ...step, skipReason: "wrong-reason" }
          : step,
      ),
    };
    expect(
      runtimeCoverageViolations(mutated, CONFORMANCE_ADAPTERS, "mock").some(
        (message) => message.includes("github") && message.includes("declared gap write-work-item"),
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
  test("the mock suite makes zero live fetch calls and only exact GET routes", async () => {
    const tenants = loadMockTenants();
    const transports: ReturnType<typeof createMockTenantTransport>[] = [];
    const guard = installThrowingFetchGuard();
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
    } finally {
      guard.restore();
    }
    for (const transport of transports) {
      for (const request of transport.requests) {
        expect(request.method).toBe("GET");
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
