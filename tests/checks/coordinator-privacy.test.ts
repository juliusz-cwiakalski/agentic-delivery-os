/**
 * TC-COORD-084 — no prompt, transcript, secret, or credential value reaches any
 * coordinator record or error; evidence is bounded `key=value`.
 */
import { describe, expect, test } from "bun:test";
import { COORDINATOR_MAX_EVIDENCE_BYTES } from "../../packages/core/src/contracts/index";
import {
  createCoordinatorHarness,
  errorCodeOf,
  seedIteration,
} from "../fixtures/coordinator/harness";

const CANARY = "sk-live-COORDINATOR-CANARY-0123456789";

describe("TC-COORD-084 coordinator records carry no secret or prompt content", () => {
  test("no coordinator record payload contains the canary", async () => {
    const harness = createCoordinatorHarness({
      label: "privacy",
      session: { liveness: "alive" },
      alive: { 4242: false },
    });
    seedIteration(harness);
    harness.seedQuestion({
      schemaId: "delivery.blocker.question.v1",
      id: "q-privacy",
      type: "decision-needed",
      audience: "coordinator",
      lane: "coordinator",
      ref: null,
      question: `A question mentioning ${CANARY}`,
      options: ["continue"],
      askedAt: "1970-01-01T00:00:01.000Z",
    });
    await harness.run(["coordinator", "tick", "--json"]);
    const raw = harness.store.readRecords();
    if (!raw.ok) throw new Error("read failed");
    const coordinatorPayloads = raw.value.records
      .filter((record) => String(record.kind).startsWith("coordinator."))
      .map((record) => JSON.stringify(record.payload));
    expect(coordinatorPayloads.length).toBeGreaterThan(0);
    for (const payload of coordinatorPayloads) {
      expect(payload).not.toContain(CANARY);
      expect(payload).not.toContain("transcript");
      expect(payload).not.toContain("prompt=");
    }
  });

  test("stuck evidence stays within the 512-byte key=value bound", async () => {
    const harness = createCoordinatorHarness({
      label: "privacy-evidence",
      session: { liveness: "alive" },
      alive: { 4242: false },
    });
    seedIteration(harness);
    await harness.run(["coordinator", "tick", "--json"]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    for (const record of read.stuck) {
      expect(Buffer.byteLength(record.evidence, "utf8")).toBeLessThanOrEqual(
        COORDINATOR_MAX_EVIDENCE_BYTES,
      );
      expect(record.evidence).toMatch(/^([a-zA-Z0-9-]+=[^ ]*)( [a-zA-Z0-9-]+=[^ ]*)*$/);
    }
  });

  test("error evidence names identities and counts only", async () => {
    const harness = createCoordinatorHarness({ label: "privacy-error" });
    const result = await harness.run(["coordinator", "start", "--json"]);
    expect(result.code).toBe(1);
    expect(errorCodeOf(result)).toBe("fallback.invocation");
    const envelope = result.json as { error?: { remediationHint?: string; summary?: string } };
    expect(JSON.stringify(envelope.error)).not.toContain(CANARY);
    expect(envelope.error?.remediationHint).not.toContain("password");
  });
});
