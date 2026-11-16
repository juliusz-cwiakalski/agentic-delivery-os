/**
 * TC-ENTRY-003 — root help lists every command family, the global flags, and a
 * see-also pointer, with no side effect.
 */
import { describe, expect, test } from "bun:test";
import { PROMPT_REQUIRED_COMMANDS, runEntrypoint } from "../../packages/cli/src/entrypoint";
import { countingComposer } from "../fixtures/entrypoint/programs";
import { bufferSink } from "../golden/helpers";

const rootHelp = async () => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const composer = countingComposer();
  const exitCode = await runEntrypoint(["--help"], {
    streams: { stdout, stderr },
    environment: {},
    configuredWorkingName: "example-product",
    composeProgram: composer.composeProgram,
    clock: { now: () => 1 },
    newRunId: () => "run-help",
  });
  return { exitCode, stdout: stdout.value, stderr: stderr.value, composeCalls: composer.calls() };
};

describe("TC-ENTRY-003 root help", () => {
  test("lists every prompt-required family and the global flags", async () => {
    const run = await rootHelp();
    expect(run.exitCode).toBe(0);
    for (const family of [
      "status",
      "brief",
      "queue",
      "lanes",
      "blockers",
      "phase",
      "commit",
      "lint",
      "plan",
      "verify",
      "merge",
      "closeout",
      "spend",
      "retro",
      "daemon",
    ]) {
      expect(run.stdout).toContain(`  ${family}  `);
    }
    expect(run.stdout).toContain("--help");
    expect(run.stdout).toContain("--version");
    expect(run.stdout).toContain("--json");
  });

  test("renders the five declared sections and a see-also pointer", async () => {
    const run = await rootHelp();
    for (const section of ["Usage:", "Options:", "Examples:", "Exit codes:", "See also:"]) {
      expect(run.stdout).toContain(section);
    }
    expect(run.stdout).toContain("man-page.md");
    expect(run.stdout).toContain("commands/entrypoint.md");
  });

  test("no composer or stream-write side effect occurs", async () => {
    const run = await rootHelp();
    expect(run.composeCalls).toBe(0);
    expect(run.stderr).toBe("");
  });

  test("TC-XREV-005: no review command family is added", async () => {
    const run = await rootHelp();
    expect(run.stdout).not.toContain("  review  ");
    expect(run.stdout).not.toContain("  reviews  ");
    expect(run.stdout).toContain("  verify  ");
  });
});

describe("TC-ENTRY-003 command-scoped version containment (review iter-1 F-2)", () => {
  const run = async (argv: readonly string[]) => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    const composer = countingComposer();
    const exitCode = await runEntrypoint(argv, {
      streams: { stdout, stderr },
      environment: {},
      configuredWorkingName: "example-product",
      composeProgram: composer.composeProgram,
      clock: { now: () => 1 },
      newRunId: () => "run-version",
    });
    return { exitCode, stdout: stdout.value, composeCalls: composer.calls() };
  };

  test("every known family answers --version without composing", async () => {
    for (const family of PROMPT_REQUIRED_COMMANDS) {
      const result = await run([family, "--version"]);
      expect(result.exitCode, family).toBe(0);
      expect(result.composeCalls, family).toBe(0);
      expect(result.stdout, family).toContain("example-product");
      expect(result.stdout, family).not.toContain("Usage:");
    }
  });

  test("an unknown leading command is never answered as a version", async () => {
    const result = await run(["notacommand", "--version", "--json"]);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain("fallback.internal");
    expect(result.stdout).not.toContain("example-product 0.0.0");
  });
});
