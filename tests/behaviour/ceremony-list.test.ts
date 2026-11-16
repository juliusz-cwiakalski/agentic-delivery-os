/**
 * TC-CEREMONY-006 — `ceremony list` content, last-run summary, bounded render,
 * and a single read.
 */
import { describe, expect, test } from "bun:test";
import { createCeremonyCommandDefinition } from "../../packages/cli/src/commands/ceremony";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

const data = (count: number) => ({
  ceremonies: Array.from({ length: count }, (_, index) => ({
    id: `ceremony-${String(index)}`,
    origin: index === 0 ? "built-in" : "project",
    tiers: ["full", "lite"],
    triggers: ["schedule:daily"],
    catchUp: "once",
    lastRun: { runId: `run-${String(index)}`, verdict: "verified", startedAtMs: 1 },
  })),
});

const run = async (count: number, json: boolean): Promise<{ exitCode: number; stdout: string }> => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  let calls = 0;
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: { now: () => 1 },
    newRunId: () => "run-list",
    secrets: [],
    program: {
      commands: {
        ceremony: createCeremonyCommandDefinition({
          list: () => {
            calls += 1;
            return { ok: true, data: data(count) };
          },
          run: () => ({ ok: true, data: {} }),
          resume: () => ({ ok: true, data: {} }),
          catchUp: () => ({ ok: true, data: {} }),
        }),
      },
    },
  };
  const exitCode = await runCli(
    ["ceremony", "list", ...(json ? ["--json"] : [])],
    { stdout, stderr },
    deps,
  );
  expect(calls).toBe(1);
  return { exitCode, stdout: stdout.value };
};

describe("TC-CEREMONY-006 ceremony list", () => {
  test("each ceremony carries its id, origin, tiers, trigger, catch-up, and last run", async () => {
    const result = await run(2, true);
    expect(result.exitCode).toBe(0);
    const envelope = JSON.parse(result.stdout) as {
      data: { ceremonies: Record<string, unknown>[] };
    };
    expect(envelope.data.ceremonies[0]).toMatchObject({
      id: "ceremony-0",
      origin: "built-in",
      tiers: ["full", "lite"],
      triggers: ["schedule:daily"],
      catchUp: "once",
      lastRun: { runId: "run-0", verdict: "verified" },
    });
    expect(envelope.data.ceremonies[1]?.origin).toBe("project");
  });

  test("the human render is bounded with an explicit omission marker", async () => {
    const result = await run(80, false);
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.split("\n").filter((line) => line.length > 0);
    expect(lines.length).toBeLessThanOrEqual(32);
    expect(Buffer.byteLength(result.stdout, "utf8")).toBeLessThanOrEqual(6_144);
    expect(result.stdout).toContain("omitted:");
  });
});
