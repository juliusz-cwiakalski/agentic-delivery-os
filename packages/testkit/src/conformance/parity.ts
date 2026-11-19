/**
 * Declared cross-adapter parity matrix, declared-difference register, and the
 * pure parity gate (GH-339 F-1, DM-1, DM-2, API-1; TDR-0036).
 *
 * Data plus pure functions. Rows import the closed operation set; columns are
 * derived from the conformance registration list, so this module authors no
 * provider-name key, lookup operand, or comparison (TDR-0039 §2). The gate
 * performs no I/O, reads no ambient input, and returns clause-tagged violation
 * records; a rendered string is only their presentation.
 */
import { GITHUB_ADAPTER_CONTRACT } from "@delivery-os/adapters/github";
import { GITLAB_ADAPTER_CONTRACT } from "@delivery-os/adapters/gitlab";
import { JIRA_ADAPTER_CONTRACT } from "@delivery-os/adapters/jira";
import {
  ADAPTER_OPERATIONS,
  type AdapterContract,
  type AdapterOperation,
  type CapabilityGapReason,
} from "@delivery-os/core/contracts";
import { CONFORMANCE_ADAPTERS } from "./adapters.js";
import {
  TRACKER_AUTH_REJECTED_CLASS,
  TRACKER_TRANSPORT_FAILED_CLASS,
} from "./tracker-error-taxonomy.js";
import type { ConformanceAdapterRegistration } from "./types.js";

/** The six closed difference classes; each IS one parity dimension. */
export const PARITY_DIFFERENCE_CLASSES = [
  "identity-scheme",
  "pipeline-model",
  "state-vocabulary",
  "pagination-model",
  "carrier-absent",
  "failure-classification",
] as const;

export type ParityDifferenceClass = (typeof PARITY_DIFFERENCE_CLASSES)[number];

/** The closed cell vocabulary; a cell carries no class. */
export const PARITY_CELL_KINDS = ["same-as-reference", "declared-difference", "gap"] as const;

export type ParityCellKind = (typeof PARITY_CELL_KINDS)[number];

/** The nine closed clause ids a violation may carry. */
export const PARITY_CLAUSE_IDS = [
  "declaration-agreement",
  "observed-contradiction",
  "register-bijection",
  "column-registration",
  "cell-set",
  "reference-purity",
  "cell-vocabulary",
  "difference-class",
  "evidence-reproduction",
] as const;

export type ParityClauseId = (typeof PARITY_CLAUSE_IDS)[number];

export type ParityCell =
  | { readonly kind: "same-as-reference" }
  | { readonly kind: "declared-difference"; readonly registerId: string }
  | { readonly kind: "gap"; readonly reason: CapabilityGapReason };

/** One authored cell: operation is a row key, never a provider name. */
export type ParityCellEntry = {
  readonly operation: AdapterOperation | string;
  readonly cell: ParityCell;
};

/** One matrix column; the provider is derived from the registration list. */
export type ParityMatrixColumn = {
  readonly provider: string;
  readonly cells: readonly ParityCellEntry[];
};

/** One observation per dimension, or `not-observable` with its reason. */
export type ParityObservation =
  | { readonly state: "observed"; readonly value: string }
  | { readonly state: "not-observable"; readonly why: string };

export type ParityObservationSet = Partial<Record<ParityDifferenceClass, ParityObservation>>;

/** One observation record: provider → operation → per-dimension observations. */
export type ParityObservationRecord = Readonly<
  Record<string, Readonly<Record<string, ParityObservationSet>>>
>;

/** One per-class evidence reference that reproduces that dimension's difference. */
export type ParityEvidence = {
  readonly path: string;
  readonly dimension: ParityDifferenceClass;
  readonly referenceValue: string;
  readonly adapterValue: string;
};

/** One register entry, keyed by exactly `(adapter, operation)`. */
export type ParityRegisterEntry = {
  readonly differenceId: string;
  readonly adapter: string;
  readonly operation: AdapterOperation | string;
  readonly differenceClasses: readonly ParityDifferenceClass[];
  readonly rationale: string;
  readonly evidence: Partial<Record<ParityDifferenceClass, ParityEvidence>>;
  readonly adjudicatedBy: string;
};

export type ParityMatrix = {
  readonly reference: string;
  readonly columns: readonly ParityMatrixColumn[];
  readonly register: readonly ParityRegisterEntry[];
};

/** One clause-tagged violation record; a string form is only its rendering. */
export type ParityViolation = {
  readonly provider: string;
  readonly operation: string;
  readonly clause: ParityClauseId;
  readonly dimensions: readonly ParityDifferenceClass[];
  readonly detail: string;
  readonly expected: string | number | boolean;
  readonly received: string | number | boolean;
  readonly evidence: string;
};

