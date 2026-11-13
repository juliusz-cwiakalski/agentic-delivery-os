/**
 * The bounded, deterministic spend human digest (GH-236 F-6; GH-291 F-5, F-6;
 * NFR-1, NFR-2, NFR-5).
 *
 * Statistics and identity references only. The renderer owns the human bounds:
 * it drops trailing `perAgent[]` lines first, then trailing breakdown rows, then
 * trailing `perPhase[]` lines, and declares the omission with the marker. The
 * totals, the telemetry-state line, and the reconciliation line (verdict plus
 * the stated tolerance) are never dropped. The amplification section is
 * human-only emphasis; the envelope always carries the block.
 */
import {
  type BrandIdentity,
  type SpendBreakdownField,
  SPEND_BREAKDOWN_FIELDS,
  SPEND_DISCLOSURES,
  SPEND_MAX_HUMAN_BYTES,
  SPEND_MAX_HUMAN_LINES,
  SPEND_PHASE_UNKNOWN,
  SPEND_TRUNCATION_MARKER,
  type SpendBreakdownEntry,
  type SpendReport,
  type SpendTruncation,
} from "#contracts";

/** Options the command surface passes to the human renderer. */
export type SpendHumanOptions = {
  readonly brand: BrandIdentity;
  readonly amplification: boolean;
  readonly truncation?: SpendTruncation;
  /** The human-emphasis breakdown dimension the caller selected (F-5). */
  readonly breakdown?: SpendBreakdownField;
};

