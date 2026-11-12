/**
 * The dual-run summary, divergence resolution, and handover use cases
 * (GH-239 F-5, F-6; DM-6, DM-7, EVT-2, EVT-3; TDR-0015).
 *
 * One predicate home: the summary and the handover read the same folded window
 * and the same gate evaluation. An unreadable or torn evidence stream refuses as
 * `dispatch.state-unverified` (exit 2); a readable-but-unmet bar is a clean
 * negative at exit 1 and appends nothing that changes authority.
 */
import {
  DISPATCH_HANDOVER_PAYLOAD_SCHEMA,
  type DispatchHandoverRecord,
  type DispatchResolveData,
  type DispatchSummaryData,
  type StateStorePort,
} from "#contracts";
import { buildDispatchAuthorityView, foldDispatchHandover } from "../domain/dispatch-authority.js";
import {
  type DispatchEvidenceWindow,
  type DispatchGateEvaluation,
  type DispatchRepositoryScope,
  evaluateHandoverGate,
  foldEvidenceWindow,
  handoverConditionsSnapshot,
  summarizeRepositoryDivergences,
  toSummaryData,
} from "../domain/dispatch-gate.js";
import {
  appendDispatchHandover,
  DISPATCH_DIVERGENCE_NOT_FOUND,
  readDispatchAttempts,
  readDispatchDivergences,
  readDispatchHandover,
  resolveDispatchDivergence,
  writeDispatchAuthority,
} from "./dispatch-ledger.js";

/** A classified gate read: the folded window, or an unreadable stream. */
export type DispatchGateRead =
  | {
      readonly ok: true;
      readonly window: DispatchEvidenceWindow;
      readonly evaluation: DispatchGateEvaluation;
    }
  | { readonly ok: false; readonly code: "dispatch.state-unverified" };

/** Read and fold the evidence window (bounded, with declared truncation). */
export const readDispatchGate = (input: {
  readonly store: StateStorePort;
  readonly repository: string;
  readonly scope: DispatchRepositoryScope;
  readonly nowIso: string;
  readonly max?: number;
}): DispatchGateRead => {
  const attempts = readDispatchAttempts(
    input.store,
    input.max === undefined ? {} : { max: input.max },
  );
  if (!attempts.ok) return { ok: false, code: "dispatch.state-unverified" };
  const divergences = readDispatchDivergences(input.store);
  if (!divergences.ok) return { ok: false, code: "dispatch.state-unverified" };
  const window = foldEvidenceWindow({
    repository: input.repository,
    scope: input.scope,
    attempts: attempts.records,
    divergences: divergences.records,
    windowEnd: input.nowIso,
    ...(attempts.truncation === undefined ? {} : { truncated: attempts.truncation }),
  });
  return { ok: true, window, evaluation: evaluateHandoverGate(window) };
};

/** The summary result. */
export type DispatchSummaryResult =
  | { readonly ok: true; readonly data: DispatchSummaryData }
  | { readonly ok: false; readonly error: { readonly kind: "dispatch"; readonly code: string } };

/** Summarize one repository's evidence window. */
export const summarizeDispatchEvidence = (input: {
  readonly store: StateStorePort;
  readonly repository: string;
  readonly scope: DispatchRepositoryScope;
  readonly nowIso: string;
  readonly max?: number;
}): DispatchSummaryResult => {
  const read = readDispatchGate(input);
  if (!read.ok) return { ok: false, error: { kind: "dispatch", code: read.code } };
  return { ok: true, data: toSummaryData(read.window, read.evaluation) };
};

/**
 * Resolve one divergence append-only from local evidence only (GH-289 F-5).
 *
 * A blank or whitespace-only note is refused before anything is read or
 * written; an over-long note is clamped by the ledger before the record is
 * built, so it can never become a write failure. The success data keeps the
 * five delivered keys and adds the unconditional local-evidence mode, the
 * divergence's own repository, and the shared repository-scoped block computed
 * over that repository's records after the append.
 */
export const resolveDispatchDivergenceEvidence = (input: {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly divergenceId: string;
  readonly note: string;
  readonly principal: string;
  readonly nowIso: string;
}):
  | { readonly ok: true; readonly data: DispatchResolveData }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: "input" | "state" | "dispatch";
        readonly code: string;
        readonly summary?: string;
      };
    } => {
  if (input.note.trim().length === 0) {
    return {
      ok: false,
      error: {
        kind: "input",
        code: "input.value.rejected",
        summary: "a resolution requires a non-blank note",
      },
    };
  }
  const resolved = resolveDispatchDivergence(input.store, input.fenceToken, {
    divergenceId: input.divergenceId,
    note: input.note,
    principal: input.principal,
    recordedAt: input.nowIso,
  });
  if (!resolved.ok) {
    return resolved.code === DISPATCH_DIVERGENCE_NOT_FOUND
      ? { ok: false, error: { kind: "input", code: "input.value.rejected" } }
      : { ok: false, error: { kind: "state", code: resolved.code } };
  }
  const divergences = readDispatchDivergences(input.store);
  if (!divergences.ok) {
    return { ok: false, error: { kind: "state", code: divergences.code } };
  }
  const record = resolved.record;
  return {
    ok: true,
    data: {
      divergenceId: input.divergenceId,
      state: record.state,
      resolved: resolved.appended,
      ...(record.note === undefined ? {} : { note: record.note }),
      ...(record.principal === undefined ? {} : { principal: record.principal }),
      mode: "local-evidence",
      repository: record.repository,
      divergences: summarizeRepositoryDivergences(divergences.records, record.repository),
    },
  };
};

