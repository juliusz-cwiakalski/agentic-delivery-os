/**
 * TC-TAX-001 / TC-TAX-009 / TC-TAX-010 — the conformance-level tracker error
 * taxonomy maps four class ids onto delivered identities, is total over five
 * observable outcomes in fixed order, and proves the capability class
 * structurally rather than by a fixture family.
 */
import { describe, expect, test } from "bun:test";
import {
  ADAPTER_OPERATIONS,
  DELIVERY_RESULT_PROJECTION_CLASSES,
  DELIVERY_RESULT_TAXONOMY,
  DOMAIN_KINDS,
  ERROR_TABLE,
} from "@delivery-os/core/contracts";
import {
  CONFORMANCE_ADAPTERS,
  CONFORMANCE_FLOWS,
  classifyTrackerFailure,
  classifyTrackerOutcome,
  createMockTenantTransport,
  runConformance,
  runtimeCoverageViolations,
  structuralCoverageViolations,
  TRACKER_ERROR_CLASS_IDS,
  TRACKER_ERROR_TAXONOMY,
  TRACKER_FAMILY_OUTCOMES,
  TRACKER_TRAP_FAMILIES,
  type TrackerErrorClass,
} from "@delivery-os/testkit";
import { createCanaryCredentialPort, loadMockTenants } from "./support/fixtures";

const CLOCK = "2026-10-31T00:00:00Z";

const mockReport = async () => {
  const tenants = loadMockTenants();
  return runConformance({
    adapters: CONFORMANCE_ADAPTERS,
    tenants,
    credentials: createCanaryCredentialPort(),
    transportFactory: (provider) => {
      const tenant = tenants[provider as keyof typeof tenants];
      if (tenant === undefined) throw new Error(`missing tenant ${provider}`);
      return createMockTenantTransport(tenant);
    },
    nowIso: CLOCK,
    runId: "taxonomy-run",
    tier: "mock",
  });
};

const PROVIDER_WORDS = /github|gitlab|jira/i;

/** Validate a taxonomy table against the declared closed shape. */
const taxonomyViolations = (table: readonly TrackerErrorClass[]): string[] => {
  const violations: string[] = [];
  const ids = new Set<string>();
  for (const entry of table) {
    if (ids.has(entry.id)) violations.push(`${entry.id}: duplicate class id`);
    ids.add(entry.id);
  }
  for (const id of TRACKER_ERROR_CLASS_IDS) {
    if (!ids.has(id)) violations.push(`${id}: class id is missing`);
  }
  for (const id of ids) {
    if (!(TRACKER_ERROR_CLASS_IDS as readonly string[]).includes(id)) {
      violations.push(`${id}: class id is outside the closed set`);
    }
  }
  if (ids.size !== TRACKER_ERROR_CLASS_IDS.length) {
    violations.push(`expected ${TRACKER_ERROR_CLASS_IDS.length} class ids, found ${ids.size}`);
  }
  for (const entry of table as readonly unknown[]) {
    if (typeof entry !== "object" || entry === null) {
      violations.push("a class entry is not an object");
      continue;
    }
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "unknown";
    if (
      typeof record.deliveredIdentity !== "string" ||
      record.deliveredIdentity.trim().length === 0
    ) {
      violations.push(`${id}: no delivered identity`);
    }
    if (typeof record.discriminator !== "string" || record.discriminator.trim().length === 0) {
      violations.push(`${id}: no structured discriminator`);
    }
    if (PROVIDER_WORDS.test(JSON.stringify(record))) {
      violations.push(`${id}: taxonomy table carries a provider name`);
    }
    if (record.unit !== undefined) violations.push(`${id}: a class carries an extra identity`);
  }
  return violations;
};

/** A local sibling of the total rule with rules (2) and (3) swapped. */
const swappedRule = (outcome: Parameters<typeof classifyTrackerOutcome>[0]): string => {
  if (outcome.kind === "capability-gap") return "tracker.capability.unsupported";
  if (outcome.kind === "adapter-refusal") return "tracker.transport.failed";
  if (outcome.kind === "no-response") return "tracker.payload.invalid";
  return classifyTrackerOutcome(outcome);
};

