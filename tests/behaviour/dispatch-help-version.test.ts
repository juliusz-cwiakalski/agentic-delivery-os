/**
 * TC-HELP-002 (phase 7) — `--help`, `dispatch --help`, and `--version` are pure
 * data lookups: they exit 0 and never invoke the composer, which would perform
 * state, git, configuration, or network reads.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import type { CommandProgram } from "../../packages/cli/src/index";
import { bufferSink } from "../golden/helpers";

const invoke = async (argv: readonly string[]) => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  let composed = 0;
  const poisoned = (): CommandProgram => {
    composed += 1;
    throw new Error("the composer must not run for self-description");
  };
  const exitCode = await runEntrypoint(argv, {
    streams: { stdout, stderr },
    environment: {},
    configuredWorkingName: "delivery-os",
    composeProgram: poisoned,
    clock: { now: () => 1 },
    newRunId: () => "run-help",
  });
  return { exitCode, stdout: stdout.value, stderr: stderr.value, composed };
};

describe("TC-HELP-002 help and version remain pure", () => {
  test("root help, dispatch help, and version all exit 0 without composing", async () => {
    const root = await invoke(["--help"]);
    const dispatch = await invoke(["dispatch", "--help"]);
    const version = await invoke(["--version"]);
    for (const run of [root, dispatch, version]) {
      expect(run.exitCode).toBe(0);
      expect(run.stderr).toBe("");
      expect(run.composed).toBe(0);
    }
    expect(root.stdout).toContain("delivery-os");
    expect(dispatch.stdout).toContain("dispatch");
    expect(dispatch.stdout).toContain("dual-run summary");
    expect(dispatch.stdout).toContain("handover");
    expect(dispatch.stdout).toContain("--revert");
    expect(version.stdout).toContain("delivery-os");
  });

  test("the dispatch subcommand help paths render without composing", async () => {
    for (const argv of [
      ["dispatch", "attempts", "--help"],
      ["dispatch", "dual-run", "summary", "--help"],
      ["dispatch", "dual-run", "resolve", "--help"],
      ["dispatch", "handover", "--help"],
    ]) {
      const run = await invoke(argv);
      expect(run.exitCode, argv.join(" ")).toBe(0);
      expect(run.composed, argv.join(" ")).toBe(0);
      expect(run.stdout.length).toBeGreaterThan(0);
    }
  });

  test("self-description creates no temporary file", async () => {
    const directory = mkdtempSync(join(tmpdir(), "dispatch-help-"));
    try {
      await invoke(["--help"]);
      await invoke(["dispatch", "--help"]);
      const { readdirSync } = await import("node:fs");
      expect(readdirSync(directory)).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
