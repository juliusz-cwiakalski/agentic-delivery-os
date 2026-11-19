/**
 * GH-350 TC-REF-001, -002, -003, -005 — the budget work-item ref seam.
 *
 * The seam is one fact with three tiers (an explicit ref-bearing fact, the local
 * delivery context, a refusal), validated against the delivered
 * `SPEND_WORK_ITEM_REF_PATTERN`. No case reads the ambient environment, clock,
 * network, or live tree. TC-REF-004 (simulate) belongs to the simulation phase,
 * which owns the fixture field it exercises.
 */
import { describe, expect, test } from "bun:test";
import {
  type ProviderBudgetDeclaration,
  type ProviderConfiguration,
  type ProviderSpendTotalsInput,
  type ProviderSpendTotalsRead,
} from "../../packages/core/src/contracts/index";
import { resolveAppErrorCode } from "../../packages/cli/src/classify";
import { createProviderSpendTotalsPort } from "../../packages/cli/src/edge";
import { projectExitCode } from "../../packages/cli/src/projection";
import { resolveProviderWorkItemRef } from "../../packages/core/src/provider/budgets";
import { createProviderEngine } from "../../packages/core/src/provider/engine";
import { parseProviderConfiguration } from "../../packages/core/src/provider/validate";
import { computeSpendReport } from "../../packages/core/src/domain/spend";
import { appendHarnessTelemetry, readSpendLedger } from "../../packages/core/src/state/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import { makeSessionRecord } from "../fixtures/spend/harness";

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const CONTEXT_PATH = "/repo/.ai/local/pm-context.yaml";

const configWith = (budgets: Record<string, ProviderBudgetDeclaration>): ProviderConfiguration => {
  const parsed = parseProviderConfiguration({
    provider: {
      defaultChain: "default",
      entries: { sub: { class: "subscription" }, paid: { class: "pay-per-token" } },
      chains: { default: { entries: ["sub", "paid"], allowPaidFallback: true } },
      budgets,
    },
  });
  if (!parsed.ok) throw new Error(parsed.error.detail);
  return parsed.config;
};

const ticketBudget: Record<string, ProviderBudgetDeclaration> = {
  ticketCap: { enabled: true, scope: "ticket", basis: "cost", ceiling: 100 },
};
const windowBudget: Record<string, ProviderBudgetDeclaration> = {
  windowCap: { enabled: true, scope: "window", basis: "cost", ceiling: 100, windowSeconds: 3600 },
};

type Recorder = {
  readonly calls: ProviderSpendTotalsInput[];
  readonly seamCalls: () => number;
  readonly port: {
    readonly read: (input: ProviderSpendTotalsInput) => Promise<ProviderSpendTotalsRead>;
  };
};

const recorder = (
  ref: { status: "resolved"; workItemRef: string } | { status: "unresolved" },
): Recorder => {
  const calls: ProviderSpendTotalsInput[] = [];
  let seamCalls = 0;
  return {
    calls,
    seamCalls: () => seamCalls,
    port: {
      read: async (input) => {
        calls.push(input);
        if (ref.status !== "resolved") return { status: "empty" };
        return {
          status: "measured",
          totals: input.scopes.map((scope) => ({
            scopeKey: scope.scopeKey,
            cost: 0,
            tokens: 0,
            newestAtMs: null,
          })),
        };
      },
    },
  };
};

const engineWith = (
  record: Recorder,
  ref: { status: "resolved"; workItemRef: string } | { status: "unresolved" },
  stateStore?: Parameters<typeof createProviderEngine>[0]["stateStore"],
) => {
  const seams = {
    credentials: 0,
    transport: 0,
    seam: 0,
  };
  const seam = () => {
    seams.seam += 1;
    return ref;
  };
  return {
    seams,
    engine: createProviderEngine({
      clock: { nowMs: () => NOW },
      credentialPort: {
        resolve: () => {
          seams.credentials += 1;
          return { ok: true, material: { value: "CANARY" } };
        },
      },
      transport: {
        send: async () => {
          seams.transport += 1;
          return { status: 200, bodyText: "{}" };
        },
      },
      sleep: { sleep: async () => undefined },
      ...(stateStore === undefined ? {} : { stateStore }),
      spendTotals: record.port,
      resolveWorkItemRef: seam,
      workItemContextPath: CONTEXT_PATH,
    }),
  };
};

