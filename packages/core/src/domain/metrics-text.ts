/**
 * The bounded, deterministic metrics human digest (GH-299 F-1, F-8, F-11;
 * DM-8, DEC-10; NFR-2, NFR-4).
 *
 * Identity references and classified evidence states only. Absence always says
 * so and never prints a zero figure. The renderer owns the human bounds: it
 * drops trailing comparison/incident/per-agent lines in the declared order and
 * declares the omission; the alarm rows, the evaluation, the window, and the
 * metric entries are never dropped.
 */
import {
  type BrandIdentity,
  METRICS_MAX_HUMAN_BYTES,
  METRICS_MAX_HUMAN_LINES,
  METRICS_TRUNCATION_MARKER,
  type MetricsMetricEntry,
  type MetricsReport,
} from "#contracts";

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

const formatValue = (value: number | undefined): string =>
  value === undefined ? "absent" : String(value);

const sampleText = (entry: MetricsMetricEntry): string => {
  const counters: string[] = [`sample.n=${String(entry.sample.n)}`];
  for (const key of [
    "runs",
    "steps",
    "phases",
    "observed",
    "unobserved",
    "censored",
    "postGateReview",
    "landedCiFailure",
    "retroAttributed",
    "excludedNonEvidence",
  ] as const) {
    const value = entry.sample[key];
    if (value !== undefined) counters.push(`${key}=${String(value)}`);
  }
  return counters.join(" ");
};

const excludedText = (entry: MetricsMetricEntry): string =>
  entry.excluded === undefined || entry.excluded.length === 0
    ? ""
    : ` excluded=${entry.excluded.map((exclusion) => `${exclusion.reason}:${String(exclusion.count)}`).join(",")}`;

const entryLine = (entry: MetricsMetricEntry): string =>
  `  ${entry.id}  ${entry.measurementKind}  ${entry.status}  value=${formatValue(entry.value)} unit=${entry.unit} ` +
  `${sampleText(entry)}${excludedText(entry)} direction=${entry.direction} basis=${entry.basis}`;

const entryDetailLines = (entry: MetricsMetricEntry): readonly string[] => {
  const lines: string[] = [];
  if (entry.caveat !== undefined) lines.push(`    caveat: ${entry.caveat}`);
  if (entry.incidents !== undefined) {
    for (const incident of entry.incidents) {
      lines.push(
        `    incident ${incident.class} ${incident.artifact}#${incident.anchor} observedAt=${incident.observedAt}`,
      );
    }
  }
  return lines;
};

const dispatchLines = (report: MetricsReport, agentLimit?: number): readonly string[] => {
  const dispatch = report.dispatch;
  if (dispatch.telemetryState === "absent") {
    return [
      `Dispatch: telemetry absent (${dispatch.absenceReason ?? "telemetry-absent"}) — no figures are reported`,
    ];
  }
  const tokens = Object.values(dispatch.tokensByClass ?? {}).reduce((sum, value) => sum + value, 0);
  const cost = dispatch.costTotals;
  const costText =
    cost === undefined
      ? "none reported"
      : `${cost.total === null ? "none reported" : String(cost.total)}${cost.sparse ? " (sparse)" : ""}`;
  const agents =
    agentLimit === undefined
      ? (dispatch.perAgent ?? [])
      : (dispatch.perAgent ?? []).slice(0, agentLimit);
  const lines = [
    `Dispatch: telemetry present tokens=${String(tokens)} cost=${costText} restarts=${String(dispatch.restarts ?? 0)} perAgent=${String(agents.length)}`,
  ];
  if (dispatch.reconciliation !== undefined) {
    lines.push(
      `  reconciliation basis=${dispatch.reconciliation.basis} verdict=${dispatch.reconciliation.verdict}`,
    );
  }
  for (const agent of agents) {
    lines.push(
      `  agent ${agent.role}/${agent.model}: ${String(agent.calls)} calls, ${String(agent.tokens)} tokens`,
    );
  }
  return lines;
};

const alarmLines = (report: MetricsReport): readonly string[] => {
  const lines: string[] = [];
  const evaluation = report.alarmEvaluation;
  const windowText =
    evaluation.status === "evaluated"
      ? `threshold=${String(evaluation.threshold)} basis=${evaluation.basis} window=${evaluation.window.start}..${evaluation.window.end}`
      : evaluation.status;
  lines.push(
    `Alarm evaluation: ${evaluation.status}${evaluation.status === "evaluated" ? ` ${windowText}` : ""}`,
  );
  if (report.alarms.length === 0) {
    lines.push("Alarms: none");
  }
  for (const alarm of report.alarms) {
    lines.push(
      `Alarm: ${alarm.kind} ref=${alarm.ref} basis=${alarm.basis} threshold=${String(alarm.threshold)} measured=${String(alarm.measured)} window=${alarm.window.start}..${alarm.window.end} crossedAt=${alarm.crossedAt}${alarm.sparse === undefined ? "" : ` sparse=${String(alarm.sparse)}`}`,
    );
  }
  return lines;
};

