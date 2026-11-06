/**
 * TC-RETRO-011 static half — key-shaped literals are confined to the single
 * allowlisted synthetic key fixture; the scan is live and positive.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkRetroKeyContainment,
  KEY_ALLOWLIST,
} from "../../scripts/checks/retro-key-containment";

const root = process.cwd();
const KEY = `${"0".repeat(63)}1`;

describe("TC-RETRO-011 key containment", () => {
  test("the delivered tree has no key-shaped literal outside the allowlist", () => {
    const report = checkRetroKeyContainment({ root });
    expect(report.failures).toEqual([]);
    expect(report.scanned).toBeGreaterThan(0);
  });

  test("the allowlisted synthetic fixture is the only admitted occurrence", () => {
    const report = checkRetroKeyContainment({
      root,
      roots: ["tests/fixtures/retro"],
    });
    expect(report.failures).toEqual([]);
    expect(report.scanned).toBeGreaterThan(0);
    expect(KEY_ALLOWLIST).toContain("tests/fixtures/retro/key-artifact.json");
  });

  test("a planted key in a record fixture fails naming the file", () => {
    const directory = mkdtempSync(join(tmpdir(), "key-containment-"));
    mkdirSync(join(directory, "tests/fixtures/retro"), { recursive: true });
    writeFileSync(
      join(directory, "tests/fixtures/retro/record.json"),
      JSON.stringify({ keyValue: KEY }),
    );
    const report = checkRetroKeyContainment({
      root: directory,
      roots: ["tests/fixtures"],
    });
    expect(
      report.failures.some((failure) => failure.includes("tests/fixtures/retro/record.json")),
    ).toBe(true);
    expect(report.occurrences).toBe(1);
  });

  test("a planted key in an output golden fails", () => {
    const directory = mkdtempSync(join(tmpdir(), "key-containment-golden-"));
    mkdirSync(join(directory, "tests/golden/retro"), { recursive: true });
    writeFileSync(join(directory, "tests/golden/retro/output.json"), JSON.stringify({ key: KEY }));
    const report = checkRetroKeyContainment({
      root: directory,
      roots: ["tests/golden"],
    });
    expect(
      report.failures.some((failure) => failure.includes("tests/golden/retro/output.json")),
    ).toBe(true);
  });

  test("the allowlisted path stays clean", () => {
    const report = checkRetroKeyContainment({
      root,
      roots: ["tests/fixtures/retro"],
      allowlist: ["tests/fixtures/retro/key-artifact.json"],
    });
    expect(report.failures).toEqual([]);
  });
});
