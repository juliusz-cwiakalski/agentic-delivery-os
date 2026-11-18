/**
 * Typed mutation builders over the production parity shapes (GH-339 TPC-PMUT).
 *
 * Every builder returns a value of the production type, so a mutation that stops
 * being a mutation (a renamed field, a widened union) is a compile error rather
 * than a passing no-op. Nothing here mutates a committed fixture.
 */

import { ADAPTER_OPERATIONS } from "@delivery-os/core/contracts";
import type {
  ParityCell,
  ParityCellEntry,
  ParityDifferenceClass,
  ParityEvidence,
  ParityMatrix,
  ParityObservation,
  ParityObservationRecord,
  ParityObservationSet,
  ParityRegisterEntry,
} from "@delivery-os/testkit";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const cloneMatrix = (matrix: ParityMatrix): ParityMatrix => clone(matrix);

export const cloneObservation = (record: ParityObservationRecord): ParityObservationRecord =>
  clone(record);

const columnOf = (matrix: ParityMatrix, provider: string) => {
  const column = matrix.columns.find((candidate) => candidate.provider === provider);
  if (column === undefined) throw new Error(`column ${provider} is missing`);
  return column;
};

const withColumns = (matrix: ParityMatrix, columns: ParityMatrix["columns"]): ParityMatrix => ({
  ...matrix,
  columns,
});

/** Replace one cell. */
export const setCell = (
  matrix: ParityMatrix,
  provider: string,
  operation: string,
  cell: ParityCell,
): ParityMatrix => {
  const target = columnOf(matrix, provider);
  return withColumns(
    matrix,
    matrix.columns.map((column) =>
      column === target
        ? {
            ...column,
            cells: column.cells.map((e) => (e.operation === operation ? { ...e, cell } : e)),
          }
        : column,
    ),
  );
};

/** Set a raw cell entry (used to plant unknown kinds and extra keys). */
export const setRawCell = (
  matrix: ParityMatrix,
  provider: string,
  operation: string,
  cell: unknown,
): ParityMatrix => setCell(matrix, provider, operation, cell as ParityCell);

/** Remove one cell. */
export const removeCell = (
  matrix: ParityMatrix,
  provider: string,
  operation: string,
): ParityMatrix => {
  const target = columnOf(matrix, provider);
  return withColumns(
    matrix,
    matrix.columns.map((column) =>
      column === target
        ? { ...column, cells: column.cells.filter((entry) => entry.operation !== operation) }
        : column,
    ),
  );
};

/** Add one cell entry. */
export const addCell = (
  matrix: ParityMatrix,
  provider: string,
  entry: ParityCellEntry,
): ParityMatrix => {
  const target = columnOf(matrix, provider);
  return withColumns(
    matrix,
    matrix.columns.map((column) =>
      column === target ? { ...column, cells: [...column.cells, entry] } : column,
    ),
  );
};

/** Duplicate one cell entry. */
export const duplicateCell = (
  matrix: ParityMatrix,
  provider: string,
  operation: string,
): ParityMatrix => {
  const target = columnOf(matrix, provider);
  const existing = target.cells.find((entry) => entry.operation === operation);
  if (existing === undefined) throw new Error(`cell ${provider}/${operation} is missing`);
  return addCell(matrix, provider, existing);
};

/** Add a whole column with one cell per closed operation. */
export const addColumn = (matrix: ParityMatrix, provider: string): ParityMatrix => ({
  ...matrix,
  columns: [
    ...matrix.columns,
    {
      provider,
      cells: ADAPTER_OPERATIONS.map((operation) => ({
        operation,
        cell: { kind: "same-as-reference" },
      })),
    },
  ],
});

export const removeColumn = (matrix: ParityMatrix, provider: string): ParityMatrix => ({
  ...matrix,
  columns: matrix.columns.filter((column) => column.provider !== provider),
});

export const setRegister = (
  matrix: ParityMatrix,
  register: readonly ParityRegisterEntry[],
): ParityMatrix => ({ ...matrix, register });

export const updateEntry = (
  matrix: ParityMatrix,
  differenceId: string,
  mutate: (entry: ParityRegisterEntry) => ParityRegisterEntry,
): ParityMatrix => ({
  ...matrix,
  register: matrix.register.map((entry) =>
    entry.differenceId === differenceId ? mutate(entry) : entry,
  ),
});

export const addRegisterEntry = (
  matrix: ParityMatrix,
  entry: ParityRegisterEntry,
): ParityMatrix => ({ ...matrix, register: [...matrix.register, entry] });

export const removeRegisterEntry = (matrix: ParityMatrix, differenceId: string): ParityMatrix => ({
  ...matrix,
  register: matrix.register.filter((entry) => entry.differenceId !== differenceId),
});

export const setClasses = (
  matrix: ParityMatrix,
  differenceId: string,
  classes: readonly ParityDifferenceClass[],
): ParityMatrix =>
  updateEntry(matrix, differenceId, (entry) => ({ ...entry, differenceClasses: classes }));

