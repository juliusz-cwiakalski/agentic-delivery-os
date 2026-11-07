/**
 * The rebuildable per-delivery economics fold (GH-235 F-6, D-6, DM-4).
 *
 * Pure over durable records: restart count, ordered history, and the resume
 * amplification signal. No harness access and no writes; derivation is a fold,
 * so two fresh readers over the same records derive identical output. Missing
 * figures degrade to `null` with a closed-vocabulary warning naming the field
 * and the record ordinal — never a fabricated zero or an estimate.
 */
import {
  type EconomicsAmplificationFlag,
  type EconomicsRestartHistoryEntry,
  type EconomicsRestartRecord,
  type EconomicsExhaustionRecord,
  type EconomicsView,
  type EconomicsWarning,
  RESUME_AMPLIFICATION_BASELINE,
  RESUME_AMPLIFICATION_LOOP_FLAG,
} from "#contracts";

const ordered = (records: readonly EconomicsRestartRecord[]): readonly EconomicsRestartRecord[] =>
  [...records].sort((left, right) => left.ordinal - right.ordinal);

/** The latest observed unique-progress figure, or undefined when never observed. */
export const latestUniqueProgressTokens = (
  records: readonly EconomicsRestartRecord[],
): number | undefined => {
  let latest: number | undefined;
  for (const record of ordered(records)) {
    const observed = record.observedUniqueProgressTokens;
    if (typeof observed === "number") latest = observed;
  }
  return latest;
};

const repayTotal = (record: EconomicsRestartRecord): number | undefined =>
  record.repayTokens === undefined
    ? undefined
    : record.repayTokens.inputTokens + record.repayTokens.outputTokens;

/** Fold restart records plus the terminal record into the per-delivery view. */
export const deriveEconomicsView = (input: {
  readonly records: readonly EconomicsRestartRecord[];
  readonly terminal?: EconomicsExhaustionRecord | undefined;
}): EconomicsView => {
  const records = ordered(input.records);
  const warnings: EconomicsWarning[] = [];
  const history: EconomicsRestartHistoryEntry[] = records.map((record) =>
    record.repayTokens === undefined
      ? {
          ordinal: record.ordinal,
          reason: record.reason,
          sessionId: record.sessionId,
          recordedAt: record.recordedAt,
        }
      : {
          ordinal: record.ordinal,
          reason: record.reason,
          repayTokens: record.repayTokens,
          sessionId: record.sessionId,
          recordedAt: record.recordedAt,
        },
  );

  let repaid = 0;
  let missingRepay: number | undefined;
  for (const record of records) {
    const total = repayTotal(record);
    if (total === undefined) {
      warnings.push({
        kind: "missing-repay-tokens",
        field: "repayTokens",
        ordinal: record.ordinal,
      });
      missingRepay ??= record.ordinal;
      continue;
    }
    repaid += total;
  }

  const unique = latestUniqueProgressTokens(records);
  if (records.length > 0 && (unique === undefined || unique <= 0)) {
    warnings.push({
      kind: "missing-unique-progress",
      field: "uniqueProgressTokens",
      ordinal: records[records.length - 1]?.ordinal ?? 0,
    });
  }

  let resumeAmplification: number | null = null;
  let amplificationFlag: EconomicsAmplificationFlag | null = null;
  if (records.length > 0 && missingRepay === undefined && unique !== undefined && unique > 0) {
    const ratio = repaid / unique;
    resumeAmplification = ratio;
    if (ratio > RESUME_AMPLIFICATION_BASELINE) amplificationFlag = RESUME_AMPLIFICATION_LOOP_FLAG;
  }

  return {
    restarts: records.length,
    resumeAmplification,
    restartHistory: history,
    amplificationFlag,
    warnings,
    ...(input.terminal === undefined ? {} : { terminal: input.terminal }),
  };
};
