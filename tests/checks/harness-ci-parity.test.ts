/**
 * TC-HARN-031 — package wiring and CI parity (the new surface rides the
 * existing jobs; no workflow change is required).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ci = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");

const jobBlock = (name: string): string => {
  const start = ci.indexOf(`  ${name}:`);
  if (start === -1) return "";
  const next = ci.indexOf("\n  ts-", start + 1);
  return ci.slice(start, next === -1 ? undefined : next);
};

describe("TC-HARN-031 wiring and CI parity", () => {
  test("the ts-test job discovers the harness suites through pnpm test", () => {
    const block = jobBlock("ts-test");
    expect(block).toContain("pnpm test");
  });

  test("the boundary job runs the neutral-tier, entrypoint, and secret scans", () => {
    const block = jobBlock("ts-boundaries");
    expect(block).toContain("pnpm check:boundaries");
  });

  test("the invariant jobs cover the forbidden-literal scan", () => {
    expect(jobBlock("ts-forbidden-literals")).toContain(
      "bun run scripts/checks/forbidden-literals.ts",
    );
  });
});
