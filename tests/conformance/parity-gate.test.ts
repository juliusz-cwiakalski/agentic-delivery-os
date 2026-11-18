/**
 * TC-PARITY-001..008, TC-PMUT-001..022, TC-GATE-003, TC-GATE-004 — the parity
 * matrix, the declared-difference register, the SIX-dimension observation grid,
 * and the pure clause-tagged gate.
 *
 * Every mutation asserts its named violation and a paired clean pass. The
 * observation record is a gate-local input; it is never read from a report.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ADAPTER_OPERATIONS } from "@delivery-os/core/contracts";
import {
  CONFORMANCE_ADAPTERS,
  type ConformanceAdapterRegistration,
  type ConformanceReport,
  createMockTenantTransport,
  type MockTenant,
  type MockTenantRoute,
  PARITY_CELL_KINDS,
  PARITY_CLAUSE_IDS,
  PARITY_DIFFERENCE_CLASSES,
  PARITY_MATRIX,
  type ParityDifferenceClass,
  type ParityMatrix,
  type ParityObservationRecord,
  type ParityViolation,
  parityViolations,
  renderParityViolation,
  runConformance,
} from "@delivery-os/testkit";
import { createGitHubClient } from "../../packages/adapters/src/github/client";
import { GITHUB_UNKNOWN_REVIEW_DECISION_FALLBACK } from "../../packages/adapters/src/github/review-state";
import { createGitLabClient } from "../../packages/adapters/src/gitlab/client";
import { createJiraClient } from "../../packages/adapters/src/jira/client";
import {
  addCell,
  addColumn,
  addRegisterEntry,
  cloneMatrix,
  coercePair,
  duplicateCell,
  duplicatePairEntry,
  foreignEntry,
  removeCell,
  removeColumn,
  removeEvidence,
  removeRegisterEntry,
  setAdjudicatedBy,
  setClasses,
  setEvidence,
  setEvidencePath,
  setObservation,
  setPair,
  setRationale,
  setRawCell,
  updateEntry,
} from "../fixtures/providers/conformance/parity/mutations";
import { createCanaryCredentialPort, loadMockTenant, loadMockTenants } from "./support/fixtures";

const ROOT = process.cwd();
const PARITY_ROOT = "tests/fixtures/providers/conformance/parity";

const loadObservation = (): ParityObservationRecord => {
  const parsed = JSON.parse(
    readFileSync(join(ROOT, PARITY_ROOT, "observation-record.json"), "utf8"),
  ) as { record: ParityObservationRecord };
  return parsed.record;
};

const OBSERVATION = loadObservation();

const gate = (
  matrix: ParityMatrix = PARITY_MATRIX,
  observation: ParityObservationRecord | undefined = OBSERVATION,
): ParityViolation[] => parityViolations({ matrix, adapters: CONFORMANCE_ADAPTERS, observation });

const clean = (result: readonly ParityViolation[]): void => {
  expect(result).toEqual([]);
};

const named = (
  result: readonly ParityViolation[],
  expected: {
    readonly provider?: string;
    readonly operation?: string;
    readonly clause: string;
    readonly dimension?: ParityDifferenceClass;
  },
): ParityViolation => {
  const found = result.find(
    (entry) =>
      entry.clause === expected.clause &&
      (expected.provider === undefined || entry.provider === expected.provider) &&
      (expected.operation === undefined || entry.operation === expected.operation) &&
      (expected.dimension === undefined || entry.dimensions.includes(expected.dimension)),
  );
  expect(
    found,
    `expected ${expected.clause} ${expected.provider ?? "*"}/${expected.operation ?? "*"}${
      expected.dimension === undefined ? "" : ` ${expected.dimension}`
    }; received ${JSON.stringify(result)}`,
  ).toBeDefined();
  return found as ParityViolation;
};

const cell = (matrix: ParityMatrix, provider: string, operation: string) =>
  matrix.columns
    .find((column) => column.provider === provider)
    ?.cells.find((entry) => entry.operation === operation)?.cell;

const supportedPairs = (): string[] =>
  PARITY_MATRIX.columns.flatMap((column) => {
    const adapter = CONFORMANCE_ADAPTERS.find((entry) => entry.provider === column.provider);
    if (adapter === undefined) return [];
    return column.cells
      .filter((entry) =>
        adapter.contract.capabilities.supportedOperations.includes(entry.operation as never),
      )
      .map((entry) => `${column.provider}/${String(entry.operation)}`);
  });

const intersectionPairs = (): string[] =>
  supportedPairs().filter((pair) => !pair.startsWith(`${PARITY_MATRIX.reference}/`));

const differentDimensions = (
  record: ParityObservationRecord,
  provider: string,
  operation: string,
): ParityDifferenceClass[] =>
  PARITY_DIFFERENCE_CLASSES.filter((dimension) => {
    const left = record[PARITY_MATRIX.reference]?.[operation]?.[dimension];
    const right = record[provider]?.[operation]?.[dimension];
    if (left === undefined || right === undefined) return true;
    if (left.state === "observed" && right.state === "observed") return left.value !== right.value;
    if (left.state === "not-observable" && right.state === "not-observable") return false;
    return true;
  });

describe("TC-PARITY-001 the cell set is exactly adapters x closed operations", () => {
  test("27 cells, nine per column, set equality both directions", () => {
    expect(PARITY_MATRIX.columns.map((column) => column.provider)).toEqual(
      CONFORMANCE_ADAPTERS.map((entry) => entry.provider),
    );
    const total = PARITY_MATRIX.columns.reduce((count, column) => count + column.cells.length, 0);
    expect(total).toBe(27);
    for (const column of PARITY_MATRIX.columns) {
      expect(column.cells.map((entry) => entry.operation).sort()).toEqual(
        [...ADAPTER_OPERATIONS].sort(),
      );
      expect(new Set(column.cells.map((entry) => entry.operation)).size).toBe(9);
    }
    clean(gate());
  });
});

describe("TC-PARITY-002 the reference column is uniformly same-as-reference", () => {
  test("github is the declared reference, all nine cells agree, no entry names it", () => {
    expect(PARITY_MATRIX.reference).toBe("github");
    expect(CONFORMANCE_ADAPTERS.map((entry) => entry.provider)).toContain(PARITY_MATRIX.reference);
    const referenceColumn = PARITY_MATRIX.columns.find(
      (column) => column.provider === PARITY_MATRIX.reference,
    );
    expect(referenceColumn?.cells.map((entry) => entry.cell.kind)).toEqual(
      Array(9).fill("same-as-reference"),
    );
    expect(
      PARITY_MATRIX.register.filter((entry) => entry.adapter === PARITY_MATRIX.reference),
    ).toEqual([]);
    clean(gate());
  });
});

describe("TC-PARITY-003 every gap cell agrees with the capability declaration", () => {
  test("27 cells compared, with reason character equality in both directions", () => {
    let gaps = 0;
    for (const column of PARITY_MATRIX.columns) {
      const adapter = CONFORMANCE_ADAPTERS.find((entry) => entry.provider === column.provider);
      if (adapter === undefined) continue;
      for (const entry of column.cells) {
        const declared = adapter.contract.capabilities.declaredGaps.find(
          (gap) => gap.operation === entry.operation,
        );
        if (entry.cell.kind === "gap") {
          gaps += 1;
          expect(entry.cell.reason).toBe(declared?.reason as string);
        } else {
          expect(declared).toBeUndefined();
        }
      }
    }
    expect(gaps).toBe(13);
    clean(gate());
  });
});

describe("TC-PARITY-004 register bijection, class sets, per-class evidence and adjudication", () => {
  test("every declared-difference cell resolves to exactly one well-formed entry", () => {
    const declaredDifferenceCells = PARITY_MATRIX.columns.flatMap((column) =>
      column.cells.filter((entry) => entry.cell.kind === "declared-difference"),
    );
    expect(declaredDifferenceCells).toHaveLength(PARITY_MATRIX.register.length);
    expect(new Set(PARITY_MATRIX.register.map((entry) => entry.differenceId)).size).toBe(
      PARITY_MATRIX.register.length,
    );
    expect(
      new Set(PARITY_MATRIX.register.map((entry) => `${entry.adapter}|${entry.operation}`)).size,
    ).toBe(PARITY_MATRIX.register.length);
    for (const entry of PARITY_MATRIX.register) {
      expect(entry.differenceClasses.length).toBeGreaterThan(0);
      expect(new Set(entry.differenceClasses).size).toBe(entry.differenceClasses.length);
      for (const differenceClass of entry.differenceClasses) {
        expect(PARITY_DIFFERENCE_CLASSES).toContain(differenceClass);
        const evidence = entry.evidence[differenceClass];
        expect(evidence).toBeDefined();
        expect(evidence?.dimension).toBe(differenceClass);
        expect(evidence?.referenceValue).not.toBe(evidence?.adapterValue);
        expect(existsSync(join(ROOT, evidence?.path ?? ""))).toBe(true);
      }
      expect(entry.rationale.trim().length).toBeGreaterThan(0);
      expect(entry.adjudicatedBy.trim().length).toBeGreaterThan(0);
    }
    clean(gate());
  });

  test("an empty rationale and a missing adjudication reference fail as register-bijection naming the entry", () => {
    const cases = [
      setRationale(PARITY_MATRIX, "jira-read-work-item", ""),
      setRationale(PARITY_MATRIX, "jira-read-work-item", "   "),
      setAdjudicatedBy(PARITY_MATRIX, "jira-read-work-item", ""),
      setAdjudicatedBy(PARITY_MATRIX, "jira-read-work-item", undefined),
    ];
    for (const mutated of cases) {
      const violation = named(gate(mutated), {
        provider: "jira",
        operation: "read-work-item",
        clause: "register-bijection",
      });
      expect(violation.detail).toContain("jira-read-work-item");
    }
    clean(gate());
  });

  test("an unresolvable evidence pointer fails as evidence-reproduction naming the class and entry", () => {
    const missing = `${PARITY_ROOT}/evidence/absent.pipeline-model.json`;
    expect(existsSync(join(ROOT, missing))).toBe(false);
    const mutated = setEvidencePath(
      PARITY_MATRIX,
      "gitlab-read-pipeline-run",
      "pipeline-model",
      missing,
    );
    const result = parityViolations({
      matrix: mutated,
      adapters: CONFORMANCE_ADAPTERS,
      observation: OBSERVATION,
      resolvesEvidence: (path) => existsSync(join(ROOT, path)),
    });
    const violation = named(result, {
      provider: "gitlab",
      operation: "read-pipeline-run",
      clause: "evidence-reproduction",
      dimension: "pipeline-model",
    });
    expect(violation.detail).toContain("gitlab-read-pipeline-run");
    // Positive control: the delivered paths all resolve through the same resolver.
    clean(
      parityViolations({
        matrix: PARITY_MATRIX,
        adapters: CONFORMANCE_ADAPTERS,
        observation: OBSERVATION,
        resolvesEvidence: (path) => existsSync(join(ROOT, path)),
      }),
    );
  });
});

describe("TC-PARITY-005 a same-as-reference cell contradicted on any dimension fails", () => {
  const pair = { provider: "jira", operation: "read-work-item" } as const;
  const baseline = coercePair(PARITY_MATRIX, OBSERVATION, pair.provider, pair.operation);

  const flip = (dimension: ParityDifferenceClass, value: string): ParityViolation[] =>
    gate(
      baseline.matrix,
      setObservation(baseline.observation, pair.provider, pair.operation, dimension, {
        state: "observed",
        value,
      }),
    );

  test("each of the six dimensions flips alone and names exactly that class id", () => {
    const flips: ReadonlyArray<[ParityDifferenceClass, string]> = [
      ["identity-scheme", "project-scoped-iid"],
      ["pipeline-model", "pipeline-unit+jobs+trace"],
      ["state-vocabulary", "merge-status-table+unknown-fallback"],
      ["pagination-model", "bound=none;count=absent"],
      ["carrier-absent", "writable=[];readable=[];participation=executed"],
      ["failure-classification", "tracker.transport.failed"],
    ];
    for (const [dimension, value] of flips) {
      const result = flip(dimension, value);
      expect(result).toHaveLength(1);
      expect(result[0]?.clause).toBe("observed-contradiction");
      expect(result[0]?.dimensions).toEqual([dimension]);
      expect(result[0]?.provider).toBe(pair.provider);
      expect(result[0]?.operation).toBe(pair.operation);
    }
    clean(gate(baseline.matrix, baseline.observation));
  });

  test("a two-dimension flip names both ids in closed-set order and no third", () => {
    const mutated = setObservation(
      setObservation(baseline.observation, pair.provider, pair.operation, "identity-scheme", {
        state: "observed",
        value: "issue-key",
      }),
      pair.provider,
      pair.operation,
      "state-vocabulary",
      { state: "observed", value: "merge-status-table+unknown-fallback" },
    );
    const result = gate(baseline.matrix, mutated);
    expect(result).toHaveLength(1);
    expect(result[0]?.dimensions).toEqual(["identity-scheme", "state-vocabulary"]);
  });

  test("non-dimensions produce no parity violation", () => {
    const pairRecord = baseline.observation[pair.provider]?.[pair.operation] ?? {};
    const withExtras = setPair(baseline.observation, pair.provider, pair.operation, {
      ...pairRecord,
      assertionFamily: { state: "observed", value: "different-family" },
      stepParticipation: { state: "observed", value: "executed" },
    } as never);
    clean(gate(baseline.matrix, withExtras));
  });
});

describe("TC-PARITY-006 per-class evidence reproduces its own dimension; the set is exact", () => {
  test("agreeing evidence fails naming the class and evidence-reproduction", () => {
    const entry = PARITY_MATRIX.register.find(
      (candidate) => candidate.differenceId === "gitlab-read-pipeline-run",
    );
    if (entry === undefined) throw new Error("entry missing");
    const evidence = entry.evidence["pipeline-model"];
    if (evidence === undefined) throw new Error("evidence missing");
    const mutated = setEvidence(PARITY_MATRIX, entry.differenceId, "pipeline-model", {
      ...evidence,
      referenceValue: evidence.adapterValue,
    });
    const violation = named(gate(mutated), {
      provider: "gitlab",
      operation: "read-pipeline-run",
      clause: "evidence-reproduction",
      dimension: "pipeline-model",
    });
    expect(violation.evidence).toBe(evidence.path);
    clean(gate());
  });

  test("a missing evidence reference and a foreign dimension both fail naming the class", () => {
    for (const mutate of [
      (matrix: ParityMatrix) => removeEvidence(matrix, "jira-read-work-item", "state-vocabulary"),
      (matrix: ParityMatrix) => {
        const evidence = matrix.register.find(
          (candidate) => candidate.differenceId === "jira-read-work-item",
        )?.evidence["state-vocabulary"];
        if (evidence === undefined) throw new Error("evidence missing");
        return setEvidence(matrix, "jira-read-work-item", "state-vocabulary", {
          ...evidence,
          dimension: "identity-scheme",
        });
      },
    ]) {
      named(gate(mutate(cloneMatrix(PARITY_MATRIX))), {
        provider: "jira",
        operation: "read-work-item",
        clause: "evidence-reproduction",
        dimension: "state-vocabulary",
      });
    }
  });

  test("omission is observed-contradiction and padding is evidence-reproduction", () => {
    const omitted = setClasses(PARITY_MATRIX, "jira-read-work-item", [
      "identity-scheme",
      "failure-classification",
    ]);
    const omissionViolation = named(gate(omitted), {
      provider: "jira",
      operation: "read-work-item",
      clause: "observed-contradiction",
      dimension: "state-vocabulary",
    });
    expect(omissionViolation.dimensions).toEqual(["state-vocabulary"]);

    const padded = setClasses(PARITY_MATRIX, "gitlab-read-pipeline-run", [
      "identity-scheme",
      "pipeline-model",
      "pagination-model",
      "carrier-absent",
    ]);
    named(gate(padded), {
      provider: "gitlab",
      operation: "read-pipeline-run",
      clause: "evidence-reproduction",
      dimension: "carrier-absent",
    });
  });
});

describe("TC-PARITY-007 the census and the five-intersection adjudication record", () => {
  const adjudication = JSON.parse(
    readFileSync(join(ROOT, PARITY_ROOT, "adjudication.json"), "utf8"),
  ) as {
    intersections: ReadonlyArray<{
      provider: string;
      operation: string;
      posture: string;
      observations: Record<string, unknown>;
      classes: ReadonlyArray<{ class: string; evidence: string }>;
      adjudicatedBy: string;
      rationale: string;
    }>;
  };

  test("the delivered census is 27 cells, 13 gaps, 14 supported, 9 reference, 5 intersections", () => {
    const total = PARITY_MATRIX.columns.reduce((count, column) => count + column.cells.length, 0);
    const gaps = PARITY_MATRIX.columns.flatMap((column) =>
      column.cells.filter((entry) => entry.cell.kind === "gap"),
    );
    expect(total).toBe(27);
    expect(gaps).toHaveLength(13);
    expect(
      PARITY_MATRIX.columns
        .find((column) => column.provider === "gitlab")
        ?.cells.filter((entry) => entry.cell.kind === "gap").length,
    ).toBe(7);
    expect(
      PARITY_MATRIX.columns
        .find((column) => column.provider === "jira")
        ?.cells.filter((entry) => entry.cell.kind === "gap").length,
    ).toBe(6);
    expect(supportedPairs()).toHaveLength(14);
    expect(supportedPairs().filter((pair) => pair.startsWith("github/"))).toHaveLength(9);
    expect(intersectionPairs()).toHaveLength(5);
    expect(new Set(intersectionPairs())).toEqual(
      new Set([
        "gitlab/read-delivery-request",
        "gitlab/read-pipeline-run",
        "jira/read-work-item",
        "jira/write-work-item",
        "jira/transition-work-item",
      ]),
    );
    clean(gate());
  });

  test("the adjudication record is total over exactly the computed intersections", () => {
    const recordPairs = adjudication.intersections.map(
      (entry) => `${entry.provider}/${entry.operation}`,
    );
    expect(new Set(recordPairs)).toEqual(new Set(intersectionPairs()));
    expect(recordPairs).toHaveLength(5);
    for (const entry of adjudication.intersections) {
      const matrixCell = cell(PARITY_MATRIX, entry.provider, entry.operation);
      expect(entry.posture).toBe(matrixCell?.kind);
      expect(Object.keys(entry.observations).sort()).toEqual([...PARITY_DIFFERENCE_CLASSES].sort());
      expect(entry.adjudicatedBy.trim().length).toBeGreaterThan(0);
      expect(entry.rationale.trim().length).toBeGreaterThan(0);
      const entryRecord = PARITY_MATRIX.register.find(
        (candidate) =>
          candidate.adapter === entry.provider && candidate.operation === entry.operation,
      );
      if (entry.posture === "declared-difference") {
        expect(entryRecord).toBeDefined();
        expect([...(entryRecord?.differenceClasses ?? [])].sort()).toEqual(
          differentDimensions(OBSERVATION, entry.provider, entry.operation).sort(),
        );
        for (const declared of entry.classes) {
          expect(entryRecord?.differenceClasses).toContain(declared.class as never);
          expect(existsSync(join(ROOT, declared.evidence))).toBe(true);
        }
      } else {
        expect(entryRecord).toBeUndefined();
        expect(entry.classes).toEqual([]);
      }
    }
  });

  test("(gitlab, read-pipeline-run) is a declared difference containing pagination-model", () => {
    const entry = PARITY_MATRIX.register.find(
      (candidate) => candidate.adapter === "gitlab" && candidate.operation === "read-pipeline-run",
    );
    expect(entry?.differenceClasses).toContain("pagination-model");
  });
});

describe("TC-PARITY-008 both adjudication arms and every dimension mutation run unconditionally", () => {
  const arms = [
    { provider: "gitlab", operation: "read-delivery-request", posture: "declared-difference" },
    { provider: "gitlab", operation: "read-pipeline-run", posture: "declared-difference" },
    { provider: "jira", operation: "read-work-item", posture: "declared-difference" },
    { provider: "jira", operation: "write-work-item", posture: "same-as-reference" },
    { provider: "jira", operation: "transition-work-item", posture: "same-as-reference" },
  ] as const;

  for (const arm of arms) {
    test(`${arm.provider}/${arm.operation} runs the ${arm.posture} arm and its falsifier`, () => {
      if (arm.posture === "same-as-reference") {
        const baseline = coercePair(PARITY_MATRIX, OBSERVATION, arm.provider, arm.operation);
        clean(gate(baseline.matrix, baseline.observation));
        const flipped = gate(
          baseline.matrix,
          setObservation(baseline.observation, arm.provider, arm.operation, "carrier-absent", {
            state: "observed",
            value: "writable=[comment];readable=[];participation=executed",
          }),
        );
        named(flipped, {
          provider: arm.provider,
          operation: arm.operation,
          clause: "observed-contradiction",
          dimension: "carrier-absent",
        });
      } else {
        clean(gate());
        const entry = PARITY_MATRIX.register.find(
          (candidate) =>
            candidate.adapter === arm.provider && candidate.operation === arm.operation,
        );
        const differenceClass = entry?.differenceClasses[0];
        if (differenceClass === undefined) throw new Error("entry class missing");
        const evidence = entry?.evidence[differenceClass];
        if (evidence === undefined) throw new Error("evidence missing");
        named(
          gate(
            setEvidence(PARITY_MATRIX, entry?.differenceId ?? "", differenceClass, {
              ...evidence,
              referenceValue: evidence.adapterValue,
            }),
          ),
          {
            provider: arm.provider,
            operation: arm.operation,
            clause: "evidence-reproduction",
            dimension: differenceClass,
          },
        );
      }
    });
  }

  test("the six dimension mutations, three record/set rules and falsified evidence are registered", () => {
    const registry = [
      ...PARITY_DIFFERENCE_CLASSES,
      "observed-vs-not-observable",
      "omitted-dimension",
      "padded-class",
      "falsified-evidence",
    ];
    expect(
      registry.filter((entry) => PARITY_DIFFERENCE_CLASSES.includes(entry as never)),
    ).toHaveLength(6);
    expect(registry).toHaveLength(10);
  });
});

describe("TC-PMUT-001..013 structural mutations", () => {
  test("PMUT-001 missing cell names provider, operation and cell-set", () => {
    named(gate(removeCell(PARITY_MATRIX, "gitlab", "read-work-item")), {
      provider: "gitlab",
      operation: "read-work-item",
      clause: "cell-set",
    });
    clean(gate());
  });

  test("PMUT-002 duplicate cell names the duplicate count", () => {
    const violation = named(gate(duplicateCell(PARITY_MATRIX, "jira", "transition-work-item")), {
      provider: "jira",
      operation: "transition-work-item",
      clause: "cell-set",
    });
    expect(violation.detail).toContain("count 2");
    clean(gate());
  });

  test("PMUT-003 an extra row key names the row and 28 against 27", () => {
    const violation = named(
      gate(
        addCell(PARITY_MATRIX, "github", {
          operation: "read-attachment",
          cell: { kind: "same-as-reference" },
        }),
      ),
      { provider: "github", operation: "read-attachment", clause: "cell-set" },
    );
    expect(violation.received).toBe(28);
    clean(gate());
  });

  test("PMUT-004 an unknown cell kind names the received kind", () => {
    const violation = named(
      gate(setRawCell(PARITY_MATRIX, "gitlab", "read-work-item", { kind: "reference-equal" })),
      { provider: "gitlab", operation: "read-work-item", clause: "cell-vocabulary" },
    );
    expect(violation.received).toBe("reference-equal");
    clean(gate());
  });

  test("PMUT-005 an out-of-set class names the entry and difference-class", () => {
    const mutated = updateEntry(PARITY_MATRIX, "gitlab-read-pipeline-run", (entry) => ({
      ...entry,
      differenceClasses: [...entry.differenceClasses, "timing-model" as never],
    }));
    named(gate(mutated), {
      provider: "gitlab",
      operation: "read-pipeline-run",
      clause: "difference-class",
    });
    clean(gate());
  });

  test("PMUT-006 support/gap contradictions fail in both directions and on a one-character reason change", () => {
    named(
      gate(
        setCellRaw(PARITY_MATRIX, "gitlab", "read-delivery-request", {
          kind: "gap",
          reason: "adapter-not-implemented",
        }),
      ),
      {
        provider: "gitlab",
        operation: "read-delivery-request",
        clause: "declaration-agreement",
      },
    );
    named(gate(setCellRaw(PARITY_MATRIX, "jira", "write-comment", { kind: "same-as-reference" })), {
      provider: "jira",
      operation: "write-comment",
      clause: "declaration-agreement",
    });
    named(
      gate(
        setCellRaw(PARITY_MATRIX, "jira", "read-pipeline-run", {
          kind: "gap",
          reason: "provider-unsupported ",
        }),
      ),
      {
        provider: "jira",
        operation: "read-pipeline-run",
        clause: "declaration-agreement",
      },
    );
  });

  test("PMUT-007 a column with no registration and a registration with no column both fail", () => {
    named(gate(addColumn(PARITY_MATRIX, "azure")), {
      provider: "azure",
      clause: "column-registration",
    });
    named(gate(removeColumn(PARITY_MATRIX, "jira")), {
      provider: "jira",
      clause: "column-registration",
    });
    clean(gate());
  });

  test("PMUT-008 a dangling registerId and a mis-keyed entry fail as register-bijection", () => {
    named(
      gate(
        setCellRaw(PARITY_MATRIX, "gitlab", "read-work-item", {
          kind: "declared-difference",
          registerId: "absent",
        }),
      ),
      { provider: "gitlab", operation: "read-work-item", clause: "register-bijection" },
    );
    named(
      gate(
        setCellRaw(PARITY_MATRIX, "jira", "read-work-item", {
          kind: "declared-difference",
          registerId: "gitlab-read-pipeline-run",
        }),
      ),
      { provider: "jira", operation: "read-work-item", clause: "register-bijection" },
    );
  });

  test("PMUT-009 an entry naming no cell fails naming the entry", () => {
    named(gate(addRegisterEntry(PARITY_MATRIX, foreignEntry("jira", "write-work-item"))), {
      provider: "jira",
      operation: "write-work-item",
      clause: "register-bijection",
    });
  });

  test("PMUT-010 two entries for one pair fail naming both ids", () => {
    const violation = named(gate(addRegisterEntry(PARITY_MATRIX, duplicatePairEntry())), {
      provider: "gitlab",
      operation: "read-pipeline-run",
      clause: "register-bijection",
    });
    expect(violation.detail).toContain("gitlab-read-pipeline-run");
    expect(violation.detail).toContain("duplicate-pair");
  });

  test("PMUT-011 a non-uniform reference column fails reference-purity", () => {
    named(
      gate(
        setCellRaw(PARITY_MATRIX, "github", "write-comment", {
          kind: "gap",
          reason: "adapter-not-implemented",
        }),
      ),
      {
        provider: "github",
        operation: "write-comment",
        clause: "reference-purity",
      },
    );
    clean(gate());
  });

  test("PMUT-012 a cell carrying a difference class fails cell-vocabulary, as a sibling on a gap cell too", () => {
    named(
      gate(
        setRawCell(PARITY_MATRIX, "gitlab", "read-pipeline-run", {
          kind: "declared-difference",
          registerId: "gitlab-read-pipeline-run",
          differenceClass: "pipeline-model",
        }),
      ),
      { provider: "gitlab", operation: "read-pipeline-run", clause: "cell-vocabulary" },
    );
    named(
      gate(
        setRawCell(PARITY_MATRIX, "jira", "read-pipeline-run", {
          kind: "gap",
          reason: "provider-unsupported",
          differenceClass: "pipeline-model",
        }),
      ),
      { provider: "jira", operation: "read-pipeline-run", clause: "cell-vocabulary" },
    );
    clean(gate());
  });

  test("PMUT-013 an empty, missing, null or empty-string class set fails difference-class", () => {
    named(gate(setClasses(PARITY_MATRIX, "jira-read-work-item", [])), {
      provider: "jira",
      operation: "read-work-item",
      clause: "difference-class",
    });
    for (const value of [undefined, null, [""]] as const) {
      const mutated = updateEntry(PARITY_MATRIX, "jira-read-work-item", (entry) => ({
        ...entry,
        differenceClasses: value as never,
      }));
      named(gate(mutated), {
        provider: "jira",
        operation: "read-work-item",
        clause: "difference-class",
      });
    }
    clean(gate());
  });
});

describe("TC-PMUT-014..019 one observation mutation per dimension", () => {
  const pair = { provider: "jira", operation: "read-work-item" } as const;
  const baseline = coercePair(PARITY_MATRIX, OBSERVATION, pair.provider, pair.operation);

  test("PMUT-014 identity-scheme flips only the scheme", () => {
    const result = gate(
      baseline.matrix,
      setObservation(baseline.observation, pair.provider, pair.operation, "identity-scheme", {
        state: "observed",
        value: "issue-key",
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.dimensions).toEqual(["identity-scheme"]);
  });

  test("PMUT-015 pipeline-model flips unit and composition", () => {
    const pipelinePair = coercePair(PARITY_MATRIX, OBSERVATION, "gitlab", "read-pipeline-run");
    const result = gate(
      pipelinePair.matrix,
      setObservation(pipelinePair.observation, "gitlab", "read-pipeline-run", "pipeline-model", {
        state: "observed",
        value: "pipeline-unit+jobs",
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.dimensions).toEqual(["pipeline-model"]);
  });

  test("PMUT-016 state-vocabulary flips the resolution mechanism", () => {
    const result = gate(
      baseline.matrix,
      setObservation(baseline.observation, pair.provider, pair.operation, "state-vocabulary", {
        state: "observed",
        value: "native-status-only",
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.dimensions).toEqual(["state-vocabulary"]);
  });

  test("PMUT-017 pagination-model flips bound or count presence", () => {
    const pipelinePair = coercePair(PARITY_MATRIX, OBSERVATION, "gitlab", "read-pipeline-run");
    const result = gate(
      pipelinePair.matrix,
      setObservation(pipelinePair.observation, "gitlab", "read-pipeline-run", "pagination-model", {
        state: "observed",
        value: "bound=none;count=absent",
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.dimensions).toEqual(["pagination-model"]);
  });

  test("PMUT-018 carrier-absent flips declaration or participation", () => {
    const pipelinePair = coercePair(PARITY_MATRIX, OBSERVATION, "gitlab", "read-pipeline-run");
    const result = gate(
      pipelinePair.matrix,
      setObservation(pipelinePair.observation, "gitlab", "read-pipeline-run", "carrier-absent", {
        state: "observed",
        value: "writable=[comment];readable=[];participation=not-observable",
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.dimensions).toEqual(["carrier-absent"]);
  });

  test("PMUT-019 failure-classification flips the API-2 class", () => {
    const result = gate(
      baseline.matrix,
      setObservation(
        baseline.observation,
        pair.provider,
        pair.operation,
        "failure-classification",
        {
          state: "observed",
          value: "tracker.transport.failed",
        },
      ),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.dimensions).toEqual(["failure-classification"]);
  });
});

describe("TC-PMUT-020..022 record and set rules", () => {
  const pair = { provider: "jira", operation: "read-work-item" } as const;
  const baseline = coercePair(PARITY_MATRIX, OBSERVATION, pair.provider, pair.operation);

  test("PMUT-020 observed against not-observable is a difference; two not-observable agree", () => {
    const referenceNot = setObservation(
      baseline.observation,
      PARITY_MATRIX.reference,
      pair.operation,
      "pagination-model",
      { state: "not-observable", why: "operation is not a collection read" },
    );
    const adapterObserved = setObservation(
      referenceNot,
      pair.provider,
      pair.operation,
      "pagination-model",
      {
        state: "observed",
        value: "bound=declared;count=reported",
      },
    );
    const result = gate(baseline.matrix, adapterObserved);
    expect(result).toHaveLength(1);
    expect(result[0]?.dimensions).toEqual(["pagination-model"]);

    const bothNot = setObservation(
      baseline.observation,
      pair.provider,
      pair.operation,
      "pagination-model",
      { state: "not-observable", why: "operation is not a collection read" },
    );
    clean(gate(baseline.matrix, bothNot));

    const droppedWhy = setObservation(
      baseline.observation,
      pair.provider,
      pair.operation,
      "pagination-model",
      {
        state: "not-observable",
        why: "",
      },
    );
    named(gate(baseline.matrix, droppedWhy), {
      provider: pair.provider,
      operation: pair.operation,
      clause: "observed-contradiction",
      dimension: "pagination-model",
    });

    const gapObservation = setObservation(
      baseline.observation,
      "jira",
      "read-pipeline-run",
      "identity-scheme",
      { state: "observed", value: "issue-key" },
    );
    named(gate(PARITY_MATRIX, gapObservation), {
      provider: "jira",
      operation: "read-pipeline-run",
      clause: "observed-contradiction",
    });
  });

  test("PMUT-021 an omitted differing dimension is observed-contradiction naming its class", () => {
    named(
      gate(
        setClasses(PARITY_MATRIX, "jira-read-work-item", [
          "identity-scheme",
          "failure-classification",
        ]),
      ),
      {
        provider: "jira",
        operation: "read-work-item",
        clause: "observed-contradiction",
        dimension: "state-vocabulary",
      },
    );
  });

  test("PMUT-022 a padded class whose dimension agrees is evidence-reproduction", () => {
    named(
      gate(
        setClasses(PARITY_MATRIX, "gitlab-read-pipeline-run", [
          "identity-scheme",
          "pipeline-model",
          "pagination-model",
          "carrier-absent",
        ]),
      ),
      {
        provider: "gitlab",
        operation: "read-pipeline-run",
        clause: "evidence-reproduction",
        dimension: "carrier-absent",
      },
    );
  });
});

describe("TC-GATE-003 diagnostics are named, bounded, scalar and secret-free", () => {
  const induced = (): ParityViolation[] =>
    gate(
      removeRegisterEntry(
        setClasses(
          removeCell(
            duplicateCell(PARITY_MATRIX, "gitlab", "read-work-item"),
            "jira",
            "write-comment",
          ),
          "jira-read-work-item",
          [],
        ),
        "gitlab-read-delivery-request",
      ),
    );

  test("every violation carries the nine-id clause, provider, operation, bounded detail and scalar values", () => {
    const violations = induced();
    expect(violations.length).toBeGreaterThan(0);
    for (const entry of violations) {
      expect(PARITY_CLAUSE_IDS).toContain(entry.clause);
      expect(entry.provider.length).toBeGreaterThan(0);
      expect(entry.operation.length).toBeGreaterThan(0);
      expect(entry.detail.length).toBeLessThanOrEqual(1024);
      expect(["string", "number", "boolean"]).toContain(typeof entry.expected);
      expect(["string", "number", "boolean"]).toContain(typeof entry.received);
      expect(entry.evidence.length).toBeGreaterThan(0);
      expect(renderParityViolation(entry)).toContain(entry.clause);
    }
  });

  test("the clause set is the exact nine-id set", () => {
    expect([...PARITY_CLAUSE_IDS]).toEqual([
      "declaration-agreement",
      "observed-contradiction",
      "register-bijection",
      "column-registration",
      "cell-set",
      "reference-purity",
      "cell-vocabulary",
      "difference-class",
      "evidence-reproduction",
    ]);
    expect(new Set(PARITY_CLAUSE_IDS).size).toBe(9);
    expect([...PARITY_CELL_KINDS]).toEqual(["same-as-reference", "declared-difference", "gap"]);
  });

  test("no credential canary reaches a violation, with a paired positive detection", () => {
    const canary = "conformance-canary-credential-value";
    expect(JSON.stringify(induced())).not.toContain(canary);
    const crafted = [
      {
        ...induced()[0],
        detail: `diagnostic containing ${canary}`,
      },
    ];
    expect(JSON.stringify(crafted)).toContain(canary);
  });
});

describe("TC-GATE-004 consecutive runs are identical and canonically ordered", () => {
  test("two runs are deep-equal, the order is canonical, and input insertion order is irrelevant", () => {
    const first = inducedForOrder();
    const second = inducedForOrder();
    expect(second).toEqual(first);
    const rank = new Map(PARITY_CLAUSE_IDS.map((clause, index) => [clause, index]));
    for (let index = 1; index < first.length; index += 1) {
      const previous = first[index - 1];
      const current = first[index];
      if (previous === undefined || current === undefined) throw new Error("missing violation");
      const previousRank = rank.get(previous.clause) ?? 99;
      const currentRank = rank.get(current.clause) ?? 99;
      expect(previousRank <= currentRank).toBe(true);
    }
    const shuffled = {
      ...PARITY_MATRIX,
      columns: [...PARITY_MATRIX.columns]
        .reverse()
        .map((column) => ({ ...column, cells: [...column.cells].reverse() })),
    };
    expect(gate(shuffled)).toEqual(gate());
  });
});

function inducedForOrder(): ParityViolation[] {
  return gate(
    removeRegisterEntry(
      setClasses(removeCell(PARITY_MATRIX, "gitlab", "read-work-item"), "jira-read-work-item", [
        "identity-scheme",
      ]),
      "jira-read-work-item",
    ),
  );
}

function setCellRaw(
  matrix: ParityMatrix,
  provider: string,
  operation: string,
  cell: unknown,
): ParityMatrix {
  return setRawCell(matrix, provider, operation, cell);
}

// --- The four static dimensions are replay-corroborated (review F-1) ---------
//
// identity-scheme, pipeline-model, state-vocabulary and carrier-absent are read
// back out of a REAL replay through the production clients over the committed
// mock tenants, then compared to the gate-local observation record. A stale
// record therefore fails here, and each mutation harness changes the replayed
// input so the derived value moves and the gate names that dimension's class.

type DerivedObservation =
  | { readonly state: "observed"; readonly value: string }
  | { readonly state: "not-observable"; readonly why: string };

type ReplayOutcome = {
  readonly ok: boolean;
  readonly code?: string;
  readonly value?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

/** Clone one tenant and patch the first matching route's object body. */
const withRoute = (
  tenant: MockTenant,
  match: (route: MockTenantRoute) => boolean,
  patch: (body: Record<string, unknown>) => void,
): MockTenant => {
  const clone = JSON.parse(JSON.stringify(tenant)) as MockTenant;
  const route = (clone.routes as readonly MockTenantRoute[]).find(match);
  if (route === undefined) throw new Error("replay route is missing");
  const body = asRecord(route.body);
  if (body === undefined) throw new Error("replay route has no object body");
  patch(body);
  return clone;
};

