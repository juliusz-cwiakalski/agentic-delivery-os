/**
 * The bounded, deterministic spend human digest (GH-236 F-6; NFR-1, NFR-2, NFR-5).
 *
 * Statistics and identity references only. The renderer owns the human bounds:
 * it drops trailing `perAgent[]` lines first, then trailing `perPhase[]` lines,
 * and declares the omission with the PIN-3 marker. The amplification section is
 * human-only emphasis; the envelope always carries the block.
 */
import {
  type BrandIdentity,
  SPEND_DISCLOSURES,
  SPEND_MAX_HUMAN_BYTES,
  SPEND_MAX_HUMAN_LINES,
  SPEND_PHASE_UNKNOWN,
  SPEND_TRUNCATION_MARKER,
  type SpendReport,
  type SpendTruncation,
} from "#contracts";

/** Options the command surface passes to the human renderer. */
export type SpendHumanOptions = {
  readonly brand: BrandIdentity;
  readonly amplification: boolean;
  readonly truncation?: SpendTruncation;
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

const truncationLine = (truncation: SpendTruncation): string =>
  `${SPEND_TRUNCATION_MARKER}  perAgent ${String(truncation.agents)} entries omitted, perPhase ${String(truncation.phases)} entries omitted, events ${String(truncation.events)} omitted`;

/**
 * Render the bounded human digest.
 *
 * The disclosure limits render on every report (they describe the metric and
 * the restart evidence basis, not a conditional emphasis); the ratio and the
 * named events render only when `amplification` is true.
 */
export const renderSpendHuman = (report: SpendReport, options: SpendHumanOptions): string => {
  const agents = [...report.perAgent];
  const phases = [...report.perPhase];
  const events = [...report.amplification.events];
  const fixedHead = [
    "spend",
    `tokens     input ${String(report.tokensByClass.input)} | output ${String(report.tokensByClass.output)} | reasoning ${String(report.tokensByClass.reasoning)} | cacheRead ${String(report.tokensByClass.cacheRead)} | cacheWrite ${String(report.tokensByClass.cacheWrite)}`,
    `calls      ${String(phases.reduce((sum, entry) => sum + entry.calls, 0))}`,
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
  const build = (): string[] => {
    const declared = options.truncation;
    const merged: SpendTruncation = {
      agents: report.perAgent.length - agents.length + (declared?.agents ?? 0),
      phases: report.perPhase.length - phases.length + (declared?.phases ?? 0),
      events: report.amplification.events.length - events.length + (declared?.events ?? 0),
    };
    return [
      ...fixedHead,
      "agents",
      ...agents.map(agentLine),
      "phases     capture-time windows (phase.transition)",
      ...phases.map((entry) =>
        entry.phase === SPEND_PHASE_UNKNOWN
          ? `${phaseLine(entry)} (no phase evidence; attribution fallback)`
          : phaseLine(entry),
      ),
      `restarts   ${String(report.restarts)} (runs that reached closeout capture)`,
      "limits",
      ...SPEND_DISCLOSURES.map((line) => `- ${line}`),
      ...amplificationLines(),
      `degradation ${String(report.degradation.records)} record(s) with warnings${degradationDetail(report)}`,
      ...(merged.agents === 0 && merged.phases === 0 && merged.events === 0
        ? []
        : [truncationLine(merged)]),
    ];
  };
  let lines = build();
  while (agents.length > 0 && exceeds(lines)) {
    agents.pop();
    lines = build();
  }
  while (phases.length > 0 && exceeds(lines)) {
    phases.pop();
    lines = build();
  }
  while (events.length > 0 && exceeds(lines)) {
    events.pop();
    lines = build();
  }
  return `${lines.join("\n")}\n`;
};

const degradationDetail = (report: SpendReport): string => {
  const parts = Object.entries(report.degradation.byReason)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${reason}=${String(count)}`);
  return parts.length === 0 ? "" : ` (${parts.join(", ")})`;
};

const exceeds = (lines: readonly string[]): boolean => {
  const text = lines.join("\n");
  if (lines.length > SPEND_MAX_HUMAN_LINES) return true;
  return utf8Bytes(text) > SPEND_MAX_HUMAN_BYTES;
};