export type ParityGateInput = {
  readonly matrix: ParityMatrix;
  readonly adapters: readonly ConformanceAdapterRegistration[];
  readonly observation?: ParityObservationRecord;
  /**
   * Optional evidence-path resolver. The gate itself performs no I/O, so a
   * caller that owns a filesystem supplies one (the suite passes `existsSync`);
   * without it, evidence is only checked for a reference that reproduces its
   * class. A path the resolver rejects fails as `evidence-reproduction`.
   */
  readonly resolvesEvidence?: (path: string) => boolean;
};

/** Longest permitted violation detail. */
export const PARITY_DETAIL_MAX_CHARS = 1024 as const;

type AuthoredColumn = readonly ParityCellEntry[];
type AuthoredRegisterEntry = Omit<ParityRegisterEntry, "adapter"> & {
  readonly contract: AdapterContract;
};

const EVERY_OPERATION = ADAPTER_OPERATIONS;

const same = (): ParityCell => ({ kind: "same-as-reference" });
const gap = (reason: CapabilityGapReason): ParityCell => ({ kind: "gap", reason });
const difference = (registerId: string): ParityCell => ({
  kind: "declared-difference",
  registerId,
});

/**
 * The authored columns, each BOUND TO ITS CONTRACT, never to a list position.
 *
 * A registration is looked up by contract identity, so reordering the
 * registration list can never attach one adapter's authored cells to another
 * adapter, and a registration whose contract is not authored here (the
 * composition-injected control) receives no cells instead of a neighbour's. The
 * provider names never appear in this module: the matrix derives them from the
 * registration list.
 */
const AUTHORED_COLUMNS: readonly {
  readonly contract: AdapterContract;
  readonly cells: AuthoredColumn;
}[] = [
  {
    contract: GITHUB_ADAPTER_CONTRACT,
    cells: EVERY_OPERATION.map((operation) => ({ operation, cell: same() })),
  },
  {
    contract: GITLAB_ADAPTER_CONTRACT,
    cells: [
      { operation: "read-work-item", cell: gap("adapter-not-implemented") },
      { operation: "write-work-item", cell: gap("adapter-not-implemented") },
      { operation: "transition-work-item", cell: gap("adapter-not-implemented") },
      { operation: "read-delivery-request", cell: difference("gitlab-read-delivery-request") },
      { operation: "write-delivery-request", cell: gap("adapter-not-implemented") },
      { operation: "read-pipeline-run", cell: difference("gitlab-read-pipeline-run") },
      { operation: "write-comment", cell: gap("adapter-not-implemented") },
      { operation: "resolve-delivery-thread", cell: gap("adapter-not-implemented") },
      { operation: "merge-delivery-request", cell: gap("adapter-not-implemented") },
    ],
  },
  {
    contract: JIRA_ADAPTER_CONTRACT,
    cells: [
      { operation: "read-work-item", cell: difference("jira-read-work-item") },
      { operation: "write-work-item", cell: same() },
      { operation: "transition-work-item", cell: same() },
      { operation: "read-delivery-request", cell: gap("provider-unsupported") },
      { operation: "write-delivery-request", cell: gap("provider-unsupported") },
      { operation: "read-pipeline-run", cell: gap("provider-unsupported") },
      { operation: "write-comment", cell: gap("adapter-not-implemented") },
      { operation: "resolve-delivery-thread", cell: gap("provider-unsupported") },
      { operation: "merge-delivery-request", cell: gap("provider-unsupported") },
    ],
  },
];

const authoredCellsFor = (registration: ConformanceAdapterRegistration): AuthoredColumn =>
  AUTHORED_COLUMNS.find((entry) => entry.contract === registration.contract)?.cells ?? [];

const providerForContract = (
  adapters: readonly ConformanceAdapterRegistration[],
  contract: AdapterContract,
): string => adapters.find((registration) => registration.contract === contract)?.provider ?? "";

const evidence = (
  path: string,
  dimension: ParityDifferenceClass,
  referenceValue: string,
  adapterValue: string,
): ParityEvidence => ({ path, dimension, referenceValue, adapterValue });

