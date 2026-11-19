/**
 * TC-CONTRACT-002 source half (GH-348 NFR-10, AC-F7-2): record, log, and
 * diagnostic hygiene is a property of the source, not only of a scenario run.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const LOOP_SOURCES = [
  "packages/core/src/app/loop-supervisor.ts",
  "packages/core/src/app/loop-session.ts",
  "packages/core/src/app/loop-corroborator.ts",
  "packages/core/src/domain/loop-verdict.ts",
  "packages/core/src/domain/loop-log.ts",
  "packages/core/src/domain/loop-status.ts",
  "packages/core/src/domain/loop-prompt.ts",
  "packages/core/src/state/loop.ts",
  "packages/cli/src/commands/loop.ts",
  "packages/cli/src/output/loop-text.ts",
] as const;

describe("TC-CONTRACT-002 no record, log line, or diagnostic carries forbidden material", () => {
  test("the loop sources name no credential, environment value, model, or seat", () => {
    const forbidden = [
      "process.env",
      "API_KEY",
      "apiKey",
      "SECRET",
      "transcript:",
      "providerPayload",
      "modelName",
      "seatName",
    ];
    const failures: string[] = [];
    for (const file of LOOP_SOURCES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const token of forbidden) {
        if (text.includes(token)) failures.push(`${file}: ${token}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("the evidence corpus is capped at 512 bytes in the source", () => {
    const text = readFileSync(join(ROOT, "packages/core/src/domain/loop-verdict.ts"), "utf8");
    expect(text).toContain("LOOP_MAX_EVIDENCE_BYTES = 512");
    expect(text).toContain("slice(0, LOOP_MAX_EVIDENCE_BYTES)");
  });
});