describe("TC-TAX-001 the taxonomy is four class ids over delivered identities", () => {
  test("exactly four ids, one delivered identity each, and no provider name", () => {
    expect([...TRACKER_ERROR_CLASS_IDS]).toEqual([
      "tracker.capability.unsupported",
      "tracker.auth.rejected",
      "tracker.transport.failed",
      "tracker.payload.invalid",
    ]);
    expect(TRACKER_ERROR_TAXONOMY.length).toBe(4);
    expect(taxonomyViolations(TRACKER_ERROR_TAXONOMY)).toEqual([]);
    expect(new Set(TRACKER_ERROR_TAXONOMY.map((entry) => entry.id))).toEqual(
      new Set(TRACKER_ERROR_CLASS_IDS),
    );
    for (const entry of TRACKER_ERROR_TAXONOMY) {
      expect(entry.deliveredIdentity).toBe(
        entry.id === "tracker.capability.unsupported"
          ? "capability-gap"
          : "provider.payload.invalid",
      );
    }
    expect(JSON.stringify(TRACKER_ERROR_TAXONOMY)).not.toMatch(PROVIDER_WORDS);
  });

  test("the six families are closed and each declares its outcome", () => {
    expect([...TRACKER_TRAP_FAMILIES]).toEqual([
      "auth-shape",
      "transport-failure",
      "rate-limit",
      "payload-shape",
      "workflow-state-mismatch",
      "pagination-truncation",
    ]);
    expect(Object.keys(TRACKER_FAMILY_OUTCOMES).sort()).toEqual([...TRACKER_TRAP_FAMILIES].sort());
    expect(TRACKER_FAMILY_OUTCOMES["pagination-truncation"].proves).toBe("bounded-observation");
  });

  test("the class vocabulary never reaches a delivered identity surface", () => {
    const trackerRows = ERROR_TABLE.filter((row) => row.code.startsWith("tracker."));
    expect(trackerRows).toEqual([]);
    expect(DOMAIN_KINDS.filter((kind) => kind.startsWith("tracker."))).toEqual([]);
    expect(
      DELIVERY_RESULT_PROJECTION_CLASSES.filter((entry) => entry.startsWith("tracker.")),
    ).toEqual([]);
    expect(DELIVERY_RESULT_TAXONOMY.filter((entry) => entry.token.startsWith("tracker."))).toEqual(
      [],
    );
    expect(ADAPTER_OPERATIONS.filter((operation) => operation.startsWith("tracker."))).toEqual([]);
  });

  test("the class ids are never returned as a failure code", () => {
    const outcomes = [
      classifyTrackerFailure(
        { ok: false, code: "provider.payload.invalid", httpStatus: 401 },
        { operationKind: "read" },
      ),
      classifyTrackerFailure(
        { ok: false, code: "provider.payload.invalid" },
        { operationKind: "read" },
      ),
      classifyTrackerFailure(
        { ok: false, code: "provider.payload.invalid", httpStatus: 500 },
        { operationKind: "write" },
      ),
      classifyTrackerOutcome({ kind: "capability-gap" }),
    ];
    for (const classification of outcomes) {
      expect(TRACKER_ERROR_CLASS_IDS).toContain(
        classification as (typeof TRACKER_ERROR_CLASS_IDS)[number],
      );
      expect([
        "provider.payload.invalid",
        "provider.not-found",
        "config.credential.missing",
      ]).not.toContain(classification);
    }
  });

  test("mutation controls: a fifth id, a second identity, a provider name", () => {
    const fifth = [
      ...TRACKER_ERROR_TAXONOMY,
      {
        id: "tracker.rate.limited" as never,
        deliveredIdentity: "provider.payload.invalid" as const,
        discriminator: "status-other-or-refusal-or-undecodable" as const,
        provingFamilies: [] as never,
        provingMechanism: "family" as const,
      },
    ];
    expect(
      taxonomyViolations(fifth).some((message) => message.includes("tracker.rate.limited")),
    ).toBe(true);
    const secondIdentity = TRACKER_ERROR_TAXONOMY.map((entry, index) =>
      index === 1 ? { ...entry, unit: "second-identity" } : entry,
    ) as unknown as readonly TrackerErrorClass[];
    expect(
      taxonomyViolations(secondIdentity).some((message) => message.includes("extra identity")),
    ).toBe(true);
    const providerName = TRACKER_ERROR_TAXONOMY.map((entry, index) =>
      index === 0 ? { ...entry, discriminator: "github-operation-membership" as never } : entry,
    );
    expect(
      taxonomyViolations(providerName).some((message) => message.includes("provider name")),
    ).toBe(true);
  });
});

