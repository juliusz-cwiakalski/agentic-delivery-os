/**
 * TC-STEER-061 — `steer --help` and `--version` answer at exit 0 from the static
 * inventory with the five declared sections and no side effect.
 */
import { describe, expect, test } from "bun:test";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { bufferSink } from "../golden/helpers";

const run = async (
  argv: readonly string[],
  compose: { readonly calls: number },
): Promise<{ readonly exitCode: number; readonly stdout: string; readonly stderr: string }> => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const exitCode = await runEntrypoint(argv, {
    streams: { stdout, stderr },
    environment: {},
    declaredWorkingName: "example-product",
    composeProgram: () => {
      compose.calls += 1;
      throw new Error("help must not compose the production program");
    },
    clock: { now: () => 1 },
    newRunId: () => "run-steer-help",
    version: "1.2.3",
    build: "deadbeef",
  });
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};

describe("TC-STEER-061 the steer family help is complete and inert", () => {
  test("the family help carries the five sections and every declared verb and flag", async () => {
    const compose = { calls: 0 };
    const help = await run(["steer", "--help"], compose);
    expect(help.exitCode).toBe(0);
    for (const section of ["Usage:", "Options:", "Examples:", "Exit codes:", "See also:"]) {
      expect(help.stdout).toContain(section);
    }
    expect(help.stdout).toContain("steer");
    for (const text of [
      "steer send",
      "steer list",
      "steer read",
      "steer complete",
      "--kind",
      "--priority",
      "--ttl",
      "--ref",
    ]) {
      expect(help.stdout).toContain(text);
    }
    expect(help.stdout).toContain("0  The operation completed");
    expect(help.stdout).toContain("1  The request was refused");
    expect(help.stdout).toContain("2  A platform, state, or provider failure");
    expect(compose.calls).toBe(0);
  });

  test("--version answers with the brand identity and no composition", async () => {
    const compose = { calls: 0 };
    const version = await run(["steer", "--version"], compose);
    expect(version.exitCode).toBe(0);
    expect(version.stdout).toContain("example-product 1.2.3");
    expect(compose.calls).toBe(0);
  });

  test("per-subcommand help is served from the same inventory", async () => {
    const compose = { calls: 0 };
    const send = await run(["steer", "send", "--help"], compose);
    expect(send.exitCode).toBe(0);
    expect(send.stdout).toContain("steer send");
    const read = await run(["steer", "read", "--help"], compose);
    expect(read.exitCode).toBe(0);
    expect(read.stdout).toContain("steer read");
    expect(compose.calls).toBe(0);
  });

  test("the help names no verb outside send, list, read, and complete", async () => {
    const compose = { calls: 0 };
    const help = await run(["steer", "--help"], compose);
    for (const invented of ["steer collect", "steer poll", "steer deliver", "steer ack"]) {
      expect(help.stdout).not.toContain(invented);
    }
  });

  test("read documents zero positionals and complete documents the required --ref", async () => {
    const compose = { calls: 0 };
    const read = await run(["steer", "read", "--help"], compose);
    expect(read.stdout).toContain("example-product steer read");
    expect(read.stdout).not.toContain("steer read <id>");
    const complete = await run(["steer", "complete", "--help"], compose);
    expect(complete.stdout).toContain("example-product steer complete <id> --ref <artifact>");
  });
});
