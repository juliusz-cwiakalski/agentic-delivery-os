/**
 * GH-289 TC-ATTEMPT-038 — one divergence-count computation, two consumers, zero
 * second fold and zero list-length derivation.
 *
 * The structural half names the single home and its consumers; the behavioural
 * half proves the exact count equals the open-record count, not the truncated
 * identifier list's length.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { summarizeRepositoryDivergences } from "../../packages/core/src/domain/dispatch-gate";
import { openDivergences, withHistory } from "../fixtures/dispatch/attempt-records";
import { REPOSITORY } from "../fixtures/dispatch/ledger";

const ROOT = process.cwd();
/** The retired helper's name; it must not survive in any source file. */
const DEPRECATED_COUNT_HELPER = "summarizeDispatchDivergences";
const DOMAIN = "packages/core/src/domain/dispatch-gate.ts";
const APP = "packages/core/src/app/dispatch-gate.ts";

const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

describe("TC-ATTEMPT-038 one computation, two consumers", () => {
  test("the computation is declared once in the domain tier", () => {
    const domain = read(DOMAIN);
    const declarations = domain.match(/export const summarizeRepositoryDivergences/gu) ?? [];
    expect(declarations).toHaveLength(1);
    // Both consumers name it, and neither folds divergences for a count.
    expect(read(APP).includes("summarizeRepositoryDivergences")).toBe(true);
    expect(domain.includes("summarizeRepositoryDivergences(input.divergences")).toBe(true);
  });

  test("the retired list-length helper is absent from every source file", () => {
    expect(DEPRECATED_COUNT_HELPER).toBe("summarizeDispatchDivergences");
    for (const path of [
      "packages/core/src/app/dispatch-ledger.ts",
      "packages/core/src/app/index.ts",
      "packages/core/src/index.ts",
      DOMAIN,
      APP,
    ]) {
      expect(read(path).includes(DEPRECATED_COUNT_HELPER)).toBe(false);
    }
  });

  test("no surface derives unresolved from the truncated identifier list", () => {
    for (const path of [DOMAIN, APP]) {
      const text = read(path);
      expect(text).not.toContain("unresolved: unresolvedIds.length");
      expect(text).not.toContain("folded.length - unresolvedIds.length");
      expect(text).not.toContain("resolved: folded.length - unresolvedIds.length");
    }
  });
});

describe("TC-ATTEMPT-038 the exact count is not the list's length", () => {
  test("25 open reports 25 while returning 20 identifiers", () => {
    const block = summarizeRepositoryDivergences(openDivergences(25), REPOSITORY);
    expect(block.unresolved).toBe(25);
    expect(block.unresolvedIds).toHaveLength(20);
    expect(block.idsTruncated).toBe(true);
    expect(block.reported).toBe(25);
    expect(block.resolved).toBe(0);
  });

  test("below the bound every identifier returns with idsTruncated false", () => {
    const block = summarizeRepositoryDivergences(openDivergences(3), REPOSITORY);
    expect(block.unresolved).toBe(3);
    expect(block.unresolvedIds).toHaveLength(3);
    expect(block.idsTruncated).toBe(false);
  });

  test("the fold reports one identifier open after a resolved-then-open history", () => {
    const block = summarizeRepositoryDivergences(withHistory("DIV-FOLD"), REPOSITORY);
    expect(block.reported).toBe(1);
    expect(block.resolved).toBe(0);
    expect(block.unresolved).toBe(1);
    expect(block.unresolvedIds).toEqual(["DIV-FOLD"]);
  });
});
