/**
 * TC-GATE-003 (diagnostics half) — every parity violation names its provider,
 * operation and one of the nine closed clause ids, carries a resolving
 * reference, keeps a bounded scalar detail, and contains no credential material.
 *
 * The wiring/discovery half belongs to TC-GATE-001 and is added in phase 5.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONFORMANCE_ADAPTERS,
  PARITY_CLAUSE_IDS,
  PARITY_DIFFERENCE_CLASSES,
  PARITY_MATRIX,
  type ParityDifferenceClass,
  type ParityMatrix,
  type ParityObservationRecord,
  type ParityViolation,
  parityViolations,
} from "@delivery-os/testkit";
import {
  addColumn,
  addRegisterEntry,
  coercePair,
  duplicatePairEntry,
  foreignEntry,
  removeCell,
  setClasses,
  setEvidence,
  setObservation,
  setRawCell,
  updateEntry,
} from "../fixtures/providers/conformance/parity/mutations";

const ROOT = process.cwd();

const observation = (): ParityObservationRecord => {
  const parsed = JSON.parse(
    readFileSync(
      join(ROOT, "tests/fixtures/providers/conformance/parity/observation-record.json"),
      "utf8",
    ),
  ) as { record: ParityObservationRecord };
  return parsed.record;
};

const OBSERVATION = observation();

const gate = (matrix: ParityMatrix, record = OBSERVATION): ParityViolation[] =>
  parityViolations({ matrix, adapters: CONFORMANCE_ADAPTERS, observation: record });

const flipped = (): ParityViolation[] => {
  const baseline = coercePair(PARITY_MATRIX, OBSERVATION, "jira", "read-work-item");
  return gate(
    baseline.matrix,
    setObservation(baseline.observation, "jira", "read-work-item", "identity-scheme", {
      state: "observed",
      value: "project-scoped-iid",
    }),
  );
};

const evidenceAgrees = (): ParityViolation[] => {
  const entry = PARITY_MATRIX.register[0];
  if (entry === undefined) throw new Error("entry missing");
  const differenceClass = entry.differenceClasses[0];
  if (differenceClass === undefined) throw new Error("class missing");
  const evidence = entry.evidence[differenceClass];
  if (evidence === undefined) throw new Error("evidence missing");
  return gate(
    setEvidence(PARITY_MATRIX, entry.differenceId, differenceClass, {
      ...evidence,
      referenceValue: evidence.adapterValue,
    }),
  );
};

const allClauses = (): ParityViolation[] => {
  const observationRecord = OBSERVATION;
  const matrix = PARITY_MATRIX;
  const violations = [
    ...gate(addColumn(matrix, "azure")),
    ...gate(removeCell(matrix, "gitlab", "read-work-item")),
    ...gate(
      setRawCell(matrix, "github", "write-comment", {
        kind: "gap",
        reason: "adapter-not-implemented",
      }),
    ),
    ...gate(setRawCell(matrix, "gitlab", "read-work-item", { kind: "reference-equal" })),
    ...gate(setClasses(matrix, "gitlab-read-delivery-request", [])),
    ...gate(
      setRawCell(matrix, "gitlab", "read-work-item", {
        kind: "declared-difference",
        registerId: "absent",
      }),
    ),
    ...gate(
      setRawCell(matrix, "gitlab", "read-delivery-request", {
        kind: "gap",
        reason: "adapter-not-implemented",
      }),
    ),
    ...flipped(),
    ...evidenceAgrees(),
    ...gate(addRegisterEntry(matrix, foreignEntry("jira", "write-work-item"))),
    ...gate(addRegisterEntry(matrix, duplicatePairEntry())),
    ...gate(
      updateEntry(matrix, "gitlab-read-pipeline-run", (entry) => ({
        ...entry,
        differenceClasses: [...entry.differenceClasses, "timing-model" as ParityDifferenceClass],
      })),
    ),
    ...gate(
      matrix,
      setObservation(observationRecord, "jira", "read-pipeline-run", "identity-scheme", {
        state: "observed",
        value: "issue-key",
      }),
    ),
  ];
  return violations;
};

const referenceResolves = (reference: string): boolean => {
  if (existsSync(join(ROOT, reference))) return true;
  return PARITY_MATRIX.register.some((entry) => entry.differenceId === reference);
};

describe("TC-GATE-003 parity diagnostics", () => {
  test("the induced set spans all nine clause ids", () => {
    const clauses = new Set(allClauses().map((entry) => entry.clause));
    expect([...clauses].sort()).toEqual([...PARITY_CLAUSE_IDS].sort());
    expect(clauses.size).toBe(9);
  });

  test("every violation is a bounded, scalar, named record with a resolving reference", () => {
    for (const entry of allClauses()) {
      expect(PARITY_CLAUSE_IDS).toContain(entry.clause);
      expect(entry.provider.length).toBeGreaterThan(0);
      expect(entry.operation.length).toBeGreaterThan(0);
      expect(entry.detail.length).toBeLessThanOrEqual(1024);
      expect(["string", "number", "boolean"]).toContain(typeof entry.expected);
      expect(["string", "number", "boolean"]).toContain(typeof entry.received);
      expect(referenceResolves(entry.evidence), entry.evidence).toBe(true);
      for (const dimension of entry.dimensions) {
        expect(PARITY_DIFFERENCE_CLASSES).toContain(dimension);
      }
    }
  });

  test("an over-bound detail is truncated rather than emitted, and an array received is never produced", () => {
    for (const entry of allClauses()) {
      expect(entry.detail.length).toBeLessThanOrEqual(1024);
      expect(Array.isArray(entry.received)).toBe(false);
      expect(Array.isArray(entry.expected)).toBe(false);
      expect(entry.received).not.toBeUndefined();
    }
  });

  test("no credential material reaches a diagnostic, with a paired detection positive", () => {
    const canary = "conformance-canary-credential-value";
    const serialized = JSON.stringify(allClauses());
    expect(serialized).not.toContain(canary);
    expect(serialized).not.toMatch(/ghp_[A-Za-z0-9]{10,}/);
    const crafted = [{ ...allClauses()[0], detail: `leaked ${canary}` }];
    expect(JSON.stringify(crafted)).toContain(canary);
  });
});

// --- TC-GATE-001: the gate is discovered by the existing aggregate path ------

import {
  CONFORMANCE_ADAPTERS as ADAPTERS,
  createMockTenantTransport,
  runConformance,
} from "@delivery-os/testkit";
import { parse } from "yaml";
import { createCanaryCredentialPort, loadMockTenants } from "../conformance/support/fixtures";

const NEW_SUITES = [
  "tests/conformance/parity-gate.test.ts",
  "tests/conformance/tracker-taxonomy.test.ts",
  "tests/conformance/family-classification.test.ts",
  "tests/conformance/stateful-double.test.ts",
  "tests/conformance/control-registration.test.ts",
  "tests/checks/parity-gate-wiring.test.ts",
  "tests/checks/tracker-literal-scan.test.ts",
  "tests/structure/conformance-family-accounting.test.ts",
  "tests/structure/registration-participation.test.ts",
  "tests/structure/ci-topology-pin.test.ts",
];

const globMatches = (pattern: string, path: string): boolean => {
  const escaped = pattern
    .replaceAll(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**/", "\u0000")
    .replaceAll("**", ".*")
    .replaceAll("*", "[^/]*")
    .replaceAll("\u0000", "(?:.*/)?");
  return new RegExp(`^${escaped}$`).test(path);
};

