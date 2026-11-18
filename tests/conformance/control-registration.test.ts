/**
 * TC-REG-002 / TC-REG-006 — the composition-injected synthetic control adapter
 * runs green with a complete column and six family postures, and dropping any
 * one of its five supplied items produces a distinct named failure.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ADAPTER_OPERATIONS } from "@delivery-os/core/contracts";
import {
  CONFORMANCE_ADAPTERS,
  CONFORMANCE_FLOWS,
  type ConformanceAdapterRegistration,
  type ConformanceReport,
  PARITY_MATRIX,
  type ParityMatrix,
  parityViolations,
  runConformance,
  runtimeCoverageViolations,
  structuralCoverageViolations,
} from "@delivery-os/testkit";
import {
  CONTROL_COLUMN,
  CONTROL_CONTRACT,
  CONTROL_FAMILY_ACCOUNTING,
  CONTROL_PROVIDER,
  CONTROL_REGISTRATION,
  CONTROL_TENANT,
} from "../fixtures/providers/conformance/control/column";
import { createCanaryCredentialPort } from "./support/fixtures";

const ROOT = process.cwd();
const CLOCK = "2026-10-31T00:00:00Z";

const controlRun = async (
  tenants = { [CONTROL_PROVIDER]: CONTROL_TENANT },
): Promise<ConformanceReport> =>
  runConformance({
    adapters: [CONTROL_REGISTRATION],
    tenants,
    credentials: createCanaryCredentialPort(),
    transportFactory: () => ({ send: async () => ({ status: 200, body: {} }) }),
    nowIso: CLOCK,
    runId: "control-run",
    tier: "mock",
  });

const controlMatrix = (): ParityMatrix => {
  const reference = PARITY_MATRIX.columns[0];
  if (reference === undefined) throw new Error("reference column missing");
  return {
    reference: PARITY_MATRIX.reference,
    columns: [reference, { provider: CONTROL_PROVIDER, cells: CONTROL_COLUMN }],
    register: [],
  };
};

const registrationWith = (
  overrides: Partial<ConformanceAdapterRegistration>,
): ConformanceAdapterRegistration => ({ ...CONTROL_REGISTRATION, ...overrides });

const trapCatalog = (): { entries: readonly { trapName: string }[] } =>
  JSON.parse(
    readFileSync(join(ROOT, "tests/fixtures/providers/conformance/control/traps.json"), "utf8"),
  ) as { entries: readonly { trapName: string }[] };

const FAMILY_TOKENS: Readonly<Record<string, string>> = {
  "auth-shape": "AUTH",
  "transport-failure": "TRANSPORT",
  "rate-limit": "RATE",
  "payload-shape": "PAYLOAD",
  "workflow-state-mismatch": "STATE",
  "pagination-truncation": "PAGE",
};

const controlFamilyViolations = (entries: readonly { trapName: string }[]): string[] => {
  const violations: string[] = [];
  for (const cell of CONTROL_FAMILY_ACCOUNTING) {
    const marker = FAMILY_TOKENS[cell.family] ?? cell.family;
    if (!entries.some((entry) => entry.trapName.includes(marker))) {
      violations.push(`${CONTROL_PROVIDER}/${cell.family}: no family fixture`);
    }
  }
  return violations;
};

describe("TC-REG-002 the injected control adapter passes with a complete column and six postures", () => {
  test("the control run is passed and every operation executes or declares its gap", async () => {
    const before = [...CONFORMANCE_ADAPTERS];
    const report = await controlRun();
    const provider = report.providers.find((entry) => entry.provider === CONTROL_PROVIDER);
    expect(provider?.status).toBe("passed");
    expect(runtimeCoverageViolations(report, [CONTROL_REGISTRATION], "mock")).toEqual([]);
    for (const operation of ADAPTER_OPERATIONS) {
      const steps = report.steps.filter(
        (step) => step.provider === CONTROL_PROVIDER && step.operation === operation,
      );
      expect(steps.length, operation).toBeGreaterThan(0);
      const executed = steps.some((step) => step.status === "executed");
      const gap = CONTROL_CONTRACT.capabilities.declaredGaps.find(
        (declared) => declared.operation === operation,
      );
      if (executed) continue;
      expect(gap).toBeDefined();
      expect(
        steps.some(
          (step) =>
            step.status === "skipped" &&
            step.skipKind === "declared-gap" &&
            step.skipReason === gap?.reason,
        ),
        operation,
      ).toBe(true);
    }
    expect([...CONFORMANCE_ADAPTERS]).toEqual(before);
    expect(CONFORMANCE_ADAPTERS.some((entry) => entry.provider === CONTROL_PROVIDER)).toBe(false);
  });

  test("the control column has nine cells and agrees with its declaration through the same gate", () => {
    const matrix = controlMatrix();
    expect(matrix.columns[1]?.cells).toHaveLength(9);
    expect(
      parityViolations({
        matrix,
        adapters: [CONFORMANCE_ADAPTERS[0] as ConformanceAdapterRegistration, CONTROL_REGISTRATION],
      }),
    ).toEqual([]);
  });

  test("the control has six family postures with its own trap catalog", () => {
    expect(CONTROL_FAMILY_ACCOUNTING).toHaveLength(6);
    expect(CONTROL_FAMILY_ACCOUNTING.map((cell) => cell.posture)).toEqual(Array(6).fill("covered"));
    expect(controlFamilyViolations(trapCatalog().entries)).toEqual([]);
  });

  test("the run is impossible without the injected seam", () => {
    expect(structuralCoverageViolations({ flows: CONFORMANCE_FLOWS, adapters: [] })).toContain(
      "adapters: registration set is empty",
    );
  });
});

describe("TC-REG-006 each of the five removals produces a distinct named failure", () => {
  test("(a) no contract names the provider", () => {
    const bad = registrationWith({ contract: undefined as never });
    expect(
      structuralCoverageViolations({ flows: CONFORMANCE_FLOWS, adapters: [bad] }).some(
        (message) => message.includes(CONTROL_PROVIDER) && message.includes("contract"),
      ),
    ).toBe(true);
  });

  test("(b) no registration names the column", () => {
    const violations = parityViolations({
      matrix: controlMatrix(),
      adapters: [CONFORMANCE_ADAPTERS[0] as ConformanceAdapterRegistration],
    });
    expect(
      violations.some(
        (entry) => entry.provider === CONTROL_PROVIDER && entry.clause === "column-registration",
      ),
    ).toBe(true);
  });

  test("(c) an empty control column fails the cell set naming the provider", () => {
    const matrix = controlMatrix();
    const empty: ParityMatrix = {
      ...matrix,
      columns: matrix.columns.map((column) =>
        column.provider === CONTROL_PROVIDER ? { ...column, cells: [] } : column,
      ),
    };
    const violations = parityViolations({
      matrix: empty,
      adapters: [CONFORMANCE_ADAPTERS[0] as ConformanceAdapterRegistration, CONTROL_REGISTRATION],
    });
    expect(
      violations.some(
        (entry) => entry.provider === CONTROL_PROVIDER && entry.clause === "cell-set",
      ),
    ).toBe(true);
  });

  test("(d) a missing tenant fails naming the provider", async () => {
    await expect(controlRun({})).rejects.toThrow(`no mock tenant for provider ${CONTROL_PROVIDER}`);
  });

  test("(e) a missing trap catalog fails naming adapter and family", () => {
    expect(controlFamilyViolations([])).toEqual(
      CONTROL_FAMILY_ACCOUNTING.map(
        (cell) => `${CONTROL_PROVIDER}/${cell.family}: no family fixture`,
      ),
    );
  });
});
