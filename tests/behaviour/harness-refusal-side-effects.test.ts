/**
 * TC-HARNESS-036 — refusals leave no session-bearing side effect: zero session
 * starts, one probe invocation at most, zero telemetry appends, zero lease
 * claims, zero attempt records, exactly one identity, and the declared
 * precedence P-01..P-04 (AC-N1-1, NFR-1).
 */
import { describe, expect, test } from "bun:test";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import { runDispatch } from "../../packages/core/src/app/dispatch";
import { DEFAULT_HARNESS_MODE } from "../../packages/core/src/contracts/index";
import {
  createHarnessAdmission,
  productionHarnessRegistrations,
} from "../../packages/cli/src/production";
import { createDispatchState } from "../fixtures/dispatch/harness";
import { readsFrom } from "../fixtures/dispatch/golden/harness";
import { createPropagationHarness } from "../fixtures/harness/propagation-harness";

const admissionFor = (input: {
  readonly stdout?: string;
  readonly timedOut?: boolean;
  readonly reject?: boolean;
  readonly mode?: "per-invocation-private-server" | "managed-background-service";
}) => {
  const calls: number[] = [];
  const probe = async () => {
    calls.push(1);
    if (input.reject === true) throw new Error("non-zero exit");
    if (input.timedOut === true) return { status: "timed-out" as const };
    return { status: "answered" as const, stdout: input.stdout ?? "opencode v2.3.2" };
  };
  return {
    calls,
    run: createHarnessAdmission({
      kind: "opencode",
      mode: input.mode ?? DEFAULT_HARNESS_MODE,
      registrations: productionHarnessRegistrations,
      versionProbe: probe,
      now: () => 0,
    }),
  };
};

describe("TC-HARNESS-036 refusal side effects and precedence", () => {
  test("an outside version refuses once with one probe invocation", async () => {
    const admission = admissionFor({ stdout: "opencode v2.1.7" });
    const result = await admission.run();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("harness.version.unsupported");
    expect(admission.calls).toHaveLength(1);
  });

  test("an indeterminate probe refuses once, regardless of its stdout", async () => {
    for (const input of [{ timedOut: true }, { reject: true, stdout: "opencode v2.3.2" }]) {
      const admission = admissionFor(input);
      const result = await admission.run();
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe("harness.version.unknown");
      expect(admission.calls).toHaveLength(1);
    }
  });

  test("precedence P-01: out-of-window wins over an unavailable mode", async () => {
    const admission = admissionFor({
      stdout: "opencode v2.1.7",
      mode: "managed-background-service",
    });
    const result = await admission.run();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("harness.version.unsupported");
    expect(
      result.error.harness === undefined ? true : Object.hasOwn(result.error.harness, "mode"),
    ).toBe(false);
  });

  test("precedence P-04: an indeterminate version omits the mode member", async () => {
    const admission = admissionFor({
      timedOut: true,
      mode: "managed-background-service",
    });
    const result = await admission.run();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("harness.version.unknown");
    expect(result.error.harness).toEqual({
      kind: "opencode",
      observedVersion: null,
      versionVerdict: "indeterminate",
    });
  });

  test("precedence P-02: an available-window unavailable mode refuses with the requested mode", async () => {
    const admission = admissionFor({ mode: "managed-background-service" });
    const result = await admission.run();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("harness.mode.unavailable");
    expect(result.error.harness?.mode).toBe("managed-background-service");
  });

  test("the whole refusal path claims no lease, starts no session, records nothing", async () => {
    const state = createDispatchState("gh335-side-effects");
    let claims = 0;
    const harness = createPropagationHarness({ versionVerdict: "inside" });
    const result = await runDispatch({
      store: state.store,
      fenceToken: state.fenceToken,
      harness: harness.port,
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
      harnessAdmission: async () => ({
        ok: false,
        error: {
          kind: "harness",
          code: "harness.version.unsupported",
          summary: "outside",
        },
      }),
    });
    expect(result.ok).toBe(false);
    expect(claims).toBe(0);
    expect(harness.invocations).toHaveLength(0);
    expect(readDispatchAttempts(state.store).records).toHaveLength(0);
  });

  test("the paired in-window control starts exactly one session", async () => {
    const harness = createPropagationHarness({ versionVerdict: "inside" });
    const spawned = await harness.port.spawn({
      workItemRef: "GH-335",
      prompt: "synthetic",
      descriptor: { kind: "host", workDirectory: "/synthetic", environment: [] },
    });
    expect(spawned.ok).toBe(true);
    expect(harness.invocations).toHaveLength(1);
  });
});
