/**
 * TC-CONF-018 / TC-CONF-019 — the `delivery.conformance.v1` artifact.
 *
 * Shape, closed sets, summary-vs-canonical flow views, bounds, truncation, and
 * redaction are proven from one in-memory mock report.
 */
import { describe, expect, test } from "bun:test";
import {
  CONFORMANCE_ADAPTERS,
  CONFORMANCE_LIMITS,
  CONFORMANCE_SCHEMA_ID,
  CONFORMANCE_SKIP_KINDS,
  CONFORMANCE_STATUSES,
  CONFORMANCE_TRUNCATION_MARKER,
  type ConformanceArtifact,
  type ConformanceReport,
  type ConformanceStepResult,
  createMockTenantTransport,
  runConformance,
  serializeConformanceArtifact,
  toConformanceArtifact,
  validateConformanceArtifact,
} from "@delivery-os/testkit";
import { SANITIZATION_CANARIES } from "../fixtures/providers/sanitization/cases";
import { createCanaryCredentialPort, loadMockTenants } from "./support/fixtures";

const CLOCK = "2026-10-31T00:00:00Z";

const mockReport = async (): Promise<ConformanceReport> => {
  const tenants = loadMockTenants();
  return runConformance({
    adapters: CONFORMANCE_ADAPTERS,
    tenants,
    credentials: createCanaryCredentialPort(),
    transportFactory: (provider) => {
      const tenant = tenants[provider];
      if (tenant === undefined) throw new Error(`missing tenant ${provider}`);
      return createMockTenantTransport(tenant);
    },
    nowIso: CLOCK,
    runId: "artifact-run",
    tier: "mock",
  });
};

const mockArtifact = async (): Promise<ConformanceArtifact> =>
  toConformanceArtifact(await mockReport());

const stepKey = (step: ConformanceStepResult): string =>
  `${step.provider}|${step.flowId}|${step.stepId}`;

const mutateStep = (
  artifact: ConformanceArtifact,
  stepId: string,
  mutate: (step: ConformanceStepResult) => ConformanceStepResult,
): ConformanceArtifact => {
  const apply = (step: ConformanceStepResult): ConformanceStepResult =>
    step.stepId === stepId ? mutate(step) : step;
  return {
    ...artifact,
    steps: artifact.steps.map(apply),
    flows: artifact.flows.map((flow) => ({ ...flow, steps: flow.steps.map(apply) })),
  };
};

const injectFailure = (artifact: ConformanceArtifact, detail: string): ConformanceArtifact => {
  const failure = {
    assertion: "bounds",
    expected: "expected",
    received: "received",
    reference: "tenant:bounds",
    detail,
  };
  const target = artifact.steps[0];
  if (target === undefined) throw new Error("artifact has no steps");
  return mutateStep(artifact, target.stepId, (step) => ({
    ...step,
    status: "failed" as const,
    skipReason: null,
    skipKind: null,
    failure,
  }));
};

const canary = (id: string, pattern: RegExp): string => {
  const content = SANITIZATION_CANARIES.find((entry) => entry.id === id)?.content ?? "";
  const match = content.match(pattern);
  if (match?.[0] === undefined) throw new Error(`canary ${id} is missing`);
  return match[0];
};

