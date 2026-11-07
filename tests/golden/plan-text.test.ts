/**
 * TC-KEYVAL-004 — plan text keeps its documented key order and classification
 * lines. The machine payload stays authoritative; this pins the text grammar.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  serializePlanDiffText,
  serializePlanOverlapText,
  serializePlanValidateText,
} from "../../packages/cli/src/output/plan-text";
import type {
  PlanDiffData,
  PlanOverlapData,
  PlanValidateData,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(join(ROOT, `tests/golden/plan/${name}.json`), "utf8")) as T;

describe("TC-KEYVAL-004 plan validate text", () => {
  test("renders verdict, artifact, tier, readiness, and errors in order", () => {
    const data = fixture<PlanValidateData>("validate-baseline");
    const lines = serializePlanValidateText(data).trimEnd().split("\n");
    expect(lines[0]).toBe("verdict=valid");
    expect(lines[1]).toMatch(/^artifact=yaml:/);
    expect(lines[2]).toMatch(/^tier=/);
    expect(lines[3]).toBe("readyForDevelopment=true");
  });
});

describe("TC-KEYVAL-004 plan diff and overlap text", () => {
  test("diff starts with verdict and against", () => {
    const data = fixture<PlanDiffData>("diff-outside");
    const lines = serializePlanDiffText(data).trimEnd().split("\n");
    expect(lines[0]).toBe(`verdict=${data.verdict}`);
    expect(lines[1]).toBe(`against=${data.against}`);
  });

  test("overlap renders verdict, shared paths, and reason in order", () => {
    const data = fixture<PlanOverlapData>("overlap-sequence");
    const text = serializePlanOverlapText(data);
    expect(text.startsWith(`verdict=${data.verdict}`)).toBe(true);
    expect(text).toContain("overlapping=");
    expect(text).toContain("reason=");
  });
});
