/**
 * TC-VOCAB-002 (guard half) — the eight daemon codes are recognized only with
 * their declared kind and every code carries a reachable declared row.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ERROR_TABLE } from "../../packages/core/src/contracts/index";

const DOC = join(process.cwd(), "doc/spec/features/feature-result-contract.md");

describe("GH-238 daemon vocabulary sync", () => {
  test("each daemon code appears in the documented table exactly once", () => {
    const doc = readFileSync(DOC, "utf8");
    for (const row of ERROR_TABLE.filter((entry) => entry.domainKind === "daemon")) {
      expect(doc.split(`| ${row.code} |`).length - 1).toBe(1);
    }
  });

  test("no daemon code exists outside the declared family", () => {
    const daemonRows = ERROR_TABLE.filter((entry) => entry.domainKind === "daemon");
    expect(daemonRows.every((entry) => entry.code.startsWith("daemon."))).toBe(true);
    expect(ERROR_TABLE.filter((entry) => entry.code.startsWith("daemon."))).toHaveLength(8);
  });
});