const utf8Bytes = (value: string): number => {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x7f) bytes += 1;
    else if (point <= 0x7ff) bytes += 2;
    else if (point <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

const formatRatio = (ratio: number | null): string => {
  if (ratio === null) return "null";
  if (Number.isInteger(ratio)) return String(ratio);
  return ratio.toFixed(3);
};

const formatCost = (cost: number | null): string =>
  cost === null ? "none reported" : String(cost);

const paidTokens = (report: SpendReport): number =>
  report.tokensByClass.input +
  report.tokensByClass.output +
  report.tokensByClass.reasoning +
  report.tokensByClass.cacheRead +
  report.tokensByClass.cacheWrite;

const agentLine = (entry: SpendReport["perAgent"][number]): string =>
  `- ${entry.agent}/${entry.model}: ${String(entry.calls)} calls, ${String(entry.tokens)} tokens`;

const phaseLine = (entry: SpendReport["perPhase"][number]): string =>
  `- ${entry.phase}: ${String(entry.calls)} calls, ${String(entry.tokens)} tokens (${String(entry.share)}%)`;

const breakdownLine = (entry: SpendBreakdownEntry): string =>
  `- ${entry.value ?? "(unattributed)"}: ${String(entry.calls)} calls, ${String(entry.tokens)} tokens, cost ${formatCost(entry.cost)}`;

const truncationLine = (truncation: SpendTruncation): string =>
  `${SPEND_TRUNCATION_MARKER}  perAgent ${String(truncation.agents)} entries omitted, breakdowns ${String(truncation.breakdowns)} entries omitted, perPhase ${String(truncation.phases)} entries omitted, events ${String(truncation.events)} omitted`;

/** The reconciliation line: verdict, tolerance, basis, and both figures. */
const reconciliationLine = (report: SpendReport): string => {
  const block = report.reconciliation;
  const harness =
    block.harnessTotals === null
      ? "no harness-reported baseline"
      : `harness ${String(
          (block.harnessTotals.input ?? 0) +
            (block.harnessTotals.output ?? 0) +
            (block.harnessTotals.reasoning ?? 0) +
            (block.harnessTotals.cacheRead ?? 0) +
            (block.harnessTotals.cacheWrite ?? 0),
        )}`;
  const observed = `observed ${String(paidTokens(report))}`;
  const excluded =
    block.excludedBaselineSessions === 0
      ? ""
      : `, ${String(block.excludedBaselineSessions)} baseline session(s) excluded`;
  return `reconcile  ${block.verdict} (tolerance ${String(block.tolerance)}, basis ${block.basis}; ${observed} / ${harness}${excluded})`;
};

/** The declared dimension order the human render presents. */
const breakdownOrder = (
  selected: SpendBreakdownField | undefined,
): readonly SpendBreakdownField[] =>
  selected === undefined
    ? ["role", "model"]
    : [selected, ...SPEND_BREAKDOWN_FIELDS.filter((field) => field !== selected)];

/**
 * Render the bounded human digest.
 *
 * The disclosure limits render on every report (they describe the metric and
 * the restart evidence basis, not a conditional emphasis); the ratio and the
 * named events render only when `amplification` is true. The telemetry state
 * and the reconciliation line always render before any droppable section.
 */
export const renderSpendHuman = (report: SpendReport, options: SpendHumanOptions): string => {
  const agents = [...report.perAgent];
  const phases = [...report.perPhase];
  const events = [...report.amplification.events];
  const breakdownFields = breakdownOrder(options.breakdown);
  const breakdowns = breakdownFields.reduce<Record<string, readonly SpendBreakdownEntry[]>>(
    (accumulator, field) => {
      accumulator[field] = [...report.breakdowns[field]];
      return accumulator;
    },
    {},
  );
  const fixedHead = [
    "spend",
    `tokens     input ${String(report.tokensByClass.input)} | output ${String(report.tokensByClass.output)} | reasoning ${String(report.tokensByClass.reasoning)} | cacheRead ${String(report.tokensByClass.cacheRead)} | cacheWrite ${String(report.tokensByClass.cacheWrite)}`,
    `calls      ${String(phases.reduce((sum, entry) => sum + entry.calls, 0))}`,
    `telemetry  ${report.telemetryState}`,
    `cost       ${formatCost(report.costTotals.total)} (harness-reported units${report.costTotals.sparse ? "; sparse, never repaired" : ""})`,
    reconciliationLine(report),
  ];
  const amplificationLines = (): string[] => {
    if (!options.amplification) return [];
    const { ratio, progressRun } = report.amplification;
    const lines: string[] = [];
    if (ratio === null) {
      lines.push(
        progressRun === null
          ? "ratio      null (no record-bearing run)"
          : `ratio      null (zero-token progress run ${progressRun})`,
      );
    } else {
      const wasted = report.amplification.events.reduce(
        (sum, event) => sum + event.tokensWasted,
        0,
      );
      const progress = paidTokens(report) - wasted;
      lines.push(
        `ratio      ${formatRatio(ratio)} (paid ${String(paidTokens(report))} / progress ${String(progress)})`,
      );
    }
    if (events.length === 0) {
      lines.push("events     none (no superseded record-bearing run)");
    } else {
      lines.push(`events     ${String(events.length)}`);
      for (const event of events) {
        lines.push(
          `- ${event.cause} [${event.window.start} -> ${event.window.end}] ${String(event.tokensWasted)} tokens wasted`,
        );
      }
    }
    return lines;
  };
  const timingLines = (): string[] =>
    report.phaseTiming.map(
      (entry) =>
        `- ${entry.phase}: ${entry.start ?? "unknown"} -> ${entry.end ?? "open"} (${entry.durationMs === null ? "duration unknown" : `${String(entry.durationMs)} ms`}; stalls ${String(entry.stalls)}, restarts ${String(entry.restarts)})`,
    );
  const build = (): string[] => {
    const declared = options.truncation;
    const merged: SpendTruncation = {
      agents: report.perAgent.length - agents.length + (declared?.agents ?? 0),
      breakdowns:
        [...breakdownFields].reduce(
          (sum, field) =>
            sum + ((report.breakdowns[field]?.length ?? 0) - (breakdowns[field]?.length ?? 0)),
          0,
        ) + (declared?.breakdowns ?? 0),
      phases: report.perPhase.length - phases.length + (declared?.phases ?? 0),
      events: report.amplification.events.length - events.length + (declared?.events ?? 0),
    };
    return [
      ...fixedHead,
      "agents",
      ...agents.map(agentLine),
      ...breakdownFields.flatMap((field) => [
        `breakdown  ${field}`,
        ...(breakdowns[field] ?? []).map(breakdownLine),
      ]),
      "phases     capture-time windows (phase.transition)",
      ...phases.map((entry) =>
        entry.phase === SPEND_PHASE_UNKNOWN
          ? `${phaseLine(entry)} (no phase evidence; attribution fallback)`
          : phaseLine(entry),
      ),
      `timing     per-phase summaries (phase.transition + economics)`,
      ...timingLines(),
      `restarts   ${String(report.restarts)} (runs that reached closeout capture)`,
      "limits",
      ...SPEND_DISCLOSURES.map((line) => `- ${line}`),
      ...amplificationLines(),
      `degradation ${String(report.degradation.records)} record(s) with warnings${degradationDetail(report)}`,
      ...(merged.agents === 0 &&
      merged.breakdowns === 0 &&
      merged.phases === 0 &&
      merged.events === 0
        ? []
        : [truncationLine(merged)]),
    ];
  };
  const fits = (): boolean => {
    const lines = build();
    if (lines.length > SPEND_MAX_HUMAN_LINES) return false;
    return utf8Bytes(lines.join("\n")) <= SPEND_MAX_HUMAN_BYTES;
  };
  if (fits()) return `${build().join("\n")}\n`;
  // Size is monotonic in the retained row count, so each tail shrinks by a
  // binary search: O(log n) renders per section, not one render per row.
  const fitRows = <T>(rows: readonly T[], apply: (kept: readonly T[]) => void): void => {
    let low = 0;
    let high = rows.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      apply(rows.slice(0, middle));
      if (fits()) low = middle;
      else high = middle - 1;
    }
    apply(rows.slice(0, low));
  };
  const agentRows = agents;
  fitRows(agentRows, (kept) => {
    agents.splice(0, agents.length, ...kept);
  });
  for (const field of breakdownFields) {
    const rows = breakdowns[field] ?? [];
    const full = rows;
    fitRows(full, (kept) => {
      breakdowns[field] = kept;
    });
  }
  const phaseRows = phases;
  fitRows(phaseRows, (kept) => {
    phases.splice(0, phases.length, ...kept);
  });
  const eventRows = events;
  fitRows(eventRows, (kept) => {
    events.splice(0, events.length, ...kept);
  });
  return `${build().join("\n")}\n`;
};

const degradationDetail = (report: SpendReport): string => {
  const parts = Object.entries(report.degradation.byReason)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${reason}=${String(count)}`);
  return parts.length === 0 ? "" : ` (${parts.join(", ")})`;
};
