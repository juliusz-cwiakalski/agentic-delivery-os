/**
 * TC-SCITE-001 / TC-SCITE-006 — the equality report cites the mirror's breadth
 * in the mirror's declared order, and every delivered byte is unchanged.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { baseFacts, clone } from "../fixtures/verify-gates/cases/facts";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";
import {
  declaredRead,
  permutedLocalMap,
  REFERENCE_SUITES,
  reorderedLocalMap,
  validEqualityMap,
} from "../fixtures/verify-gates/suite-map/cases";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/verify-gates/golden");

const golden = <T>(name: string): T => JSON.parse(readFileSync(join(GOLDEN, name), "utf8")) as T;

const runEquality = (map = validEqualityMap(), json = true) =>
  runVerify(
    combinedRuntime({ facts: clone(baseFacts()), suiteMap: declaredRead(map) }),
    ["gates", "GH-178"],
    json ? {} : { json: false },
  );

describe("TC-SCITE-001 the equality report cites the two fields", () => {
  test("exit 0, both fields present, every delivered report field intact", async () => {
    const result = await runEquality();
    expect(result.exitCode).toBe(0);
    expect(result.envelope?.error).toBeUndefined();
    const data = result.envelope?.data as Record<string, unknown>;
    expect(data.schemaVersion).toBe("delivery.verify-gates.v1");
    expect(data.target).toBe("gates");
    expect(data.overall).toBe("pass");
    expect(data.suiteBreadth).toEqual([...REFERENCE_SUITES]);
    expect(data.mirrorsJob).toBe("job-01");
    expect(data.summary).toEqual({ gates: 5, passed: 5, failed: 0, unknown: 0 });
    const delivered = golden<Record<string, unknown>>("success-data.json");
    expect(JSON.stringify(data.gates)).toBe(JSON.stringify(delivered.gates));
  });

  test("the only new report root keys are the two breadth fields", async () => {
    const result = await runEquality();
    const data = result.envelope?.data as Record<string, unknown>;
    const delivered = golden<Record<string, unknown>>("success-data.json");
    const added = Object.keys(data).filter((key) => !Object.hasOwn(delivered, key));
    expect(added.sort()).toEqual(["mirrorsJob", "suiteBreadth"]);
    for (const record of data.gates as readonly Record<string, unknown>[]) {
      expect(Object.keys(record).sort()).toEqual(["citation", "id", "reason", "verdict"]);
    }
  });

  test("the human report is the delivered six lines with no breadth line", async () => {
    const result = await runEquality(validEqualityMap(), false);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(readFileSync(join(GOLDEN, "human-success.txt"), "utf8"));
    expect(result.stdout.split("\n").filter((line) => line.length > 0)).toHaveLength(6);
    expect(result.stdout).not.toContain("breadth=");
  });
});

describe("TC-SCITE-006 the order witness: suiteBreadth follows the mirror declaration", () => {
  test("a reversed local set still cites the mirror's forward order", async () => {
    const result = await runEquality(reorderedLocalMap());
    const data = result.envelope?.data as Record<string, unknown>;
    expect(data.suiteBreadth).toEqual([...REFERENCE_SUITES]);
    expect(data.suiteBreadth).not.toEqual(reorderedLocalMap().local);
    const cited = data.suiteBreadth as readonly string[];
    const local = reorderedLocalMap().local;
    for (let index = 0; index < cited.length; index += 1) {
      expect(cited[index]).not.toBe(local[index]);
    }
  });

  test("a third permutation still cites the mirror's declared order", async () => {
    const map = permutedLocalMap();
    const result = await runEquality(map);
    const data = result.envelope?.data as Record<string, unknown>;
    expect(data.suiteBreadth).toEqual([...REFERENCE_SUITES]);
    expect(data.suiteBreadth).not.toEqual(map.local);
    expect(data.mirrorsJob).toBe("job-01");
  });

  test("the fields never appear on the no-map path", async () => {
    const result = await runVerify(combinedRuntime({ facts: clone(baseFacts()) }), [
      "gates",
      "GH-178",
    ]);
    const data = result.envelope?.data as Record<string, unknown>;
    expect(Object.hasOwn(data, "suiteBreadth")).toBe(false);
    expect(Object.hasOwn(data, "mirrorsJob")).toBe(false);
  });
});
