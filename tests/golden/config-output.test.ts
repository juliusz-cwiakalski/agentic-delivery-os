/**
 * TC-CONFIG-018/019 — config human goldens and the single GH-172 envelope.
 * All bytes are asserted through injected sinks and testkit conformance.
 */
import { describe, expect, test } from "bun:test";
import { assertEnvelopeContract } from "@delivery-os/testkit";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";

const REPO = "/repo";
const HOME = "/home/synthetic";

const bufferSink = (): { write: (chunk: string) => void; readonly value: string } => {
  let text = "";
  return {
    write: (chunk: string) => {
      text += chunk;
    },
    get value() {
      return text;
    },
  };
};

const run = async (args: readonly string[]) => {
  const built = createConfigProgram({
    workingName: "synthetic",
    environment: {},
    cwd: "/work",
    homeDirectory: HOME,
    platform: "linux",
    fs: { exists: () => false, readText: () => "" },
    repositoryIo: { exists: () => false, isFile: () => false, readText: () => "" },
  });
  if (!built.ok) throw new Error("fixture brand failed");
  const stdout = bufferSink();
  const stderr = bufferSink();
  let tick = 0;
  const deps: CliDependencies = {
    brand: built.brand,
    clock: {
      now: () => {
        const value = tick === 0 ? 1000 : 1007;
        tick += 1;
        return value;
      },
    },
    newRunId: () => "run-config-golden",
    secrets: built.secrets,
    program: built.program,
  };
  const exitCode = await runCli(["config", ...args], { stdout, stderr }, deps);
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};

const singleDocument = (text: string): unknown => {
  expect(text.endsWith("\n")).toBe(true);
  return JSON.parse(text);
};

describe("config human goldens", () => {
  test("empty production basic is exactly a plain tree", async () => {
    const result = await run(["--project-root", REPO]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("{}\n");
    expect(result.stderr).toBe("");
  });

  test("empty production debug has exactly the contracted keys and skipped evidence", async () => {
    const result = await run(["debug", "--project-root", REPO]);
    expect(result.exitCode).toBe(0);
    expect(singleDocument(result.stdout)).toEqual({
      config: {},
      origins: {},
      loadedFiles: [],
      skippedLayers: [
        { layer: "system", reason: "missing" },
        { layer: "user-global", reason: "missing" },
        { layer: "project-committed", reason: "missing" },
        { layer: "project-local", reason: "missing" },
      ],
    });
  });
});

describe("config machine envelope", () => {
  test("basic and debug machine payloads equal the human payloads", async () => {
    for (const [humanArgs, machineArgs] of [
      [[], ["--json"]],
      [["debug"], ["debug", "--json"]],
    ] as const) {
      const human = await run([...humanArgs, "--project-root", REPO]);
      const machine = await run([...machineArgs, "--project-root", REPO]);
      expect(machine.exitCode).toBe(0);
      const envelope = singleDocument(machine.stdout) as {
        data: unknown;
        error?: unknown;
      };
      expect(envelope.data).toEqual(singleDocument(human.stdout));
      expect(envelope).not.toHaveProperty("error");
      expect(assertEnvelopeContract(envelope)).toEqual([]);
      expect(machine.stderr).toBe("");
    }
  });

  test("a config failure emits one error envelope and no partial data", async () => {
    const result = await run(["get", "missing.key", "--json", "--project-root", REPO]);
    expect(result.exitCode).toBe(1);
    const envelope = singleDocument(result.stdout) as {
      data?: unknown;
      error?: { code: string; category: string; retryable: boolean };
    };
    expect(envelope).not.toHaveProperty("data");
    expect(envelope.error).toMatchObject({
      code: "config.key.unknown",
      category: "user",
      retryable: false,
    });
    expect(assertEnvelopeContract(envelope)).toEqual([]);
    expect(result.stderr).toContain("config.key.unknown");
  });
});