describe("TC-REF-001 an enabled budget with no resolvable ref refuses once, before resolution", () => {
  for (const [scopeName, budgets] of [
    ["ticket", ticketBudget],
    ["window", windowBudget],
  ] as const) {
    for (const cell of ["no-context-file", "context-without-active-ref"] as const) {
      test(`${scopeName} / ${cell}: one input.refusal naming budgets, path and remedy`, async () => {
        const record = recorder({ status: "unresolved" });
        const { engine, seams } = engineWith(record, { status: "unresolved" });
        const result = await engine.resolve({ config: configWith(budgets), persist: false });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errorCode).toBe("input.value.rejected");
        const budgetName = Object.keys(budgets)[0] as string;
        expect(result.summary).toContain(budgetName);
        expect(result.summary).toContain(CONTEXT_PATH);
        expect(result.summary).toContain("disable the budget");
        // Exactly one refusal, and nothing measured, probed, or written.
        expect(result.summary.split("input.value.rejected").length - 1).toBe(0);
        expect(record.calls).toHaveLength(0);
        expect(seams.transport).toBe(0);
        expect(seams.credentials).toBe(0);
        expect(seams.seam).toBe(1);
        const resolved = resolveAppErrorCode("input.value.rejected");
        expect(resolved.ok).toBe(true);
        if (resolved.ok) expect(projectExitCode(resolved.entry.projectionClass)).toBe(1);
      });
    }
  }

  test("a budget-free invocation never calls the seam and keeps its normal outcome", async () => {
    const record = recorder({ status: "unresolved" });
    const { engine, seams } = engineWith(record, { status: "unresolved" });
    const parsed = parseProviderConfiguration({
      provider: {
        defaultChain: "default",
        entries: { sub: { class: "subscription" } },
        chains: { default: { entries: ["sub"], allowPaidFallback: false } },
      },
    });
    if (!parsed.ok) throw new Error(parsed.error.detail);
    const result = await engine.resolve({ config: parsed.config, persist: false });
    expect(result.ok).toBe(true);
    expect(seams.seam).toBe(0);
    expect(record.calls).toHaveLength(0);
  });
});