describe("TC-CONF-018 artifact schema validation", () => {
  test("the mock report serializes with the required top-level fields", async () => {
    const artifact = await mockArtifact();
    expect(artifact.schema).toBe(CONFORMANCE_SCHEMA_ID);
    for (const key of [
      "runId",
      "tier",
      "generatedAt",
      "status",
      "providers",
      "flows",
      "steps",
      "mutationRequests",
      "createdArtifacts",
      "totals",
    ]) {
      expect(Object.hasOwn(artifact, key), key).toBe(true);
    }
    expect(validateConformanceArtifact(artifact)).toEqual([]);
  });

  test("provider flows are summaries only and top-level flows nest the canonical steps", async () => {
    const artifact = await mockArtifact();
    for (const provider of artifact.providers) {
      expect(Array.isArray(provider.missingSettings)).toBe(true);
      for (const summary of provider.flows) {
        expect(Object.keys(summary).sort()).toEqual(["flowId", "name", "status"]);
      }
    }
    expect(artifact.flows).toHaveLength(9);
    for (const flow of artifact.flows) {
      expect(flow.steps.length).toBeGreaterThan(0);
    }
    const nested = new Map<string, string>();
    for (const flow of artifact.flows) {
      for (const step of flow.steps) nested.set(stepKey(step), step.status);
    }
    for (const step of artifact.steps) {
      expect(nested.get(stepKey(step)), stepKey(step)).toBe(step.status);
      expect(step.provider.length).toBeGreaterThan(0);
      expect(step.flowId.length).toBeGreaterThan(0);
      expect(step.operation.length).toBeGreaterThan(0);
      expect(step.assertionCount).toBeGreaterThanOrEqual(0);
    }
  });

  test("every skipped step carries a closed skipKind", async () => {
    const artifact = await mockArtifact();
    const skipped = artifact.steps.filter((step) => step.status === "skipped");
    expect(skipped.length).toBeGreaterThan(0);
    for (const step of skipped) {
      expect(CONFORMANCE_SKIP_KINDS as readonly string[]).toContain(step.skipKind);
      expect(step.skipReason).not.toBeNull();
    }
  });

  test("status values and timestamps stay in their closed sets", async () => {
    const artifact = await mockArtifact();
    expect(CONFORMANCE_STATUSES as readonly string[]).toContain(artifact.status);
    expect(artifact.generatedAt).toBe(CLOCK);
  });

  test("malformed artifacts fail by field name", async () => {
    const artifact = await mockArtifact();
    const withoutSteps = Object.fromEntries(
      Object.entries(artifact).filter(([key]) => key !== "steps"),
    );
    expect(
      validateConformanceArtifact(withoutSteps).some((message) => message.includes("steps")),
    ).toBe(true);
    expect(
      validateConformanceArtifact({ ...artifact, schema: "delivery.conformance.v2" }).some(
        (message) => message.includes("unsupported schema"),
      ),
    ).toBe(true);
    expect(
      validateConformanceArtifact({ ...artifact, status: "bogus" }).some((message) =>
        message.includes("invalid status"),
      ),
    ).toBe(true);
    const withoutCounter = Object.fromEntries(
      Object.entries(artifact).filter(([key]) => key !== "mutationRequests"),
    );
    expect(
      validateConformanceArtifact(withoutCounter).some((message) =>
        message.includes("mutationRequests"),
      ),
    ).toBe(true);
    const summaryWithSteps = {
      ...artifact,
      providers: artifact.providers.map((provider) => ({
        ...provider,
        flows: provider.flows.map((flow) => ({ ...flow, steps: [] })),
      })),
    };
    expect(
      validateConformanceArtifact(summaryWithSteps).some((message) =>
        message.includes("summaries without steps"),
      ),
    ).toBe(true);
  });

  test("a skipped step with a missing or unknown skipKind fails by field", async () => {
    const artifact = await mockArtifact();
    const skipped = artifact.steps.find((step) => step.status === "skipped");
    if (skipped === undefined) throw new Error("artifact has no skipped step");
    const withoutKind = mutateStep(artifact, skipped.stepId, (step) => {
      const copy = { ...step };
      Reflect.deleteProperty(copy, "skipKind");
      return copy;
    });
    expect(
      validateConformanceArtifact(withoutKind).some((message) => message.includes("skipKind")),
    ).toBe(true);
    const bogusKind = mutateStep(artifact, skipped.stepId, (step) => {
      const copy = { ...step };
      Reflect.set(copy, "skipKind", "bogus");
      return copy;
    });
    expect(
      validateConformanceArtifact(bogusKind).some((message) => message.includes("skipKind")),
    ).toBe(true);
  });

  test("mock and live-tier artifacts validate through the same validator", async () => {
    const artifact = await mockArtifact();
    const liveLike: ConformanceArtifact = {
      ...artifact,
      tier: "live",
      status: "not-configured",
      providers: artifact.providers.map((provider) => ({
        ...provider,
        status: "not-configured",
        flows: [],
      })),
      flows: [],
      steps: [],
      totals: { providers: 3, flows: 0, steps: 0, executed: 0, skipped: 0, failed: 0 },
    };
    expect(validateConformanceArtifact(liveLike)).toEqual([]);
    expect(validateConformanceArtifact(JSON.parse(serializeConformanceArtifact(liveLike)))).toEqual(
      [],
    );
  });
});