const AUTHORED_REGISTER: readonly AuthoredRegisterEntry[] = [
  {
    contract: GITLAB_ADAPTER_CONTRACT,
    differenceId: "gitlab-read-delivery-request",
    operation: "read-delivery-request",
    differenceClasses: ["identity-scheme", "state-vocabulary", "failure-classification"],
    rationale:
      "GitLab identifies the merge request by its project-scoped iid, resolves review state through the merge-status table, and builds a status-less payload failure; the failure-classification difference is unobservable on the reference on this operation because no reference family fixture exercises read-delivery-request, so the recorded class reflects the adapter's structural status absence rather than a reference divergence.",
    evidence: {
      "identity-scheme": evidence(
        "tests/fixtures/providers/conformance/parity/evidence/gitlab-read-delivery-request.identity-scheme.json",
        "identity-scheme",
        "provider-numeric-id",
        "project-scoped-iid",
      ),
      "state-vocabulary": evidence(
        "tests/fixtures/providers/conformance/parity/evidence/gitlab-read-delivery-request.state-vocabulary.json",
        "state-vocabulary",
        "review-state-resolver+unknown-decision-fallback",
        "merge-status-table+unknown-fallback",
      ),
      "failure-classification": evidence(
        "tests/fixtures/providers/conformance/parity/evidence/gitlab-read-delivery-request.failure-classification.json",
        "failure-classification",
        "not-observable:no-family-on-reference",
        TRACKER_TRANSPORT_FAILED_CLASS,
      ),
    },
    adjudicatedBy: "TDR-0036",
  },
  {
    contract: GITLAB_ADAPTER_CONTRACT,
    differenceId: "gitlab-read-pipeline-run",
    operation: "read-pipeline-run",
    differenceClasses: ["identity-scheme", "pipeline-model", "pagination-model"],
    rationale:
      "GitLab identities are bare pipeline ids, one item is a provider pipeline with its own job list and trace, and the read declares no page bound and reports no page count where the reference returns a bounded check-run page.",
    evidence: {
      "identity-scheme": evidence(
        "tests/fixtures/providers/conformance/parity/evidence/gitlab-read-pipeline-run.identity-scheme.json",
        "identity-scheme",
        "composite-check-run-identity",
        "bare-pipeline-id",
      ),
      "pipeline-model": evidence(
        "tests/fixtures/providers/conformance/parity/evidence/gitlab-read-pipeline-run.pipeline-model.json",
        "pipeline-model",
        "check-run-unit+jobs+check-run-evidence",
        "pipeline-unit+jobs+trace",
      ),
      "pagination-model": evidence(
        "tests/fixtures/providers/conformance/parity/evidence/gitlab-read-pipeline-run.pagination-model.json",
        "pagination-model",
        "bound=declared;count=reported",
        "bound=none;count=absent",
      ),
    },
    adjudicatedBy: "TDR-0036",
  },
  {
    contract: JIRA_ADAPTER_CONTRACT,
    differenceId: "jira-read-work-item",
    operation: "read-work-item",
    differenceClasses: ["identity-scheme", "state-vocabulary", "failure-classification"],
    rationale:
      "Jira identifies a work item by its issue key, resolves native status through an exact workflow-map row that refuses the unmapped, and builds a status-less payload failure, so the auth-shape family classifies as the transport class on this adapter.",
    evidence: {
      "identity-scheme": evidence(
        "tests/fixtures/providers/conformance/parity/evidence/jira-read-work-item.identity-scheme.json",
        "identity-scheme",
        "provider-numeric-id",
        "issue-key",
      ),
      "state-vocabulary": evidence(
        "tests/fixtures/providers/conformance/parity/evidence/jira-read-work-item.state-vocabulary.json",
        "state-vocabulary",
        "native-status+label-tokens+refusal",
        "native-status-row+refusal",
      ),
      "failure-classification": evidence(
        "tests/fixtures/providers/conformance/parity/evidence/jira-read-work-item.failure-classification.json",
        "failure-classification",
        TRACKER_AUTH_REJECTED_CLASS,
        TRACKER_TRANSPORT_FAILED_CLASS,
      ),
    },
    adjudicatedBy: "TDR-0036",
  },
];

/**
 * Build one matrix from a registration list.
 *
 * The reference is the FIRST registered adapter (DM-7), and columns/cells are
 * bound by contract identity, so no authored column reaches an adapter it was
 * not written for. A registration whose contract is not authored here receives
 * an empty column, which the gate reports as a missing cell set rather than
 * silently borrowing a neighbour's cells.
 */
export const buildParityMatrix = (
  adapters: readonly ConformanceAdapterRegistration[],
): ParityMatrix => ({
  reference: adapters[0]?.provider ?? "",
  columns: adapters.map((registration) => ({
    provider: registration.provider,
    cells: authoredCellsFor(registration),
  })),
  register: AUTHORED_REGISTER.map((entry) => ({
    differenceId: entry.differenceId,
    adapter: providerForContract(adapters, entry.contract),
    operation: entry.operation,
    differenceClasses: entry.differenceClasses,
    rationale: entry.rationale,
    evidence: entry.evidence,
    adjudicatedBy: entry.adjudicatedBy,
  })),
});

