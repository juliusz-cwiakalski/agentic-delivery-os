/**
 * TC-REG-002 / TC-REG-006 — the composition-injected synthetic control adapter
 * runs green with a complete column and six family postures, and dropping any
 * one of its five supplied items produces a distinct named failure.
 *
 * The family-accounting half is the DELIVERED DM-4 validator
 * (`familyAccountingViolations`) applied to the control's own postures — no
 * token scan over trap names, and no `covered` posture on an operation the
 * control's declaration does not support.
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
  TRACKER_TRAP_FAMILIES,
} from "@delivery-os/testkit";
import {
  CONTROL_ACCOUNTING,
  CONTROL_COLUMN,
  CONTROL_CONTRACT,
  CONTROL_PROVIDER,
  CONTROL_REGISTRATION,
  CONTROL_TENANT,
} from "../fixtures/providers/conformance/control/column";
import {
  createCanaryCredentialPort,
  type FamilyAccountingContext,
  familyAccountingViolations,
} from "./support/fixtures";

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

/** The control's accounting context: its own registration, catalog and matrix. */
const controlAccountingContext = (
  entries: readonly { trapName: string }[] = trapCatalog().entries,
): FamilyAccountingContext => ({
  adapters: [CONTROL_REGISTRATION],
  catalogs: { [CONTROL_PROVIDER]: { entries } },
  register: [],
});

const controlAccountingViolations = (
  accounting: typeof CONTROL_ACCOUNTING = CONTROL_ACCOUNTING,
  context: FamilyAccountingContext = controlAccountingContext(),
): string[] => familyAccountingViolations(accounting, context);

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

  test("the delivered accounting validator accepts the control's six postures", () => {
    const cells = CONTROL_ACCOUNTING.providers.control;
    expect(Object.keys(cells).sort()).toEqual([...TRACKER_TRAP_FAMILIES].sort());
    expect(controlAccountingViolations()).toEqual([]);
    const postures = Object.values(cells).map((cell) => cell.posture);
    expect(postures.filter((posture) => posture === "covered")).toHaveLength(4);
    expect(postures.filter((posture) => posture === "gap-backed")).toHaveLength(2);
    expect(postures.filter((posture) => posture === "recorded-difference")).toHaveLength(0);
    for (const [family, cell] of Object.entries(cells)) {
      if (cell.posture === "covered") {
        expect(CONTROL_CONTRACT.capabilities.supportedOperations, family).toContain(
          cell.operation as never,
        );
      } else {
        const declared = CONTROL_CONTRACT.capabilities.declaredGaps.find(
          (gap) => gap.operation === cell.operation,
        );
        expect(declared?.reason, family).toBe(cell.gapReason);
      }
    }
  });

  test("the validator refuses a covered posture on the control's unsupported operation", () => {
    const mutated = {
      ...CONTROL_ACCOUNTING,
      providers: {
        control: {
          ...CONTROL_ACCOUNTING.providers.control,
          "pagination-truncation": {
            posture: "covered" as const,
            operation: "read-pipeline-run",
            catalogEntries: ["CONTROL-FAMILY-PAGE"],
            fixture: "tests/fixtures/providers/conformance/control/tenant.json",
          },
        },
      },
    };
    const violations = controlAccountingViolations(mutated);
    expect(
      violations.some(
        (message) =>
          message.startsWith(`${CONTROL_PROVIDER}/pagination-truncation`) &&
          message.includes("unsupported"),
      ),
    ).toBe(true);
  });

  test("the validator refuses a covered posture whose fixture does not resolve", () => {
    const mutated = {
      ...CONTROL_ACCOUNTING,
      providers: {
        control: {
          ...CONTROL_ACCOUNTING.providers.control,
          "auth-shape": {
            ...CONTROL_ACCOUNTING.providers.control["auth-shape"],
            fixture: "tests/fixtures/providers/conformance/control/absent.json",
          },
        },
      },
    };
    expect(
      controlAccountingViolations(mutated).some(
        (message) =>
          message.startsWith(`${CONTROL_PROVIDER}/auth-shape`) &&
          message.includes("does not resolve"),
      ),
    ).toBe(true);
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
    expect(controlAccountingViolations(CONTROL_ACCOUNTING, controlAccountingContext([]))).toEqual([
      `${CONTROL_PROVIDER}/auth-shape: catalog entry CONTROL-FAMILY-AUTH does not exist`,
      `${CONTROL_PROVIDER}/transport-failure: catalog entry CONTROL-FAMILY-TRANSPORT does not exist`,
      `${CONTROL_PROVIDER}/rate-limit: catalog entry CONTROL-FAMILY-RATE does not exist`,
      `${CONTROL_PROVIDER}/payload-shape: catalog entry CONTROL-FAMILY-PAYLOAD does not exist`,
    ]);
  });
});