describe("TC-REF-002 a malformed context value is unresolvable and never reaches the fold", () => {
  test("three malformed values refuse; the valid control resolves through the context tier", () => {
    for (const malformed of ["gh-350", "", "GH-350/extra"]) {
      const outcome = resolveProviderWorkItemRef({
        contextRef: malformed,
        contextPath: CONTEXT_PATH,
        requiredBy: ["ticketCap"],
      });
      expect(outcome.status, malformed).toBe("unresolved");
      if (outcome.status !== "unresolved") continue;
      expect(outcome.summary).toContain(CONTEXT_PATH);
      expect(outcome.summary).not.toContain(malformed === "" ? "gh-350" : malformed);
    }
    const valid = resolveProviderWorkItemRef({
      contextRef: "GH-350",
      contextPath: CONTEXT_PATH,
      requiredBy: ["ticketCap"],
    });
    expect(valid).toMatchObject({ status: "resolved", workItemRef: "GH-350", source: "context" });
  });

  test("a malformed engine seam value refuses with input.value.rejected and zero fold calls", async () => {
    const record = recorder({ status: "resolved", workItemRef: "gh-350" });
    const { engine } = engineWith(record, { status: "resolved", workItemRef: "gh-350" });
    const result = await engine.resolve({ config: configWith(ticketBudget), persist: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe("input.value.rejected");
    expect(result.summary).not.toContain("gh-350");
    expect(record.calls).toHaveLength(0);
  });
});

describe("TC-REF-003 the read-only members never resolve a ref", () => {
  test("quota and parks answer normally with a declared enabled budget and no context", async () => {
    const root = makeTempRoot("provider-budget-ref-readonly");
    try {
      const { store } = openStore(makeIdentity(root));
      const record = recorder({ status: "unresolved" });
      const { engine, seams } = engineWith(record, { status: "unresolved" }, store);
      const config = configWith(ticketBudget);
      const quota = await engine.quota({ config });
      expect(quota.ok).toBe(true);
      const parks = engine.parks({ all: true });
      expect(parks.ok).toBe(true);
      expect(seams.seam).toBe(0);
      expect(record.calls).toHaveLength(0);
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-REF-005 the three-tier precedence measures the same ledger spend reports", () => {
  const seedRef = (
    store: ReturnType<typeof openStore>["store"],
    ref: string,
    cost: number,
  ): void => {
    const appended = appendHarnessTelemetry(
      store,
      `ref-${ref}`,
      makeSessionRecord({
        ref,
        runId: `run-${ref}`,
        sessionId: `ses-${ref}`,
        cost,
        tokens: { input: 10, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
        capturedAt: new Date(NOW - 3600 * 1000).toISOString(),
      }),
    );
    expect(appended.ok).toBe(true);
  };

  test("explicit wins, the context is the fallback, and neither refuses", async () => {
    const root = makeTempRoot("provider-budget-ref");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seedRef(store, "GH-700", 10);
      seedRef(store, "GH-701", 70);
      const port = createProviderSpendTotalsPort(store);
      const scopes = [{ scopeKey: "ticketCap", fromMs: 0 }];

      // Arm 1: the explicit fact wins and the seam is never consulted.
      const explicitRead = await port.read({ workItemRef: "GH-700", scopes });
      expect(explicitRead.status).toBe("measured");
      if (explicitRead.status === "measured") {
        expect(explicitRead.totals[0]?.cost).toBe(10);
        expect(explicitRead.totals[0]?.cost).not.toBe(70);
      }
      let seamCalls = 0;
      const explicitEngine = createProviderEngine({
        clock: { nowMs: () => NOW },
        credentialPort: { resolve: () => undefined },
        transport: { send: async () => ({ status: 200, bodyText: "{}" }) },
        sleep: { sleep: async () => undefined },
        spendTotals: port,
        resolveWorkItemRef: () => {
          seamCalls += 1;
          return { status: "resolved", workItemRef: "GH-701" };
        },
        workItemContextPath: CONTEXT_PATH,
      });
      const explicit = await explicitEngine.resolve({
        config: configWith(ticketBudget),
        persist: false,
        workItemRef: "GH-700",
      });
      expect(explicit.ok).toBe(true);
      expect(seamCalls).toBe(0);
      const explicitFold = readSpendLedger(store, "GH-700");
      if (!explicitFold.ok) throw new Error(explicitFold.error.code);
      const folded = computeSpendReport(explicitFold.value, { workItemRef: "GH-700" });
      if (!folded.ok) throw new Error("fold refused");
      expect(explicitRead.status === "measured" ? explicitRead.totals[0]?.cost : undefined).toBe(
        folded.data.costTotals.total,
      );

      // Arm 2: the context answers and the seam is called exactly once.
      seamCalls = 0;
      const contextEngine = createProviderEngine({
        clock: { nowMs: () => NOW },
        credentialPort: { resolve: () => undefined },
        transport: { send: async () => ({ status: 200, bodyText: "{}" }) },
        sleep: { sleep: async () => undefined },
        spendTotals: port,
        resolveWorkItemRef: () => {
          seamCalls += 1;
          return { status: "resolved", workItemRef: "GH-701" };
        },
        workItemContextPath: CONTEXT_PATH,
      });
      const context = await contextEngine.resolve({
        config: configWith(ticketBudget),
        persist: false,
      });
      expect(context.ok).toBe(true);
      expect(seamCalls).toBe(1);
      const contextRead = await port.read({ workItemRef: "GH-701", scopes });
      expect(contextRead.status === "measured" ? contextRead.totals[0]?.cost : undefined).toBe(70);

      // Arm 3: neither tier refuses once.
      const refusing = createProviderEngine({
        clock: { nowMs: () => NOW },
        credentialPort: { resolve: () => undefined },
        transport: { send: async () => ({ status: 200, bodyText: "{}" }) },
        sleep: { sleep: async () => undefined },
        spendTotals: port,
        resolveWorkItemRef: () => ({ status: "unresolved" }),
        workItemContextPath: CONTEXT_PATH,
      });
      const refused = await refusing.resolve({ config: configWith(ticketBudget), persist: false });
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.errorCode).toBe("input.value.rejected");
    } finally {
      removeRoot(root);
    }
  });
});
