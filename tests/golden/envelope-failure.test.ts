/**
 * TC-RESULT-003 / TC-CONTAIN-002 — classified failures project table entries,
 * keep timing, and never leak stack traces or raw diagnostics on stdout.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ERROR_TABLE, type ErrorTableEntry } from "../../packages/core/src/contracts/index";
import {
  assertEnvelopeContract,
  loadGoldenCases,
} from "../../packages/testkit/src/result-conformance";
import { GOLDEN_ROOT, hasStackLeak, isSingleJsonDocument, ROOT, runCase } from "./helpers";

const entries = ERROR_TABLE as readonly ErrorTableEntry[];
const cases = await loadGoldenCases(GOLDEN_ROOT);
const failureCases = cases.filter((entry) =>
  ["classified-user", "classified-platform", "unknown-failure"].includes(entry.id),
);

const mutateSerializer = async (
  suffixSource: string,
): Promise<{
  serializeEnvelope: (envelope: unknown, secrets: readonly string[]) => string;
}> => {
  const directory = mkdtempSync(join(tmpdir(), "serializer-mutant-"));
  const target = join(directory, "mutant.ts");
  const live = pathToFileURL(join(ROOT, "packages/cli/src/output/serialize.ts")).href;
  writeFileSync(
    target,
    `import { serializeEnvelope as base } from ${JSON.stringify(live)};\n` +
      `export const serializeEnvelope = (envelope: unknown, secrets: readonly string[]): string =>\n` +
      `  base(envelope as never, secrets) + ${JSON.stringify(suffixSource)};\n`,
  );
  return import(`${pathToFileURL(target).href}?v=${Date.now()}`) as Promise<{
    serializeEnvelope: (envelope: unknown, secrets: readonly string[]) => string;
  }>;
};

describe("TC-RESULT-003 classified-failure goldens", () => {
  test("classified cases are discovered", () => {
    expect(failureCases.map((entry) => entry.id)).toEqual([
      "classified-platform",
      "classified-user",
      "unknown-failure",
    ]);
  });

  for (const testCase of failureCases) {
    test(`${testCase.id} projects the table entry and exit code`, async () => {
      const run = await runCase(testCase);
      expect(run.stdout).toBe(testCase.stdout);
      expect(run.stderr).toBe(testCase.stderr);
      expect(isSingleJsonDocument(run.stdout)).toBe(true);
      const envelope = JSON.parse(run.stdout) as {
        exitCode: number;
        error: { code: string; category: string; retryable: boolean; consequence: string };
      };
      expect(envelope.exitCode).toBe(run.exitCode);
      expect([0, 1, 2]).toContain(envelope.exitCode);
      const entry = entries.find((candidate) => candidate.code === envelope.error.code);
      expect(entry).toBeDefined();
      if (entry === undefined) return;
      expect(envelope.error.category).toBe(entry.category);
      expect(envelope.error.retryable).toBe(entry.retryable);
      expect(envelope.error.consequence).toBe(entry.consequence);
      expect(assertEnvelopeContract(envelope)).toEqual([]);
    });
  }
});

describe("TC-CONTAIN-002 no diagnostics on the machine channel", () => {
  test("failure stdout contains no stack markers, absolute paths, or raw messages", () => {
    for (const testCase of failureCases) {
      expect(hasStackLeak(testCase.stdout), testCase.id).toBe(false);
      expect(testCase.stdout).not.toContain("/home/");
      expect(testCase.stdout).not.toContain("planted-fake-");
      expect(testCase.stderr).not.toContain('"schemaVersion"');
    }
  });

  test("a temp-copy serializer appending a stack is detected", async () => {
    const mutant = await mutateSerializer("  at leaked.ts:1\n");
    const sample = failureCases[0];
    if (sample === undefined) throw new Error("failure golden is missing");
    const leaked = mutant.serializeEnvelope(JSON.parse(sample.stdout), []);
    expect(hasStackLeak(leaked)).toBe(true);
  });

  test("vacuity control: the live serializer never emits a stack marker", () => {
    for (const testCase of failureCases) {
      expect(readFileSync(join(GOLDEN_ROOT, testCase.id, "stdout.json"), "utf8")).not.toContain(
        " at ",
      );
    }
  });
});
