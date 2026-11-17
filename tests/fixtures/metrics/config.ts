/**
 * The project-committed configuration document builders (GH-299 test plan §6).
 *
 * Each document declares (or omits) the `metrics.burn-rate` node; the
 * at-limit twins and one defect builder per declared class let the matrix in
 * TC-METRICS-054 run against real documents.
 */

export type BurnRateConfigInput = {
  readonly threshold?: number | string | null;
  readonly basis?: string | null;
  readonly window?: string | null;
  readonly omitThreshold?: boolean;
  readonly omitBasis?: boolean;
  readonly omitWindow?: boolean;
  readonly extra?: Readonly<Record<string, string>>;
};

const scalar = (value: number | string | null): string =>
  typeof value === "string" ? `'${value.replace(/'/gu, "''")}'` : String(value);

/** Render a document declaring the `metrics.burn-rate` node. */
export const burnRateConfig = (input: BurnRateConfigInput = {}): string => {
  const lines = ["metrics:", "  burn-rate:"];
  if (input.omitThreshold !== true) {
    lines.push(`    threshold: ${scalar(input.threshold === undefined ? 1000 : input.threshold)}`);
  }
  if (input.omitBasis !== true) {
    lines.push(`    basis: ${scalar(input.basis === undefined ? "tokens" : input.basis)}`);
  }
  if (input.omitWindow !== true) {
    lines.push(`    window: ${scalar(input.window === undefined ? "14d" : input.window)}`);
  }
  for (const [key, value] of Object.entries(input.extra ?? {})) {
    lines.push(`    ${key}: ${scalar(value)}`);
  }
  return `${lines.join("\n")}\n`;
};

/** A document with a `metrics` branch but no `burn-rate` member. */
export const metricsWithoutBurnRate = (): string => "metrics:\n  other: 'declared'\n";

/** A document with unrelated nodes only. */
export const unrelatedNodesOnly = (): string => "commit:\n  phaseCommit: true\n";

/** A document whose `burn-rate` value is a non-mapping scalar. */
export const nonMappingBurnRate = (): string => "metrics:\n  burn-rate: 'declared'\n";

/** The full defect matrix, each cell a real document. */
export const defectConfigs = (): Readonly<Record<string, string>> => ({
  thresholdZero: burnRateConfig({ threshold: 0 }),
  thresholdNegative: burnRateConfig({ threshold: -1 }),
  thresholdString: burnRateConfig({ threshold: "1000" }),
  thresholdNull: burnRateConfig({ threshold: null }),
  thresholdMissing: burnRateConfig({ omitThreshold: true }),
  basisMoney: burnRateConfig({ basis: "money" }),
  basisCosts: burnRateConfig({ basis: "costs" }),
  basisMissing: burnRateConfig({ omitBasis: true }),
  windowZero: burnRateConfig({ window: "0d" }),
  windowNinetyOne: burnRateConfig({ window: "91d" }),
  windowBare: burnRateConfig({ window: "30" }),
  windowProse: burnRateConfig({ window: "30 days" }),
  windowNegative: burnRateConfig({ window: "-1d" }),
  windowMissing: burnRateConfig({ omitWindow: true }),
  nonMapping: nonMappingBurnRate(),
});
