/**
 * The spend read consumer over the injected state port (GH-236 F-2, PIN-12;
 * GH-291 F-3, F-5, F-6).
 *
 * One classified read composes every telemetry family for the exact work-item
 * ref — the v2 step and baseline records beside the delivered v1 session and
 * capture-outcome records, in a single verified pass — plus that ref's
 * `phase.transition` history and its delivered economics restarts. Read-only by
 * construction: no append, no fence, and no harness adapter, session reader, or
 * provider client is imported, so the read path never re-queries a harness
 * store (NG-2). Store damage keeps the delivered `state.*` identities; an
 * absent per-ref family is explicit verified-empty evidence.
 */
import type { SpendLedgerRead, StateResult, StateStorePort } from "#contracts";
import { readEconomicsRecords } from "./economics.js";
import { readChangeTransitionsTolerant } from "./registry.js";
import { readTelemetryFamilies } from "./telemetry.js";

/**
 * Compose the spend read for one exact ref (PIN-12).
 *
 * The verified reads run in a fixed order so the failure identity is
 * deterministic: every telemetry family in one pass first, the transition
 * history second, the economics restarts last. Each failure is the delivered
 * `state.*` result, never a partial or zeroed read.
 */
export const readSpendLedger = (
  store: StateStorePort,
  workItemRef: string,
): StateResult<SpendLedgerRead> => {
  const families = readTelemetryFamilies(store, workItemRef);
  if (!families.ok) return families;
  const transitions = readChangeTransitionsTolerant(store, workItemRef);
  if (!transitions.ok) return transitions;
  const economics = readEconomicsRecords(store, workItemRef);
  if (!economics.ok) {
    return {
      ok: false,
      error: {
        kind: "state",
        code: economics.code,
        consequence: "not_landed",
        location: economics.location ?? { path: families.value.evidence.storePath },
      },
    };
  }
  return {
    ok: true,
    value: {
      workItemRef,
      records: families.value.records,
      outcomes: families.value.outcomes,
      transitions: transitions.value.transitions,
      transitionsPresent: transitions.value.present,
      verifiedEmpty: families.value.verifiedEmpty,
      evidence: {
        storePath: families.value.evidence.storePath,
        recordCount: transitions.value.evidence.recordCount,
      },
      steps: families.value.steps,
      baselines: families.value.baselines,
      restarts: economics.restarts,
    },
  };
};
