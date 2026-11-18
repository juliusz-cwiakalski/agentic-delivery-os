/**
 * TC-HARNESS-027 — privacy: identity, counts, cost, and durations only; no
 * conversation content, prompt, diff, or tool output reaches a row, a warning,
 * or a refusal (NFR-5, NFR-9, T-12).
 */
import { describe, expect, test } from "bun:test";
import { extractOpencode, ROOT_BINDING } from "../fixtures/harness/telemetry-attempts";
import {
  PRIVACY_CANARY,
  ROOT_SESSION,
  buildOpencodeStore,
} from "../fixtures/harness/opencode-store/build";

describe("TC-HARNESS-027 privacy", () => {
  test("the store fixture carries a canary and no row or warning emits it", () => {
    const store = buildOpencodeStore();
    const captured = extractOpencode({
      store,
      bindings: { [ROOT_SESSION]: ROOT_BINDING },
      pinnedVersion: "9.9.9",
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const serialized = JSON.stringify(captured.value);
    expect(serialized.length).toBeGreaterThan(0);
    expect(serialized).not.toContain(PRIVACY_CANARY);
    expect(serialized).not.toContain("content");
    for (const row of captured.value.records) {
      expect(Object.keys(row)).not.toContain("content");
      expect(Object.keys(row)).not.toContain("prompt");
      expect(Object.keys(row)).not.toContain("diff");
    }
  });

  test("every emitted field is an identity, a count, a cost, or a duration", () => {
    const store = buildOpencodeStore();
    const captured = extractOpencode({ store, bindings: { [ROOT_SESSION]: ROOT_BINDING } });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const allowed = new Set([
      "schemaId",
      "workItemRef",
      "runId",
      "sessionId",
      "harnessKind",
      "harnessVersion",
      "agent",
      "model",
      "treeRoot",
      "parentChain",
      "tokens",
      "calls",
      "toolCounts",
      "cost",
      "capturedAt",
      "warnings",
      "seat",
      "resolvedModel",
      "durations",
      "absentObservedAxes",
      "toolTruncation",
    ]);
    for (const row of captured.value.records) {
      for (const key of Object.keys(row)) expect(allowed.has(key), key).toBe(true);
    }
  });
});
