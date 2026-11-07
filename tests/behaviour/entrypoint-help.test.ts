/**
 * TC-ENTRY-003 — root help lists every command family, the global flags, and a
 * see-also pointer, with no side effect.
 */
import { describe, expect, test } from "bun:test";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
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
});
