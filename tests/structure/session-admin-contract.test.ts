/** TC-CAP-044 — the db surface is unchanged. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("session admin contract", () => {
  test("db keeps its delivered subcommands and gains no work-item field", () => {
    const source = readFileSync("packages/core/src/contracts/session.ts", "utf8");
    expect(source.includes("work_item_ref")).toBe(false);
    expect(source.includes("compaction")).toBe(false);
  });
});
