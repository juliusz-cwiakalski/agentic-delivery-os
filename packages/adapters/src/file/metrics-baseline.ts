/**
 * The committed measurement baseline log read (GH-299 F-2, DM-2, DM-7).
 *
 * One bounded committed-document read in the adapters file tier (the
 * ceremony-declarations/config-source precedent): a missing log is row-absent
 * evidence, an unreadable or unparseable log is classified damage, and a
 * parsed-but-invalid document is classified damage too — never absence. The
 * document's content is validated against the delivered log contract and
 * interpreted only where the report consumes it.
 */
import type {
  MetricsBaselineDocument,
  MetricsBaselineLogRead,
  MetricsBaselineRow,
  MetricsExclusion,
  MetricsExclusionReason,
} from "@delivery-os/core/contracts";
import { METRICS_BASELINE_LOG_PATH, METRICS_EXCLUSION_REASONS } from "@delivery-os/core/contracts";
import type { FileSystemFacts } from "./config-source.js";
import { parseConfigYaml } from "./yaml-parser.js";

export type MetricsBaselineReadInput = {
  readonly projectRoot: string;
  readonly fs: FileSystemFacts;
  /** The log path relative to the project root; the declared default otherwise. */
  readonly relativePath?: string;
};

const BASELINE_STATUSES = new Set(["MEASURED", "PARTIAL", "UNAVAILABLE"]);
const REASON_SET = new Set<string>(METRICS_EXCLUSION_REASONS);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const invalid = (detail: string): MetricsBaselineLogRead => ({
  ok: false,
  state: "invalid",
  detail,
});

/**
 * The committed exclusion counters.
 *
 * The committed log records one row per excluded change (`{ref, reason}`); a
 * legacy counter row (`{reason, count}`) is tolerated. Entries are counted per
 * closed reason so the report carries the conserved totals, and a zero count
 * never surfaces.
 */
const exclusionsOf = (value: unknown): readonly MetricsExclusion[] | undefined => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return undefined;
  const counts = new Map<MetricsExclusionReason, number>();
  const order: MetricsExclusionReason[] = [];
  for (const row of value) {
    if (!isRecord(row)) return undefined;
    const reason = row.reason;
    if (typeof reason !== "string" || !REASON_SET.has(reason)) return undefined;
    let count: number;
    if (typeof row.count === "number") {
      if (!Number.isInteger(row.count) || row.count < 0) return undefined;
      count = row.count;
    } else if (isNonEmptyString(row.ref)) {
      count = 1;
    } else {
      return undefined;
    }
    const key = reason as MetricsExclusionReason;
    if (!counts.has(key)) order.push(key);
    counts.set(key, (counts.get(key) ?? 0) + count);
  }
  return order
    .map((reason) => ({ reason, count: counts.get(reason) ?? 0 }))
    .filter((entry) => entry.count > 0);
};

const countersOf = (sample: unknown): Readonly<Record<string, number>> => {
  if (!isRecord(sample)) return {};
  const counters: Record<string, number> = {};
  for (const [key, value] of Object.entries(sample)) {
    if (typeof value === "number" && Number.isFinite(value)) counters[key] = value;
  }
  return counters;
};

const rowOf = (value: unknown): MetricsBaselineRow | undefined => {
  if (!isRecord(value)) return undefined;
  if (!isNonEmptyString(value.id)) return undefined;
  if (typeof value.status !== "string" || !BASELINE_STATUSES.has(value.status)) return undefined;
  if (!isNonEmptyString(value.measurement_kind)) return undefined;
  if (!isNonEmptyString(value.unit) || !isNonEmptyString(value.direction)) return undefined;
  if (!isNonEmptyString(value.limitation)) return undefined;
  const value_ = value.value;
  if (value_ !== null && (typeof value_ !== "number" || !Number.isFinite(value_))) return undefined;
  const excluded = exclusionsOf(value.metric_excluded_changes);
  if (excluded === undefined) return undefined;
  return {
    id: value.id,
    status: value.status,
    measurementKind: value.measurement_kind,
    unit: value.unit,
    direction: value.direction,
    value: value_,
    limitation: value.limitation,
    excluded,
    counters: countersOf(value.sample),
  };
};

/**
 * Validate one parsed baseline document against the delivered contract.
 *
 * A non-mapping root, a wrong schema version, a missing/empty `source_commit`,
 * a malformed window, a duplicate metric ID, an unknown status, an out-of-set
 * exclusion reason, or a non-numeric committed value is damage.
 */
export const validateMetricsBaselineDocument = (document: unknown): MetricsBaselineLogRead => {
  if (!isRecord(document)) return invalid("document.not-a-mapping");
  if (document.schema_version !== 2) return invalid("document.schema-version");
  const sourceCommit = document.source_commit;
  if (!isNonEmptyString(sourceCommit)) return invalid("document.source-commit");
  const window = document.window;
  if (!isRecord(window) || !isNonEmptyString(window.start) || !isNonEmptyString(window.end)) {
    return invalid("document.window");
  }
  const rawMetrics = document.metrics;
  if (!Array.isArray(rawMetrics)) return invalid("document.metrics");
  const rows: MetricsBaselineRow[] = [];
  const seen = new Set<string>();
  for (const raw of rawMetrics) {
    const row = rowOf(raw);
    if (row === undefined) return invalid("document.metric-row");
    if (seen.has(row.id)) return invalid(`document.metric-row.duplicate.${row.id}`);
    seen.add(row.id);
    rows.push(row);
  }
  const comparisons = document.comparisons;
  const parsed: MetricsBaselineDocument = {
    sourceCommit,
    window: { start: window.start, end: window.end },
    rows,
    comparisonRecords: Array.isArray(comparisons) ? comparisons.length : 0,
  };
  return { ok: true, state: "present", document: parsed };
};

/** Read and validate the committed measurement baseline log. */
export const readMetricsBaselineLog = (input: MetricsBaselineReadInput): MetricsBaselineLogRead => {
  const relative = input.relativePath ?? METRICS_BASELINE_LOG_PATH;
  const path = `${input.projectRoot.replace(/\/+$/u, "")}/${relative}`;
  let exists: boolean;
  try {
    exists = input.fs.exists(path);
  } catch {
    return { ok: false, state: "unreadable" };
  }
  if (!exists) return { ok: true, state: "absent" };
  let text: string;
  try {
    text = input.fs.readText(path);
  } catch {
    return { ok: false, state: "unreadable" };
  }
  const parsed = parseConfigYaml(text, "project-committed", path);
  if (!parsed.ok) return { ok: false, state: "unparseable" };
  return validateMetricsBaselineDocument(parsed.facts.values);
};
