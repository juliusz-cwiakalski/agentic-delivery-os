/**
 * TC-HARNESS-008 — an unavailable requested mode refuses naming the requested
 * and the available mode, before any session (M-03, AC-F2-3).
 */
import { describe, expect, test } from "bun:test";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import { harnessRefusalDetail, runDispatch } from "../../packages/core/src/app/dispatch";
import { DEFAULT_HARNESS_MODE, HARNESS_MODES } from "../../packages/core/src/contracts/index";
import { createDispatchState } from "../fixtures/dispatch/harness";
import { readsFrom } from "../fixtures/dispatch/golden/harness";
import { createPropagationHarness } from "../fixtures/harness/propagation-harness";

const NON_DEFAULT_MODES = HARNESS_MODES.filter((mode) => mode !== DEFAULT_HARNESS_MODE);

describe("TC-HARNESS-008 an unavailable mode", () => {
  test("each non-default mode refuses with the closed identity and names both modes", async () => {
    for (const mode of NON_DEFAULT_MODES) {
      const harness = createPropagationHarness({ versionVerdict: "inside", mode });
      const result = await harness.port.spawn({
        workItemRef: "GH-335",
        prompt: "synthetic",
        descriptor: { kind: "host", workDirectory: "/synthetic", environment: [] },
      });
      expect(result.ok, mode).toBe(false);
      if (result.ok) continue;
      expect(result.error.code, mode).toBe("harness.mode.unavailable");
      expect(result.error.summary ?? "", mode).toContain(mode);
      expect(result.error.summary ?? "", mode).toContain(DEFAULT_HARNESS_MODE);
      expect(harness.invocations).toHaveLength(0);
    }
  });

  test("the disclosed member names the requested mode with an inside verdict", () => {
    const requested = NON_DEFAULT_MODES[0] ?? "managed-background-service";
    const detail = harnessRefusalDetail("harness.mode.unavailable", {
      kind: "opencode",
      observedVersion: "2.3.2",
      versionVerdict: "inside",
      mode: requested,
    });
    expect(detail).toEqual({
      kind: "opencode",
      observedVersion: "2.3.2",
      versionVerdict: "inside",
      mode: requested,
    });
  });

  test("the paired default-mode control spawns", async () => {
    const harness = createPropagationHarness({ versionVerdict: "inside" });
    const result = await harness.port.spawn({
      workItemRef: "GH-335",
      prompt: "synthetic",
      descriptor: { kind: "host", workDirectory: "/synthetic", environment: [] },
    });
    expect(result.ok).toBe(true);
    expect(harness.invocations).toHaveLength(1);
  });

  test("an admission refusal claims no lease, starts no child, and appends no record", async () => {
    const state = createDispatchState("mode-refusal");
    let claims = 0;
    const requested = NON_DEFAULT_MODES[0] ?? "managed-background-service";
    const result = await runDispatch({
      store: state.store,
      fenceToken: state.fenceToken,
      harness: createPropagationHarness({ versionVerdict: "inside", mode: requested }).port,
      harnessKind: "opencode",
      descriptor: { kind: "host", workDirectory: state.root, environment: [] },
      prompt: "synthetic",
      ref: "GH-335",
      evidenceClass: "production",
      repository: "github.com/owner/repo",
      handoverState: "authoritative",
      nowIso: () => "2026-11-18T10:00:00.000Z",
      newAttemptId: () => "attempt-1",
      newDivergenceId: () => "DIV-1",
      readTruth: async () => readsFrom(),
      claimLease: () => {
        claims += 1;
        return { ok: true, leaseId: "lease-1" };
      },
      releaseLease: () => true,
      phaseLedger: { completed: 0, total: 9, variant: "full" },
      harnessFacts: () => ({
        kind: "opencode",
        observedVersion: "2.3.2",
        versionVerdict: "inside",
        mode: requested,
      }),
      harnessAdmission: async () => ({
        ok: false,
        error: {
          kind: "harness",
          code: "harness.mode.unavailable",
          summary: `requested mode ${requested} is unavailable; the available mode is ${DEFAULT_HARNESS_MODE}`,
          harness: harnessRefusalDetail("harness.mode.unavailable", {
            kind: "opencode",
            observedVersion: "2.3.2",
            versionVerdict: "inside",
            mode: requested,
          }),
        },
      }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("harness.mode.unavailable");
    expect(result.error.harness?.mode).toBe(requested);
    expect(claims).toBe(0);
    expect(readDispatchAttempts(state.store).records).toHaveLength(0);
  });
});