/** The declared production matrix over the shipped registration list. */
export const PARITY_MATRIX: ParityMatrix = buildParityMatrix(CONFORMANCE_ADAPTERS);

const CLASS_SET: ReadonlySet<string> = new Set(PARITY_DIFFERENCE_CLASSES);
const CELL_KIND_SET: ReadonlySet<string> = new Set(PARITY_CELL_KINDS);
const CLAUSE_ORDER: ReadonlyMap<string, number> = new Map(
  PARITY_CLAUSE_IDS.map((clause, index) => [clause, index]),
);

const supported = (registration: ConformanceAdapterRegistration): ReadonlySet<string> =>
  new Set(registration.contract.capabilities.supportedOperations);

const gapReason = (
  registration: ConformanceAdapterRegistration,
  operation: string,
): CapabilityGapReason | undefined =>
  registration.contract.capabilities.declaredGaps.find(
    (declared) => declared.operation === operation,
  )?.reason;

const cellOf = (column: ParityMatrixColumn, operation: string): ParityCell | undefined =>
  column.cells.find((entry) => entry.operation === operation)?.cell;

const evidenceFor = (entry: ParityRegisterEntry): string => {
  const firstClass: ParityDifferenceClass | undefined = Array.isArray(entry.differenceClasses)
    ? (entry.differenceClasses[0] as ParityDifferenceClass | undefined)
    : undefined;
  const path = firstClass === undefined ? undefined : entry.evidence?.[firstClass]?.path;
  return path !== undefined && path.length > 0
    ? path
    : "packages/testkit/src/conformance/parity.ts";
};

const violation = (input: {
  readonly provider: string;
  readonly operation: string;
  readonly clause: ParityClauseId;
  readonly dimensions?: readonly ParityDifferenceClass[];
  readonly detail: string;
  readonly expected: string | number | boolean;
  readonly received: string | number | boolean;
  readonly evidence: string;
}): ParityViolation => {
  const detail =
    input.detail.length <= PARITY_DETAIL_MAX_CHARS
      ? input.detail
      : `${input.detail.slice(0, PARITY_DETAIL_MAX_CHARS - 1).trimEnd()}…`;
  return {
    provider: input.provider,
    operation: input.operation,
    clause: input.clause,
    dimensions: input.dimensions ?? [],
    detail,
    expected: input.expected,
    received: input.received,
    evidence: input.evidence,
  };
};

const sortViolations = (violations: readonly ParityViolation[]): ParityViolation[] =>
  [...violations].sort((left, right) => {
    const rank = (CLAUSE_ORDER.get(left.clause) ?? 99) - (CLAUSE_ORDER.get(right.clause) ?? 99);
    if (rank !== 0) return rank;
    const provider = left.provider.localeCompare(right.provider, "en");
    if (provider !== 0) return provider;
    const operation = left.operation.localeCompare(right.operation, "en");
    if (operation !== 0) return operation;
    return left.dimensions.join(",").localeCompare(right.dimensions.join(","), "en");
  });

const observationValuesDiffer = (
  left: ParityObservation | undefined,
  right: ParityObservation | undefined,
): boolean => {
  if (left === undefined || right === undefined) return true;
  if (left.state === "observed" && right.state === "observed") return left.value !== right.value;
  if (left.state === "not-observable" && right.state === "not-observable") return false;
  return true;
};

const malformedObservation = (entry: ParityObservation | undefined): string | undefined => {
  if (entry === undefined) return "missing observation";
  if (entry.state === "not-observable" && entry.why.trim().length === 0) {
    return "not-observable observation has no why";
  }
  if (entry.state === "observed" && entry.value.trim().length === 0) {
    return "observed observation has an empty value";
  }
  return undefined;
};

/**
 * Evaluate the parity matrix and its register.
 *
 * Structural clauses evaluate without an observation; observed clauses only
 * when one is supplied. The result is canonically ordered and empty on pass.
 */
