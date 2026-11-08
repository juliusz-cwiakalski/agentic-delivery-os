/**
 * The external-effect state machine (GH-238 F-10; DEC-4, DEC-15, DEC-19;
 * TDR-0014 INV-1..INV-8; Appendix I).
 *
 * `unknown` is first-class. Before any re-apply exactly one bounded query by
 * stable identity is required. For a commit the query is exactly one
 * `logSince(baselineHead)` read; `applied` holds only for exactly one new commit
 * whose normalized changed-path set equals the recorded set. Everything else is
 * `unknown` with no automatic re-apply and no guessed SHA.
 */
import type {
  CommitLogRead,
  EffectKind,
  EffectQueryVerdict,
  EffectReceiptStatus,
  EffectState,
  OutboxEffectRecord,
} from "#contracts";

export const EFFECT_LEGAL_TRANSITIONS: Readonly<Record<EffectState, readonly EffectState[]>> = {
  accepted: ["in-flight", "failed", "unknown"],
  "in-flight": ["applied", "failed", "unknown"],
  applied: [],
  failed: ["in-flight", "unknown"],
  unknown: ["applied", "in-flight", "failed"],
};

export type EffectTransitionDecision =
  | { readonly ok: true; readonly state: EffectState }
  | { readonly ok: false; readonly code: "state.store.unknown" };

export const transitionEffect = (
  current: EffectState,
  next: EffectState,
): EffectTransitionDecision =>
  EFFECT_LEGAL_TRANSITIONS[current].includes(next)
    ? { ok: true, state: next }
    : { ok: false, code: "state.store.unknown" };

/** Normalize the staged path set: repo-relative, `/`, no `./`, deduped, sorted. */
export const normalizeStagedPaths = (paths: readonly string[]): readonly string[] =>
  [...new Set(paths.map((path) => path.replaceAll("\\", "/").replace(/^\.\//u, "")))].sort();

export const pathSetsEqual = (left: readonly string[], right: readonly string[]): boolean => {
  const a = normalizeStagedPaths(left);
  const b = normalizeStagedPaths(right);
  return a.length === b.length && a.every((path, index) => path === b[index]);
};

export type CommitQueryOutcome = {
  readonly status: EffectReceiptStatus;
  readonly verdict: EffectQueryVerdict;
  readonly discoveredSha?: string;
};

/**
 * Resolve a commit effect from exactly one bounded log read. Any inconclusive
 * result is `unknown`; a capped or unreadable read is `unknown`. A path-set
 * mismatch is `not-found` ("this commit is not ours") and never carries a SHA;
 * multiple commits or an unverifiable recorded set is `unreadable`.
 */
export const resolveCommitEffect = (
  record: Pick<OutboxEffectRecord, "baselineHead" | "stagedPaths">,
  read: CommitLogRead,
): CommitQueryOutcome => {
  if (!read.ok) return { status: "unknown", verdict: "unreadable" };
  if (read.commits.length === 0) return { status: "unknown", verdict: "not-found" };
  if (read.commits.length !== 1) return { status: "unknown", verdict: "unreadable" };
  const commit = read.commits[0];
  if (commit === undefined) return { status: "unknown", verdict: "unreadable" };
  if (record.stagedPaths === undefined) {
    return { status: "unknown", verdict: "unreadable" };
  }
  if (!pathSetsEqual(commit.changedPaths, record.stagedPaths)) {
    return { status: "unknown", verdict: "not-found" };
  }
  return { status: "already-applied", verdict: "found", discoveredSha: commit.sha };
};

export type TrackerQueryOutcome = {
  readonly status: EffectReceiptStatus;
  readonly verdict: EffectQueryVerdict;
};

export const resolveTrackerEffect = (
  query: { readonly verdict: EffectQueryVerdict },
  effectKind: EffectKind,
): TrackerQueryOutcome => {
  if (effectKind === "commit") return { status: "unknown", verdict: "unreadable" };
  if (query.verdict === "found") return { status: "already-applied", verdict: "found" };
  if (query.verdict === "not-found") return { status: "unknown", verdict: "not-found" };
  return { status: "unknown", verdict: "unreadable" };
};

/** Whether the protocol may re-apply after a query (tracker not-found only). */
export const mayReapply = (outcome: TrackerQueryOutcome, effectKind: EffectKind): boolean =>
  effectKind !== "commit" && outcome.verdict === "not-found";

/** Deterministic idempotency key (changeRef, phase, baselineHead). */
export const commitIdempotencyKey = (
  changeRef: string,
  phase: string,
  baselineHead: string,
): string => `${changeRef}:${phase}:${baselineHead}`;