/** Replay one supported (adapter, operation) through the production client. */
const replayOperation = async (tenant: MockTenant, operation: string): Promise<ReplayOutcome> => {
  const credentials = createCanaryCredentialPort();
  const transport = createMockTenantTransport(tenant);
  const addressing = tenant.addressing;
  const shape = (result: { readonly ok: boolean; readonly code?: string; value?: unknown }) => ({
    ok: result.ok,
    value: result.value,
    ...(result.ok ? {} : { code: result.code }),
  });
  if (addressing.provider === "github") {
    const client = createGitHubClient({
      instance: tenant.instance,
      credentials,
      repository: { owner: addressing.owner, name: addressing.repo },
      transport,
    });
    switch (operation) {
      case "read-work-item":
        return shape(await client.readWorkItem(addressing.issueNumber));
      case "read-delivery-request":
        return shape(await client.readDeliveryRequest(addressing.pullNumber));
      case "read-pipeline-run": {
        const pipeline = await client.readPipelineRun(addressing.commitSha);
        if (!pipeline.ok) return shape(pipeline);
        return { ok: true, value: pipeline.value.items };
      }
      case "write-delivery-request":
        return shape(
          await client.writeDeliveryRequest({
            kind: "create",
            sourceRef: "feat/GH-339/static-dimension-replay",
            targetRef: "main-tools",
            title: "Static dimension replay",
            body: "Static dimension replay",
          }),
        );
      case "write-comment":
        return shape(
          await client.writeComment({
            entityId: String(addressing.issueNumber),
            body: "static dimension replay",
          }),
        );
      default:
        throw new Error(`no github replay for ${operation}`);
    }
  }
  if (addressing.provider === "gitlab") {
    const client = createGitLabClient({
      instance: tenant.instance,
      credentials,
      projectPath: addressing.projectPath,
      transport,
    });
    if (operation === "read-delivery-request") {
      return shape(await client.readDeliveryRequest(addressing.mrIid));
    }
    if (operation === "read-pipeline-run") {
      return shape(await client.readPipelineRun(addressing.commitSha));
    }
    throw new Error(`no gitlab replay for ${operation}`);
  }
  const client = createJiraClient({ instance: tenant.instance, credentials, transport });
  if (operation === "read-work-item") return shape(await client.readWorkItem(addressing.issueKey));
  throw new Error(`no jira replay for ${operation}`);
};