export const parityViolations = (input: ParityGateInput): ParityViolation[] => {
  const { matrix, adapters, observation, resolvesEvidence } = input;
  const violations: ParityViolation[] = [];
  const registrationByProvider = new Map(adapters.map((entry) => [entry.provider, entry]));
  const columnProviders = matrix.columns.map((column) => column.provider);
  const registeredProviders = adapters.map((entry) => entry.provider);

  // (e) column/registration mismatch, both directions.
  for (const provider of columnProviders) {
    if (!registeredProviders.includes(provider)) {
      violations.push(
        violation({
          provider,
          operation: "*",
          clause: "column-registration",
          detail: `matrix column ${provider} names no registered adapter`,
          expected: registeredProviders.join(","),
          received: provider,
          evidence: "packages/testkit/src/conformance/parity.ts",
        }),
      );
    }
  }
  for (const provider of registeredProviders) {
    if (!columnProviders.includes(provider)) {
      violations.push(
        violation({
          provider,
          operation: "*",
          clause: "column-registration",
          detail: `registered adapter ${provider} has no matrix column`,
          expected: provider,
          received: columnProviders.join(","),
          evidence: "packages/testkit/src/conformance/parity.ts",
        }),
      );
    }
  }
  if (registeredProviders.length > 0 && !registeredProviders.includes(matrix.reference)) {
    violations.push(
      violation({
        provider: matrix.reference,
        operation: "*",
        clause: "reference-purity",
        detail: `reference adapter ${matrix.reference} is not registered`,
        expected: registeredProviders.join(","),
        received: matrix.reference,
        evidence: "packages/testkit/src/conformance/parity.ts",
      }),
    );
  }

  const expectedOperations = new Set<string>(ADAPTER_OPERATIONS);
  const totalCells = matrix.columns.reduce((count, column) => count + column.cells.length, 0);

  // (f1) cell set: exactly operations × columns, no missing, duplicate, or extra.
  for (const column of matrix.columns) {
    const seen = new Set<string>();
    for (const entry of column.cells) {
      if (!expectedOperations.has(entry.operation)) {
        violations.push(
          violation({
            provider: column.provider,
            operation: String(entry.operation),
            clause: "cell-set",
            detail: `cell ${entry.operation} is outside the closed operation set; observed ${totalCells} cells against ${ADAPTER_OPERATIONS.length * matrix.columns.length}`,
            expected: ADAPTER_OPERATIONS.length,
            received: totalCells,
            evidence: "packages/testkit/src/conformance/parity.ts",
          }),
        );
        continue;
      }
      if (seen.has(entry.operation)) {
        violations.push(
          violation({
            provider: column.provider,
            operation: String(entry.operation),
            clause: "cell-set",
            detail: `duplicate cell for ${entry.operation} (count ${column.cells.filter((candidate) => candidate.operation === entry.operation).length})`,
            expected: 1,
            received: column.cells.filter((candidate) => candidate.operation === entry.operation)
              .length,
            evidence: "packages/testkit/src/conformance/parity.ts",
          }),
        );
      }
      seen.add(entry.operation);
    }
    for (const operation of ADAPTER_OPERATIONS) {
      if (!seen.has(operation)) {
        violations.push(
          violation({
            provider: column.provider,
            operation,
            clause: "cell-set",
            detail: `matrix is missing the ${operation} cell for ${column.provider}`,
            expected: operation,
            received: "missing",
            evidence: "packages/testkit/src/conformance/parity.ts",
          }),
        );
      }
    }
  }

  // Cell shape, declaration agreement, and reference purity.
  for (const column of matrix.columns) {
    const registration = registrationByProvider.get(column.provider);
    const isReference = column.provider === matrix.reference;
    for (const entry of column.cells) {
      const cell = entry.cell;
      const keys = Object.keys(cell).sort();
      const allowed =
        cell.kind === "same-as-reference"
          ? ["kind"]
          : cell.kind === "declared-difference"
            ? ["kind", "registerId"]
            : cell.kind === "gap"
              ? ["kind", "reason"]
              : [];
      if (!CELL_KIND_SET.has(cell.kind)) {
        violations.push(
          violation({
            provider: column.provider,
            operation: String(entry.operation),
            clause: "cell-vocabulary",
            detail: `cell kind is outside the closed vocabulary`,
            expected: PARITY_CELL_KINDS.join(","),
            received: String(cell.kind),
            evidence: "packages/testkit/src/conformance/parity.ts",
          }),
        );
      } else if (allowed.length > 0 && keys.join(",") !== allowed.join(",")) {
        violations.push(
          violation({
            provider: column.provider,
            operation: String(entry.operation),
            clause: "cell-vocabulary",
            detail: `a cell carries only its declared shape; a declared-difference cell carries a registerId and no class`,
            expected: allowed.join(","),
            received: keys.join(","),
            evidence: "packages/testkit/src/conformance/parity.ts",
          }),
        );
      }
      if (cell.kind === "declared-difference" && cell.registerId.trim().length === 0) {
        violations.push(
          violation({
            provider: column.provider,
            operation: String(entry.operation),
            clause: "cell-vocabulary",
            detail: `declared-difference cell has no registerId`,
            expected: "non-empty registerId",
            received: cell.registerId,
            evidence: "packages/testkit/src/conformance/parity.ts",
          }),
        );
      }
      if (isReference && cell.kind !== "same-as-reference") {
        violations.push(
          violation({
            provider: column.provider,
            operation: String(entry.operation),
            clause: "reference-purity",
            detail: `the reference column must be uniformly same-as-reference`,
            expected: "same-as-reference",
            received: cell.kind,
            evidence: "packages/testkit/src/conformance/parity.ts",
          }),
        );
      }
      if (registration !== undefined && expectedOperations.has(entry.operation)) {
        const isSupported = supported(registration).has(entry.operation);
        const declaredReason = gapReason(registration, entry.operation);
        if (cell.kind === "gap") {
          if (isSupported) {
            violations.push(
              violation({
                provider: column.provider,
                operation: String(entry.operation),
                clause: "declaration-agreement",
                detail: `a supported operation cannot carry a gap cell`,
                expected: "supported",
                received: `gap:${cell.reason}`,
                evidence: "packages/testkit/src/conformance/parity.ts",
              }),
            );
          } else if (declaredReason !== undefined && cell.reason !== declaredReason) {
            violations.push(
              violation({
                provider: column.provider,
                operation: String(entry.operation),
                clause: "declaration-agreement",
                detail: `gap reason differs from the capability declaration`,
                expected: declaredReason,
                received: cell.reason,
                evidence: "packages/testkit/src/conformance/parity.ts",
              }),
            );
          }
        } else if (declaredReason !== undefined) {
          violations.push(
            violation({
              provider: column.provider,
              operation: String(entry.operation),
              clause: "declaration-agreement",
              detail: `a declared-gap operation cannot carry a ${cell.kind} cell`,
              expected: `gap:${declaredReason}`,
              received: cell.kind,
              evidence: "packages/testkit/src/conformance/parity.ts",
            }),
          );
        } else if (!isSupported) {
          violations.push(
            violation({
              provider: column.provider,
              operation: String(entry.operation),
              clause: "declaration-agreement",
              detail: `an unsupported operation cannot carry a ${cell.kind} cell`,
              expected: "gap",
              received: cell.kind,
              evidence: "packages/testkit/src/conformance/parity.ts",
            }),
          );
        }
      }
    }
  }

  // Register vocabulary and bijection.
  const entryById = new Map<string, ParityRegisterEntry>();
  const entryByPair = new Map<string, ParityRegisterEntry>();
  for (const entry of matrix.register) {
    if (entry.adapter === matrix.reference) {
      violations.push(
        violation({
          provider: entry.adapter,
          operation: String(entry.operation),
          clause: "reference-purity",
          detail: `register entry ${entry.differenceId} names the reference adapter`,
          expected: "no reference entry",
          received: entry.differenceId,
          evidence: evidenceFor(entry),
        }),
      );
    }
    if (entryById.has(entry.differenceId)) {
      violations.push(
        violation({
          provider: entry.adapter,
          operation: String(entry.operation),
          clause: "register-bijection",
          detail: `duplicate differenceId ${entry.differenceId}`,
          expected: "unique differenceId",
          received: entry.differenceId,
          evidence: evidenceFor(entry),
        }),
      );
    }
    entryById.set(entry.differenceId, entry);
    const pair = `${entry.adapter}|${entry.operation}`;
    const duplicate = entryByPair.get(pair);
    if (duplicate !== undefined) {
      violations.push(
        violation({
          provider: entry.adapter,
          operation: String(entry.operation),
          clause: "register-bijection",
          detail: `two register entries for one adapter and operation: ${duplicate.differenceId} and ${entry.differenceId}`,
          expected: duplicate.differenceId,
          received: entry.differenceId,
          evidence: evidenceFor(entry),
        }),
      );
    }
    entryByPair.set(pair, entry);

    // Register shape: an entry is an adjudicated, reasoned claim, and each class
    // it claims must carry evidence that resolves when a resolver is supplied.
    if (typeof entry.rationale !== "string" || entry.rationale.trim().length === 0) {
      violations.push(
        violation({
          provider: entry.adapter,
          operation: String(entry.operation),
          clause: "register-bijection",
          detail: `entry ${entry.differenceId} has an empty rationale`,
          expected: "non-empty rationale",
          received: typeof entry.rationale === "string" ? entry.rationale : "missing",
          evidence: evidenceFor(entry),
        }),
      );
    }
    if (typeof entry.adjudicatedBy !== "string" || entry.adjudicatedBy.trim().length === 0) {
      violations.push(
        violation({
          provider: entry.adapter,
          operation: String(entry.operation),
          clause: "register-bijection",
          detail: `entry ${entry.differenceId} has no adjudication reference`,
          expected: "non-empty adjudicatedBy",
          received:
            typeof entry.adjudicatedBy === "string" ? entry.adjudicatedBy : "missing adjudicatedBy",
          evidence: evidenceFor(entry),
        }),
      );
    }

    const classes = entry.differenceClasses;
    if (!Array.isArray(classes) || classes.length === 0) {
      violations.push(
        violation({
          provider: entry.adapter,
          operation: String(entry.operation),
          clause: "difference-class",
          detail: `entry ${entry.differenceId} must carry a non-empty class set`,
          expected: "cardinality >= 1",
          received: Array.isArray(classes) ? classes.length : "not-a-set",
          evidence: evidenceFor(entry),
        }),
      );
    } else {
      const seenClasses = new Set<string>();
      for (const differenceClass of classes) {
        if (!CLASS_SET.has(differenceClass)) {
          violations.push(
            violation({
              provider: entry.adapter,
              operation: String(entry.operation),
              clause: "difference-class",
              detail: `entry ${entry.differenceId} carries class ${String(differenceClass)} outside the closed set`,
              expected: PARITY_DIFFERENCE_CLASSES.join(","),
              received: String(differenceClass),
              evidence: evidenceFor(entry),
            }),
          );
        }
        if (seenClasses.has(differenceClass)) {
          violations.push(
            violation({
              provider: entry.adapter,
              operation: String(entry.operation),
              clause: "difference-class",
              detail: `entry ${entry.differenceId} repeats class ${String(differenceClass)}`,
              expected: "a set",
              received: String(differenceClass),
              evidence: evidenceFor(entry),
            }),
          );
        }
        seenClasses.add(differenceClass);
        if (resolvesEvidence !== undefined && CLASS_SET.has(differenceClass)) {
          const rawEvidence = entry.evidence?.[differenceClass as ParityDifferenceClass];
          const evidencePath = rawEvidence?.path;
          if (
            evidencePath !== undefined &&
            evidencePath.trim().length > 0 &&
            !resolvesEvidence(evidencePath)
          ) {
            violations.push(
              violation({
                provider: entry.adapter,
                operation: String(entry.operation),
                clause: "evidence-reproduction",
                dimensions: [differenceClass],
                detail: `entry ${entry.differenceId} class ${differenceClass} evidence does not resolve`,
                expected: "resolving evidence path",
                received: evidencePath,
                evidence: evidencePath,
              }),
            );
          }
        }
      }
    }
  }

  // Bidirectional bijection over the entry.
  for (const column of matrix.columns) {
    for (const entry of column.cells) {
      if (entry.cell.kind !== "declared-difference") continue;
      const registerId = entry.cell.registerId;
      const resolved = entryById.get(registerId);
      if (resolved === undefined) {
        violations.push(
          violation({
            provider: column.provider,
            operation: String(entry.operation),
            clause: "register-bijection",
            detail: `declared-difference cell resolves to no register entry`,
            expected: "resolving registerId",
            received: registerId,
            evidence: "packages/testkit/src/conformance/parity.ts",
          }),
        );
        continue;
      }
      if (
        resolved.adapter !== column.provider ||
        String(resolved.operation) !== String(entry.operation)
      ) {
        violations.push(
          violation({
            provider: column.provider,
            operation: String(entry.operation),
            clause: "register-bijection",
            detail: `register entry ${registerId} is keyed to ${resolved.adapter}/${String(resolved.operation)}`,
            expected: `${column.provider}/${String(entry.operation)}`,
            received: `${resolved.adapter}/${String(resolved.operation)}`,
            evidence: evidenceFor(resolved),
          }),
        );
      }
    }
  }
  for (const entry of matrix.register) {
    const column = matrix.columns.find((candidate) => candidate.provider === entry.adapter);
    const cell = column === undefined ? undefined : cellOf(column, String(entry.operation));
    if (cell === undefined || cell.kind !== "declared-difference") {
      violations.push(
        violation({
          provider: entry.adapter,
          operation: String(entry.operation),
          clause: "register-bijection",
          detail: `register entry ${entry.differenceId} names no declared-difference cell`,
          expected: "declared-difference cell",
          received: cell?.kind ?? "no cell",
          evidence: evidenceFor(entry),
        }),
      );
    } else if (cell.registerId !== entry.differenceId) {
      violations.push(
        violation({
          provider: entry.adapter,
          operation: String(entry.operation),
          clause: "register-bijection",
          detail: `register entry ${entry.differenceId} does not match the cell registerId`,
          expected: cell.registerId,
          received: entry.differenceId,
          evidence: evidenceFor(entry),
        }),
      );
    }
  }

  // Observed clauses and evidence reproduction.
  if (observation !== undefined) {
    for (const column of matrix.columns) {
      const registration = registrationByProvider.get(column.provider);
      if (registration === undefined) continue;
      for (const entry of column.cells) {
        const operation = String(entry.operation);
        if (!expectedOperations.has(operation)) continue;
        const isSupported = supported(registration).has(operation);
        const pair = observation[column.provider]?.[operation];
        const cell = entry.cell;
        if (!isSupported) {
          if (pair !== undefined && Object.keys(pair).length > 0) {
            violations.push(
              violation({
                provider: column.provider,
                operation,
                clause: "observed-contradiction",
                detail: `a declared-gap pair carries no observation`,
                expected: "no observation",
                received: Object.keys(pair).join(","),
                evidence: "packages/testkit/src/conformance/parity.ts",
              }),
            );
          }
          continue;
        }
        const referencePair = observation[matrix.reference]?.[operation];
        const differences: ParityDifferenceClass[] = [];
        for (const dimension of PARITY_DIFFERENCE_CLASSES) {
          const left = referencePair?.[dimension];
          const right = pair?.[dimension];
          const malformed = malformedObservation(right) ?? malformedObservation(left);
          if (malformed !== undefined) {
            violations.push(
              violation({
                provider: column.provider,
                operation,
                clause: "observed-contradiction",
                dimensions: [dimension],
                detail: `${dimension}: ${malformed}`,
                expected: "one observation per dimension",
                received: malformed,
                evidence: "packages/testkit/src/conformance/parity.ts",
              }),
            );
            continue;
          }
          if (observationValuesDiffer(left, right)) differences.push(dimension);
        }
        const entryForPair = matrix.register.find(
          (candidate) => candidate.adapter === column.provider && candidate.operation === operation,
        );
        if (cell.kind === "same-as-reference") {
          if (differences.length > 0) {
            violations.push(
              violation({
                provider: column.provider,
                operation,
                clause: "observed-contradiction",
                dimensions: differences,
                detail: `same-as-reference cell contradicts the observation on ${differences.join(",")}`,
                expected: "all dimensions agree",
                received: differences.join(","),
                evidence: "packages/testkit/src/conformance/parity.ts",
              }),
            );
          }
          continue;
        }
        if (cell.kind !== "declared-difference" || entryForPair === undefined) continue;
        const declaredClasses: readonly ParityDifferenceClass[] = Array.isArray(
          entryForPair.differenceClasses,
        )
          ? entryForPair.differenceClasses
          : [];
        const declared = new Set<string>(declaredClasses);
        const omitted = differences.filter((dimension) => !declared.has(dimension));
        for (const dimension of omitted) {
          violations.push(
            violation({
              provider: column.provider,
              operation,
              clause: "observed-contradiction",
              dimensions: [dimension],
              detail: `${dimension} differs but is absent from the entry class set`,
              expected: [...declared].join(","),
              received: dimension,
              evidence: evidenceFor(entryForPair),
            }),
          );
        }
        for (const differenceClass of declaredClasses) {
          if (!CLASS_SET.has(differenceClass)) continue;
          const evidenceDoc = entryForPair.evidence[differenceClass];
          const left = referencePair?.[differenceClass];
          const right = pair?.[differenceClass];
          const classAgrees = !observationValuesDiffer(left, right);
          const expectedReference = left?.state === "observed" ? left.value : "not-observable";
          const expectedAdapter = right?.state === "observed" ? right.value : "not-observable";
          if (
            classAgrees ||
            evidenceDoc === undefined ||
            evidenceDoc.dimension !== differenceClass ||
            evidenceDoc.path.trim().length === 0 ||
            evidenceDoc.adapterValue !== expectedAdapter ||
            (left?.state === "observed"
              ? evidenceDoc.referenceValue !== expectedReference
              : !evidenceDoc.referenceValue.startsWith("not-observable"))
          ) {
            violations.push(
              violation({
                provider: column.provider,
                operation,
                clause: "evidence-reproduction",
                dimensions: [differenceClass],
                detail: classAgrees
                  ? `class ${differenceClass} names a dimension that agrees`
                  : `class ${differenceClass} evidence does not reproduce that dimension`,
                expected: `reproducing ${differenceClass} evidence`,
                received: evidenceDoc?.path ?? "missing evidence",
                evidence:
                  evidenceDoc?.path !== undefined && evidenceDoc.path.length > 0
                    ? evidenceDoc.path
                    : evidenceFor(entryForPair),
              }),
            );
          }
        }
      }
    }
  }

  return sortViolations(violations);
};

/** Render one violation for human output; tests assert the record, never this. */
export const renderParityViolation = (entry: ParityViolation): string =>
  `${entry.clause} ${entry.provider}/${entry.operation}: ${entry.detail}`;
