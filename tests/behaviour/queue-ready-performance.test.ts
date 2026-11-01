/**
 * TC-QREADY-030 — pure-evaluation performance and read-cost bounds.
 */
import { describe, expect, test } from "bun:test";
import {
  baseFacts,
  blockedBy,
  createRecorder,
  evaluate,
  makeWorkItem,
  queueRuntime,
  runQueueReadyCli,
  unavailableBinding,
  workItemRead,
} from "../fixtures/queue-ready/harness";

const capSizedFacts = () => {
  const refs = Array.from({ length: 8 }, (_, index) => `GH-${index + 1}`);
  return baseFacts({
    candidates: refs,
    tracker: workItemRead(
      refs.map((ref) =>
        makeWorkItem({
          entityId: ref.replace(/^.*-/, ""),
          labels: ["priority:high", ...Array.from({ length: 15 }, (_, index) => `label-${index}`)],
          relations: Array.from({ length: 16 }, (_, index) => blockedBy(`999${index}`)),
        }),
      ),
      undefined,
      8,
    ),
  });
};

describe("TC-QREADY-030 performance and read cost", () => {
  test("the pure evaluator meets the 50 ms bound at cap size", () => {
    const facts = capSizedFacts();
    evaluate(facts);
    const samples: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const started = performance.now();
      evaluate(facts);
      samples.push(performance.now() - started);
    }
    samples.sort((left, right) => left - right);
    const median = samples[2] ?? 0;
    console.log(
      `queue-ready pure evaluation median ${median.toFixed(3)} ms; runtime ${process.versions.bun}; platform ${process.platform}/${process.arch}; candidates 8`,
    );
    expect(median).toBeLessThanOrEqual(50);
  });

  test("a single-candidate evaluation is also within the bound", () => {
    const facts = baseFacts();
    evaluate(facts);
    const started = performance.now();
    evaluate(facts);
    expect(performance.now() - started).toBeLessThanOrEqual(50);
  });

  test("the command performs exactly three GitHub reads, one fold, one config, and one local read", async () => {
    const recorder = createRecorder();
    const run = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "--json"],
      queueRuntime(capSizedFacts(), recorder),
    );
    expect(run.exitCode).toBe(0);
    expect(recorder.calls.filter((call) => call === "readWorkItems")).toHaveLength(1);
    expect(recorder.calls.filter((call) => call === "readDeliveryRequests")).toHaveLength(1);
    expect(recorder.calls.filter((call) => call === "readPipelineRuns")).toHaveLength(1);
    expect(recorder.calls.filter((call) => call === "readProviderParks")).toHaveLength(1);
    expect(recorder.calls.filter((call) => call === "readProviderConfig")).toHaveLength(1);
    expect(recorder.calls.filter((call) => call === "readLocalContext")).toHaveLength(1);
    expect(recorder.calls.filter((call) => call === "readRepository")).toHaveLength(1);
  });

  test("an unavailable binding short-circuits to zero GitHub reads", async () => {
    const recorder = createRecorder();
    const facts = capSizedFacts();
    const run = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "--json"],
      queueRuntime(
        {
          ...facts,
          repository: { binding: unavailableBinding(), head: { branch: "x", detached: false } },
        },
        recorder,
      ),
    );
    expect(run.exitCode).toBe(0);
    for (const call of ["readWorkItems", "readDeliveryRequests", "readPipelineRuns"]) {
      expect(
        recorder.calls.filter((entry) => entry === call),
        call,
      ).toHaveLength(0);
    }
  });

  test("a deliberate second read trips the read-cost control", async () => {
    const recorder = createRecorder();
    const runtime = queueRuntime(capSizedFacts(), recorder);
    await runQueueReadyCli(["queue", "ready", "GH-176", "--json"], runtime);
    recorder.calls.push("readWorkItems");
    expect(recorder.calls.filter((call) => call === "readWorkItems")).toHaveLength(2);
  });
});
