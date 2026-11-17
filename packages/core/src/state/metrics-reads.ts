/**
 * The metrics read composition over the delivered seams (GH-299 F-2..F-6;
 * NFR-7).
 *
 * One classified read composes the delivered spend ledger read (telemetry
 * families, the transition history, and the economics restarts) with the
 * verified ceremony run/step records. Read-only by construction: no append, no
 * fence, no adapter, and no provider client is imported. Store damage keeps the
 * delivered `state.*` identities; an absent family stays explicit evidence.
 */
import type {
  MetricsCeremonyRun,
  MetricsLedgerRead,
  StateResult,
  StateStorePort,
} from "#contracts";
import { readCeremonyState } from "./ceremony.js";
import { readSpendLedger } from "./spend-reads.js";

/** The declared evidence boundary: the read's verified store path. */
export type MetricsLedgerEvidence = {
  readonly storePath: string;
  readonly ceremonyRuns: number;
  readonly ceremonySteps: number;
};

/** The composed read one report folds: the spend ledger plus ceremony records. */
export type MetricsLedgerComposition = MetricsLedgerRead & {
  readonly evidence: MetricsLedgerEvidence;
};

/**
 * Compose the metrics read for one exact ref.
 *
 * The reads run in a fixed order so the failure identity is deterministic: the
 * spend ledger first (every telemetry family, then transitions, then
 * restarts), the ceremony runs second, and each run's steps third. Every
 * failure is a delivered `state.*` result, never a partial read.
 */
export const readMetricsLedger = (
  store: StateStorePort,
  workItemRef: string,
): StateResult<MetricsLedgerComposition> => {
  const spend = readSpendLedger(store, workItemRef);
  if (!spend.ok) return spend;
  // One verified scan partitions the ceremony runs and every step record.
  const ceremonyState = readCeremonyState(store);
  if (!ceremonyState.ok) return ceremonyState;
  const stepsByRun = new Map<string, MetricsCeremonyRun["steps"][number][]>();
  for (const step of ceremonyState.value.steps) {
    const list = stepsByRun.get(step.runId) ?? [];
    list.push({
      phaseIndex: step.phaseIndex,
      startedAtMs: step.startedAtMs,
      endedAtMs: step.endedAtMs,
      durationMs: step.durationMs,
    });
    stepsByRun.set(step.runId, list);
  }
  const ceremony: MetricsCeremonyRun[] = ceremonyState.value.runs.map((run) => ({
    runId: run.runId,
    ceremony: run.ceremonyId,
    steps: (stepsByRun.get(run.runId) ?? []).sort(
      (left, right) => left.phaseIndex - right.phaseIndex,
    ),
  }));
  const stepCount = ceremonyState.value.steps.length;
  const telemetryEmpty =
    (spend.value.steps ?? []).length === 0 &&
    spend.value.records.length === 0 &&
    spend.value.outcomes.length === 0;
  return {
    ok: true,
    value: {
      workItemRef,
      telemetryState: telemetryEmpty ? "absent" : "present",
      ceremony,
      spend: spend.value,
      evidence: {
        storePath: spend.value.evidence.storePath,
        ceremonyRuns: ceremony.length,
        ceremonySteps: stepCount,
      },
    },
  };
};
