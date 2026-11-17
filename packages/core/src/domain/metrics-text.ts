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

const dispatchLines = (report: MetricsReport): readonly string[] => {
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
  const lines = [
    `Dispatch: telemetry present tokens=${String(tokens)} cost=${costText} restarts=${String(dispatch.restarts ?? 0)} perAgent=${String(dispatch.perAgent?.length ?? 0)}`,
  ];
  if (dispatch.reconciliation !== undefined) {
    lines.push(
      `  reconciliation basis=${dispatch.reconciliation.basis} verdict=${dispatch.reconciliation.verdict}`,
    );
  }
  for (const agent of dispatch.perAgent ?? []) {
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

/** Render the bounded human digest; the same facts always produce the same text. */
export const renderMetricsHuman = (report: MetricsReport, brand: BrandIdentity): string => {
  const head: string[] = [
    `${brand.binaryName} metrics — delivery metrics`,
    `ref ${report.ref}`,
    `window ${report.window.from} .. ${report.window.through} (inclusive)`,
    "Metrics:",
  ];
  const entries = report.metrics.flatMap((entry) => [entryLine(entry), ...entryDetailLines(entry)]);
  const dispatch = dispatchLines(report);
  const alarms = alarmLines(report);
  const comparisonsHead = ["Comparisons:"];
  const comparisons = [...comparisonLines(report)];
  const tail = [
    `omitted=${String(report.omitted)} truncated=${String(report.truncated)}`,
    ...(report.truncated
      ? [
          `${METRICS_TRUNCATION_MARKER}  comparisons ${String(Math.max(0, report.omitted))} row(s) dropped tail-first`,
        ]
      : []),
  ];

  const assemble = (rows: readonly string[]): string[] => [
    ...head,
    ...entries,
    ...dispatch,
    ...alarms,
    ...comparisonsHead,
    ...rows,
    ...tail,
  ];

  let rows = comparisons;
  let lines = assemble(rows);
  // Tail-first section drops keep the never-dropped set intact.
  let humanOmitted = 0;
  while (!withinBounds(lines) && rows.length > 0) {
    rows = rows.slice(0, -1);
    humanOmitted += 1;
    lines = assemble(rows);
  }
  while (!withinBounds(lines) && lines.length > head.length + entries.length) {
    lines = lines.slice(0, -1);
    humanOmitted += 1;
  }
  if (humanOmitted > 0) {
    lines = [
      ...lines,
      `${METRICS_TRUNCATION_MARKER}  ${String(humanOmitted)} human row(s) omitted to respect the digest bounds`,
    ];
  }
  return `${lines.join("\n")}\n`;
};