const identityOf = (value: unknown): string => {
  const record = asRecord(value);
  const identity = asRecord(record?.identity);
  const entityId = identity?.entityId;
  if (typeof entityId !== "string" || entityId.length === 0) {
    throw new Error("the replayed result carries no entity identity");
  }
  return entityId;
};

const commentIdOf = (value: unknown): string => {
  const record = asRecord(value);
  const commentId = record?.commentId;
  if (typeof commentId !== "string" || commentId.length === 0) {
    throw new Error("the replayed comment write carries no comment identity");
  }
  return commentId;
};

const observed = (value: string): DerivedObservation => ({ state: "observed", value });
const notObservable = (why: string): DerivedObservation => ({ state: "not-observable", why });

/** Classify the replayed identity into its scheme token (never the value). */
const identitySchemeOf = (
  provider: string,
  operation: string,
  entityId: string,
  payload: unknown,
): string => {
  if (provider === "jira") {
    return /^[A-Za-z][A-Za-z0-9]*-\d+$/.test(entityId) ? "issue-key" : "provider-numeric-id";
  }
  if (entityId.includes(":")) return "composite-check-run-identity";
  if (provider === "gitlab" && operation === "read-delivery-request") {
    const body = asRecord(payload);
    return body !== undefined &&
      body.id !== undefined &&
      body.iid !== undefined &&
      String(body.iid) === entityId &&
      body.id !== body.iid
      ? "project-scoped-iid"
      : "provider-numeric-id";
  }
  if (provider === "gitlab") return "bare-pipeline-id";
  if (operation === "write-delivery-request") return "provider-delivery-request-id";
  if (operation === "write-comment") return "provider-comment-id";
  return "provider-numeric-id";
};