export const setEvidence = (
  matrix: ParityMatrix,
  differenceId: string,
  differenceClass: ParityDifferenceClass,
  value: ParityEvidence,
): ParityMatrix =>
  updateEntry(matrix, differenceId, (entry) => ({
    ...entry,
    evidence: { ...entry.evidence, [differenceClass]: value },
  }));

export const removeEvidence = (
  matrix: ParityMatrix,
  differenceId: string,
  differenceClass: ParityDifferenceClass,
): ParityMatrix =>
  updateEntry(matrix, differenceId, (entry) => {
    const next = { ...entry.evidence };
    delete next[differenceClass];
    return { ...entry, evidence: next };
  });

/** Replace one class's evidence path, keeping the rest of the document. */
export const setEvidencePath = (
  matrix: ParityMatrix,
  differenceId: string,
  differenceClass: ParityDifferenceClass,
  path: string,
): ParityMatrix =>
  updateEntry(matrix, differenceId, (entry) => {
    const existing = entry.evidence[differenceClass];
    if (existing === undefined)
      throw new Error(`evidence ${differenceId}/${differenceClass} missing`);
    return { ...entry, evidence: { ...entry.evidence, [differenceClass]: { ...existing, path } } };
  });

/** Replace one entry's free-text rationale (including with an empty string). */
export const setRationale = (
  matrix: ParityMatrix,
  differenceId: string,
  rationale: string,
): ParityMatrix => updateEntry(matrix, differenceId, (entry) => ({ ...entry, rationale }));

/** Replace or drop one entry's adjudication reference. */
export const setAdjudicatedBy = (
  matrix: ParityMatrix,
  differenceId: string,
  adjudicatedBy: string | undefined,
): ParityMatrix =>
  updateEntry(matrix, differenceId, (entry) => ({
    ...entry,
    adjudicatedBy: adjudicatedBy as string,
  }));

const withObservationPair = (
  record: ParityObservationRecord,
  provider: string,
  operation: string,
  mutate: (pair: ParityObservationSet) => ParityObservationSet,
): ParityObservationRecord => {
  const providerRecord = record[provider] ?? {};
  const pair = providerRecord[operation] ?? {};
  return {
    ...record,
    [provider]: { ...providerRecord, [operation]: mutate(pair) },
  };
};

export const setObservation = (
  record: ParityObservationRecord,
  provider: string,
  operation: string,
  dimension: ParityDifferenceClass,
  observation: ParityObservation,
): ParityObservationRecord =>
  withObservationPair(record, provider, operation, (pair) => ({
    ...pair,
    [dimension]: observation,
  }));

export const dropObservation = (
  record: ParityObservationRecord,
  provider: string,
  operation: string,
  dimension: ParityDifferenceClass,
): ParityObservationRecord =>
  withObservationPair(record, provider, operation, (pair) => {
    const next = { ...pair };
    delete next[dimension];
    return next;
  });

export const setPair = (
  record: ParityObservationRecord,
  provider: string,
  operation: string,
  pair: ParityObservationSet,
): ParityObservationRecord => withObservationPair(record, provider, operation, () => pair);

/**
 * The `same-as-reference` baseline: one non-reference supported pair is coerced
 * to agreement on all six dimensions and its register entry is removed.
 */
export const coercePair = (
  matrix: ParityMatrix,
  record: ParityObservationRecord,
  provider: string,
  operation: string,
): { readonly matrix: ParityMatrix; readonly observation: ParityObservationRecord } => {
  const referencePair = record[matrix.reference]?.[operation] ?? {};
  const entryForPair = matrix.register.find(
    (candidate) => candidate.adapter === provider && candidate.operation === operation,
  );
  const withoutEntry =
    entryForPair === undefined ? matrix : removeRegisterEntry(matrix, entryForPair.differenceId);
  return {
    matrix: setCell(withoutEntry, provider, operation, { kind: "same-as-reference" }),
    observation: setPair(record, provider, operation, referencePair),
  };
};

export const sameAsReferenceBaseline = (
  matrix: ParityMatrix,
  record: ParityObservationRecord,
  provider = "jira",
  operation = "read-work-item",
): { readonly matrix: ParityMatrix; readonly observation: ParityObservationRecord } => {
  return coercePair(matrix, record, provider, operation);
};

const entry = (
  differenceId: string,
  adapter: string,
  operation: string,
  differenceClasses: readonly ParityDifferenceClass[],
): ParityRegisterEntry => ({
  differenceId,
  adapter,
  operation,
  differenceClasses,
  rationale: "mutation entry",
  evidence: {},
  adjudicatedBy: "TDR-0036",
});

export const foreignEntry = (adapter: string, operation: string): ParityRegisterEntry =>
  entry("foreign-entry", adapter, operation, ["identity-scheme"]);

export const duplicatePairEntry = (): ParityRegisterEntry =>
  entry("duplicate-pair", "gitlab", "read-pipeline-run", ["identity-scheme"]);
