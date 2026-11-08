/** TC-CAP-044 — no invented harness compaction API and no db change. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("TC-CAP-044 compaction absence", () => {
  test("the closeout domain names the gap and imports no compaction API", () => {
    const source = readFileSync("packages/core/src/domain/closeout.ts", "utf8");
    expect(source.includes("harness-compaction-unavailable")).toBe(true);
    expect(source.includes("compactSession")).toBe(false);
    expect(source.includes("compaction(")).toBe(false);
    const db = readFileSync("packages/core/src/contracts/session.ts", "utf8");
    expect(db.includes("compact")).toBe(false);
  });
});
