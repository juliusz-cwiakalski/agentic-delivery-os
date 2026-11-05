/**
 * TC-DPLAN-009 (seed SC-M1-07) — the ready-for-development gate refuses an
 * unvalidatable plan, and the shipped `queue ready` surface is unchanged with
 * zero plan reads. No `queue add` warning path exists in this change.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  baseFacts,
  createRecorder as createQueueRecorder,
  queueRuntime,
  runQueueReadyCli,
} from "../fixtures/queue-ready/harness";
import { parseEnvelope, planRuntime, planWorld, runPlanCli } from "../fixtures/plan/harness/index";

const BASELINE_STDOUT = readFileSync(
  join(import.meta.dir, "..", "fixtures", "plan", "queue-ready", "baseline.stdout.json"),
  "utf8",
);
const BASELINE_STDERR = readFileSync(
  join(import.meta.dir, "..", "fixtures", "plan", "queue-ready", "baseline.stderr.txt"),
  "utf8",
);

describe("TC-DPLAN-009 ready gate", () => {
  test("phase 6 without scope refuses development with a classified error", async () => {
    const world = planWorld({ "GH-308": "invalid/phase-missing-scope.yaml" });
    const run = await runPlanCli(["plan", "validate", "GH-308", "--json"], planRuntime(world), {
      runId: "run-ready-gate",
    });
    expect(run.exitCode).toBe(1);
    const envelope = parseEnvelope(run.stdout);
    const data = envelope.data as {
      readyForDevelopment: boolean;
      verdict: string;
      errors: readonly { code: string; phase?: number; field: string }[];
    };
    expect(data.verdict).toBe("invalid");
    expect(data.readyForDevelopment).toBe(false);
    const error = data.errors.find((entry) => entry.phase === 6);
    expect(error?.code).toBe("plan.schema.invalid");
    expect(error?.field).toBe("scope.files");
  });

  test("queue ready is byte-identical to its recorded baseline and reads no plan", async () => {
    const recorder = createQueueRecorder();
    const runtime = queueRuntime(baseFacts(), recorder);
    const run = await runQueueReadyCli(["queue", "ready", "GH-176", "--json"], runtime, {
      runId: "run-gh226-baseline",
    });
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(BASELINE_STDOUT);
    expect(run.stderr).toBe(BASELINE_STDERR);
    expect(recorder.calls.filter((call) => call.startsWith("plan:"))).toEqual([]);
  });

  test("no queue add surface is added", async () => {
    const recorder = createQueueRecorder();
    const runtime = queueRuntime(baseFacts(), recorder);
    const run = await runQueueReadyCli(["queue", "add", "GH-308", "--json"], runtime);
    expect(run.exitCode).toBe(1);
    const envelope = parseEnvelope(run.stdout);
    expect((envelope.error as { code: string }).code).toBe("input.value.rejected");
    expect(recorder.calls.filter((call) => call.startsWith("plan:"))).toEqual([]);
  });
});
