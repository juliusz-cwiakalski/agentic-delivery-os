/**
 * The committed measurement baseline log builders (GH-299 test plan §6).
 *
 * Every document is a committed-path-shaped fixture: the full log with the
 * three consumed rows plus the untouched false-signal row, a partial log, and
 * one builder per damage class. Committed values are deliberately different
 * from what the fixture evidence yields, so a restated value is detectable.
 */

export type BaselineRowInput = {
  readonly id: string;
  readonly status: string;
  readonly measurementKind: string;
  readonly unit: string;
  readonly direction: string;
  readonly value: number | null;
  readonly limitation: string;
  /** The committed per-change exclusion rows: `{ref, reason}` (the real log shape). */
  readonly excluded?: readonly { readonly ref: string; readonly reason: string }[];
  readonly sample?: Readonly<Record<string, number>>;
};

export type BaselineDocumentInput = {
  readonly sourceCommit?: string;
  readonly schemaVersion?: number;
  readonly window?: { readonly start: string; readonly end: string };
  readonly rows?: readonly BaselineRowInput[];
  readonly comparisons?: readonly Record<string, unknown>[];
};

/** The committed definition reference the suite asserts against. */
export const BASELINE_SOURCE_COMMIT = "75b4e7602ad89bd26f96912ac06ed8bfcb72a5ae";
export const BASELINE_WINDOW = {
  start: "2026-02-01T00:00:00Z",
  end: "2026-10-31T23:59:59Z",
} as const;

const yamlString = (value: string): string => `'${value.replace(/'/gu, "''")}'`;

const jsonScalar = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return yamlString(String(value));
};

const rowText = (row: BaselineRowInput): string => {
  const lines = [
    `  - id: ${row.id}`,
    `    status: ${row.status}`,
    `    measurement_kind: ${row.measurementKind}`,
    `    unit: ${yamlString(row.unit)}`,
    `    direction: ${yamlString(row.direction)}`,
    `    value: ${jsonScalar(row.value)}`,
    `    limitation: ${yamlString(row.limitation)}`,
    `    sample:`,
    ...Object.entries(row.sample ?? {}).map(([key, value]) => `      ${key}: ${jsonScalar(value)}`),
  ];
  if (row.sample === undefined) lines.push("      metric_included: 0");
  lines.push("    metric_excluded_changes:");
  for (const exclusion of row.excluded ?? []) {
    lines.push(`      - ref: ${exclusion.ref}`);
    lines.push(`        reason: ${exclusion.reason}`);
  }
  if ((row.excluded ?? []).length === 0)
    lines[lines.length - 1] = "    metric_excluded_changes: []";
  return lines.join("\n");
};

/** Render one baseline document from the declared rows (deterministic order kept). */
export const baselineDocument = (input: BaselineDocumentInput = {}): string => {
  const rows = input.rows ?? [];
  const window = input.window ?? BASELINE_WINDOW;
  const lines = [
    `schema_version: ${input.schemaVersion ?? 2}`,
    `source_commit: ${input.sourceCommit ?? BASELINE_SOURCE_COMMIT}`,
    "window:",
    `  start: ${yamlString(window.start)}`,
    `  end: ${yamlString(window.end)}`,
    "metrics:",
    ...rows.map(rowText),
  ];
  if ((input.comparisons ?? []).length === 0) lines.push("comparisons: []");
  else {
    lines.push("comparisons:");
    for (const record of input.comparisons ?? []) {
      lines.push(`  - schemaId: ${record.schemaId as string}`);
      lines.push(`    metricId: ${record.metricId as string}`);
      lines.push(`    verdict: ${record.verdict as string}`);
      lines.push(`    disclosure: ${yamlString(record.disclosure as string)}`);
    }
  }
  return `${lines.join("\n")}\n`;
};

export const CEREMONY_ROW: BaselineRowInput = {
  id: "MET-CEREMONY-SHARE",
  status: "PARTIAL",
  measurementKind: "duration_ratio_proxy",
  unit: "ratio",
  direction: "lower is better",
  value: 0.406648,
  limitation:
    "Duration share, not wall-clock union: overlapping phases count in both numerator and denominator. Self-reported timestamps.",
  excluded: [],
  sample: { spine_included: 23, metric_included: 23 },
};

