/**
 * TC-METRICS-112 — mutant sensitivity: each honesty rule, disabled in a temp
 * copy of the pure domain, produces its prohibited observable on an unchanged
 * fixture, and the unmutated module keeps the control.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { MetricsReport } from "../../packages/core/src/contracts/index";
import { computeMetricsReport } from "../../packages/core/src/domain/metrics";
import { foldInputFor, makeMetricsCase } from "../fixtures/metrics/case";
import { burnRateConfig } from "../fixtures/metrics/config";
import type { EvidenceInput } from "../fixtures/metrics/corpus";
import { METRICS_NOW_MS, METRICS_REF } from "../fixtures/metrics/harness";
import { stepOf, tokens } from "../fixtures/metrics/telemetry";

const ROOT = process.cwd();
const MODULE = "packages/core/src/domain/metrics.ts";

type Replacement = readonly [string, string];

type Module = {
  readonly computeMetricsReport: (input: ReturnType<typeof foldInputFor>) => MetricsReport;
};

const withMutant = async (
  id: string,
  replacements: readonly Replacement[],
  body: (module: Module) => void,
): Promise<void> => {
  const absolute = join(ROOT, MODULE);
  let source = readFileSync(absolute, "utf8");
  for (const [from, to] of replacements) {
    if (!source.includes(from)) throw new Error(`${id}: mutant anchor missing: ${from}`);
    source = source.replace(from, to);
  }
  const temp = join(dirname(absolute), `.metrics-mutant-${id}.ts`);
  writeFileSync(temp, source);
  if (id === "uncited") {
    const i = source.indexOf("row.citation");
    console.log("MUTANT REGION", JSON.stringify(source.slice(i - 40, i + 120)));
  }
  try {
    const module = (await import(`${pathToFileURL(temp).href}`)) as Module;
    body(module);
  } finally {
    rmSync(temp, { force: true });
  }
};

const at = (daysAgo: number): string =>
  new Date(METRICS_NOW_MS - daysAgo * 86_400_000).toISOString();

const evidenceRows = (): readonly EvidenceInput[] => [
  {
    path: "doc/changes/2026-11/x/review/uncited.md",
    anchor: null,
    class: "post-gate-review",
    observedAt: at(1),
    ref: METRICS_REF,
  },
  {
    path: "doc/changes/2026-11/x/review/cited.md",
    anchor: "CITED-1",
    class: "post-gate-review",
    observedAt: at(1),
    ref: METRICS_REF,
  },
];

const fixture = (label: string, crossing = true) => {
  const built = makeMetricsCase({
    label,
    config: burnRateConfig({
      threshold: crossing ? 1000 : 999_999,
      basis: "tokens",
      window: "14d",
    }),
    evidence: evidenceRows(),
  });
  built.project.set("doc/changes/2026-11/x/review/uncited.md", "no anchor\n");
  built.project.set("doc/changes/2026-11/x/review/cited.md", "CITED-1 cited\n");
  return built;
};

const entryOf = (report: MetricsReport, id: string) =>
  report.metrics.find((entry) => entry.id === id);

describe("TC-METRICS-112 every honesty rule has a disabling mutant", () => {
  test("baseline restatement: echoing the committed value is detected", async () => {
    const built = fixture("mutant-baseline");
    const control = computeMetricsReport(foldInputFor(built));
    const ci = entryOf(control, "MET-CI-FAILURE-RATE");
    expect(ci?.value).not.toBe(0.25);
    await withMutant(
      "baseline",
      [["          value: measure.ratio,", "          value: row.value ?? measure.ratio,"]],
      (module) => {
        const mutated = module.computeMetricsReport(foldInputFor(built));
        expect(entryOf(mutated, "MET-CI-FAILURE-RATE")?.value).toBe(0.25);
      },
    );
    built.dispose();
  });

  test("caveat dropped: a cross-kind row without the caveat is detected", async () => {
    const built = fixture("mutant-caveat-drop");
    const control = computeMetricsReport(foldInputFor(built));
    expect(control.comparisons.some((row) => row.caveat !== undefined)).toBe(true);
    await withMutant(
      "caveat-drop",
      [
        [
          "    const caveat = entry.measurementKind === beforeKind ? undefined : METRICS_PROXY_NATIVE_CAVEAT;",
          "    const caveat = undefined;",
        ],
      ],
      (module) => {
        const mutated = module.computeMetricsReport(foldInputFor(built));
        expect(mutated.comparisons.every((row) => row.caveat === undefined)).toBe(true);
      },
    );
    built.dispose();
  });

  test("caveat over-applied: a same-kind row with the caveat is detected", async () => {
    const built = fixture("mutant-caveat-over");
    const control = computeMetricsReport(foldInputFor(built));
    expect(control.comparisons.find((row) => row.metricId === "MET-CI-FAILURE-RATE")?.caveat).toBe(
      undefined,
    );
    await withMutant(
      "caveat-over",
      [
        [
          "    const caveat = entry.measurementKind === beforeKind ? undefined : METRICS_PROXY_NATIVE_CAVEAT;",
          "    const caveat = METRICS_PROXY_NATIVE_CAVEAT;",
        ],
      ],
      (module) => {
        const mutated = module.computeMetricsReport(foldInputFor(built));
        expect(
          mutated.comparisons.find((row) => row.metricId === "MET-CI-FAILURE-RATE")?.caveat,
        ).toBeDefined();
      },
    );
    built.dispose();
  });

  test("trend below the minimum: a sub-minimum improved verdict is detected", async () => {
    const built = fixture("mutant-trend");
    const control = computeMetricsReport(foldInputFor(built));
    expect(control.comparisons.every((row) => row.verdict !== "improved")).toBe(true);
    await withMutant(
      "trend",
      [
        [
          '      if (entry.sample.n < METRICS_SAMPLE_MINIMUM) return "insufficient-sample" as const;\n',
          "",
        ],
      ],
      (module) => {
        const mutated = module.computeMetricsReport(foldInputFor(built));
        const ci = mutated.comparisons.find((row) => row.metricId === "MET-CI-FAILURE-RATE");
        expect(["improved", "regressed"]).toContain(String(ci?.verdict));
        expect(ci?.after.sampleSize).toBeLessThan(5);
      },
    );
    built.dispose();
  });

  test("duplicate alarm: two alarms for one crossing are detected", async () => {
    const built = fixture("mutant-duplicate");
    expect(computeMetricsReport(foldInputFor(built)).alarms).toHaveLength(1);
    await withMutant(
      "duplicate",
      [
        [
          "  return { alarms: [alarm], alarmEvaluation: evaluation };",
          "  return { alarms: [alarm, alarm], alarmEvaluation: evaluation };",
        ],
      ],
      (module) => {
        expect(module.computeMetricsReport(foldInputFor(built)).alarms).toHaveLength(2);
      },
    );
    built.dispose();
  });

  test("invented evaluation state: an undeclared node reporting evaluated is detected", async () => {
    const built = fixture("mutant-threshold");
    built.removeConfig();
    expect(computeMetricsReport(foldInputFor(built)).alarmEvaluation.status).toBe(
      "threshold-undeclared",
    );
    await withMutant(
      "threshold",
      [
        [
          '    return { alarms: [], alarmEvaluation: { kind, status: "threshold-undeclared" } };',
          '    return { alarms: [], alarmEvaluation: { kind, status: "telemetry-absent" } };',
        ],
      ],
      (module) => {
        expect(module.computeMetricsReport(foldInputFor(built)).alarmEvaluation.status).not.toBe(
          "threshold-undeclared",
        );
      },
    );
    built.dispose();
  });

  test("unobserved green: counting an unobserved row as observed is detected", async () => {
    const built = makeMetricsCase({
      label: "mutant-unobserved",
      ci: [
        { ref: "GH-1", observed: true, outcome: "green", observedAt: at(1) },
        { ref: "GH-2", observed: false, outcome: null, observedAt: at(2) },
      ],
    });
    const control = entryOf(computeMetricsReport(foldInputFor(built)), "MET-CI-FAILURE-RATE");
    expect(control?.sample.n).toBe(1);
    await withMutant(
      "unobserved",
      [
        [
          '      reasons.set("no_ci_observation", (reasons.get("no_ci_observation") ?? 0) + 1);\n      continue;',
          "      observed += 1;\n      continue;",
        ],
      ],
      (module) => {
        const mutated = entryOf(
          module.computeMetricsReport(foldInputFor(built)),
          "MET-CI-FAILURE-RATE",
        );
        expect(mutated?.sample.n).toBe(2);
      },
    );
    built.dispose();
  });

  test("zero-fill escaped defects: an empty corpus rendering zero is detected", async () => {
    const built = makeMetricsCase({ label: "mutant-zero-escaped", evidence: [] });
    expect(
      entryOf(computeMetricsReport(foldInputFor(built)), "escaped-defects")?.value,
    ).toBeUndefined();
    await withMutant(
      "zero-escaped",
      [
        [
          "      ...(total === 0\n        ? {}\n        : {\n            value: total,\n            incidents: curated.incidents,\n          }),",
          "      value: total,\n      incidents: curated.incidents,",
        ],
      ],
      (module) => {
        expect(
          entryOf(module.computeMetricsReport(foldInputFor(built)), "escaped-defects")?.value,
        ).toBe(0);
      },
    );
    built.dispose();
  });

  test("uncited incident: counting a row without an anchor is detected", async () => {
    const built = fixture("mutant-uncited");
    expect(entryOf(computeMetricsReport(foldInputFor(built)), "escaped-defects")?.value).toBe(1);
    await withMutant(
      "uncited",
      [
        [
          '    if (row.anchor === null || row.anchor.trim().length === 0) {\n      excluded += 1;\n      continue;\n    }\n    if (row.citation === "unresolved") {\n      excluded += 1;\n      continue;\n    }',
          '    if (row.anchor === null) row.anchor = "invented";',
        ],
      ],
      (module) => {
        expect(
          entryOf(module.computeMetricsReport(foldInputFor(built)), "escaped-defects")?.value,
        ).toBe(2);
      },
    );
    built.dispose();
  });

  test("alarms dropped: dropping the alarm set under a cap is detected", async () => {
    const built = fixture("mutant-alarms-drop");
    expect(computeMetricsReport(foldInputFor(built)).alarms).toHaveLength(1);
    await withMutant(
      "alarms-drop",
      [["    alarms: alarms.alarms,", "    alarms: [],"]],
      (module) => {
        expect(module.computeMetricsReport(foldInputFor(built)).alarms).toEqual([]);
      },
    );
    built.dispose();
  });

  test("the unmutated module passes every control above", () => {
    const built = fixture("mutant-control");
    const report = computeMetricsReport(foldInputFor(built));
    expect(report.alarms).toHaveLength(1);
    expect(report.alarmEvaluation.status).toBe("evaluated");
    expect(entryOf(report, "escaped-defects")?.value).toBe(1);
    expect(entryOf(report, "MET-CI-FAILURE-RATE")?.value).not.toBe(0.25);
    expect(report.comparisons.some((row) => row.caveat !== undefined)).toBe(true);
    built.dispose();
    expect(METRICS_REF).toBe("GH-299");
    expect(stepOf).toBeDefined();
    expect(tokens).toBeDefined();
  });
});