describe("TC-CONF-019 artifact bounds and redaction", () => {
  test("a normal artifact stays within the byte cap", async () => {
    const text = serializeConformanceArtifact(await mockArtifact());
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(
      CONFORMANCE_LIMITS.maxArtifactBytes,
    );
  });

  test("an oversized failure detail is visibly truncated", async () => {
    const artifact = injectFailure(await mockArtifact(), "x".repeat(5000));
    const text = serializeConformanceArtifact(artifact);
    expect(text.includes(CONFORMANCE_TRUNCATION_MARKER)).toBe(true);
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(
      CONFORMANCE_LIMITS.maxArtifactBytes,
    );
    expect(validateConformanceArtifact(JSON.parse(text))).toEqual([]);
  });

  test("over-cap provider, flow and step reports fail naming the cap and count", async () => {
    const artifact = await mockArtifact();
    const provider = artifact.providers[0];
    const flow = artifact.flows[0];
    const step = artifact.steps[0];
    if (provider === undefined || flow === undefined || step === undefined) {
      throw new Error("artifact fixture is incomplete");
    }
    expect(
      validateConformanceArtifact({
        ...artifact,
        providers: Array.from({ length: 17 }, () => provider),
      }).some((message) => message.includes("maxProviders 16 (observed 17)")),
    ).toBe(true);
    expect(
      validateConformanceArtifact({
        ...artifact,
        flows: Array.from({ length: 17 }, () => flow),
      }).some((message) => message.includes("maxFlows 16 (observed 17)")),
    ).toBe(true);
    expect(
      validateConformanceArtifact({
        ...artifact,
        steps: Array.from({ length: 513 }, () => step),
      }).some((message) => message.includes("maxTotalSteps 512 (observed 513)")),
    ).toBe(true);
    expect(
      validateConformanceArtifact({
        ...artifact,
        flows: [{ ...flow, steps: Array.from({ length: 65 }, () => step) }],
      }).some((message) => message.includes("maxStepsPerFlow 64 (observed 65)")),
    ).toBe(true);
  });

  test("canary shapes are absent from the serialized artifact", async () => {
    const token = canary("github-token", /ghp_[A-Za-z0-9]+/);
    const email = canary("email", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    const avatar = canary("avatar-url", /https:\/\/avatars\.githubusercontent\.com[^"\\]*/);
    const bearer = canary("authorization-bearer", /Bearer [A-Za-z0-9]+/);
    const artifact = injectFailure(
      await mockArtifact(),
      `${token} ${email} ${avatar} ${bearer} raw-provider-payload`,
    );
    const text = serializeConformanceArtifact(artifact);
    for (const leaked of [token, email, avatar, bearer, "raw-provider-payload"]) {
      expect(text.includes(leaked), leaked).toBe(false);
    }
  });

  test("non-scalar expected/received values are rejected", async () => {
    const artifact = injectFailure(await mockArtifact(), "detail");
    const target = artifact.steps[0];
    if (target === undefined) throw new Error("artifact has no steps");
    const failure = {
      assertion: "bounds",
      expected: "expected",
      received: "received",
      reference: "tenant:bounds",
      detail: "detail",
    };
    Reflect.set(failure, "expected", { nested: true });
    const nonScalar = mutateStep(artifact, target.stepId, (step) => ({
      ...step,
      status: "failed",
      failure,
    }));
    expect(() => serializeConformanceArtifact(nonScalar)).toThrow("scalars");
  });

  test("the count caps are finite positive integers", () => {
    for (const value of Object.values(CONFORMANCE_LIMITS)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });
});