export const CYCLE_ROW: BaselineRowInput = {
  id: "MET-CYCLE-TIME",
  status: "MEASURED",
  measurementKind: "duration_proxy",
  unit: "hours",
  direction: "lower is better",
  value: 5.3,
  limitation:
    "Self-reported timestamps; clock skew is possible; measures elapsed time, not effort.",
  sample: { spine_included: 23, metric_included: 20 },
};

export const CI_ROW: BaselineRowInput = {
  id: "MET-CI-FAILURE-RATE",
  status: "PARTIAL",
  measurementKind: "session_proxy",
  unit: "ratio",
  direction: "lower is better",
  value: 0.25,
  limitation:
    "No committed CI run log exists. This is a session-level proxy, not a per-run or per-check rate.",
  excluded: [{ ref: "GH-32", reason: "no_ci_observation" }],
  sample: { spine_included: 23, metric_included: 4 },
};

export const FALSE_SIGNAL_ROW: BaselineRowInput = {
  id: "MET-FALSE-SIGNAL-INCIDENTS",
  status: "MEASURED",
  measurementKind: "curated_count",
  unit: "count",
  direction: "lower is better",
  value: 4,
  limitation:
    "Curated from committed prose, not a signal ledger; the count is a floor, not a census.",
  sample: { spine_included: 23, metric_included: 23 },
};

/** The full committed log: three consumed rows plus the untouched fourth row. */
export const fullBaseline = (overrides: BaselineDocumentInput = {}): string =>
  baselineDocument({
    rows: [CEREMONY_ROW, CYCLE_ROW, CI_ROW, FALSE_SIGNAL_ROW],
    ...overrides,
  });

/** A log missing one consumed row; every other row is intact. */
export const partialBaseline = (missingId: string): string =>
  baselineDocument({
    rows: [CEREMONY_ROW, CYCLE_ROW, CI_ROW, FALSE_SIGNAL_ROW].filter((row) => row.id !== missingId),
  });

/** A log carrying only the excluded fourth row. */
export const falseSignalOnlyBaseline = (): string => baselineDocument({ rows: [FALSE_SIGNAL_ROW] });

/** A committed comparison record with a distinctive disclosure. */
export const committedComparisonBaseline = (): string =>
  fullBaseline({
    comparisons: [
      {
        schemaId: "delivery.ceremony.comparison.v1",
        metricId: "MET-CEREMONY-SHARE",
        verdict: "regressed",
        disclosure: "DISTINCTIVE-COMMITTED-COMPARISON-DISCLOSURE",
      },
    ],
  });

/** A months-long window for the verbatim-carriage cells. */
export const monthsLongWindowBaseline = (): string =>
  fullBaseline({
    window: { start: "2025-01-01T00:00:00Z", end: "2026-10-31T23:59:59Z" },
  });

/** The damage-class documents: each is classified, never treated as absence. */
export const damageDocuments = (): Readonly<Record<string, string>> => {
  const full = fullBaseline();
  return {
    truncated: "schema_version: 2\nsource_commit: 'x'\nmetrics: [\n",
    duplicateKey: full.replace("schema_version: 2", "schema_version: 2\nschema_version: 2"),
    missingRequired: full.replace(`source_commit: ${BASELINE_SOURCE_COMMIT}\n`, ""),
    unknownStatus: full.replace("status: MEASURED", "status: GUESSED"),
    badReason: baselineDocument({
      rows: [
        {
          ...CI_ROW,
          excluded: [{ ref: "GH-1", reason: "invented_reason" }],
        },
        CEREMONY_ROW,
        CYCLE_ROW,
      ],
    }),
    emptySourceCommit: full.replace(
      `source_commit: ${BASELINE_SOURCE_COMMIT}`,
      "source_commit: ''",
    ),
    nonMapping: "- just\n- a\n- list\n",
  };
};
