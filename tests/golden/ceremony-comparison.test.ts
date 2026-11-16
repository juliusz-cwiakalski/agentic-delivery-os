/**
 * TC-CEREMONY-041 (golden half) — the committed comparison entry is exactly the
 * builder output over the committed baseline inputs; no value is restated in
 * source and no existing metric row is edited.
 */
import { describe, expect, test } from "bun:test";
import {
  buildCeremonyComparison,
  foldCeremonyMeasurement,
} from "../../packages/core/src/domain/index";
import {
  AFTER_WINDOW,
  BEFORE,
  ceremonyShareRow,
  committedComparison,
  LIMITATION,
  LOG_PATH,
  readCommittedLog,
} from "../fixtures/ceremony/comparison/baseline";

describe("golden: the committed ceremony-share comparison", () => {
  test("the log is schema version 2 with an additive comparisons list", () => {
    const log = readCommittedLog();
    expect(log.schema_version).toBe(2);
    expect(Array.isArray(log.comparisons)).toBe(true);
    expect(log.comparisons).toHaveLength(1);
    expect(ceremonyShareRow().value).toBe(0.406648);
  });

  test("the committed entry deep-equals the builder output", () => {
    const built = buildCeremonyComparison({
      logPath: LOG_PATH,
      sourceCommit: "75b4e7602ad89bd26f96912ac06ed8bfcb72a5ae",
      before: BEFORE,
      afterWindow: AFTER_WINDOW,
      samples: [],
      measurement: foldCeremonyMeasurement([]),
      limitation: LIMITATION,
    });
    expect(committedComparison()).toEqual(built);
    expect(built.verdict).toBe("insufficient-sample");
  });
});
