/**
 * TC-EVT-061 — root help lists nineteen families (the delivered eighteen preserved
 * as a subsequence), the family page renders the five declared sections with the
 * M2 page pointer, both verb pages answer `--help` at exit 0, and `--version`
 * is identity only. No page is held to the reference-surface 40-line rule.
 */
import { describe, expect, test } from "bun:test";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { bufferSink } from "../golden/helpers";

const DELIVERED_FAMILIES = [
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
  "dispatch",
  "spend",
  "retro",
  "daemon",
  "coordinator",
  "projects",
] as const;

const M2_PAGE = "doc/planning/oss-tooling/milestones/m2/commands/events.md";

const run = async (
  argv: readonly string[],
): Promise<{ exitCode: number; stdout: string; stderr: string; composerCalls: number }> => {
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
    newRunId: () => "run-events-help",
  });
  return { exitCode, stdout: stdout.value, stderr: stderr.value, composerCalls };
};

describe("TC-EVT-061 events self-description", () => {
  test("root help lists nineteen families, including events, in content and order", async () => {
    const help = await run(["--help"]);
    expect(help.exitCode).toBe(0);
    const commandsBlock = help.stdout.slice(help.stdout.indexOf("\nCommands:\n"));
    const families = commandsBlock
      .split("\n")
      .filter((line) => /^ {2}\S+ {2}\S/u.test(line))
      .map((line) => (line.trim().split(/\s+/u)[0] ?? "").trim());
    expect(families).toHaveLength(19);
    expect(families).toContain("events");
    // The delivered eighteen remain, in their delivered relative order.
    const positions = DELIVERED_FAMILIES.map((family) => families.indexOf(family));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
    expect(help.stdout).toMatch(/\n {2}events {2}\S/u);
    // Content only: no ANSI escape, and the measured size is recorded for evidence.
    expect(help.stdout).not.toContain("\u001b[");
    console.log(
      `root --help: ${help.stdout.trimEnd().split("\n").length} lines / ${new TextEncoder().encode(help.stdout).length} bytes`,
    );
    expect(help.composerCalls).toBe(0);
  });

  test("events --help renders the five sections and the M2 see-also pointer", async () => {
    const help = await run(["events", "--help"]);
    expect(help.exitCode).toBe(0);
    for (const section of ["Usage:", "Options:", "Examples:", "Exit codes:", "See also:"]) {
      expect(help.stdout).toContain(section);
    }
    expect(help.stdout).toContain(M2_PAGE);
    expect(help.stdout).toContain("list");
    expect(help.stdout).toContain("describe");
    expect(help.stdout).toContain("--json");
    const exitSection = help.stdout.slice(help.stdout.indexOf("Exit codes:"));
    for (const code of ["0", "1", "2"]) expect(exitSection).toContain(`  ${code}  `);
    expect(help.stdout).not.toContain(" 3  ");
    expect(help.composerCalls).toBe(0);
  });

  test("both verb pages answer --help at exit 0 with their own usage", async () => {
    for (const verb of ["list", "describe"]) {
      const help = await run(["events", verb, "--help"]);
      expect(help.exitCode, verb).toBe(0);
      expect(help.stdout).toContain(`events ${verb}`);
      expect(help.stdout).not.toContain("unknown flag");
      expect(help.stdout).not.toContain("unknown argument");
      expect(help.stdout).not.toContain("\u001b[");
      expect(help.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(120);
      expect(new TextEncoder().encode(help.stdout).length).toBeLessThanOrEqual(4_000);
    }
  });

  test("--version is identity only and composes nothing", async () => {
    const version = await run(["--version"]);
    expect(version.exitCode).toBe(0);
    expect(version.stdout).toContain("example-product");
    expect(version.stdout).not.toContain("events  ");
    expect(version.composerCalls).toBe(0);
  });

  test("every events help page is inside the family bound and has no ANSI escape", async () => {
    for (const argv of [
      ["events", "--help"],
      ["events", "list", "--help"],
      ["events", "describe", "--help"],
    ]) {
      const help = await run(argv);
      expect(help.stdout.trimEnd().split("\n").length, argv.join(" ")).toBeLessThanOrEqual(120);
      expect(new TextEncoder().encode(help.stdout).length, argv.join(" ")).toBeLessThanOrEqual(
        4_000,
      );
      expect(help.stdout).not.toContain("\u001b[");
    }
  });
});
