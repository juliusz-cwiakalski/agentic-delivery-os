/**
 * TC-METRICS-001/005/016/020/023 (contract halves) and TC-METRICS-102 (bounds
 * half) — the one contract home: the payload identity is a declared constant,
 * the vocabularies are closed at their declared members, and every bound is a
 * contract fact the domain and the command assert through.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALARM_EVALUATION_STATUSES,
  ALARM_KINDS,
  BASELINE_CONSUMED_METRIC_IDS,
  COMPARISON_VERDICTS,
  ESCAPED_DEFECT_CLASSES,
  ESCAPED_DEFECTS_METRIC_ID,
  EXACT_CODE_DOMAIN_KINDS,
  MEASUREMENT_KINDS,
  METRIC_BASES,
  METRIC_IDS,
  METRIC_STATUSES,
  METRICS_BASELINE_UNREADABLE_CODE,
  METRICS_BURN_RATE_BASES,
  METRICS_BURN_RATE_CONFIG_KEY,
  METRICS_BURN_RATE_MAX_WINDOW_DAYS,
  METRICS_BURN_RATE_MIN_WINDOW_DAYS,
  METRICS_BURN_RATE_NODE_KEYS,
  METRICS_BURN_RATE_SCHEMA,
  METRICS_DATA_KEYS,
  METRICS_DATA_SCHEMA_ID,
  METRICS_DRAWN_WINDOW_DAYS,
  METRICS_ESCAPED_DEFECTS_FLOOR_CAVEAT,
  METRICS_EXCLUSION_REASONS,
  METRICS_MAX_COMPARISONS,
  METRICS_MAX_HUMAN_BYTES,
  METRICS_MAX_HUMAN_LINES,
  METRICS_MAX_INCIDENTS,
  METRICS_MAX_MACHINE_BYTES,
  METRICS_MAX_PER_AGENT,
  METRICS_PROXY_NATIVE_CAVEAT,
  METRICS_SAMPLE_MINIMUM,
  METRICS_TRUNCATION_TARGETS,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const CONTRACT_TEXT = readFileSync(join(ROOT, "packages/core/src/contracts/metrics.ts"), "utf8");

describe("TC-METRICS-005 one payload identity declared as contract data", () => {
  test("the identity is delivery.metrics.v1 and is never a data key", () => {
    expect(METRICS_DATA_SCHEMA_ID).toBe("delivery.metrics.v1");
    expect([...METRICS_DATA_KEYS]).not.toContain(METRICS_DATA_SCHEMA_ID);
    expect([...METRICS_DATA_KEYS]).not.toContain("schemaVersion");
  });

  test("the data key set is exactly the nine declared members in order", () => {
    expect([...METRICS_DATA_KEYS]).toEqual([
      "ref",
      "window",
      "metrics",
      "dispatch",
      "alarms",
      "alarmEvaluation",
      "comparisons",
      "omitted",
      "truncated",
    ]);
  });

  test("the identity literal lives in the contract file only once", () => {
    const occurrences = CONTRACT_TEXT.split(`"${METRICS_DATA_SCHEMA_ID}"`).length - 1;
    expect(occurrences).toBe(1);
  });
});

describe("TC-METRICS-016 the closed entry vocabulary leaves no home for the excluded row", () => {
  test("the four members are exact and ordered", () => {
    expect([...METRIC_IDS]).toEqual([
      "MET-CEREMONY-SHARE",
      "MET-CYCLE-TIME",
      "MET-CI-FAILURE-RATE",
      "escaped-defects",
    ]);
    expect([...BASELINE_CONSUMED_METRIC_IDS]).toEqual([
      "MET-CEREMONY-SHARE",
      "MET-CYCLE-TIME",
      "MET-CI-FAILURE-RATE",
    ]);
    expect(ESCAPED_DEFECTS_METRIC_ID).toBe("escaped-defects");
  });

  test("the vocabulary contains no MET-FALSE-SIGNAL-INCIDENTS member and no quota shape", () => {
    const joined = JSON.stringify([
      METRIC_IDS,
      BASELINE_CONSUMED_METRIC_IDS,
      METRIC_BASES,
      METRICS_DATA_KEYS,
    ]);
    expect(joined).not.toContain("MET-FALSE-SIGNAL");
    expect(joined.toLowerCase()).not.toContain("quota");
  });

  test("escaped defects is the one non-MET member", () => {
    expect([...METRIC_IDS].filter((id) => !id.startsWith("MET-"))).toEqual(["escaped-defects"]);
  });
});

describe("the closed vocabularies are exact", () => {
  test("measurement kinds, statuses, bases, verdicts, evaluation states, classes", () => {
    expect([...MEASUREMENT_KINDS]).toEqual(["native", "proxy", "curated-count"]);
    expect([...METRIC_STATUSES]).toEqual(["MEASURED", "PARTIAL", "UNAVAILABLE"]);
    expect([...METRIC_BASES]).toEqual([
      "phase-transition-history",
      "ceremony-runner-fold",
      "committed-pm-notes-corpus",
      "committed-evidence-corpus",
    ]);
    expect([...COMPARISON_VERDICTS]).toEqual([
      "improved",
      "regressed",
      "flat",
      "not-established",
      "insufficient-sample",
    ]);
    expect([...ALARM_EVALUATION_STATUSES]).toEqual([
      "evaluated",
      "threshold-undeclared",
      "telemetry-absent",
    ]);
    expect([...ALARM_KINDS]).toEqual(["burn-rate"]);
    expect([...ESCAPED_DEFECT_CLASSES]).toEqual([
      "post-gate-review",
      "landed-ci-failure",
      "retro-attributed",
    ]);
  });

  test("the exclusion reason set is the delivered closed seven", () => {
    expect([...METRICS_EXCLUSION_REASONS]).toEqual([
      "unparseable_yaml",
      "date_only_or_missing_time",
      "placeholder_zero_time",
      "capture_change",
      "outside_window",
      "missing_metric_input",
      "no_ci_observation",
    ]);
  });
});

describe("TC-METRICS-102 the declared bounds are contract constants", () => {
  test("byte, line, row, and window bounds", () => {
    expect(METRICS_MAX_MACHINE_BYTES).toBe(65_536);
    expect(METRICS_MAX_HUMAN_LINES).toBe(200);
    expect(METRICS_MAX_HUMAN_BYTES).toBe(16_384);
    expect(METRICS_MAX_INCIDENTS).toBe(8);
    expect(METRICS_MAX_PER_AGENT).toBe(20);
    expect(METRICS_MAX_COMPARISONS).toBe(20);
    expect(METRICS_SAMPLE_MINIMUM).toBe(5);
    expect(METRICS_DRAWN_WINDOW_DAYS).toBe(30);
  });

  test("the tail-first drop order is comparisons then incidents then perAgent", () => {
    expect([...METRICS_TRUNCATION_TARGETS]).toEqual(["comparisons", "incidents", "perAgent"]);
  });
});

describe("the disclosures and the declaration node are declared once", () => {
  test("the caveat names both bases and claims no interchangeability", () => {
    expect(METRICS_PROXY_NATIVE_CAVEAT).toContain("committed pm-notes proxy basis");
    expect(METRICS_PROXY_NATIVE_CAVEAT).toContain("native source");
    expect(METRICS_PROXY_NATIVE_CAVEAT).toContain("not interchangeable");
    expect(METRICS_PROXY_NATIVE_CAVEAT).toContain("no trend is claimed");
  });

  test("the escaped-defects floor caveat is the curated-floor statement", () => {
    expect(METRICS_ESCAPED_DEFECTS_FLOOR_CAVEAT).toContain("Curated floor, not a census");
    expect(METRICS_ESCAPED_DEFECTS_FLOOR_CAVEAT).toContain("artifact-anchored");
    expect(METRICS_ESCAPED_DEFECTS_FLOOR_CAVEAT).toContain("tmp/**");
    expect(METRICS_ESCAPED_DEFECTS_FLOOR_CAVEAT).toContain(".ai/local/**");
  });

  test("the burn-rate node schema, key, members, bases, and window bounds", () => {
    expect(METRICS_BURN_RATE_SCHEMA).toBe("delivery.metrics.burn-rate.v1");
    expect(METRICS_BURN_RATE_CONFIG_KEY).toBe("metrics.burn-rate");
    expect([...METRICS_BURN_RATE_NODE_KEYS]).toEqual(["threshold", "basis", "window"]);
    expect([...METRICS_BURN_RATE_BASES]).toEqual(["cost", "tokens"]);
    expect(METRICS_BURN_RATE_MIN_WINDOW_DAYS).toBe(1);
    expect(METRICS_BURN_RATE_MAX_WINDOW_DAYS).toBe(90);
  });

  test("the one failure identity is exact-code only", () => {
    expect(METRICS_BASELINE_UNREADABLE_CODE).toBe("metrics.baseline-unreadable");
    expect([...EXACT_CODE_DOMAIN_KINDS]).toContain("metrics");
  });
});
