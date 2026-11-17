/**
 * TC-METRICS-081 — `metrics --help` answers at exit 0 with the declared
 * sections and no side effect; `--version` answers from the same static
 * inventory; the brand seam supplies the binary name; help wins over --json.
 */
import { describe, expect, test } from "bun:test";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { bufferSink } from "../golden/helpers";

const base = (): {
  readonly streams: {
    stdout: ReturnType<typeof bufferSink>;
    stderr: ReturnType<typeof bufferSink>;
  };
  readonly calls: string[];
} => {
  const calls: string[] = [];
  return {
    streams: { stdout: bufferSink(), stderr: bufferSink() },
    calls,
  };
};

describe("TC-METRICS-081 the family help is a static answer", () => {
  test("metrics --help exits 0 with summary, usage, options, examples, exit codes, and see-also", async () => {
    const { streams, calls } = base();
    const exitCode = await runEntrypoint(["metrics", "--help"], {
      streams,
      environment: {},
      declaredWorkingName: "example-product",
      clock: { now: () => 1 },
      newRunId: () => "run-metrics-help",
      composeProgram: () => {
        calls.push("compose");
        return { commands: {} };
      },
    });
    expect(exitCode).toBe(0);
    expect(calls).toEqual([]);
    const text = streams.stdout.value;
    expect(text).toContain("example-product metrics —");
    expect(text).toContain("Usage:");
    expect(text).toContain("--ref");
    expect(text).toContain("--from");
    expect(text).toContain("--through");
    expect(text).toContain("--json");
    expect(text).toContain("Examples:");
    expect(text).toContain("Exit codes:");
    expect(text).toContain("See also:");
    expect(text).toContain(" 0 ");
    expect(text).toContain(" 1 ");
    expect(text).toContain(" 2 ");
    expect(text).toContain("m2/commands/metrics.md");
  });

  test("metrics --version answers at exit 0 from the same static inventory", async () => {
    const { streams, calls } = base();
    const exitCode = await runEntrypoint(["metrics", "--version"], {
      streams,
      environment: {},
      declaredWorkingName: "example-product",
      clock: { now: () => 1 },
      newRunId: () => "run-metrics-version",
      composeProgram: () => {
        calls.push("compose");
        return { commands: {} };
      },
    });
    expect(exitCode).toBe(0);
    expect(calls).toEqual([]);
    expect(streams.stdout.value.length).toBeGreaterThan(0);
    expect(streams.stdout.value).toContain("example-product");
  });

  test("--help --json still answers help rather than attempting a report", async () => {
    const { streams } = base();
    const exitCode = await runEntrypoint(["metrics", "--help", "--json"], {
      streams,
      environment: {},
      declaredWorkingName: "example-product",
      clock: { now: () => 1 },
      newRunId: () => "run-metrics-help-json",
      composeProgram: () => ({ commands: {} }),
    });
    expect(exitCode).toBe(0);
    expect(streams.stdout.value).toContain("Usage:");
    expect(streams.stdout.value).not.toContain("delivery.metrics.v1");
  });

  test("the brand seam supplies the binary name: a swapped brand follows", async () => {
    const { streams } = base();
    await runEntrypoint(["metrics", "--help"], {
      streams,
      environment: {},
      declaredWorkingName: "another-product",
      clock: { now: () => 1 },
      newRunId: () => "run-metrics-brand",
      composeProgram: () => ({ commands: {} }),
    });
    expect(streams.stdout.value).toContain("another-product metrics —");
    expect(streams.stdout.value).not.toContain("example-product");
  });
});
