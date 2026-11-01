/**
 * TC-CONF-016 / TC-CONF-017 — the deliberately broken adapter control and its
 * bounded, secret-free diagnostics.
 *
 * The control is a test-only wrapper around the production GitHub client; it
 * never enters the production registry.
 */
import { describe, expect, test } from "bun:test";
import type { WorkItem } from "@delivery-os/core/contracts";
import {
  CONFORMANCE_ADAPTERS,
  type ConformanceAdapterRegistration,
  type ConformanceCredentialPort,
  type ConformanceReport,
  createMockTenantTransport,
  runConformance,
} from "@delivery-os/testkit";
import { SANITIZATION_CANARIES } from "../fixtures/providers/sanitization/cases";
import { createCanaryCredentialPort, loadMockTenant } from "./support/fixtures";

const CLOCK = "2026-10-31T00:00:00Z";

const githubRegistration = (): ConformanceAdapterRegistration => {
  const registration = CONFORMANCE_ADAPTERS.find((entry) => entry.provider === "github");
  if (registration === undefined) throw new Error("missing github registration");
  return registration;
};

const corruptRegistration = (
  mutate: (item: WorkItem) => WorkItem,
): ConformanceAdapterRegistration => {
  const base = githubRegistration();
  return {
    provider: base.provider,
    contract: base.contract,
    buildClient: (input) => {
      const client = base.buildClient(input);
      const readWorkItem = client.readWorkItem;
      if (readWorkItem === undefined) throw new Error("base client has no readWorkItem");
      return {
        readWorkItem: async () => {
          const result = await readWorkItem();
          if (!result.ok) return result;
          return { ok: true, value: mutate(result.value) };
        },
        ...(client.readDeliveryRequest !== undefined
          ? { readDeliveryRequest: client.readDeliveryRequest }
          : {}),
        ...(client.readPipelineRun !== undefined
          ? { readPipelineRun: client.readPipelineRun }
          : {}),
      };
    },
  };
};

const runControl = (
  adapters: readonly ConformanceAdapterRegistration[],
  runId: string,
  credentials: ConformanceCredentialPort = createCanaryCredentialPort(),
): Promise<ConformanceReport> => {
  const tenant = loadMockTenant("github");
  return runConformance({
    adapters,
    tenants: { github: tenant },
    credentials,
    transportFactory: () => createMockTenantTransport(tenant),
    nowIso: CLOCK,
    runId,
    tier: "mock",
  });
};

const caught = async (task: Promise<unknown>): Promise<Error> => {
  try {
    await task;
  } catch (error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
  }
  throw new Error("expected the task to fail");
};

const canary = (id: string, pattern: RegExp): string => {
  const content = SANITIZATION_CANARIES.find((entry) => entry.id === id)?.content ?? "";
  const match = content.match(pattern);
  if (match?.[0] === undefined) throw new Error(`canary ${id} is missing`);
  return match[0];
};

const FORBIDDEN_MARKERS: readonly RegExp[] = [
  /raw-provider-payload/i,
  /Authorization"\s*:\s*"Bearer/i,
  /\bghp_[A-Za-z0-9]{16,}\b/,
  /\bglpat-[A-Za-z0-9_-]{16,}\b/,
  /\bATATT3?[A-Za-z0-9_-]{10,}\b/,
  /avatars\.githubusercontent\.com/,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
];

const leaks = (text: string): boolean => FORBIDDEN_MARKERS.some((pattern) => pattern.test(text));

