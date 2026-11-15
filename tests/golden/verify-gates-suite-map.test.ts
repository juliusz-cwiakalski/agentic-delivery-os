/**
 * GH-300 golden suite: the new equality report, the reordered-order witness, the
 * human six lines, the narrowed envelopes (member-less and member-declaring),
 * and the two bounded `cause:` lines — first capture, then byte-for-byte.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REFERENCE_SUITES } from "../fixtures/verify-gates/suite-map/cases";
import {
  causeBreadthRun,
  causeMirrorRun,
  equalityHuman,
  equalityRun,
  narrowedMemberRun,
  narrowedRun,
  reorderedRun,
} from "../fixtures/verify-gates/suite-map/golden-cases";

const GOLDEN = join(process.cwd(), "tests/fixtures/verify-gates/golden");

const golden = <T>(name: string): T => JSON.parse(readFileSync(join(GOLDEN, name), "utf8")) as T;
const goldenText = (name: string): string => readFileSync(join(GOLDEN, name), "utf8");

describe("TC-SCITE-001/TC-SCITE-006 the equality report and the order witness", () => {
  test("the equality data golden matches byte-for-byte", async () => {
    const result = await equalityRun();
    expect(result.exitCode).toBe(0);
    expect(result.envelope?.data).toEqual(golden("suite-map-success-data.json"));
  });

  test("the reordered local order still cites the mirror's declared order", async () => {
    const result = await reorderedRun();
    const data = result.envelope?.data as Record<string, unknown>;
    expect(data).toEqual(golden("suite-map-success-data-reordered.json"));
    expect(data.suiteBreadth).toEqual([...REFERENCE_SUITES]);
  });

  test("the human report is the delivered six lines", async () => {
    const result = await equalityHuman();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(goldenText("suite-map-human-success.txt"));
    expect(result.stdout.split("\n").filter((line) => line.length > 0)).toHaveLength(6);
  });
});

describe("TC-SNARR-001/006 the narrowed envelopes", () => {
  test("the member-less narrowed envelope matches byte-for-byte and pins the header", async () => {
    const result = await narrowedRun();
    expect(result.exitCode).toBe(1);
    expect(result.envelope).toEqual(golden("suite-map-narrowed-envelope.json"));
    const summary = String(result.envelope?.error?.summary ?? "");
    expect(summary.split("\n")[0]).toBe(
      `result=unknown; gates=5/5 passed, 0 failed, 0 unknown; scope=narrowed mirror=job-01 breadth=${REFERENCE_SUITES.join(",")}`,
    );
    expect(result.envelope?.detail).toEqual({ suiteBreadth: ["tests"] });
  });

  test("the member-mode refusal is exactly one line and carries no report", async () => {
    const result = await narrowedMemberRun();
    expect(result.exitCode).toBe(1);
    expect(result.envelope).toEqual(golden("suite-map-narrowed-member-envelope.json"));
    const summary = String(result.envelope?.error?.summary ?? "");
    expect(summary.split("\n")).toHaveLength(1);
    expect(summary).toBe(
      `result=unknown; gates=0/0 passed, 0 failed, 0 unknown; scope=narrowed mirror=job-01 breadth=${REFERENCE_SUITES.join(",")}`,
    );
    expect(JSON.stringify(result.envelope)).not.toContain("definitionOfDone");
    expect(JSON.stringify(result.envelope)).not.toContain("member");
  });
});

describe("TC-SRES-002/TC-SRES-003 the two cause-line goldens", () => {
  test("the uncorroborated mirror writes one bounded cause line", async () => {
    const result = await causeMirrorRun();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe(goldenText("suite-map-cause-mirror.txt"));
    expect(result.stderr.split("\n").filter((line) => line.length > 0)).toHaveLength(2);
    expect(result.stderr).toContain("cause: mirror=not-a-workflow-job");
  });

  test("the unmirrored breadth writes one bounded cause line", async () => {
    const result = await causeBreadthRun();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe(goldenText("suite-map-cause-breadth.txt"));
    expect(result.stderr).toContain("cause: breadth=");
    expect(result.stderr).toContain(" omitted=1");
    expect(result.envelope?.detail).toBeUndefined();
  });
});
