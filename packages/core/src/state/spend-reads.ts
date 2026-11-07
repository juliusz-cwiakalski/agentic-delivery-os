/**
 * The spend read consumer over the injected state port (GH-236 F-2, PIN-12).
 *
 * One classified read composes both `harness.telemetry` record families for the
 * exact work-item ref plus that ref's `phase.transition` history. Read-only by
 * construction: no append, no fence, no salvage member is reachable here, and
 * no harness adapter, session reader, or provider client is imported. Store
 * damage keeps the delivered `state.*` identities; an absent per-ref family is
 * explicit verified-empty evidence, never a zero value.
 */
import type { SpendLedgerRead, StateResult, StateStorePort } from "#contracts";
import { readHarnessCaptureOutcomes, readHarnessTelemetry } from "./harness-telemetry.js";
import { readChangeTransitionsTolerant } from "./registry.js";

/**
 * Compose the spend read for one exact ref (PIN-12).
 *
 * The three verified reads run in a fixed order so the failure identity is
 * deterministic: session telemetry first, capture outcomes second, transition
 * history last. Every failure is the delivered `state.*` result, never a
 * partial or zeroed read.
 */
export const readSpendLedger = (
  store: StateStorePort,
  workItemRef: string,
): StateResult<SpendLedgerRead> => {
  const telemetry = readHarnessTelemetry(store, workItemRef);
  if (!telemetry.ok) return telemetry;
  const outcomes = readHarnessCaptureOutcomes(store, workItemRef);
  if (!outcomes.ok) return outcomes;
  const transitions = readChangeTransitionsTolerant(store, workItemRef);
  if (!transitions.ok) return transitions;
  return {
    ok: true,
    value: {
      workItemRef,
      records: telemetry.value.records,
      outcomes: outcomes.value.records,
      transitions: transitions.value.transitions,
      transitionsPresent: transitions.value.present,
      verifiedEmpty: telemetry.value.records.length === 0 && outcomes.value.records.length === 0,
      evidence: {
        storePath: telemetry.value.evidence.storePath,
        recordCount: transitions.value.evidence.recordCount,
      },
    },
  };
};
