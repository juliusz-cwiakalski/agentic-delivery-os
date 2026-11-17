/**
 * TC-SUP-096 (help half) — supervise --help and --version answer at exit 0 from
 * the static inventory with the five declared sections and zero side effects,
 * and the help invents no extra invocation form (GH-295 F-1, §4.3 mounting).
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { helpEntryFor, renderHelp } from "../../packages/cli/src/help";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

const SUPERVISE_HELP = helpEntryFor(["supervise"]);

describe("TC-SUP-096 supervise help is complete and inert", () => {
  test("the entry declares summary, usage, options, examples, and a reference page", () => {
    expect(SUPERVISE_HELP).toBeDefined();
    if (SUPERVISE_HELP === undefined) return;
    expect(SUPERVISE_HELP.summary.length).toBeGreaterThan(0);
    expect(SUPERVISE_HELP.usage).toContain("<binary> supervise [--json]");
    expect(SUPERVISE_HELP.examples.length).toBeGreaterThan(0);
    expect(SUPERVISE_HELP.seeAlso).toContain(
      "doc/planning/oss-tooling/milestones/m2/commands/supervise.md",
    );
    // No invocation form beyond the one battery invocation.
    for (const line of SUPERVISE_HELP.usage) {
      expect(line).not.toContain("<subcommand>");
    }
  });

  test("the rendered page carries the five sections and the 0/1/2 exit table", () => {
    if (SUPERVISE_HELP === undefined) throw new Error("supervise help missing");
    const text = renderHelp(SUPERVISE_HELP, SYNTHETIC_BRAND);
    for (const section of ["Usage:", "Options:", "Examples:", "Exit codes:", "See also:"]) {
      expect(text).toContain(section);
    }
    expect(text).toContain("  0  ");
    expect(text).toContain("  1  ");
    expect(text).toContain("  2  ");
  });

  test("--help and --version answer at exit 0 from the static inventory with zero side effects", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "supervise-help-"));
    try {
      const before = readdirSync(scratch);
      let composed = 0;
      const baseOptions = {
        environment: {},
        declaredWorkingName: "example-product",
        version: "9.9.9",
        build: "test",
        composeProgram: () => {
          composed += 1;
          return { commands: {} };
        },
      } as const;
      const stdout = bufferSink();
      const stderr = bufferSink();
      const helpExit = await runEntrypoint(["supervise", "--help"], {
        ...baseOptions,
        streams: { stdout, stderr },
      });
      expect(helpExit).toBe(0);
      expect(stdout.value).toContain("Usage:");
      expect(stdout.value).toContain("Exit codes:");
      const versionStdout = bufferSink();
      const versionExit = await runEntrypoint(["supervise", "--version"], {
        ...baseOptions,
        streams: { stdout: versionStdout, stderr: bufferSink() },
      });
      expect(versionExit).toBe(0);
      expect(versionStdout.value).toContain("9.9.9");
      // Self-description never runs the composer and never touches the tree.
      expect(composed).toBe(0);
      expect(readdirSync(scratch)).toEqual(before);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
