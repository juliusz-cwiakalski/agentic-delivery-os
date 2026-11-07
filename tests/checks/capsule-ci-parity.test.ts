/** TC-CAP-059 — the aggregate gate and CI wiring cover the new suites. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("TC-CAP-059 CI parity", () => {
  test("CI runs the aggregate gate that includes tests and boundaries", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(ci.includes("pnpm check")).toBe(true);
    expect(ci.includes("bun test tests/structure")).toBe(true);
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.check).toContain("pnpm test");
    expect(pkg.scripts.check).toContain("pnpm check:boundaries");
  });
});