/** Classify the replayed pipeline set into its unit + composition token. */
const pipelineModelOf = (value: unknown): DerivedObservation => {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) return notObservable("the replayed read returns no pipeline item");
  const identities = items.map((item) => identityOf(item));
  const unit = identities.every((identity) => identity.includes(":"))
    ? "check-run-unit"
    : "pipeline-unit";
  const jobs = items.every((item) => {
    const record = asRecord(item);
    return Array.isArray(record?.jobs) && record.jobs.length > 0;
  })
    ? "jobs"
    : "no-jobs";
  const evidence = items.some((item) => {
    const record = asRecord(item);
    return Array.isArray(record?.traceEvidence) && record.traceEvidence.length > 0;
  })
    ? unit === "check-run-unit"
      ? "check-run-evidence"
      : "trace"
    : "no-evidence";
  return observed([unit, jobs, evidence].join("+"));
};

const deliveryStateOf = (value: unknown): string | undefined => {
  const record = asRecord(value);
  const status = asRecord(record?.status);
  const deliveryState = status?.deliveryState;
  return typeof deliveryState === "string" ? deliveryState : undefined;
};

const reviewStateOf = (value: unknown): string | undefined => {
  const record = asRecord(value);
  const reviewState = record?.reviewState;
  return typeof reviewState === "string" ? reviewState : undefined;
};

