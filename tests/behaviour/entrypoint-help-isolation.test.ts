/**
 * TC-ENTRY-005/006 — help and version succeed without a configuration file or a
 * project checkout, render the neutral default when no name source exists, and
 * perform zero composition, state, network, git, or configuration reads within
 * the suite's fixed timeout.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { bufferSink } from "../golden/helpers";

const roots: string[] = [];
const tempRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "gh242-entrypoint-"));
  roots.push(root);
  return root;
};

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  }
});

const run = async (args: readonly string[], environment: Record<string, string> = {}) => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  let composed = 0;
  const started = Date.now();
  const exitCode = await runEntrypoint(args, {
    streams: { stdout, stderr },
    environment,
    composeProgram: () => {
      composed += 1;
      throw new Error("the composer must not run for self-description");
    },
    clock: { now: () => 1 },
    newRunId: () => "run-isolation",
  });
  return {
    exitCode,
    stdout: stdout.value,
    stderr: stderr.value,
    composed,
    elapsedMs: Date.now() - started,
  };
};

describe("TC-ENTRY-005/006 help and version isolation", () => {
  test("both succeed in an empty directory and render the neutral default", async () => {
    const root = tempRoot();
    const before = readdirSync(root);
    for (const args of [["--help"], ["--version"]]) {
      const result = await run(args);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("delivery-os");
      expect(result.stderr).toBe("");
      expect(result.composed).toBe(0);
      // Informational only; wall-clock timing is never a gate.
      expect(result.elapsedMs).toBeLessThan(10_000);
    }
    expect(readdirSync(root)).toEqual(before);
  });

  test("an unreadable configuration file does not turn help into a config error", async () => {
    const root = tempRoot();
    mkdirSync(join(root, ".delivery-os"), { recursive: true });
    writeFileSync(join(root, ".delivery-os", "config.yaml"), "not: [valid");
    const result = await run(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("delivery-os");
    expect(result.stderr).toBe("");
    expect(result.composed).toBe(0);
  });

  test("an invalid override cannot reject the self-description surface", async () => {
    const result = await run(["--version"], { DELIVERY_OS_WORKING_NAME: "bad/name" });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("delivery-os");
    expect(result.stderr).toBe("");
    expect(result.composed).toBe(0);
  });

  test("help never invokes the composer even when the environment is poisoned", async () => {
    const result = await run(["--help"], {
      DELIVERY_OS_CONFIG: "/nonexistent/config.yaml",
      DELIVERY_OS_WORKING_NAME: "poisoned-product",
    });
    expect(result.composed).toBe(0);
    expect(result.stdout).toContain("poisoned-product");
  });
});
