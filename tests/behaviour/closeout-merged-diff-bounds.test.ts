/** TC-CAP-026 — diff budget and zero source/remote mutation. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { evaluateDiffSweep } from "../../packages/core/src/domain/closeout-diff-sweep";
import {
  CAPSULE_MAX_DIFF_BYTES,
  CAPSULE_MAX_DIFF_FILES,
  CAPSULE_MAX_DIFF_HITS,
} from "../../packages/core/src/contracts/index";
import { makeDiff } from "../fixtures/closeout/diff";

describe("TC-CAP-026 merged-diff budget", () => {
  test("the hit cap truncates with an explicit omitted count", () => {
    const lines = Array.from(
      { length: CAPSULE_MAX_DIFF_HITS + 20 },
      () => "// TODO close-todo GH-183",
    );
    const result = evaluateDiffSweep({ diff: makeDiff(lines), workItemRef: "GH-183" });
    expect(result.hits.length).toBe(CAPSULE_MAX_DIFF_HITS);
    expect(result.truncated).toBe(true);
    expect(result.omitted).toBe(20);
  });

  test("the file and byte caps are marked, never exceeded", () => {
    const result = evaluateDiffSweep({
      diff: makeDiff(["// TODO close-todo GH-183"], CAPSULE_MAX_DIFF_FILES + 5),
      workItemRef: "GH-183",
    });
    expect(result.files).toBe(CAPSULE_MAX_DIFF_FILES);
    const huge = {
      ...makeDiff(["// TODO close-todo GH-183"]),
      text: "x".repeat(CAPSULE_MAX_DIFF_BYTES + 100),
    };
    const bytes = evaluateDiffSweep({ diff: huge, workItemRef: "GH-183" });
    expect(bytes.bytes).toBeLessThanOrEqual(CAPSULE_MAX_DIFF_BYTES);
    expect(bytes.truncated).toBe(true);
  });

  test("the sweep module contains no write, spawn, or remote surface", () => {
    const source = readFileSync("packages/core/src/domain/closeout-diff-sweep.ts", "utf8");
    expect(source.includes("node:")).toBe(false);
    expect(source.includes("child_process")).toBe(false);
    expect(source.includes("writeFile")).toBe(false);
    expect(source.includes("spawn")).toBe(false);
    expect(source.includes("exec(")).toBe(false);
  });
});
