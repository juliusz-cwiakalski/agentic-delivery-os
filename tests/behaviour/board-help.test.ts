/**
 * TC-BOARD-041 — `board --help` answers at exit 0 from the static inventory with
 * the five declared sections, and `--version` is identity only (AC-F7-1, F-7).
 */
import { describe, expect, test } from "bun:test";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { syntheticPromptProgram } from "../fixtures/entrypoint/programs";
import { bufferSink } from "../golden/helpers";

const M2_PAGE = "doc/planning/oss-tooling/milestones/m2/commands/board.md";

const run = async (argv: readonly string[]) => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  let composerCalls = 0;
  const exitCode = await runEntrypoint(argv, {
    streams: { stdout, stderr },
    environment: {},
    configuredWorkingName: "example-product",
    composeProgram: () => {
      composerCalls += 1;
      throw new Error("help and version must not compose a program");
    },
    clock: { now: () => 1 },
    newRunId: () => "run-board-help",
  });
  return { exitCode, stdout: stdout.value, stderr: stderr.value, composerCalls };
};

describe("TC-BOARD-041 board help", () => {
  test("board --help renders the five sections and the M2 page pointer", async () => {
    const result = await run(["board", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.composerCalls).toBe(0);
    for (const heading of ["Usage:", "Options:", "Examples:", "Exit codes:", "See also:"]) {
      expect(result.stdout).toContain(heading);
    }
    expect(result.stdout).toContain("--all");
    expect(result.stdout).toContain("--project <key>");
    expect(result.stdout).toContain(M2_PAGE);
    expect(result.stdout).toContain("0  ");
    expect(result.stdout).toContain("1  ");
    expect(result.stdout).toContain("2  ");
  });

  test("board --version answers identity only", async () => {
    const result = await run(["board", "--version"]);
    expect(result.exitCode).toBe(0);
    expect(result.composerCalls).toBe(0);
    expect(result.stdout).toContain("example-product");
    expect(result.stdout.toLowerCase()).not.toContain("usage:");
  });

  test("an unknown leading command keeps its classified containment failure", async () => {
    const result = await run(["notacommand", "--version", "--json"]);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain("fallback.internal");
    expect(result.stdout).toContain("is not part of the composed prompt-required set");
    expect(result.stdout).not.toContain("example-product 0.0.0");
  });

  test("a positional alongside --version keeps fallback.invocation at exit 1", async () => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    const exitCode = await runEntrypoint(["board", "positional", "--version", "--json"], {
      streams: { stdout, stderr },
      environment: {},
      configuredWorkingName: "example-product",
      composeProgram: () => syntheticPromptProgram(),
      clock: { now: () => 1 },
      newRunId: () => "run-board-version-positional",
    });
    expect(exitCode).toBe(1);
    expect(stdout.value).toContain("fallback.invocation");
    expect(stdout.value).not.toContain("example-product 0.0.0");
  });

  test("root help lists board among exactly twenty-two families", async () => {
    const result = await run(["--help"]);
    expect(result.exitCode).toBe(0);
    const families = result.stdout
      .split("\n")
      .filter((line) => /^ {2}[a-z][a-z0-9-]* {2}/u.test(line));
    expect(families).toHaveLength(23);
    expect(families.some((line) => line.trimStart().startsWith("board  "))).toBe(true);
  });
});
