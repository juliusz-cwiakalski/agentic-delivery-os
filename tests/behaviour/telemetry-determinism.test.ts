/**
 * TC-TELEMETRY-032 — byte-identical repeat renders for identical stored
 * telemetry, injected clock, and injected run id; zero model calls; and
 * shuffled-append permutation invariance (NFR-3).
 */
import { afterEach, describe, expect, test } from "bun:test";
import {
  aggregateStatus,
  projectBrief,
  renderBriefHuman,
} from "../../packages/core/src/domain/index";
import { computeSpendReport } from "../../packages/core/src/domain/spend";
import { readSpendLedger } from "../../packages/core/src/state/index";
import { baseFacts } from "../fixtures/brief/harness";
import { runSpendCli, spendRuntimeOver } from "../fixtures/spend/harness";
import {
  foldTelemetryStore,
  makeStepRecord,
  RUN_A,
  removeRoot,
  SESSION_A,
  SESSION_B,
  T1,
  T2,
  tokens,
} from "../fixtures/telemetry";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const steps = (order: readonly string[]) =>
  order.map((sessionId) =>
    makeStepRecord({
      runId: sessionId === SESSION_A ? RUN_A : "run-telemetry-b",
      sessionId,
      tokens: tokens({ input: sessionId === SESSION_A ? 10 : 20 }),
      calls: 1,
      finishedAt: sessionId === SESSION_A ? T1 : T2,
    }),
  );

describe("TC-TELEMETRY-032 determinism and zero model calls", () => {
  test("the command renders byte-identically under identical injected inputs", async () => {
    const fixture = foldTelemetryStore({ steps: steps([SESSION_A, SESSION_B]) }, "determinism");
    roots.push(fixture.root);
    const first = await runSpendCli(
      ["--json", "spend", "--ref", "GH-291"],
      spendRuntimeOver(fixture.store),
    );
    const second = await runSpendCli(
      ["--json", "spend", "--ref", "GH-291"],
      spendRuntimeOver(fixture.store),
    );
    expect(first.exitCode).toBe(0);
    expect(second.stdout).toBe(first.stdout);
    const humanFirst = await runSpendCli(
      ["spend", "--ref", "GH-291"],
      spendRuntimeOver(fixture.store),
    );
    const humanSecond = await runSpendCli(
      ["spend", "--ref", "GH-291"],
      spendRuntimeOver(fixture.store),
    );
    expect(humanSecond.stdout).toBe(humanFirst.stdout);
  });

  test("shuffled append order renders byte-identically (permutation invariance)", () => {
    const forward = foldTelemetryStore({ steps: steps([SESSION_A, SESSION_B]) }, "determinism-fwd");
    const shuffled = foldTelemetryStore(
      { steps: steps([SESSION_B, SESSION_A]) },
      "determinism-shuf",
    );
    roots.push(forward.root, shuffled.root);
    if (!forward.read.ok || !shuffled.read.ok) throw new Error("read failed");
    const foldedForward = computeSpendReport(forward.read.value, { workItemRef: "GH-291" });
    const foldedShuffled = computeSpendReport(shuffled.read.value, { workItemRef: "GH-291" });
    expect(foldedForward.ok).toBe(true);
    expect(foldedShuffled.ok).toBe(true);
    if (!foldedForward.ok || !foldedShuffled.ok) return;
    expect(JSON.stringify(foldedShuffled.data)).toBe(JSON.stringify(foldedForward.data));
  });

  test("digest and brief renders are byte-identical across repeats", async () => {
    const fixture = foldTelemetryStore({ steps: steps([SESSION_A]) }, "determinism-brief");
    roots.push(fixture.root);
    const read = readSpendLedger(fixture.store, "GH-291");
    if (!read.ok) throw new Error("read failed");
    const folded = computeSpendReport(read.value, { workItemRef: "GH-291" });
    if (!folded.ok) throw new Error("fold failed");
    const section = {
      state: "observed" as const,
      captured: true as const,
      tokensByClass: folded.data.tokensByClass,
      restarts: folded.data.restarts,
      ratio: folded.data.amplification.ratio,
      telemetryState: folded.data.telemetryState,
      reconciliation: folded.data.reconciliation,
      byRole: folded.data.breakdowns.role,
      byModel: folded.data.breakdowns.model,
      phaseTiming: folded.data.phaseTiming,
    };
    const facts = { ...baseFacts(), spend: section };
    const digestFirst = aggregateStatus(facts);
    const digestSecond = aggregateStatus(facts);
    expect(JSON.stringify(digestSecond)).toBe(JSON.stringify(digestFirst));
    const briefFirst = renderBriefHuman(projectBrief(facts), SYNTHETIC_BRAND);
    const briefSecond = renderBriefHuman(projectBrief(facts), SYNTHETIC_BRAND);
    expect(briefSecond).toBe(briefFirst);
  });

  test("rendering performs no model call or network open (throwing fetch seam)", async () => {
    const fixture = foldTelemetryStore({ steps: steps([SESSION_A]) }, "determinism-model");
    roots.push(fixture.root);
    const originalFetch = globalThis.fetch;
    let calls = 0;
    try {
      globalThis.fetch = (() => {
        calls += 1;
        throw new Error("network not licensed");
      }) as typeof fetch;
      const run = await runSpendCli(
        ["--json", "spend", "--ref", "GH-291"],
        spendRuntimeOver(fixture.store),
      );
      expect(run.exitCode).toBe(0);
      expect(calls).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