const comparisonLines = (report: MetricsReport): readonly string[] =>
  report.comparisons.map((row) => {
    const before = row.before.value === null ? "absent" : String(row.before.value);
    const after = row.after.value === undefined ? "absent" : String(row.after.value);
    const caveat = row.caveat === undefined ? "" : ` [caveat: ${row.caveat}]`;
    return `  ${row.metricId} before=${before} after=${after} verdict=${row.verdict} sampleMinimum=${String(row.sampleMinimum)} sampleSize=${String(row.after.sampleSize)}${caveat}`;
  });

const withinBounds = (lines: readonly string[]): boolean =>
  lines.length <= METRICS_MAX_HUMAN_LINES && utf8Bytes(lines.join("\n")) <= METRICS_MAX_HUMAN_BYTES;

/**
 * Render the bounded human digest; the same facts always produce the same text.
 *
 * The fallback drop order mirrors the machine bound — comparisons, then
 * incidents, then per-agent rows — and stops before the never-dropped set (the
 * header, the metric entries, the dispatch summary, the alarms, and the
 * evaluation). The truncated marker names the sections actually dropped.
 */
export const renderMetricsHuman = (report: MetricsReport, brand: BrandIdentity): string => {
  const head: string[] = [
    `${brand.binaryName} metrics — delivery metrics`,
    `ref ${report.ref}`,
    `window ${report.window.from} .. ${report.window.through} (inclusive)`,
    "Metrics:",
  ];
  const alarms = alarmLines(report);
  const comparisonsHead = ["Comparisons:"];
  const incidentLimits = new Map<string, number>();
  for (const entry of report.metrics) {
    if (entry.incidents !== undefined) incidentLimits.set(entry.id, entry.incidents.length);
  }
  let comparisonRows = report.comparisons.length;
  let agentRows = report.dispatch.perAgent?.length ?? 0;
  const dropped = { comparisons: 0, incidents: 0, perAgent: 0 };

  const assemble = (): string[] => {
    const entries = report.metrics.flatMap((entry) => {
      const limit = incidentLimits.get(entry.id);
      const view =
        limit === undefined || entry.incidents === undefined
          ? entry
          : { ...entry, incidents: entry.incidents.slice(0, limit) };
      return [entryLine(view), ...entryDetailLines(view)];
    });
    const comparisons = comparisonLines(report).slice(0, comparisonRows);
    const drops: string[] = [];
    if (dropped.comparisons > 0) drops.push(`comparisons=${String(dropped.comparisons)}`);
    if (dropped.incidents > 0) drops.push(`incidents=${String(dropped.incidents)}`);
    if (dropped.perAgent > 0) drops.push(`perAgent=${String(dropped.perAgent)}`);
    const humanTruncated = report.truncated || drops.length > 0;
    const tail = [
      `omitted=${String(report.omitted)} truncated=${String(humanTruncated)}`,
      ...(drops.length > 0
        ? [`${METRICS_TRUNCATION_MARKER}  ${drops.join(" ")} row(s) dropped tail-first`]
        : report.truncated
          ? [
              `${METRICS_TRUNCATION_MARKER}  ${String(report.omitted)} row(s) dropped before rendering by the row caps`,
            ]
          : []),
    ];
    return [
      ...head,
      ...entries,
      ...dispatchLines(report, agentRows),
      ...alarms,
      ...comparisonsHead,
      ...comparisons,
      ...tail,
    ];
  };

  let lines = assemble();
  // Tail-first section drops keep the never-dropped set intact.
  while (!withinBounds(lines)) {
    if (comparisonRows > 0) {
      comparisonRows -= 1;
      dropped.comparisons += 1;
    } else {
      const incidentEntry = report.metrics.find((entry) => (incidentLimits.get(entry.id) ?? 0) > 0);
      if (incidentEntry !== undefined) {
        incidentLimits.set(incidentEntry.id, (incidentLimits.get(incidentEntry.id) ?? 1) - 1);
        dropped.incidents += 1;
      } else if (agentRows > 0) {
        agentRows -= 1;
        dropped.perAgent += 1;
      } else {
        break;
      }
    }
    lines = assemble();
  }
  return `${lines.join("\n")}\n`;
};
