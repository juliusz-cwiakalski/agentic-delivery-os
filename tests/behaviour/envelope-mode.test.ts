/**
 * TC-GH223-018 (interactive byte-conformance) and TC-GH223-019 (`--verbose`
 * override, `--pretty` indentation-only, stream line discipline).
 */
import { describe, expect, test } from "bun:test";
import {
  assertEnvelopeContract,
  loadGoldenCases,
} from "../../packages/testkit/src/result-conformance";
import { invocationPayloadsOf, makeAuditStore, removeRoot } from "../fixtures/state/harness";
import { GOLDEN_ROOT, isSingleJsonDocument, runCase } from "../golden/helpers";
import { programFor, runAudited } from "./audit-run-support";

const cases = await loadGoldenCases(GOLDEN_ROOT);
const caseById = (id: string) => {
  const found = cases.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`golden missing: ${id}`);
  return found;
};

const oneLine = (text: string): boolean =>
  text.endsWith("\n") && text.indexOf("\n") === text.length - 1;

describe("TC-GH223-018 interactive mode keeps the M0-S3 envelope", () => {
  test("interactive output is the full envelope and remains audited", async () => {
    const fixture = makeAuditStore("mode-interactive");
    try {
      const run = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-interactive",
        mode: "interactive",
      });
      expect(run.exitCode).toBe(0);
      expect(isSingleJsonDocument(run.stdout)).toBe(true);
      const envelope = JSON.parse(run.stdout) as Record<string, unknown>;
      expect(Object.keys(envelope).sort()).toEqual(
        ["data", "exitCode", "runId", "schemaVersion", "timing"].sort(),
      );
      expect(envelope.runId).toBe("run-interactive");
      expect(assertEnvelopeContract(envelope)).toEqual([]);
      expect(
        invocationPayloadsOf(fixture.store).some((record) => record.runId === "run-interactive"),
      ).toBe(true);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("existing interactive goldens remain byte-identical", async () => {
    for (const id of ["success-data", "classified-user", "broken-unknown-command"]) {
      const testCase = caseById(id);
      const run = await runCase(testCase);
      expect(run.stdout, id).toBe(testCase.stdout);
      expect(run.stderr, id).toBe(testCase.stderr);
      expect(assertEnvelopeContract(JSON.parse(run.stdout) as unknown), id).toEqual([]);
    }
  });

  test("auditing does not perturb the interactive bytes", async () => {
    const fixture = makeAuditStore("mode-interactive-bytes");
    try {
      const testCase = caseById("success-data");
      const baseline = await runCase(testCase);
      const audited = await runAudited(fixture, {
        argv: testCase.argv,
        program: {
          commands: {
            "synthetic.ok": {
              handler: () => ({ data: { message: "all good", count: 2 } }),
            },
          },
        },
        runId: testCase.injected.runId,
        ticks: testCase.injected.ticks,
        mode: "interactive",
      });
      expect(audited.stdout).toBe(baseline.stdout);
    } finally {
      removeRoot(fixture.root);
    }
  });
});

describe("TC-GH223-019 --verbose override and --pretty indentation", () => {
  test("--verbose forces the full envelope in scripted mode", async () => {
    const fixture = makeAuditStore("mode-verbose");
    try {
      const run = await runAudited(fixture, {
        argv: ["--json", "--verbose", "status"],
        program: programFor("success"),
        runId: "run-verbose-scripted",
        mode: "scripted",
      });
      expect(run.exitCode).toBe(0);
      const envelope = JSON.parse(run.stdout) as Record<string, unknown>;
      expect(Object.keys(envelope).sort()).toEqual(
        ["data", "exitCode", "runId", "schemaVersion", "timing"].sort(),
      );
      expect(assertEnvelopeContract(envelope)).toEqual([]);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("--verbose in interactive mode is the same full envelope", async () => {
    const fixture = makeAuditStore("mode-verbose-interactive");
    try {
      const run = await runAudited(fixture, {
        argv: ["--json", "--verbose", "status"],
        program: programFor("classified-user"),
        runId: "run-verbose-interactive",
        mode: "interactive",
      });
      expect(isSingleJsonDocument(run.stdout)).toBe(true);
      expect(assertEnvelopeContract(JSON.parse(run.stdout) as unknown)).toEqual([]);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("--pretty never re-expands a scripted line; with --verbose it indents the full envelope", async () => {
    const fixture = makeAuditStore("mode-pretty");
    try {
      const trimmed = await runAudited(fixture, {
        argv: ["--json", "--pretty", "status"],
        program: programFor("success"),
        runId: "run-pretty-scripted",
        mode: "scripted",
      });
      expect(oneLine(trimmed.stdout)).toBe(true);
      expect(trimmed.stdout).toBe('{"data":{"message":"all good","count":2}}\n');

      const full = await runAudited(fixture, {
        argv: ["--json", "--verbose", "--pretty", "status"],
        program: programFor("success"),
        runId: "run-pretty-full",
        mode: "scripted",
      });
      expect(full.stdout).toContain("\n  ");
      expect(assertEnvelopeContract(JSON.parse(full.stdout) as unknown)).toEqual([]);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("text mode with --pretty is unchanged", async () => {
    const fixture = makeAuditStore("mode-pretty-text");
    try {
      const run = await runAudited(fixture, {
        argv: ["--pretty", "status"],
        program: programFor("classified-user"),
        runId: "run-pretty-text",
        mode: "scripted",
      });
      expect(run.exitCode).toBe(1);
      expect(run.stdout).toBe("");
      expect(run.stderr).toContain("input.value.rejected");
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("the override and pretty flags are accepted by the command program", async () => {
    const fixture = makeAuditStore("mode-flags-accepted");
    try {
      for (const argv of [
        ["--json", "--verbose", "status"],
        ["--json", "--pretty", "status"],
        ["--json", "--verbose", "--pretty", "status"],
      ]) {
        const run = await runAudited(fixture, {
          argv,
          program: programFor("success"),
          runId: `run-flags-${argv.length}`,
          mode: "scripted",
        });
        expect(run.exitCode).toBe(0);
        const envelope = JSON.parse(run.stdout) as { error?: { code?: string } };
        expect(envelope.error?.code).not.toBe("fallback.invocation");
      }
    } finally {
      removeRoot(fixture.root);
    }
  });
});
