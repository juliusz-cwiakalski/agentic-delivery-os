/**
 * The metrics golden fixture generator (GH-299 TC-METRICS-101).
 *
 * Explicit command only: `bun run tests/fixtures/metrics/golden/regenerate.ts`.
 * Regeneration is a reviewed act; the diff must show only the declared delta.
 * Every form is built from the committed case fixture with the fixed clock, so
 * the output carries no absolute path, timestamp, or unstable ordering.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { belowThresholdMatrix, crossingMatrix } from "../alarms";
import { makeMetricsCase } from "../case";
import { burnRateConfig } from "../config";
import { DAY_MS, METRICS_NOW_MS, METRICS_REF, runMetrics } from "../harness";

export const GOLDEN_DIR = join(import.meta.dir);
const CAPTURED_AT = new Date(METRICS_NOW_MS - 2 * DAY_MS).toISOString();

const writeWith = async (
  name: string,
  steps: readonly import("../../../../packages/core/src/contracts/index").TelemetryStepRecord[],
  config: string,
): Promise<void> => {
  const fixture = makeMetricsCase({ label: `golden-${name}`, steps, config });
  writeFileSync(join(GOLDEN_DIR, `${name}.txt`), (await runMetrics(fixture, ["metrics"])).human);
  const machine = await runMetrics(fixture, ["metrics", "--json"]);
  writeFileSync(
    join(GOLDEN_DIR, `${name}.json`),
    `${JSON.stringify(machine.envelope?.data, null, 2)}\n`,
  );
  fixture.dispose();
};

/** Regenerate every declared form. */
export const regenerate = async (): Promise<void> => {
  mkdirSync(GOLDEN_DIR, { recursive: true });
  // Bare: the full evidence picture with the drawn window.
  const bare = makeMetricsCase({ label: "golden-bare" });
  const bareRun = await runMetrics(bare, ["metrics"]);
  writeFileSync(join(GOLDEN_DIR, "bare.txt"), bareRun.human);
  const bareMachine = await runMetrics(bare, ["metrics", "--json"]);
  writeFileSync(
    join(GOLDEN_DIR, "bare.json"),
    `${JSON.stringify(bareMachine.envelope?.data, null, 2)}\n`,
  );
  bare.dispose();

  const crossing = crossingMatrix(METRICS_REF, CAPTURED_AT);
  await writeWith("crossing", crossing.steps, burnRateConfig(crossing.config));

  const below = belowThresholdMatrix(METRICS_REF, CAPTURED_AT);
  await writeWith("below-threshold", below.steps, burnRateConfig(below.config));

  const absent = makeMetricsCase({ label: "golden-telemetry-absent", steps: [] });
  const absentRun = await runMetrics(absent, ["metrics"]);
  writeFileSync(join(GOLDEN_DIR, "telemetry-absent.txt"), absentRun.human);
  const absentMachine = await runMetrics(absent, ["metrics", "--json"]);
  writeFileSync(
    join(GOLDEN_DIR, "telemetry-absent.json"),
    `${JSON.stringify(absentMachine.envelope?.data, null, 2)}\n`,
  );
  absent.dispose();

  const undeclared = makeMetricsCase({ label: "golden-undeclared", steps: [] });
  undeclared.removeConfig();
  const undeclaredRun = await runMetrics(undeclared, ["metrics"]);
  writeFileSync(join(GOLDEN_DIR, "undeclared-threshold.txt"), undeclaredRun.human);
  undeclared.dispose();

  const insufficient = makeMetricsCase({
    label: "golden-insufficient",
    steps: [],
    ci: [
      {
        ref: "GH-1",
        observed: true,
        outcome: "red",
        observedAt: new Date(METRICS_NOW_MS - 86_400_000).toISOString(),
      },
    ],
  });
  const insufficientRun = await runMetrics(insufficient, ["metrics"]);
  writeFileSync(join(GOLDEN_DIR, "insufficient-sample.txt"), insufficientRun.human);
  insufficient.dispose();
};

if (import.meta.main) {
  await regenerate();
  process.stdout.write(`regenerated metrics goldens in ${GOLDEN_DIR}\n`);
}
