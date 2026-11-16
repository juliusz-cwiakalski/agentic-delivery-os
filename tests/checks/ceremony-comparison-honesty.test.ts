/**
 * TC-CEREMONY-042 (honesty half) — no trend claim exists below the sample
 * minimum in the record or any change artifact, and zero-filling the verdict into
 * `flat` fails the same scan.
 */
import { describe, expect, test } from "bun:test";
import {
  buildCeremonyComparison,
  ceremonyComparisonHonestyViolations,
  foldCeremonyMeasurement,
} from "../../packages/core/src/domain/index";
import {
  AFTER_WINDOW,
  BEFORE,
  LIMITATION,
  LOG_PATH,
} from "../fixtures/ceremony/comparison/baseline";

const record = () =>
  buildCeremonyComparison({
    logPath: LOG_PATH,
    sourceCommit: "75b4e7602ad89bd26f96912ac06ed8bfcb72a5ae",
    before: BEFORE,
    afterWindow: AFTER_WINDOW,
    samples: [],
    measurement: foldCeremonyMeasurement([]),
    limitation: LIMITATION,
  });

describe("TC-CEREMONY-042 no trend claim below the minimum", () => {
  test("the delivered record and its artifacts are honest", () => {
    expect(ceremonyComparisonHonestyViolations(record(), [])).toEqual([]);
    expect(ceremonyComparisonHonestyViolations(record(), ["no sample at delivery time"])).toEqual(
      [],
    );
  });

  test("a trend token in an artifact fails the scan", () => {
    expect(
      ceremonyComparisonHonestyViolations(record(), ["ceremony time improved this window"]),
    ).toContain('artifact 0 carries the trend token "improved"');
  });

  test("zero-filling insufficient-sample into flat fails the scan", () => {
    const zeroFilled = { ...record(), verdict: "flat" as const };
    expect(ceremonyComparisonHonestyViolations(zeroFilled, [])).toContain(
      'a sample below the minimum carries the verdict "flat" instead of insufficient-sample',
    );
  });
});
