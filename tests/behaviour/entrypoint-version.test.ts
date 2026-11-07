/**
 * TC-ENTRY-001/002 — `--version` renders the injected identity with no side
 * effects, and the configured/override/neutral precedence introduces no seed
 * literal.
 */
import { describe, expect, test } from "bun:test";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { countingComposer, syntheticPromptProgram } from "../fixtures/entrypoint/programs";
import { bufferSink } from "../golden/helpers";

const versionRun = async (options: {
  readonly configuredWorkingName?: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly composeCalls?: () => number;
}) => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const composer = countingComposer();
  const exitCode = await runEntrypoint(["--version"], {
    streams: { stdout, stderr },
    environment: options.environment ?? {},
    ...(options.configuredWorkingName === undefined
      ? {}
      : { configuredWorkingName: options.configuredWorkingName }),
    composeProgram: composer.composeProgram,
    version: "1.2.3",
    build: "build-abc",
    clock: { now: () => 1 },
    newRunId: () => "run-version",
  });
  return { exitCode, stdout: stdout.value, stderr: stderr.value, composeCalls: composer.calls() };
};

describe("TC-ENTRY-001 version identity", () => {
  test("renders the injected binary identity, version, and build with exit 0", async () => {
    const run = await versionRun({ configuredWorkingName: "example-product" });
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("example-product");
    expect(run.stdout).toContain("1.2.3");
    expect(run.stdout).toContain("build-abc");
    expect(run.stderr).toBe("");
    expect(run.composeCalls).toBe(0);
  });

  test("the composer is never invoked, so no state/network/git port is touched", async () => {
    let touched = 0;
    const stdout = bufferSink();
    const stderr = bufferSink();
    const exitCode = await runEntrypoint(["--version"], {
      streams: { stdout, stderr },
      environment: {},
      configuredWorkingName: "example-product",
      composeProgram: () => {
        touched += 1;
        return syntheticPromptProgram();
      },
    });
    expect(exitCode).toBe(0);
    expect(touched).toBe(0);
  });
});

describe("TC-ENTRY-002 identity precedence", () => {
  test("the configured name renders when no override is present", async () => {
    const run = await versionRun({ configuredWorkingName: "configured-product" });
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("configured-product");
  });

  test("a non-empty DELIVERY_OS_WORKING_NAME override wins over the configured name", async () => {
    const run = await versionRun({
      configuredWorkingName: "configured-product",
      environment: { DELIVERY_OS_WORKING_NAME: "alt-product" },
    });
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("alt-product");
    expect(run.stdout).not.toContain("configured-product");
  });

  test("neither source renders the neutral default delivery-os", async () => {
    const run = await versionRun({});
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("delivery-os");
  });

  test("no rendered identity contains a seed literal", async () => {
    for (const workingName of ["configured-product", "alt-product", undefined]) {
      const run = await versionRun({
        ...(workingName === undefined ? {} : { configuredWorkingName: workingName }),
      });
      for (const seed of ["ados", "ADOS_", "~/.ados"]) {
        expect(run.stdout).not.toContain(seed);
      }
    }
  });

  test("an empty override is ignored rather than rejecting the run", async () => {
    const run = await versionRun({
      configuredWorkingName: "configured-product",
      environment: { DELIVERY_OS_WORKING_NAME: "" },
    });
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("configured-product");
  });
});
