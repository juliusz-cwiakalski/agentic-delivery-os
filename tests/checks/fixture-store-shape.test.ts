/**
 * TC-HARNESS-025 / DM-10 (DDL half) — every fixture store is shaped by the
 * observed contract, and a forbidden column's reappearance fails the suite.
 *
 * This is the executable form of the spec's observed-shape metric.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const FIXTURE_FILES = [
  "tests/fixtures/harness/opencode-store/current-generation.ts",
  "tests/fixtures/harness/opencode-store/legacy-generation.ts",
  "tests/fixtures/harness/opencode-store/build.ts",
];

const FORBIDDEN = [
  "work_item_ref",
  "harness_version",
  "input_tokens",
  "output_tokens",
  "reasoning_tokens",
  "cache_read_tokens",
  "cache_write_tokens",
] as const;

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

describe("TC-HARNESS-025 fixture store shape", () => {
  test("no fixture DDL or builder declares a work-item or harness-version column", () => {
    for (const file of FIXTURE_FILES) {
      const text = read(file);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toContain("work_item_ref");
      expect(text).not.toContain("harness_version");
    }
  });

  test("token counts are session-row columns, never per-message columns", () => {
    const messageDdl = `${read("tests/fixtures/harness/opencode-store/current-generation.ts")}\n${read("tests/fixtures/harness/opencode-store/legacy-generation.ts")}`;
    const messageBlocks = messageDdl.includes("CREATE TABLE session_message")
      ? messageDdl.slice(
          messageDdl.indexOf("CREATE TABLE session_message"),
          messageDdl.indexOf("CREATE TABLE session_part"),
        )
      : "";
    expect(messageBlocks.length).toBeGreaterThan(0);
    for (const forbidden of FORBIDDEN) {
      expect(messageBlocks).not.toContain(forbidden);
    }
  });

  test("no fixture queries `part(tool ...)` or invents a populated tool source", () => {
    for (const file of FIXTURE_FILES) {
      const text = read(file);
      expect(text).not.toMatch(/part\s*\(\s*tool/iu);
      expect(text).not.toContain("INSERT INTO part (id, message_id, session_id, tool");
    }
  });

  test("the message JSON carries content only as a privacy canary, never projected", () => {
    const builder = read("tests/fixtures/harness/opencode-store/build.ts");
    expect(builder).toContain("PRIVACY-CANARY");
    // The extractor is not part of the fixture; content exists only in the store.
    const extractor = read("packages/adapters/src/harness/telemetry-opencode.ts");
    expect(extractor).not.toContain("data.content");
    expect(extractor).not.toContain("json_extract");
  });
});