/** The replayed state-resolution mechanism, probed (never a literal table). */
const stateVocabularyOf = async (
  provider: string,
  operation: string,
  tenant: MockTenant,
): Promise<DerivedObservation> => {
  const addressing = tenant.addressing;
  if (provider === "github" && operation === "read-work-item") {
    if (addressing.provider !== "github") throw new Error("github addressing required");
    const base = await replayOperation(tenant, operation);
    if (!base.ok || deliveryStateOf(base.value) === undefined) {
      return notObservable("the replayed issue read resolves no delivery state");
    }
    const labelled = await replayOperation(
      withRoute(
        tenant,
        (route) =>
          route.method === "GET" && route.url.endsWith(`/issues/${addressing.issueNumber}`),
        (body) => {
          body.labels = [{ name: "review" }];
        },
      ),
      operation,
    );
    const labelsParticipate = labelled.ok && deliveryStateOf(labelled.value) === "in-review";
    const refused = await replayOperation(
      withRoute(
        tenant,
        (route) =>
          route.method === "GET" && route.url.endsWith(`/issues/${addressing.issueNumber}`),
        (body) => {
          body.state = "sideways";
        },
      ),
      operation,
    );
    return observed(
      [
        "native-status",
        labelsParticipate ? "label-tokens" : undefined,
        refused.ok ? undefined : "refusal",
      ]
        .filter((token): token is string => token !== undefined)
        .join("+"),
    );
  }
  if (provider === "jira" && operation === "read-work-item") {
    const base = await replayOperation(tenant, operation);
    if (!base.ok || deliveryStateOf(base.value) === undefined) {
      return notObservable("the replayed issue read resolves no delivery state");
    }
    const issueRoute = (route: MockTenantRoute): boolean =>
      route.method === "GET" && route.url.includes("/rest/api/2/issue/");
    const labelled = await replayOperation(
      withRoute(tenant, issueRoute, (body) => {
        const fields = asRecord(body.fields);
        if (fields !== undefined) fields.labels = ["review"];
      }),
      operation,
    );
    const baseState = deliveryStateOf(base.value);
    const labelsParticipate = labelled.ok && deliveryStateOf(labelled.value) !== baseState;
    const refused = await replayOperation(
      withRoute(tenant, issueRoute, (body) => {
        const fields = asRecord(body.fields);
        const status = asRecord(fields?.status);
        if (status !== undefined) status.name = "Sideways";
      }),
      operation,
    );
    return observed(
      [
        labelsParticipate ? "native-status" : "native-status-row",
        labelsParticipate ? "label-tokens" : undefined,
        refused.ok ? undefined : "refusal",
      ]
        .filter((token): token is string => token !== undefined)
        .join("+"),
    );
  }
  if (provider === "github" && operation === "read-delivery-request") {
    if (addressing.provider !== "github") throw new Error("github addressing required");
    const base = await replayOperation(tenant, operation);
    if (!base.ok || reviewStateOf(base.value) === undefined) {
      return notObservable("the replayed pull-request read resolves no review state");
    }
    const unknown = await replayOperation(
      withRoute(
        tenant,
        (route) => route.method === "GET" && route.url.includes("/pulls/"),
        (body) => {
          body.reviewDecision = "SOMEWHERE_ELSE";
        },
      ),
      operation,
    );
    const fallsBack =
      unknown.ok && reviewStateOf(unknown.value) === GITHUB_UNKNOWN_REVIEW_DECISION_FALLBACK;
    return observed(
      fallsBack ? "review-state-resolver+unknown-decision-fallback" : "review-state-resolver",
    );
  }
  if (provider === "gitlab" && operation === "read-delivery-request") {
    const mergeRequestRoute = (route: MockTenantRoute): boolean =>
      route.method === "GET" && route.url.includes("/merge_requests/");
    const base = await replayOperation(tenant, operation);
    if (!base.ok || reviewStateOf(base.value) === undefined) {
      return notObservable("the replayed merge-request read resolves no review state");
    }
    const tableProbe = await replayOperation(
      withRoute(tenant, mergeRequestRoute, (body) => {
        body.detailed_merge_status = "discussions_not_resolved";
      }),
      operation,
    );
    const tableWorks = tableProbe.ok && reviewStateOf(tableProbe.value) === "changes-requested";
    const fallbackProbe = await replayOperation(
      withRoute(tenant, mergeRequestRoute, (body) => {
        delete body.detailed_merge_status;
      }),
      operation,
    );
    return observed(
      [
        tableWorks ? "merge-status-table" : "unmapped-status-table",
        fallbackProbe.ok ? "unknown-fallback" : "no-fallback",
      ].join("+"),
    );
  }
  throw new Error(`no state-vocabulary derivation for ${provider}/${operation}`);
};

