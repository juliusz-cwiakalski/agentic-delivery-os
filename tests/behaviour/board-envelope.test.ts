/**
 * TC-BOARD-050 — every outcome uses the five-field envelope with all new keys
 * under `data` and the declared exit projection (AC-F8-1, NFR-1, DM-2).
 */
import { describe, expect, test } from "bun:test";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { createSelectionHarness } from "../fixtures/board/selection";

describe("TC-BOARD-050 envelope and exit projection", () => {
  test("a produced board and a refusal keep the five-field envelope", async () => {
    const harness = createSelectionHarness({
      repositories: [{ projectKey: "delivery-a" }],
      invokingKey: "delivery-a",
    });
    try {
      const produced = await harness.run(["board"]);
      expect(produced.exitCode).toBe(0);
      const producedEnvelope = JSON.parse(produced.stdout) as Record<string, unknown>;
      expect(assertEnvelopeContract(producedEnvelope)).toEqual([]);
      expect(Object.keys(producedEnvelope).sort()).toEqual([
        "data",
        "exitCode",
        "runId",
        "schemaVersion",
        "timing",
      ]);

      const refused = await harness.run(["board", "--project", "delivery-zzz"]);
      expect(refused.exitCode).toBe(1);
      const refusedEnvelope = JSON.parse(refused.stdout) as Record<string, unknown>;
      expect(assertEnvelopeContract(refusedEnvelope)).toEqual([]);
      expect(refusedEnvelope).not.toHaveProperty("data");
      expect(refusedEnvelope.error).toMatchObject({ code: "board.repository-unknown" });
    } finally {
      harness.dispose();
    }
  });
});