describe("TC-TAX-009 the decision rule is total, ordered, and deterministic", () => {
  test("every observable outcome resolves exactly once, deterministically", () => {
    expect(classifyTrackerOutcome({ kind: "capability-gap" })).toBe(
      "tracker.capability.unsupported",
    );
    expect(classifyTrackerOutcome({ kind: "adapter-refusal" })).toBe("tracker.payload.invalid");
    expect(classifyTrackerOutcome({ kind: "no-response" })).toBe("tracker.transport.failed");
    expect(classifyTrackerOutcome({ kind: "read-not-found" })).toBe("outside-taxonomy");
    expect(classifyTrackerOutcome({ kind: "status", httpStatus: 401, operationKind: "read" })).toBe(
      "tracker.auth.rejected",
    );
    expect(classifyTrackerOutcome({ kind: "status", httpStatus: 403, operationKind: "read" })).toBe(
      "tracker.auth.rejected",
    );
    expect(classifyTrackerOutcome({ kind: "status", httpStatus: 500, operationKind: "read" })).toBe(
      "tracker.payload.invalid",
    );
    expect(
      classifyTrackerOutcome({
        kind: "status",
        httpStatus: 200,
        operationKind: "read",
        undecodable: true,
      }),
    ).toBe("tracker.payload.invalid");
    expect(classifyTrackerOutcome({ kind: "decoded-success" })).toBe("success");
    const once = classifyTrackerOutcome({ kind: "no-response" });
    expect(classifyTrackerOutcome({ kind: "no-response" })).toBe(once);
  });

  test("a read 404 stays outside while a write 404 stays the payload class", () => {
    expect(classifyTrackerOutcome({ kind: "read-not-found" })).toBe("outside-taxonomy");
    expect(classifyTrackerOutcome({ kind: "status", httpStatus: 404, operationKind: "read" })).toBe(
      "outside-taxonomy",
    );
    expect(
      classifyTrackerOutcome({ kind: "status", httpStatus: 404, operationKind: "write" }),
    ).toBe("tracker.payload.invalid");
    expect(
      classifyTrackerFailure(
        { ok: false, code: "provider.not-found", httpStatus: 404 },
        { operationKind: "write" },
      ),
    ).toBe("tracker.payload.invalid");
    expect(
      classifyTrackerFailure(
        { ok: false, code: "config.credential.missing" },
        { operationKind: "read" },
      ),
    ).toBe("outside-taxonomy");
  });

  test("an ambiguity set proves order: a refusal beats a status-less failure", () => {
    const ambiguous = { kind: "adapter-refusal" } as const;
    expect(classifyTrackerOutcome(ambiguous)).toBe("tracker.payload.invalid");
    expect(swappedRule(ambiguous)).toBe("tracker.transport.failed");
    const statusless = { kind: "no-response" } as const;
    expect(classifyTrackerOutcome(statusless)).toBe("tracker.transport.failed");
    expect(swappedRule(statusless)).toBe("tracker.payload.invalid");
    // A stimulus that is both a refusal and would present without a response:
    // the refusal rule precedes the no-response rule in the declared order.
    const refusalOverTransport = { kind: "adapter-refusal" } as const;
    expect(classifyTrackerOutcome(refusalOverTransport)).toBe("tracker.payload.invalid");
    expect(
      swappedRule({ kind: "adapter-refusal" } as unknown as Parameters<
        typeof classifyTrackerOutcome
      >[0]),
    ).not.toBe(classifyTrackerOutcome(refusalOverTransport));
  });
});

describe("TC-TAX-010 the capability class is proven structurally", () => {
  test("the table declares the capability class as structural with no family", () => {
    const capability = TRACKER_ERROR_TAXONOMY.find(
      (entry) => entry.id === "tracker.capability.unsupported",
    );
    expect(capability?.provingMechanism).toBe("structural");
    expect(capability?.provingFamilies).toEqual([]);
    expect(TRACKER_FAMILY_OUTCOMES["auth-shape"].proves).not.toBe("tracker.capability.unsupported");
  });

  test("the structural and runtime coverage gates prove every declared gap", async () => {
    expect(
      structuralCoverageViolations({ flows: CONFORMANCE_FLOWS, adapters: CONFORMANCE_ADAPTERS }),
    ).toEqual([]);
    const report = await mockReport();
    expect(runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")).toEqual([]);
    for (const adapter of CONFORMANCE_ADAPTERS) {
      for (const gap of adapter.contract.capabilities.declaredGaps) {
        const step = report.steps.find(
          (candidate) =>
            candidate.provider === adapter.provider && candidate.operation === gap.operation,
        );
        expect(step?.status).not.toBe("failed");
        expect(step?.skipKind === "declared-gap" || step === undefined).toBe(true);
      }
    }
    expect(report.steps.filter((step) => step.status === "failed")).toEqual([]);
  });

  test("recording a gapped operation as a failure is refused by the runtime gate", async () => {
    const report = await mockReport();
    const target = report.steps.find(
      (step) => step.skipKind === "declared-gap" && step.status === "skipped",
    );
    expect(target).toBeDefined();
    if (target === undefined) throw new Error("expected a declared-gap step");
    const mutated = {
      ...report,
      steps: report.steps.map((step) =>
        step.provider === target.provider && step.operation === target.operation
          ? { ...step, status: "executed" as const, skipKind: null, skipReason: null }
          : step,
      ),
    };
    expect(runtimeCoverageViolations(mutated, CONFORMANCE_ADAPTERS, "mock")).toContain(
      `${target.provider}: declared gap ${target.operation} (${target.skipReason ?? ""}) was not encountered`,
    );
    const failed = {
      ...report,
      steps: report.steps.map((step) =>
        step.provider === target.provider && step.operation === target.operation
          ? { ...step, status: "failed" as const, skipKind: null, skipReason: null }
          : step,
      ),
    };
    expect(
      runtimeCoverageViolations(failed, CONFORMANCE_ADAPTERS, "mock").some((message) =>
        message.includes("failed step counted as passed"),
      ),
    ).toBe(true);
  });
});