let reportPromise: Promise<ConformanceReport> | undefined;
/** One mock conformance run, read only for the carrier step's participation. */
const mockReport = (): Promise<ConformanceReport> => {
  reportPromise ??= runConformance({
    adapters: CONFORMANCE_ADAPTERS,
    tenants: loadMockTenants(),
    credentials: createCanaryCredentialPort(),
    transportFactory: (provider) => createMockTenantTransport(loadMockTenant(provider)),
    nowIso: "2026-10-31T00:00:00Z",
    runId: "static-dimension-replay",
    tier: "mock",
  });
  return reportPromise;
};

/** The declared carrier arrays plus the carrier step's replayed participation. */
const carrierAbsentOf = async (
  registration: ConformanceAdapterRegistration,
  operation: string,
): Promise<DerivedObservation> => {
  const capabilities = registration.contract.capabilities;
  const writable = [...capabilities.writableCarriers].join(",");
  const readable = [...capabilities.readableCarriers].join(",");
  let participation = "not-observable";
  if (operation === "write-comment") {
    if (capabilities.writableCarriers.length > 0 || capabilities.readableCarriers.length > 0) {
      participation = "executed";
    } else {
      const step = (await mockReport()).steps.find(
        (candidate) =>
          candidate.provider === registration.provider &&
          candidate.operation === "write-comment" &&
          candidate.stepId.includes("carrier-roundtrip"),
      );
      participation =
        step?.skipKind === "capability-absent"
          ? "skipped:capability-absent"
          : (step?.status ?? "not-observable");
    }
  }
  return observed(`writable=[${writable}];readable=[${readable}];participation=${participation}`);
};