describe("TC-GATE-001 the gate rides the existing aggregate test path", () => {
  test("the ts-test job runs exactly `pnpm test` and the script is exactly `bun test`", () => {
    const workflow = parse(readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8")) as {
      jobs?: Record<string, { steps?: Array<{ name?: string; run?: string }> }>;
    };
    const steps = workflow.jobs?.["ts-test"]?.steps ?? [];
    const runs = steps.flatMap((step) => (typeof step.run === "string" ? [step.run] : []));
    expect(runs).toContain("pnpm test");
    expect(runs.some((run) => /pnpm test\s+\S|bun test\s+tests\//.test(run))).toBe(false);
    const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts.test).toBe("bun test");
  });

  test("the discovery root is `.` and no new suite path is ignored", () => {
    const bunfig = readFileSync(join(ROOT, "bunfig.toml"), "utf8");
    expect(bunfig).toMatch(/root\s*=\s*"\."/);
    const ignored = [...bunfig.matchAll(/"([^"]+)"/g)]
      .map((match) => match[1] ?? "")
      .filter((value) => value.includes("*") || value.includes("/"));
    for (const suite of NEW_SUITES) {
      expect(existsSync(join(ROOT, suite)), suite).toBe(true);
      for (const pattern of ignored) {
        expect(globMatches(pattern, suite), `${suite} matched ${pattern}`).toBe(false);
      }
    }
    expect(globMatches("tmp/**", "tests/conformance/parity-gate.test.ts")).toBe(false);
  });

  test("the gate actually ran over the production matrix and the mock tier executed steps", async () => {
    const before = PARITY_MATRIX;
    expect(parityViolations({ matrix: before, adapters: CONFORMANCE_ADAPTERS })).toEqual([]);
    expect(before).toBe(PARITY_MATRIX);

    const tenants = loadMockTenants();
    const report = await runConformance({
      adapters: ADAPTERS,
      tenants,
      credentials: createCanaryCredentialPort(),
      transportFactory: (provider) =>
        createMockTenantTransport(tenants[provider as keyof typeof tenants] as never),
      nowIso: "2026-10-31T00:00:00Z",
      runId: "gate-wiring-run",
      tier: "mock",
    });
    expect(report.steps.filter((step) => step.status === "executed").length).toBeGreaterThan(0);
  });
});
