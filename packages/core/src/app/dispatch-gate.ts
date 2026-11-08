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
  DISPATCH_DIVERGENCE_PAYLOAD_SCHEMA,
  DISPATCH_HANDOVER_PAYLOAD_SCHEMA,
  type DispatchDivergenceRecord,
  type DispatchHandoverRecord,
  type DispatchSummaryData,
  type StateStorePort,
} from "#contracts";
import { buildDispatchAuthorityView, foldDispatchHandover } from "../domain/dispatch-authority.js";
import {
  evaluateHandoverGate,
  foldEvidenceWindow,
  handoverConditionsSnapshot,
  toSummaryData,
  type DispatchEvidenceWindow,
  type DispatchGateEvaluation,
  type DispatchRepositoryScope,
} from "../domain/dispatch-gate.js";
import {
  appendDispatchDivergence,
  appendDispatchHandover,
  readDispatchAttempts,
  readDispatchDivergences,
  readDispatchHandover,
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

/** Resolve one divergence append-only. */
export const resolveDispatchDivergenceEvidence = (input: {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly divergenceId: string;
  readonly note: string;
  readonly principal: string;
  readonly nowIso: string;
}):
  | { readonly ok: true; readonly data: Record<string, unknown> }
  | { readonly ok: false; readonly error: { readonly kind: string; readonly code: string } } => {
  const resolved = resolveAppend(input);
  if (!resolved.ok) {
    return {
      ok: false,
      error: {
        kind: "dispatch",
        code:
          resolved.code === "state.keys.missing"
            ? "input.value.rejected"
            : "dispatch.state-unverified",
      },
    };
  }
  return {
    ok: true,
    data: {
      divergenceId: input.divergenceId,
      state: resolved.record.state,
      resolved: resolved.appended,
      note: resolved.record.note,
      principal: resolved.record.principal,
    },
  };
};

const resolveAppend = (input: {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly divergenceId: string;
  readonly note: string;
  readonly principal: string;
  readonly nowIso: string;
}) => {
  const read = readDispatchDivergences(input.store);
  if (!read.ok) return { ok: false as const, code: read.code };
  const latest = [...read.records]
    .reverse()
    .find((record) => record.divergenceId === input.divergenceId);
  if (latest === undefined) return { ok: false as const, code: "state.keys.missing" };
  if (latest.state === "resolved") return { ok: true as const, appended: false, record: latest };
  const resolved: DispatchDivergenceRecord = {
    ...latest,
    state: "resolved",
    note: input.note,
    principal: input.principal,
    resolvedAt: input.nowIso,
    recordedAt: input.nowIso,
  };
  const appended = appendDispatchDivergence(input.store, input.fenceToken, {
    ...resolved,
    schema: DISPATCH_DIVERGENCE_PAYLOAD_SCHEMA,
  });
  return appended.ok
    ? { ok: true as const, appended: appended.appended, record: appended.record }
    : { ok: false as const, code: appended.code };
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
