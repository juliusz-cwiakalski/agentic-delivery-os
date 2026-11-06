/**
 * TC-RETRO-012 — cross-process continuity: a fresh edge over the same durable
 * directory verifies earlier history with zero false breaks and continues the
 * chain.
 */
import { describe, expect, test } from "bun:test";
import { createNodeRetroSidecarIo, createRetroSidecar } from "../../packages/core/src/state/index";
import { appendEvidence, makeRetroDir, newTraceId } from "../fixtures/retro/harness";

describe("TC-RETRO-012 cross-process chain", () => {
  test("a second runtime instance verifies and continues the chain", () => {
    const fixture = makeRetroDir("cross-process");
    appendEvidence(fixture);
    appendEvidence(fixture);

    const secondIo = createNodeRetroSidecarIo({
      stateDirectory: fixture.stateDirectory,
      workspaceId: fixture.workspaceId,
    });
    const second = createRetroSidecar(secondIo);
    const verified = second.verify();
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value.verified).toBe(true);
      expect(verified.value.breaks).toEqual([]);
      expect(verified.value.records).toBe(2);
    }

    const appended = second.append({
      traceId: newTraceId(),
      level: "change",
      source: "pm-notes",
      windowStart: 1,
      windowEnd: 2,
      collectedAt: 3,
      payloadRefs: ["note:second-process"],
      payloadSchemaId: "delivery.retro.evidence.v1",
    });
    expect(appended.ok).toBe(true);
    const final = fixture.sidecar.verify();
    expect(final.ok).toBe(true);
    if (final.ok) {
      expect(final.value.verified).toBe(true);
      expect(final.value.records).toBe(3);
    }
  });
});
