/**
 * TC-CAP-009 — the `verify` producer.
 *
 * One `gate.outcome` event per full gate evaluation, keyed by gate-set identity
 * plus head SHA, with a bounded evidence-only payload and non-gating disclosure.
 */
import { describe, expect, test } from "bun:test";
import { capsuleGateEventKey } from "../../packages/core/src/domain/capsule";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";
import { makeRecordingProducer } from "../fixtures/capsule/producer";
import { baseFacts } from "../fixtures/verify-gates/cases/facts";

const REF = "GH-178";

describe("TC-CAP-009 verify capsule producer", () => {
  test("one full evaluation appends one gate.outcome event", async () => {
    const producer = makeRecordingProducer();
    const result = await runVerify(combinedRuntime({ capsule: producer.port }), ["gates", REF]);
    expect(result.exitCode).toBe(0);
    expect(producer.calls.length).toBe(1);
    const request = producer.calls[0];
    expect(request?.writer).toBe("verify");
    expect(request?.kind).toBe("gate.outcome");
    const headSha = request?.payload.headSha as string;
    const gateSet = request?.payload.gateSet as string;
    expect(gateSet.length).toBeGreaterThan(0);
    expect(request?.eventKey).toBe(capsuleGateEventKey(gateSet, headSha));
    const gates = request?.payload.gates as readonly Record<string, unknown>[];
    expect(gates.length).toBeGreaterThan(0);
    for (const gate of gates) {
      expect(Object.keys(gate).sort()).toEqual(["gateId", "reason", "verdict"]);
    }
  });

  test("a busy lock is disclosed without changing the primary evaluation", async () => {
    const producer = makeRecordingProducer("busy");
    const result = await runVerify(combinedRuntime({ capsule: producer.port }), ["gates", REF]);
    expect(result.exitCode).toBe(0);
    const data = result.envelope?.data as Record<string, unknown>;
    const capsule = data.capsule as Record<string, unknown>;
    expect(capsule.code).toBe("state.lock.busy");
    expect(capsule.retryable).toBe(true);
    expect(capsule.appended).toBe(false);
    expect(baseFacts().repository.head.sha).toBeTruthy();
  });

  test("without a producer no capsule field appears", async () => {
    const result = await runVerify(combinedRuntime(), ["gates", REF]);
    expect(result.exitCode).toBe(0);
    const data = result.envelope?.data as Record<string, unknown>;
    expect(Object.hasOwn(data, "capsule")).toBe(false);
  });
});
