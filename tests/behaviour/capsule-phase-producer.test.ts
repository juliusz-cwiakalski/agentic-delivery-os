/**
 * TC-CAP-007 — the `phase` producer.
 *
 * One `phase.transition` event per landed completion or reopen, a deterministic
 * event key, a duplicate no-op, and non-gating disclosure on failure.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { capsulePhaseEventKey } from "../../packages/core/src/domain/capsule";
import { makeRecordingProducer } from "../fixtures/capsule/producer";
import { type PhaseHarness, withPhaseHarness } from "./phase-support";

const ROOT = process.cwd();
const FULL = readFileSync(join(ROOT, "tests/fixtures/phase/full-open.yaml"), "utf8");
const REF = "GH-179";

const dataOf = (run: { readonly envelope?: Record<string, unknown> }): Record<string, unknown> => {
  const data = run.envelope?.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("expected success data");
  }
  return data as Record<string, unknown>;
};

const completion = (harness: PhaseHarness) => harness.run(["complete", REF, "delivery"]);

describe("TC-CAP-007 phase capsule producer", () => {
  test("one landed completion appends exactly one phase.transition event", async () => {
    const producer = makeRecordingProducer();
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const run = await completion(harness);
        expect(run.exitCode).toBe(0);
        expect(producer.calls.length).toBe(1);
        const request = producer.calls[0];
        expect(request?.changeRef).toBe(REF);
        expect(request?.writer).toBe("phase");
        expect(request?.kind).toBe("phase.transition");
        const data = dataOf(run);
        expect(typeof data.timestamp).toBe("string");
        expect(request?.eventKey).toBe(
          capsulePhaseEventKey({
            changeRef: REF,
            phaseId: "delivery",
            operation: "complete",
            transitionId: data.timestamp as string,
          }),
        );
        expect(harness.transitionPayloads().length).toBe(1);
      },
      "capsule-phase",
      undefined,
      { capsule: producer.port },
    );
  });

  test("a re-run of the same completion appends nothing", async () => {
    const producer = makeRecordingProducer();
    await withPhaseHarness(
      FULL,
      async (harness) => {
        expect((await completion(harness)).exitCode).toBe(0);
        expect(producer.calls.length).toBe(1);
        const second = await completion(harness);
        expect(second.exitCode).toBe(0);
        expect(dataOf(second).outcome).toBe("no-op");
        expect(producer.calls.length).toBe(1);
      },
      "capsule-phase-idempotent",
      undefined,
      { capsule: producer.port },
    );
  });

  test("a reopen and a later completion produce distinct deterministic keys", async () => {
    const producer = makeRecordingProducer();
    await withPhaseHarness(
      FULL,
      async (harness) => {
        expect((await completion(harness)).exitCode).toBe(0);
        const reopened = await harness.run(["reopen", REF, "delivery", "rework"]);
        expect(reopened.exitCode).toBe(0);
        expect(producer.calls.length).toBe(2);
        expect(producer.calls[1]?.payload.operation).toBe("reopen");
        expect(producer.calls[1]?.eventKey).not.toBe(producer.calls[0]?.eventKey);
      },
      "capsule-phase-reopen",
      undefined,
      { capsule: producer.port },
    );
  });

  test("two no-commit transitions of one phase produce distinct events", async () => {
    const producer = makeRecordingProducer();
    await withPhaseHarness(
      FULL,
      async (harness) => {
        expect((await completion(harness)).exitCode).toBe(0);
        expect((await harness.run(["reopen", REF, "delivery", "rework"])).exitCode).toBe(0);
        expect((await completion(harness)).exitCode).toBe(0);
        const completes = producer.calls.filter((call) => call.payload.operation === "complete");
        expect(completes.length).toBe(2);
        expect(completes[0]?.eventKey).not.toBe(completes[1]?.eventKey);
      },
      "capsule-phase-two-transitions",
      undefined,
      { capsule: producer.port },
    );
  });

  test("a busy lock is disclosed as state.lock.busy and changes no primary outcome", async () => {
    const producer = makeRecordingProducer("busy");
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const run = await completion(harness);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).outcome).toBe("landed");
        const capsule = dataOf(run).capsule as Record<string, unknown>;
        expect(capsule.code).toBe("state.lock.busy");
        expect(capsule.retryable).toBe(true);
        expect(capsule.appended).toBe(false);
        expect(harness.transitionPayloads().length).toBe(1);
      },
      "capsule-phase-busy",
      undefined,
      { capsule: producer.port },
    );
  });

  test("a thrown append is contained as a classified disclosure", async () => {
    const producer = makeRecordingProducer("throw");
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const run = await completion(harness);
        expect(run.exitCode).toBe(0);
        const capsule = dataOf(run).capsule as Record<string, unknown>;
        expect(capsule.appended).toBe(false);
        expect(capsule.code).toBe("capsule.append-failed");
        expect(harness.transitionPayloads().length).toBe(1);
      },
      "capsule-phase-throw",
      undefined,
      { capsule: producer.port },
    );
  });

  test("without a producer no capsule field appears", async () => {
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const run = await completion(harness);
        expect(run.exitCode).toBe(0);
        expect(Object.hasOwn(dataOf(run), "capsule")).toBe(false);
      },
      "capsule-phase-none",
    );
  });

  test("a real file producer writes the change-folder capsule", async () => {
    const { makeFileProducer } = await import("../fixtures/capsule/producer");
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const port = makeFileProducer(join(harness.root, "doc", "changes"));
        const withPort = { ...harness.runtime, capsule: port };
        const { createPhaseCommandDefinition } = await import(
          "../../packages/cli/src/commands/phase"
        );
        const run = await harness.runDefinition(createPhaseCommandDefinition(withPort), [
          "complete",
          REF,
          "delivery",
        ]);
        expect(run.exitCode).toBe(0);
        const { readFileSync: read } = await import("node:fs");
        const file = join(
          harness.root,
          "doc",
          "changes",
          "2026-10",
          `2026-10-31--${REF}--phase-fixture`,
          "events.jsonl",
        );
        const lines = read(file, "utf8").trim().split("\n");
        expect(lines.length).toBe(2);
        expect(JSON.parse(lines[0] as string).kind).toBe("capsule.opened");
        expect(JSON.parse(lines[1] as string).kind).toBe("phase.transition");
      },
      "capsule-phase-file",
      undefined,
      {},
    );
  });
});
