/**
 * TC-BOUNDARY-004 — fixture hygiene: no product tokens, fakes only, synthetic
 * brand values, no machine-specific paths or timestamps, valid JSON, no test-named
 * fixtures. A temp-copy mutation proves the detector fires by file and token.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const FIXTURE_ROOT = "tests/fixtures/result";
const SEED_LITERALS = ["a" + "dos", "A" + "DOS_", "~/" + "." + "ad" + "os"];
const PLANTED = /planted-fake-[a-z0-9-]+/g;
const PLANTED_TOKEN = /^planted-fake-[a-z0-9-]+$/;
const ABSOLUTE_PATH = /\/(home|Users)\//;
const TIMESTAMP = /\b20\d\d-\d\d-\d\dT\d\d:\d\d/;

const NEW_TEST_FILES = [
  "tests/golden/envelope-success.test.ts",
  "tests/golden/envelope-failure.test.ts",
  "tests/golden/timing.test.ts",
  "tests/golden/broken-command.test.ts",
  "tests/golden/redaction.test.ts",
  "tests/behaviour/run-cli.test.ts",
  "tests/behaviour/error-classification.test.ts",
  "tests/behaviour/exit-projection.test.ts",
  "tests/structure/result-contract.test.ts",
  "tests/structure/error-table.test.ts",
  "tests/structure/cli-edge-seam.test.ts",
  "tests/structure/result-fixtures.test.ts",
];

const walkFiles = (root: string, relativeDir: string): string[] => {
  const results: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else results.push(next);
    }
  };
  walk(relativeDir);
  return results.sort();
};

export const fixtureHygieneFailures = (root: string, includeTests = true): string[] => {
  const failures: string[] = [];
  const files = walkFiles(root, FIXTURE_ROOT);
  for (const file of files) {
    const text = readFileSync(join(root, file), "utf8");
    for (const seed of SEED_LITERALS) {
      if (text.includes(seed)) failures.push(`${file}: product token ${seed}`);
    }
    if (file.endsWith(".test.ts")) failures.push(`${file}: fixture must not be named *.test.ts`);
    if (ABSOLUTE_PATH.test(text)) failures.push(`${file}: absolute user path`);
    if (TIMESTAMP.test(text)) failures.push(`${file}: wall-clock timestamp`);
    for (const match of text.matchAll(PLANTED)) {
      if (!PLANTED_TOKEN.test(match[0])) failures.push(`${file}: malformed planted token`);
    }
    if (file.endsWith(".json")) {
      try {
        JSON.parse(text);
      } catch {
        failures.push(`${file}: invalid JSON`);
      }
    }
    if (file.endsWith("/injected.json")) {
      const injected = JSON.parse(text) as { brand?: { binaryName?: string } };
      const binaryName = injected.brand?.binaryName;
      if (binaryName !== "example-product") {
        failures.push(`${file}: brand value is not the synthetic fixture`);
      }
    }
  }
  if (includeTests) {
    for (const file of NEW_TEST_FILES) {
      const text = readFileSync(join(root, file), "utf8");
      for (const seed of SEED_LITERALS) {
        if (text.includes(seed)) failures.push(`${file}: product token ${seed}`);
      }
    }
  }
  return failures;
};

describe("TC-BOUNDARY-004 fixture hygiene", () => {
  test("the live fixture tree and new test files are clean", () => {
    expect(fixtureHygieneFailures(ROOT)).toEqual([]);
  });

  test("planted values are obviously fake and match the marker prefix", () => {
    const tokens = new Set<string>();
    for (const file of walkFiles(ROOT, FIXTURE_ROOT)) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const match of text.matchAll(PLANTED)) tokens.add(match[0]);
    }
    expect(tokens.size).toBeGreaterThan(0);
    for (const token of tokens) expect(token).toMatch(PLANTED_TOKEN);
  });

  test("a temp copy with a product token fails naming file and token", () => {
    const root = mkdtempSync(join(tmpdir(), "fixture-hygiene-"));
    const relative = `${FIXTURE_ROOT}/envelopes/success-data/stdout.json`;
    mkdirSync(join(root, `${FIXTURE_ROOT}/envelopes/success-data`), { recursive: true });
    const seed = "a" + "dos";
    writeFileSync(join(root, relative), JSON.stringify({ note: seed }, null, 2));
    try {
      const failures = fixtureHygieneFailures(root, false);
      expect(failures.some((message) => message.includes(relative))).toBe(true);
      expect(failures.some((message) => message.includes(seed))).toBe(true);
    } finally {
      // temp tree is intentionally left for the OS to reap
    }
  });

  test("no fixture file is named like a test", () => {
    for (const file of walkFiles(ROOT, FIXTURE_ROOT)) {
      expect(file.endsWith(".test.ts")).toBe(false);
    }
  });
});
