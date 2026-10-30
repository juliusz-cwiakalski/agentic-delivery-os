/**
 * TC-CONTAIN-001 / TC-CONTAIN-003 / TC-RUNCLI-003 — broken invocations and
 * hostile handler bodies still produce one valid envelope; the machine channel
 * stays clean and single-pass.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadGoldenCases } from "../../packages/testkit/src/result-conformance";
import {
  bufferSink,
  GOLDEN_ROOT,
  hasStackLeak,
  isSingleJsonDocument,
  ROOT,
  runCase,
  runDescriptor,
} from "./helpers";

const cases = await loadGoldenCases(GOLDEN_ROOT);
const brokenCases = cases.filter((entry) => entry.id.startsWith("broken-"));

const mutateWriteOutput = async (): Promise<{
  writeOutput: (
    streams: {
      stdout: { write: (chunk: string) => void };
      stderr: { write: (chunk: string) => void };
    },
    envelope: unknown,
    diagnostic: string | undefined,
    secrets: readonly string[],
    emitEnvelope: boolean,
  ) => void;
}> => {
  const directory = mkdtempSync(join(tmpdir(), "serializer-partial-"));
  const target = join(directory, "mutant.ts");
  const live = pathToFileURL(join(ROOT, "packages/cli/src/output/serialize.ts")).href;
  writeFileSync(
    target,
    `import { writeOutput as base } from ${JSON.stringify(live)};\n` +
      `export const writeOutput = (streams: any, envelope: any, diagnostic: any, secrets: any, emit: boolean): void => {\n` +
      `  streams.stdout.write('{"partial":true}\\n');\n` +
      `  base(streams, envelope, diagnostic, secrets, emit);\n` +
      `};\n`,
  );
  return import(`${pathToFileURL(target).href}?v=${Date.now()}`) as Promise<{
    writeOutput: (
      streams: {
        stdout: { write: (chunk: string) => void };
        stderr: { write: (chunk: string) => void };
      },
      envelope: unknown,
      diagnostic: string | undefined,
      secrets: readonly string[],
      emitEnvelope: boolean,
    ) => void;
  }>;
};

describe("TC-CONTAIN-001 broken-invocation goldens", () => {
  test("all four broken shapes are discovered", () => {
    expect(brokenCases.map((entry) => entry.id).sort()).toEqual([
      "broken-conflicting-flags",
      "broken-missing-value",
      "broken-unknown-command",
      "broken-unknown-flag",
    ]);
  });

  for (const testCase of brokenCases) {
    test(`${testCase.id} emits fallback.invocation with exit 1`, async () => {
      const run = await runCase(testCase);
      expect(run.exitCode).toBe(1);
      expect(run.stdout).toBe(testCase.stdout);
      expect(run.stderr).toBe(testCase.stderr);
      expect(isSingleJsonDocument(run.stdout)).toBe(true);
      const envelope = JSON.parse(run.stdout) as {
        exitCode: number;
        timing: unknown;
        error: {
          code: string;
          category: string;
          retryable: boolean;
          consequence: string;
          remediationHint: string;
        };
      };
      expect(envelope.exitCode).toBe(1);
      expect(envelope.timing).toBeDefined();
      expect(envelope.error).toMatchObject({
        code: "fallback.invocation",
        category: "user",
        retryable: false,
        consequence: "unknown",
      });
      expect(envelope.error.remediationHint.length).toBeGreaterThan(0);
      expect(hasStackLeak(run.stdout)).toBe(false);
      expect(run.stderr.length).toBeGreaterThan(0);
    });
  }
});

describe("TC-CONTAIN-003 hostile handler bodies", () => {
  const hostileIds = [
    "sync-throw",
    "thrown-non-Error",
    "rejected-promise",
    "throw-after-partial-assembly",
    "malformed-result",
  ];

  for (const id of hostileIds) {
    test(`${id} is contained by fallback.internal with exit 2`, async () => {
      const run = await runDescriptor(
        id,
        ["--json", "synthetic.ok"],
        [1000, 1005],
        `run-hostile-${id}`,
      );
      expect(run.exitCode).toBe(2);
      expect(isSingleJsonDocument(run.stdout)).toBe(true);
      const envelope = JSON.parse(run.stdout) as {
        exitCode: number;
        error: { code: string; category: string };
      };
      expect(envelope.exitCode).toBe(2);
      expect(envelope.error.code).toBe("fallback.internal");
      expect(envelope.error.category).toBe("platform");
      expect(hasStackLeak(run.stdout)).toBe(false);
      expect(run.stdout).not.toContain("planted-fake-");
      expect(run.stderr).not.toContain('"schemaVersion"');
    });
  }

  test("containment is deterministic on the hostile path", async () => {
    const first = await runDescriptor("sync-throw", ["--json", "synthetic.ok"], [1, 2], "run-1");
    const second = await runDescriptor("sync-throw", ["--json", "synthetic.ok"], [1, 2], "run-1");
    expect(second).toEqual(first);
  });

  test("a partial-write serializer corrupts the machine channel detectably", async () => {
    const mutant = await mutateWriteOutput();
    const stdout = bufferSink();
    const stderr = bufferSink();
    mutant.writeOutput(
      { stdout, stderr },
      {
        schemaVersion: "delivery.result.v1",
        runId: "run-partial",
        exitCode: 0,
        timing: { totalMs: 1 },
        data: {},
      },
      undefined,
      [],
      true,
    );
    expect(isSingleJsonDocument(stdout.value)).toBe(false);
  });
});

describe("TC-RUNCLI-003 channel split", () => {
  test("every golden keeps the envelope on stdout and diagnostics on stderr", () => {
    for (const testCase of cases) {
      expect(isSingleJsonDocument(testCase.stdout), testCase.id).toBe(true);
      expect(testCase.stderr).not.toContain('"schemaVersion"');
      expect(testCase.stderr).not.toContain('"runId"');
      expect(testCase.stdout).not.toMatch(/^error: /m);
      expect(testCase.stdout).not.toMatch(/^example-product: /m);
    }
  });

  test("dropping stderr leaves stdout valid and the exit code unchanged", async () => {
    for (const testCase of brokenCases) {
      const run = await runCase(testCase);
      expect(isSingleJsonDocument(run.stdout)).toBe(true);
      expect(run.exitCode).toBe(1);
    }
  });

  test("non-json success writes nothing and returns 0", async () => {
    const run = await runDescriptor("ok-data", ["synthetic.ok"], [1, 4], "run-plain");
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe("");
    expect(run.stderr).toBe("");
  });

  test("non-json failure returns its exit code and uses only the error stream", async () => {
    const run = await runDescriptor("classified-user", ["synthetic.ok"], [1, 4], "run-plain-fail");
    expect(run.exitCode).toBe(1);
    expect(run.stdout).toBe("");
    expect(run.stderr).toContain("input.value.rejected");
  });
});
