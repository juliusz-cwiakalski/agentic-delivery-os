/**
 * The derived per-repository authority view (GH-239 F-6; DM-3, DM-4; EVT-3;
 * DEC-9, DEC-13).
 *
 * Authority truth is the append-only handover ledger; this module folds the
 * ledger into the latest operation per repository and builds the rebuildable
 * view that non-typed consumers read. Absent, unreadable, or malformed input
 * resolves to `dual-run`, and no error escapes to the caller.
 */
import {
  DISPATCH_AUTHORITY_SCHEMA,
  type DispatchAuthorityView,
  type DispatchHandoverOperation,
  type DispatchHandoverRecord,
  type DispatchHandoverState,
} from "#contracts";

/** The folded authority fact for one repository: latest operation wins. */
export type DispatchAuthorityFold = {
  readonly repository: string;
  readonly authority: DispatchHandoverState;
  readonly handoverRef: string;
  readonly recordedAt: string;
  readonly reversalAvailable: boolean;
};

/** The safe default: any repository with no valid authority evidence is dual-run. */
export const dualRunAuthority = (repository: string): DispatchAuthorityView => ({
  schema: DISPATCH_AUTHORITY_SCHEMA,
  repository,
  authority: "dual-run",
  recordedAt: "",
  reversalAvailable: false,
});

const authorityOf = (operation: DispatchHandoverOperation): DispatchHandoverState =>
  operation === "authoritative" ? "authoritative" : "dual-run";

/**
 * Fold the verified handover history: the latest operation per repository
 * governs, and every original record is preserved by the caller's ledger.
 */
export const foldDispatchHandover = (
  records: readonly DispatchHandoverRecord[],
): readonly DispatchAuthorityFold[] => {
  const latest = new Map<string, DispatchHandoverRecord>();
  for (const record of records) latest.set(record.repository, record);
  return [...latest.values()]
    .map((record) => ({
      repository: record.repository,
      authority: authorityOf(record.operation),
      handoverRef: `${record.repository}#${record.recordedAt}`,
      recordedAt: record.recordedAt,
      reversalAvailable: authorityOf(record.operation) === "authoritative",
    }))
    .sort((left, right) => (left.repository < right.repository ? -1 : 1));
};

/** Build the view from the folded truth for one repository. */
export const buildDispatchAuthorityView = (
  repository: string,
  folded: readonly DispatchAuthorityFold[],
): DispatchAuthorityView => {
  const match = folded.find((entry) => entry.repository === repository);
  if (match === undefined) return dualRunAuthority(repository);
  return {
    schema: DISPATCH_AUTHORITY_SCHEMA,
    repository: match.repository,
    authority: match.authority,
    handoverRef: match.handoverRef,
    recordedAt: match.recordedAt,
    reversalAvailable: match.reversalAvailable,
  };
};

/** Validate a parsed view; an out-of-shape document is never authoritative. */
export const parseDispatchAuthorityView = (value: unknown): DispatchAuthorityView | undefined => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Partial<Record<keyof DispatchAuthorityView, unknown>>;
  if (record.schema !== DISPATCH_AUTHORITY_SCHEMA) return undefined;
  if (typeof record.repository !== "string" || record.repository.length === 0) return undefined;
  if (record.authority !== "dual-run" && record.authority !== "authoritative") return undefined;
  if (typeof record.recordedAt !== "string") return undefined;
  if (typeof record.reversalAvailable !== "boolean") return undefined;
  if (record.handoverRef !== undefined && typeof record.handoverRef !== "string") return undefined;
  return {
    schema: DISPATCH_AUTHORITY_SCHEMA,
    repository: record.repository,
    authority: record.authority,
    ...(typeof record.handoverRef === "string" ? { handoverRef: record.handoverRef } : {}),
    recordedAt: record.recordedAt,
    reversalAvailable: record.reversalAvailable,
  };
};

/** Read a view from text with a safe dual-run default for that repository. */
export const parseDispatchAuthorityText = (
  repository: string,
  text: string | null | undefined,
): DispatchAuthorityView => {
  if (text === null || text === undefined) return dualRunAuthority(repository);
  try {
    const parsed = parseDispatchAuthorityView(JSON.parse(text));
    return parsed === undefined ? dualRunAuthority(repository) : parsed;
  } catch {
    return dualRunAuthority(repository);
  }
};

/** Whether a repository is engine-authoritative. */
export const isAuthoritative = (view: DispatchAuthorityView): boolean =>
  view.authority === "authoritative";