/** The handover/reversal result. */
export type DispatchHandoverResult =
  | {
      readonly ok: true;
      readonly data: {
        readonly repository: string;
        readonly operation: "authoritative" | "dual-run";
        readonly recorded: boolean;
        readonly noop: boolean;
        readonly verdict?: string;
        readonly unmetConditions?: readonly {
          readonly condition: string;
          readonly detail: string;
        }[];
      };
    }
  | { readonly ok: false; readonly error: { readonly kind: string; readonly code: string } };

const refreshAuthorityView = (input: {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly repository: string;
}): boolean => {
  const handover = readDispatchHandover(input.store);
  if (!handover.ok) return false;
  const view = buildDispatchAuthorityView(input.repository, foldDispatchHandover(handover.records));
  return writeDispatchAuthority(input.store, input.fenceToken, view).ok;
};

/** Flip one repository when the bar is met; refuse cleanly otherwise. */
export const handoverDispatchEvidence = (input: {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly repository: string;
  readonly scope: DispatchRepositoryScope;
  readonly nowIso: string;
  readonly principal: string;
  readonly evidenceRefs?: readonly string[];
  readonly max?: number;
}): DispatchHandoverResult => {
  const read = readDispatchGate(input);
  if (!read.ok) return { ok: false, error: { kind: "dispatch", code: read.code } };

  // NFR-6: fold the authority before appending, so an identical replay under an
  // advancing clock reports a noop instead of appending a second record.
  const handover = readDispatchHandover(input.store);
  if (!handover.ok) {
    return { ok: false, error: { kind: "dispatch", code: "dispatch.state-unverified" } };
  }
  const current = foldDispatchHandover(handover.records).find(
    (entry) => entry.repository === input.repository,
  );
  if (current !== undefined && current.authority === "authoritative") {
    return {
      ok: true,
      data: {
        repository: input.repository,
        operation: "authoritative",
        recorded: false,
        noop: true,
        verdict: read.evaluation.verdict,
      },
    };
  }

  if (!read.evaluation.eligibility) {
    return {
      ok: true,
      data: {
        repository: input.repository,
        operation: "authoritative",
        recorded: false,
        noop: false,
        verdict: read.evaluation.verdict,
        unmetConditions: read.evaluation.unmetConditions,
      },
    };
  }
  const record: DispatchHandoverRecord = {
    schema: DISPATCH_HANDOVER_PAYLOAD_SCHEMA,
    repository: input.repository,
    operation: "authoritative",
    conditions: handoverConditionsSnapshot(read.window, read.evaluation),
    evidenceRefs: (input.evidenceRefs ?? [`window:${read.window.windowStart}`]).slice(0, 16),
    principal: input.principal,
    recordedAt: input.nowIso,
  };
  const appended = appendDispatchHandover(input.store, input.fenceToken, record);
  if (!appended.ok) {
    return { ok: false, error: { kind: "dispatch", code: "dispatch.state-unverified" } };
  }
  if (!refreshAuthorityView(input)) {
    return { ok: false, error: { kind: "dispatch", code: "dispatch.state-unverified" } };
  }
  return {
    ok: true,
    data: {
      repository: input.repository,
      operation: "authoritative",
      recorded: appended.appended,
      noop: !appended.appended,
      verdict: read.evaluation.verdict,
    },
  };
};

/** Revert one repository; an already dual-run repository is an idempotent noop. */
export const revertDispatchHandoverEvidence = (input: {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly repository: string;
  readonly scope: DispatchRepositoryScope;
  readonly nowIso: string;
  readonly principal: string;
}): DispatchHandoverResult => {
  const handover = readDispatchHandover(input.store);
  if (!handover.ok)
    return { ok: false, error: { kind: "dispatch", code: "dispatch.state-unverified" } };
  const folded = foldDispatchHandover(handover.records);
  const current = folded.find((entry) => entry.repository === input.repository);
  if (current === undefined || current.authority === "dual-run") {
    return {
      ok: true,
      data: {
        repository: input.repository,
        operation: "dual-run",
        recorded: false,
        noop: true,
      },
    };
  }
  const read = readDispatchGate(input);
  if (!read.ok) return { ok: false, error: { kind: "dispatch", code: read.code } };
  const record: DispatchHandoverRecord = {
    schema: DISPATCH_HANDOVER_PAYLOAD_SCHEMA,
    repository: input.repository,
    operation: "dual-run",
    conditions: handoverConditionsSnapshot(read.window, read.evaluation),
    evidenceRefs: [`handover:${current.recordedAt}`],
    principal: input.principal,
    recordedAt: input.nowIso,
  };
  const appended = appendDispatchHandover(input.store, input.fenceToken, record);
  if (!appended.ok) {
    return { ok: false, error: { kind: "dispatch", code: "dispatch.state-unverified" } };
  }
  if (!refreshAuthorityView(input)) {
    return { ok: false, error: { kind: "dispatch", code: "dispatch.state-unverified" } };
  }
  return {
    ok: true,
    data: {
      repository: input.repository,
      operation: "dual-run",
      recorded: appended.appended,
      noop: !appended.appended,
    },
  };
};