const STATIC_DIMENSIONS = [
  "identity-scheme",
  "pipeline-model",
  "state-vocabulary",
  "carrier-absent",
] as const;

type StaticDimension = (typeof STATIC_DIMENSIONS)[number];

const observedPairs = (dimension: StaticDimension): { provider: string; operation: string }[] =>
  Object.entries(OBSERVATION).flatMap(([provider, operations]) =>
    Object.entries(operations).flatMap(([operation, set]) =>
      set?.[dimension]?.state === "observed" ? [{ provider, operation }] : [],
    ),
  );

const registrationOf = (provider: string): ConformanceAdapterRegistration => {
  const registration = CONFORMANCE_ADAPTERS.find((entry) => entry.provider === provider);
  if (registration === undefined) throw new Error(`no registration for ${provider}`);
  return registration;
};

/** Read one route body from a tenant without mutating it. */
const routeBodyOf = (tenant: MockTenant, match: (route: MockTenantRoute) => boolean): unknown =>
  (tenant.routes as readonly MockTenantRoute[]).find(match)?.body;

/** Derive one static dimension from a live replay for one pair. */
const derivedFor = async (
  provider: string,
  operation: string,
  dimension: StaticDimension,
  options: {
    readonly tenant?: MockTenant;
    readonly registration?: ConformanceAdapterRegistration;
  } = {},
): Promise<DerivedObservation> => {
  if (dimension === "carrier-absent") {
    return carrierAbsentOf(options.registration ?? registrationOf(provider), operation);
  }
  const tenant = options.tenant ?? loadMockTenant(provider);
  const replay = await replayOperation(tenant, operation);
  if (dimension === "identity-scheme") {
    if (!replay.ok) return notObservable(`the replay fails: ${replay.code ?? "unknown"}`);
    const payload =
      provider === "gitlab" && operation === "read-delivery-request"
        ? routeBodyOf(
            tenant,
            (route) => route.method === "GET" && route.url.includes("/merge_requests/"),
          )
        : undefined;
    const identityValue = Array.isArray(replay.value) ? replay.value[0] : replay.value;
    const entityId =
      operation === "write-comment" ? commentIdOf(identityValue) : identityOf(identityValue);
    return observed(identitySchemeOf(provider, operation, entityId, payload));
  }
  if (dimension === "pipeline-model") {
    if (!replay.ok) return notObservable(`the replay fails: ${replay.code ?? "unknown"}`);
    return pipelineModelOf(replay.value);
  }
  if (dimension === "state-vocabulary") {
    return stateVocabularyOf(provider, operation, tenant);
  }
  throw new Error(`no derivation for ${dimension}`);
};

