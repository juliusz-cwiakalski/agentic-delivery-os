/**
 * TC-HARNESS-001 / 002 / 003 — the version gate before any session.
 *
 * M-01 (outside), M-02 (indeterminate), and the paired in-window control. The
 * refusal identity, the disclosed `detail.harness` facts, the zero-session
 * assertion, and the app-level no-lease/no-attempt rule are all asserted here.
 */
import { describe, expect, test } from "bun:test";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import {
  HARNESS_PRESESSION_REFUSAL_CODES,
  harnessRefusalDetail,
  runDispatch,
} from "../../packages/core/src/app/dispatch";
import type { HarnessSessionPort } from "../../packages/core/src/contracts/index";
import { createDispatchState } from "../fixtures/dispatch/harness";
import { readsFrom } from "../fixtures/dispatch/golden/harness";
import { createPropagationHarness } from "../fixtures/harness/propagation-harness";

const FACTS_OUTSIDE = {
  kind: "opencode",
  observedVersion: "2.1.7",
  versionVerdict: "outside",
  mode: "per-invocation-private-server",
} as const;

const FACTS_INDETERMINATE = {
  kind: "opencode",
  observedVersion: null,
  versionVerdict: "indeterminate",
  mode: "per-invocation-private-server",
} as const;

const spawnOnce = (port: HarnessSessionPort, workItemRef = "GH-335") =>
  port.spawn({
    workItemRef,
    prompt: "synthetic",
    descriptor: { kind: "host", workDirectory: "/synthetic", environment: [] },
  });

describe("TC-HARNESS-002 out-of-window refusal (M-01)", () => {
  test("an outside verdict refuses with the unsupported identity and starts no session", async () => {
    const harness = createPropagationHarness({
      versionVerdict: "outside",
      observedVersion: "2.1.7",
    });
    const result = await spawnOnce(harness.port);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("harness.version.unsupported");
    expect(harness.invocations).toHaveLength(0);
    const detail = harnessRefusalDetail(result.error.code, FACTS_OUTSIDE);
    expect(detail).toEqual({
      kind: "opencode",
      observedVersion: "2.1.7",
      versionVerdict: "outside",
    });
    expect(detail === undefined ? true : Object.hasOwn(detail, "mode")).toBe(false);
  });

  test("the in-window control spawns exactly one session", async () => {
    const harness = createPropagationHarness({
      versionVerdict: "inside",
      observedVersion: "2.3.2",
    });
    const result = await spawnOnce(harness.port);
    expect(result.ok).toBe(true);
    expect(harness.invocations).toHaveLength(1);
  });
});

describe("TC-HARNESS-003 indeterminate-version refusal (M-02)", () => {
  test("an indeterminate verdict refuses with the unknown identity and no fabricated version", async () => {
    const harness = createPropagationHarness({ versionVerdict: "indeterminate" });
    const result = await spawnOnce(harness.port);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("harness.version.unknown");
    expect(harness.invocations).toHaveLength(0);
    const detail = harnessRefusalDetail(result.error.code, FACTS_INDETERMINATE);
    expect(detail).toEqual({
      kind: "opencode",
      observedVersion: null,
      versionVerdict: "indeterminate",
    });
  });
});

describe("TC-HARNESS-006 the gate runs before the lease claim and the attempt append", () => {
  const portsFor = (
    state: ReturnType<typeof createDispatchState>,
    calls: { claims: number },
    harnessAdmission: NonNullable<Parameters<typeof runDispatch>[0]["harnessAdmission"]>,
  ) => ({
    store: state.store,
    fenceToken: state.fenceToken,
    harness: createPropagationHarness({ versionVerdict: "outside", observedVersion: "2.1.7" }).port,
    harnessKind: "opencode" as const,
    descriptor: { kind: "host" as const, workDirectory: state.root, environment: [] },
    prompt: "synthetic",
    ref: "GH-335",
    evidenceClass: "production" as const,
    repository: "github.com/owner/repo",
    handoverState: "authoritative" as const,
    nowIso: () => "2026-11-18T10:00:00.000Z",
    newAttemptId: () => "attempt-1",
    newDivergenceId: () => "DIV-1",
    readTruth: async () => readsFrom(),
    claimLease: () => {
      calls.claims += 1;
      return { ok: true as const, leaseId: "lease-1" };
    },
    releaseLease: () => true,
    phaseLedger: { completed: 0, total: 9, variant: "full" as const },
    harnessFacts: FACTS_OUTSIDE,
    harnessAdmission,
  });

  test("an admission refusal claims no lease and appends no attempt record", async () => {
    const state = createDispatchState("version-gate");
    const calls = { claims: 0 };
    const result = await runDispatch(
      portsFor(state, calls, async () => ({
        ok: false,
        error: {
          kind: "harness",
          code: "harness.version.unsupported",
          summary: "observed 2.1.7 is outside the supported window",
          harness: harnessRefusalDetail("harness.version.unsupported", FACTS_OUTSIDE),
        },
      })),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("harness.version.unsupported");
    expect(result.error.harness?.observedVersion).toBe("2.1.7");
    expect(calls.claims).toBe(0);
    expect(readDispatchAttempts(state.store).records).toHaveLength(0);
  });

  test("a spawned pre-session refusal appends no attempt record either", async () => {
    const state = createDispatchState("version-gate-spawn");
    const calls = { claims: 0 };
    const ports = portsFor(state, calls, async () => ({ ok: true }));
    const result = await runDispatch(ports);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("harness.version.unsupported");
    expect(
      (HARNESS_PRESESSION_REFUSAL_CODES as readonly string[]).includes(result.error.code),
    ).toBe(true);
    expect(readDispatchAttempts(state.store).records).toHaveLength(0);
  });
});