describe("TC-CONF-016 broken adapter control", () => {
  test("a corrupt change-lifecycle outcome fails by provider, flow, step and assertion", async () => {
    const control = corruptRegistration((item) => ({ ...item, title: "Corrupted title" }));
    const report = await runControl([control], "broken-change-lifecycle");
    expect(report.status).toBe("failed");
    const failed = report.steps.find((step) => step.stepId === "change-lifecycle.read-work-item");
    expect(failed?.status).toBe("failed");
    expect(failed?.provider).toBe("github");
    expect(failed?.flowId).toBe("change-lifecycle");
    expect(failed?.operation).toBe("read-work-item");
    expect(failed?.failure?.assertion).toBe("expected-projection");
    expect(typeof failed?.failure?.expected).toBe("string");
    expect(typeof failed?.failure?.received).toBe("string");
    expect((failed?.failure?.reference ?? "").trim().length).toBeGreaterThan(0);
  });

  test("the unmodified client passes the same flow", async () => {
    const report = await runControl([githubRegistration()], "unmodified-run");
    expect(report.status).toBe("passed");
    expect(report.steps.every((step) => step.status !== "failed")).toBe(true);
  });

  test("a label-semantics corruption localizes to that step", async () => {
    const control = corruptRegistration((item) => ({ ...item, labels: [] }));
    const report = await runControl([control], "broken-label-semantics");
    expect(
      report.steps.some(
        (step) =>
          step.stepId === "label-semantics.read-labels" &&
          step.status === "failed" &&
          step.flowId === "label-semantics",
      ),
    ).toBe(true);
  });

  test("the control never enters the production registry", () => {
    const control = corruptRegistration((item) => item);
    expect(CONFORMANCE_ADAPTERS.includes(control)).toBe(false);
    for (const registration of CONFORMANCE_ADAPTERS) {
      expect(registration.writeHandler).toBeUndefined();
    }
  });
});

describe("TC-CONF-017 failure diagnostics and redaction", () => {
  test("the diagnostic names every field and contains no secret or raw payload", async () => {
    const token = canary("github-token", /ghp_[A-Za-z0-9]+/);
    const email = canary("email", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    const avatar = canary("avatar-url", /https:\/\/avatars\.githubusercontent\.com[^"\\]*/);
    const control = corruptRegistration((item) => ({
      ...item,
      title: `${token} ${email} ${avatar} raw-provider-payload`,
    }));
    const report = await runControl([control], "redaction-run");
    const failed = report.steps.find((step) => step.stepId === "change-lifecycle.read-work-item");
    expect(failed?.failure !== undefined).toBe(true);
    expect((failed?.failure?.assertion ?? "").trim().length).toBeGreaterThan(0);
    expect((failed?.failure?.detail ?? "").trim().length).toBeGreaterThan(0);
    for (const value of [failed?.failure?.expected, failed?.failure?.received]) {
      expect(["string", "number", "boolean"]).toContain(typeof value);
    }
    const serialized = JSON.stringify(report);
    expect(serialized.includes(token)).toBe(false);
    expect(serialized.includes(email)).toBe(false);
    expect(serialized.includes(avatar)).toBe(false);
    expect(serialized.includes("raw-provider-payload")).toBe(false);
    expect(serialized.includes("Authorization")).toBe(false);
  });

  test("a canary credential value is absent from the report and from thrown errors", async () => {
    const token = canary("github-token", /ghp_[A-Za-z0-9]+/);
    const credentials: ConformanceCredentialPort = {
      resolve: () => ({ ok: true, material: { value: token } }),
    };
    const control = corruptRegistration((item) => ({
      ...item,
      title: "corrupted with credential",
    }));
    const report = await runControl([control], "canary-run", credentials);
    expect(JSON.stringify(report).includes(token)).toBe(false);

    const failClosed = corruptRegistration((item) => item);
    const withoutHandler: ConformanceAdapterRegistration = {
      ...failClosed,
      contract: {
        ...failClosed.contract,
        capabilities: {
          ...failClosed.contract.capabilities,
          supportedOperations: ["read-work-item", "write-comment"],
          declaredGaps: [
            { operation: "write-work-item", reason: "adapter-not-implemented" },
            { operation: "transition-work-item", reason: "adapter-not-implemented" },
            { operation: "read-delivery-request", reason: "adapter-not-implemented" },
            { operation: "write-delivery-request", reason: "adapter-not-implemented" },
            { operation: "read-pipeline-run", reason: "adapter-not-implemented" },
            { operation: "resolve-delivery-thread", reason: "adapter-not-implemented" },
          ],
        },
      },
    };
    const error = await caught(runControl([withoutHandler], "fail-closed-run", credentials));
    expect(error.message.includes(token)).toBe(false);
  });

  test("an injected raw-payload marker is detectable by the diagnostic check", async () => {
    const control = corruptRegistration((item) => ({ ...item, title: "Corrupted" }));
    const report = await runControl([control], "injection-run");
    const serialized = JSON.stringify(report);
    expect(leaks(serialized)).toBe(false);
    const injected = serialized.replace(/"detail":"[^"]*"/, '"detail":"raw-provider-payload leak"');
    expect(leaks(injected)).toBe(true);
  });
});