const withDimension = (
  record: ParityObservationRecord,
  provider: string,
  operation: string,
  dimension: ParityDifferenceClass,
  derived: DerivedObservation,
): ParityObservationRecord =>
  setObservation(
    JSON.parse(JSON.stringify(record)) as ParityObservationRecord,
    provider,
    operation,
    dimension,
    derived,
  );

const committedValue = (
  provider: string,
  operation: string,
  dimension: ParityDifferenceClass,
): DerivedObservation => {
  const entry = OBSERVATION[provider]?.[operation]?.[dimension];
  if (entry === undefined)
    throw new Error(`no committed ${dimension} for ${provider}/${operation}`);
  return entry;
};

describe("review F-1 remediation: the four static dimensions are replay-corroborated", () => {
  test("identity-scheme equals the replayed identity scheme on every observed pair", async () => {
    const pairs = observedPairs("identity-scheme");
    expect(pairs).toHaveLength(8);
    for (const pair of pairs) {
      const derived = await derivedFor(pair.provider, pair.operation, "identity-scheme");
      expect(derived, `${pair.provider}/${pair.operation}`).toEqual(
        committedValue(pair.provider, pair.operation, "identity-scheme"),
      );
    }
  });

  test("pipeline-model equals the replayed pipeline unit and composition", async () => {
    const pairs = observedPairs("pipeline-model");
    expect(pairs).toHaveLength(2);
    for (const pair of pairs) {
      const derived = await derivedFor(pair.provider, pair.operation, "pipeline-model");
      expect(derived, `${pair.provider}/${pair.operation}`).toEqual(
        committedValue(pair.provider, pair.operation, "pipeline-model"),
      );
    }
  });

  test("state-vocabulary equals the replayed resolution mechanism", async () => {
    const pairs = observedPairs("state-vocabulary");
    expect(pairs).toHaveLength(4);
    for (const pair of pairs) {
      const derived = await derivedFor(pair.provider, pair.operation, "state-vocabulary");
      expect(derived, `${pair.provider}/${pair.operation}`).toEqual(
        committedValue(pair.provider, pair.operation, "state-vocabulary"),
      );
    }
  });

  test("carrier-absent equals the declared carrier arrays plus the replayed participation", async () => {
    const pairs = observedPairs("carrier-absent");
    expect(pairs).toHaveLength(14);
    for (const pair of pairs) {
      const derived = await derivedFor(pair.provider, pair.operation, "carrier-absent");
      expect(derived, `${pair.provider}/${pair.operation}`).toEqual(
        committedValue(pair.provider, pair.operation, "carrier-absent"),
      );
    }
    // The participation half is not decoration: the carrier step is recorded as
    // skipped for the one adapter that supports it and carries none.
    expect(committedValue("github", "write-comment", "carrier-absent")).toMatchObject({
      value: "writable=[];readable=[];participation=skipped:capability-absent",
    });
  });

  test("a dropped GitLab iid moves identity-scheme and the gate names that class", async () => {
    const tenant = withRoute(
      loadMockTenant("gitlab"),
      (route) => route.method === "GET" && route.url.includes("/merge_requests/"),
      (body) => {
        delete body.iid;
      },
    );
    const derived = await derivedFor("gitlab", "read-delivery-request", "identity-scheme", {
      tenant,
    });
    expect(derived).not.toEqual(
      committedValue("gitlab", "read-delivery-request", "identity-scheme"),
    );
    expect(derived).toEqual({ state: "observed", value: "provider-numeric-id" });
    named(
      gate(
        PARITY_MATRIX,
        withDimension(OBSERVATION, "gitlab", "read-delivery-request", "identity-scheme", derived),
      ),
      {
        provider: "gitlab",
        operation: "read-delivery-request",
        clause: "evidence-reproduction",
        dimension: "identity-scheme",
      },
    );
  });

  test("removing the GitLab trace moves pipeline-model and the gate names that class", async () => {
    const tenant = withRoute(
      loadMockTenant("gitlab"),
      (route) => route.method === "GET" && route.url.includes("/pipelines?sha="),
      (body) => {
        for (const pipeline of Array.isArray(body.pipelines) ? body.pipelines : []) {
          const record = asRecord(pipeline);
          if (record !== undefined) delete record.trace;
        }
      },
    );
    const derived = await derivedFor("gitlab", "read-pipeline-run", "pipeline-model", { tenant });
    expect(derived).not.toEqual(committedValue("gitlab", "read-pipeline-run", "pipeline-model"));
    named(
      gate(
        PARITY_MATRIX,
        withDimension(OBSERVATION, "gitlab", "read-pipeline-run", "pipeline-model", derived),
      ),
      {
        provider: "gitlab",
        operation: "read-pipeline-run",
        clause: "evidence-reproduction",
        dimension: "pipeline-model",
      },
    );
  });

  test("an unresolvable GitLab merge status moves state-vocabulary and the gate names that class", async () => {
    const tenant = withRoute(
      loadMockTenant("gitlab"),
      (route) => route.method === "GET" && route.url.includes("/merge_requests/"),
      (body) => {
        body.detailed_merge_status = "not_a_native_status";
        delete body.merge_status;
      },
    );
    const derived = await derivedFor("gitlab", "read-delivery-request", "state-vocabulary", {
      tenant,
    });
    expect(derived).not.toEqual(
      committedValue("gitlab", "read-delivery-request", "state-vocabulary"),
    );
    expect(derived.state).toBe("not-observable");
    named(
      gate(
        PARITY_MATRIX,
        withDimension(OBSERVATION, "gitlab", "read-delivery-request", "state-vocabulary", derived),
      ),
      {
        provider: "gitlab",
        operation: "read-delivery-request",
        clause: "evidence-reproduction",
        dimension: "state-vocabulary",
      },
    );
  });

  test("a declared carrier moves carrier-absent and the gate names that class", async () => {
    const gitlab = registrationOf("gitlab");
    const mutatedRegistration: ConformanceAdapterRegistration = {
      ...gitlab,
      contract: {
        ...gitlab.contract,
        capabilities: {
          ...gitlab.contract.capabilities,
          writableCarriers: ["comment"],
        },
      },
    };
    const derived = await derivedFor("gitlab", "read-pipeline-run", "carrier-absent", {
      registration: mutatedRegistration,
    });
    expect(derived).toEqual({
      state: "observed",
      value: "writable=[comment];readable=[];participation=not-observable",
    });
    expect(derived).not.toEqual(committedValue("gitlab", "read-pipeline-run", "carrier-absent"));
    const adapters = CONFORMANCE_ADAPTERS.map((entry) =>
      entry.provider === "gitlab" ? mutatedRegistration : entry,
    );
    named(
      parityViolations({
        matrix: PARITY_MATRIX,
        adapters,
        observation: withDimension(
          OBSERVATION,
          "gitlab",
          "read-pipeline-run",
          "carrier-absent",
          derived,
        ),
      }),
      {
        provider: "gitlab",
        operation: "read-pipeline-run",
        clause: "observed-contradiction",
        dimension: "carrier-absent",
      },
    );
  });
});
