/**
 * GH-350 TC-BUD-002..009, -011, -013, -014, -017 — the pure budget gate.
 *
 * Every case injects the clock, the spend-totals facts and the ref seam; no
 * suite reads the ambient clock, environment, network, or live tree. TC-BUD-001
 * (the declaration matrix through a resolved configuration) belongs to the
 * configuration phase that declares the catalog branch; TC-BUD-012 owns the
 * chain suite; TC-BUD-015/TC-CONFORM-004 own the evidence-bounds suite.
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveAppErrorCode } from "../../packages/cli/src/classify";
import { createProviderSpendTotalsPort } from "../../packages/cli/src/edge";
import { projectExitCode } from "../../packages/cli/src/projection";
import { resolveConfig } from "../../packages/core/src/config/index";
import type {
  CombinedProviderCondition,
  ProviderBudgetDeclaration,
  ProviderChain,
  ProviderConditionKind,
  ProviderConditionResult,
  ProviderConfiguration,
  ProviderDescriptor,
  ProviderResolveResult,
  ProviderSpendTotalsInput,
  ProviderSpendTotalsRead,
} from "../../packages/core/src/contracts/index";
import { computeSpendReport } from "../../packages/core/src/domain/spend";
import { type BudgetEvaluation, evaluateBudgets } from "../../packages/core/src/provider/budgets";
import { resolveProviderChain } from "../../packages/core/src/provider/chain";
import { combineProviderConditions } from "../../packages/core/src/provider/conditions";
import { createProviderEngine } from "../../packages/core/src/provider/engine";
import {
  parseAndValidateProviderConfiguration,
  parseProviderBudgets,
  parseProviderConfiguration,
} from "../../packages/core/src/provider/validate";
import { appendHarnessTelemetry, readSpendLedger } from "../../packages/core/src/state/index";
import { fileFacts } from "../fixtures/config/facts";
import { makeSessionRecord } from "../fixtures/spend/harness";
import {
  listStoreFiles,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const REF = "GH-350";
const CONTEXT_PATH = "/repo/.ai/local/pm-context.yaml";

const budgetsOf = (
  declarations: Record<string, ProviderBudgetDeclaration>,
): Record<string, ProviderBudgetDeclaration> => declarations;

/** A config with the two entries every budget chain case uses and no I/O seams. */
const configWith = (
  budgets: Record<string, ProviderBudgetDeclaration> | undefined,
  chain: readonly string[] = ["sub", "paid"],
  allowPaidFallback = true,
): ProviderConfiguration => {
  const parsed = parseProviderConfiguration({
    provider: {
      defaultChain: "default",
      entries: {
        sub: { class: "subscription" },
        paid: { class: "pay-per-token" },
      },
      chains: { default: { entries: [...chain], allowPaidFallback } },
      ...(budgets === undefined ? {} : { budgets }),
    },
  });
  if (!parsed.ok) throw new Error(parsed.error.detail);
  return parsed.config;
};

type RecordedRead = {
  readonly calls: ProviderSpendTotalsInput[];
  readonly port: {
    readonly read: (input: ProviderSpendTotalsInput) => Promise<ProviderSpendTotalsRead>;
  };
};

const recordedPort = (
  answer: ProviderSpendTotalsRead | ((input: ProviderSpendTotalsInput) => ProviderSpendTotalsRead),
): RecordedRead => {
  const calls: ProviderSpendTotalsInput[] = [];
  return {
    calls,
    port: {
      read: async (input) => {
        calls.push(input);
        return typeof answer === "function" ? answer(input) : answer;
      },
    },
  };
};

const measured = (
  entries: readonly { scopeKey: string; cost: number; tokens: number; newestAtMs: number | null }[],
): ProviderSpendTotalsRead => ({ status: "measured", totals: entries });

const engineWith = (options: {
  readonly read: RecordedRead;
  readonly ref?: { status: "resolved"; workItemRef: string } | { status: "unresolved" };
}) =>
  createProviderEngine({
    clock: { nowMs: () => NOW },
    // The budget path resolves no credential and calls no transport; both seams
    // throw so the assertion is non-vacuous.
    credentialPort: {
      resolve: () => {
        throw new Error("the budget path must not resolve a credential");
      },
    },
    transport: {
      send: () => {
        throw new Error("the budget path must not call the transport");
      },
    },
    sleep: { sleep: async () => undefined },
    spendTotals: options.read.port,
    resolveWorkItemRef: () => options.ref ?? { status: "resolved", workItemRef: REF },
    workItemContextPath: CONTEXT_PATH,
  });

const resolveWith = async (options: {
  readonly config: ProviderConfiguration;
  readonly read: RecordedRead;
  readonly ref?: { status: "resolved"; workItemRef: string } | { status: "unresolved" };
  readonly persist?: boolean;
  readonly workItemRef?: string;
  readonly chainName?: string;
}): Promise<ProviderResolveResult> =>
  engineWith({
    read: options.read,
    ...(options.ref === undefined ? {} : { ref: options.ref }),
  }).resolve({
    config: options.config,
    persist: options.persist ?? false,
    ...(options.chainName === undefined ? {} : { chainName: options.chainName }),
    ...(options.workItemRef === undefined ? {} : { workItemRef: options.workItemRef }),
  });

const parkCauseOf = (result: ProviderResolveResult): string | undefined => {
  if (!result.ok || result.decision.kind !== "parked") return undefined;
  return result.decision.park.cause;
};

const skippedReasonOf = (
  result: ProviderResolveResult,
  providerName: string,
): string | undefined => {
  if (!result.ok) return undefined;
  return result.skipped.find((entry) => entry.providerName === providerName)?.reason;
};

describe("TC-BUD-002 a disabled budget is inert", () => {
  test("no budget and a disabled budget perform zero reads and produce no condition", async () => {
    const none = recordedPort({ status: "empty" });
    const noneResult = await resolveWith({ config: configWith(undefined), read: none });
    expect(none.calls).toHaveLength(0);
    expect(noneResult.ok).toBe(true);
    if (!noneResult.ok) return;
    expect(noneResult.decision).toMatchObject({ kind: "selected", providerName: "sub" });

    const disabled = recordedPort({ status: "empty" });
    const disabledResult = await resolveWith({
      config: configWith(
        budgetsOf({
          capped: { enabled: false, scope: "window", basis: "cost", ceiling: 1, windowSeconds: 60 },
        }),
      ),
      read: disabled,
    });
    expect(disabled.calls).toHaveLength(0);
    expect(disabledResult).toEqual(noneResult);

    const enabled = recordedPort(
      measured([{ scopeKey: "capped", cost: 0, tokens: 0, newestAtMs: null }]),
    );
    const enabledResult = await resolveWith({
      config: configWith(
        budgetsOf({
          capped: { enabled: true, scope: "window", basis: "cost", ceiling: 1, windowSeconds: 60 },
        }),
      ),
      read: enabled,
    });
    expect(enabled.calls).toHaveLength(1);
    expect(enabledResult.ok).toBe(true);
    if (!enabledResult.ok) return;
    expect(enabledResult.decision).toMatchObject({ kind: "selected", providerName: "sub" });
    expect(enabledResult.parks).toEqual([]);
  });
});

describe("TC-BUD-003 a window crossing parks with the exact expiry and five evidence fields", () => {
  const newestAtMs = NOW - 3 * 3600 * 1000;
  const config = configWith(
    budgetsOf({
      daily: { enabled: true, scope: "window", basis: "cost", ceiling: 40, windowSeconds: 86_400 },
    }),
  );

  test("the park carries cause/kind budget-exhausted, the exact instant, and an info announcement", async () => {
    const read = recordedPort(measured([{ scopeKey: "daily", cost: 40, tokens: 0, newestAtMs }]));
    const result = await resolveWith({ config, read });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const providerPark = result.parks.find((park) => park.name === "provider:sub");
    expect(providerPark?.cause).toBe("budget-exhausted");
    expect(providerPark?.conditions).toEqual(["budget-exhausted"]);
    expect(providerPark?.expiresAtMs).toBe(newestAtMs + 86_400 * 1000);
    expect(providerPark?.expiresAtMs).toBeGreaterThan(NOW);
    // The decision is the chain park over the one contributing provider park.
    expect(result.decision.kind).toBe("parked");
    if (result.decision.kind !== "parked") return;
    expect(result.decision.park.cause).toBe("chain-exhausted");
    expect(result.decision.park.conditions).toEqual(["budget-exhausted"]);
    expect(result.decision.park.expiresAtMs).toBe(newestAtMs + 86_400 * 1000);
    expect(providerPark?.evidence).toMatchObject({
      budgetName: "daily",
      budgetScope: "window",
      budgetBasis: "cost",
      budgetMeasured: 40,
      budgetCeiling: 40,
    });
    const announcement = result.announcements.find(
      (entry) => entry.code === "provider.budget.parked",
    );
    expect(announcement?.severity).toBe("info");
    expect(announcement?.message).toContain("daily");
    expect(announcement?.message).toContain(REF);
  });

  test("the evaluator's outcome evidence is exactly the five declared fields", () => {
    const evaluation: BudgetEvaluation = evaluateBudgets({
      budgets: config.budgets,
      read: measured([{ scopeKey: "daily", cost: 40, tokens: 0, newestAtMs }]),
      nowMs: NOW,
    });
    const outcome = evaluation.outcomes.daily;
    expect(outcome?.status).toBe("parked");
    if (outcome === undefined || outcome.status !== "parked") return;
    expect(Object.keys(outcome.evidence).sort()).toEqual([
      "budgetBasis",
      "budgetCeiling",
      "budgetMeasured",
      "budgetName",
      "budgetScope",
    ]);
    expect(outcome.evidence).toEqual({
      budgetName: "daily",
      budgetScope: "window",
      budgetBasis: "cost",
      budgetMeasured: 40,
      budgetCeiling: 40,
    });
  });
});

describe("TC-BUD-004 every window park expiry is strictly future and exact", () => {
  test("24 cells: every crossing parks at newest + window, every non-crossing is clear", () => {
    const windowSeconds = 3600;
    const ceiling = 100;
    const newestOptions = [NOW, NOW - 1_000, NOW - 3600_000, NOW - windowSeconds * 1000];
    let parks = 0;
    let cells = 0;
    for (const basis of ["cost", "tokens"] as const) {
      for (const measuredFigure of [ceiling - 1, ceiling, ceiling + 1]) {
        for (const newestAtMs of newestOptions) {
          cells += 1;
          const evaluation = evaluateBudgets({
            budgets: {
              hourly: { enabled: true, scope: "window", basis, ceiling, windowSeconds },
            },
            read: measured([
              {
                scopeKey: "hourly",
                cost: basis === "cost" ? measuredFigure : 0,
                tokens: basis === "tokens" ? measuredFigure : 0,
                newestAtMs,
              },
            ]),
            nowMs: NOW,
          });
          const outcome = evaluation.outcomes.hourly;
          if (measuredFigure < ceiling) {
            expect(outcome?.status, `${basis}/${measuredFigure}`).toBe("clear");
            continue;
          }
          if (newestAtMs === NOW - windowSeconds * 1000) {
            // A boundary observation cannot supply a strictly-future resume
            // instant: the crossing fails rather than fabricating a park.
            expect(outcome?.status, `${basis}/${measuredFigure}/boundary`).toBe("failed");
            if (outcome === undefined) continue;
            expect(Object.hasOwn(outcome, "expiresAtMs")).toBe(false);
            continue;
          }
          parks += 1;
          expect(outcome?.status, `${basis}/${measuredFigure}/${newestAtMs}`).toBe("parked");
          if (outcome === undefined || outcome.status !== "parked") continue;
          expect(outcome.expiresAtMs).toBe(newestAtMs + windowSeconds * 1000);
          expect(outcome.expiresAtMs).toBeGreaterThan(NOW);
          expect(outcome.waitSeconds).toBe(Math.floor((outcome.expiresAtMs - NOW) / 1000));
          expect(outcome.announcementCode).toBe("provider.budget.parked");
        }
      }
    }
    expect(cells).toBe(24);
    expect(parks).toBe(8);
  });
});

describe("TC-BUD-005 a ticket crossing is a failed entry, never a park", () => {
  const config = configWith(
    budgetsOf({
      ticketCap: { enabled: true, scope: "ticket", basis: "cost", ceiling: 200, entries: ["sub"] },
    }),
  );

  test("skipped budget-exhausted, no park, a warning, five fields, no expiry, paid still selectable", async () => {
    const read = recordedPort(
      measured([{ scopeKey: "ticketCap", cost: 200, tokens: 0, newestAtMs: NOW - 1_000 }]),
    );
    const result = await resolveWith({ config, read });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision).toMatchObject({
      kind: "selected",
      providerName: "paid",
      costClass: "pay-per-token",
    });
    expect(skippedReasonOf(result, "sub")).toBe("budget-exhausted");
    expect(result.parks.some((park) => park.cause === "budget-exhausted")).toBe(false);
    const crossed = result.announcements.find((entry) => entry.code === "provider.budget.crossed");
    expect(crossed?.severity).toBe("warning");
    expect(crossed?.evidence).toMatchObject({
      budgetName: "ticketCap",
      budgetScope: "ticket",
      budgetBasis: "cost",
      budgetMeasured: 200,
      budgetCeiling: 200,
    });
    const evaluation = evaluateBudgets({
      budgets: config.budgets,
      read: measured([{ scopeKey: "ticketCap", cost: 200, tokens: 0, newestAtMs: NOW - 1_000 }]),
      nowMs: NOW,
    });
    const outcome = evaluation.outcomes.ticketCap;
    expect(outcome?.status).toBe("failed");
    if (outcome === undefined) return;
    expect(Object.hasOwn(outcome, "expiresAtMs")).toBe(false);
    expect(Object.keys(outcome.evidence).sort()).toEqual([
      "budgetBasis",
      "budgetCeiling",
      "budgetMeasured",
      "budgetName",
      "budgetScope",
    ]);
  });
});

const peakActive = (): ProviderDescriptor["peak"] => ({
  timezone: "UTC",
  startSecondsOfDay: 0,
  endSecondsOfDay: 86_399,
  bufferSeconds: 0,
});

const configWithPeak = (
  budgets: Record<string, ProviderBudgetDeclaration>,
): ProviderConfiguration => {
  const parsed = parseProviderConfiguration({
    provider: {
      defaultChain: "default",
      entries: {
        sub: { class: "subscription", peak: peakActive() },
        parked: { class: "subscription", peak: peakActive() },
        eligible: { class: "subscription" },
        paid: { class: "pay-per-token" },
      },
      chains: {
        default: { entries: ["sub", "eligible"], allowPaidFallback: true },
        parkedOnly: { entries: ["sub", "parked"], allowPaidFallback: true },
      },
      budgets,
    },
  });
  if (!parsed.ok) throw new Error(parsed.error.detail);
  return parsed.config;
};

describe("TC-BUD-006 the ticket refusal is terminal only when nothing honest supplies a resume", () => {
  const ticketBudget = budgetsOf({
    ticketCap: { enabled: true, scope: "ticket", basis: "cost", ceiling: 200, entries: ["sub"] },
  });
  const crossingRead = recordedPort(
    measured([{ scopeKey: "ticketCap", cost: 200, tokens: 0, newestAtMs: NOW - 1_000 }]),
  );

  test("(a) a later eligible entry serves with no budget refusal", async () => {
    const read = recordedPort(
      measured([{ scopeKey: "ticketCap", cost: 200, tokens: 0, newestAtMs: NOW - 1_000 }]),
    );
    const result = await resolveWith({ config: configWith(ticketBudget), read });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision).toMatchObject({ kind: "selected", providerName: "paid" });
  });

  test("(b) a contributing honest park supplies the chain expiry, no budget refusal", async () => {
    const result = await resolveWith({
      config: configWithPeak(ticketBudget),
      read: crossingRead,
      chainName: "parkedOnly",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("parked");
    if (result.decision.kind !== "parked") return;
    expect(result.decision.park.cause).toBe("chain-exhausted");
    expect(result.decision.park.expiresAtMs).toBeGreaterThan(NOW);
  });

  test("(c) nothing honest remains: provider.budget.exceeded at exit 1 with the facts", async () => {
    const onlySub = configWith(ticketBudget, ["sub"], false);
    const result = await resolveWith({ config: onlySub, read: crossingRead });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe("provider.budget.exceeded");
    expect(result.summary).toContain("ticketCap");
    expect(result.summary).toContain("ticket");
    expect(result.summary).toContain("cost");
    expect(result.summary).toContain("200");
    expect(result.summary).toContain("cannot reopen");
    expect(result.summary).toContain(REF);
    const resolved = resolveAppErrorCode("provider.budget.exceeded");
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.entry.projectionClass).toBe("user-validation");
      expect(projectExitCode(resolved.entry.projectionClass)).toBe(1);
    }
  });
});

describe("TC-BUD-007 exactly one spend read per evaluation at any budget count", () => {
  const budgetSet = (count: number): Record<string, ProviderBudgetDeclaration> => {
    const budgets: Record<string, ProviderBudgetDeclaration> = {};
    for (let index = 0; index < count; index += 1) {
      budgets[`b${index}`] = {
        enabled: true,
        scope: index % 2 === 0 ? "ticket" : "window",
        basis: index % 3 === 0 ? "cost" : "tokens",
        ceiling: 1000,
        ...(index % 2 === 0 ? {} : { windowSeconds: 3600 }),
      };
    }
    return budgets;
  };

  test("0, 1, 3 and 8 budgets read 0, 1, 1 and 1 times and cover every scope once", async () => {
    for (const [count, expected] of [
      [0, 0],
      [1, 1],
      [3, 1],
      [8, 1],
    ] as const) {
      const budgets = count === 0 ? undefined : budgetSet(count);
      const read = recordedPort((input) => ({
        status: "measured",
        totals: input.scopes.map((scope) => ({
          scopeKey: scope.scopeKey,
          cost: 0,
          tokens: 0,
          newestAtMs: null,
        })),
      }));
      const result = await resolveWith({ config: configWith(budgets), read });
      expect(result.ok).toBe(true);
      expect(read.calls, `${count} budgets`).toHaveLength(expected);
      if (count === 0) continue;
      const scopes = read.calls[0]?.scopes ?? [];
      expect(scopes).toHaveLength(count);
      expect(new Set(scopes.map((scope) => scope.scopeKey)).size).toBe(count);
    }
  });
});

describe("TC-BUD-008 the evaluation path writes nothing", () => {
  test("a populated store's files are byte-identical after a park and a crossing evaluation", async () => {
    const root = makeTempRoot("provider-budget-nowrite");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      // Populate the ledger so an accidental write is visible.
      const seeded = appendHarnessTelemetry(
        store,
        "budget-nowrite-seed",
        makeSessionRecord({
          ref: REF,
          runId: "run-seed",
          sessionId: "ses-seed",
          cost: 5,
          capturedAt: new Date(NOW - 3600 * 1000).toISOString(),
        }),
      );
      expect(seeded.ok).toBe(true);
      const snapshot = (): string[] =>
        listStoreFiles(identity.stateDirectory).map((name) => {
          const bytes = readFileSync(join(identity.stateDirectory, name));
          return `${name}:${createHash("sha256").update(bytes).digest("hex")}`;
        });
      const before = snapshot();
      const read = recordedPort(
        measured([
          { scopeKey: "win", cost: 50, tokens: 0, newestAtMs: NOW - 60_000 },
          { scopeKey: "ticketCap", cost: 200, tokens: 0, newestAtMs: NOW - 1_000 },
        ]),
      );
      const result = await resolveWith({
        config: configWith(
          budgetsOf({
            win: {
              enabled: true,
              scope: "window",
              basis: "cost",
              ceiling: 40,
              windowSeconds: 3600,
            },
            ticketCap: {
              enabled: true,
              scope: "ticket",
              basis: "cost",
              ceiling: 200,
              entries: ["sub"],
            },
          }),
          ["sub", "paid"],
          true,
        ),
        read,
        persist: false,
      });
      expect(result.ok).toBe(true);
      expect(snapshot()).toEqual(before);
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-BUD-009 verified-empty measures zero; damage refuses and never reads clear", () => {
  const config = configWith(
    budgetsOf({
      daily: { enabled: true, scope: "window", basis: "tokens", ceiling: 10, windowSeconds: 60 },
      ticketCap: { enabled: true, scope: "ticket", basis: "cost", ceiling: 10 },
    }),
  );

  test("verified-empty is an honest zero for every scope and evaluates clear", async () => {
    const read = recordedPort({ status: "empty" });
    const result = await resolveWith({ config, read });
    expect(read.calls).toHaveLength(1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision).toMatchObject({ kind: "selected", providerName: "sub" });
    expect(result.parks).toEqual([]);
    expect(result.announcements).toEqual([]);
    const evaluation = evaluateBudgets({
      budgets: config.budgets,
      read: { status: "empty" },
      nowMs: NOW,
    });
    expect(Object.values(evaluation.outcomes).every((outcome) => outcome.status === "clear")).toBe(
      true,
    );
  });

  test("a failed read refuses with the delivered state identity and creates no park", async () => {
    const read = recordedPort({ status: "failed", code: "state.store.torn" });
    const result = await resolveWith({ config, read });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe("state.store.torn");
    expect(result.summary).toContain("state.store.torn");
    expect(Object.hasOwn(result, "parks")).toBe(false);
    const resolved = resolveAppErrorCode("state.store.torn");
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(projectExitCode(resolved.entry.projectionClass)).toBe(2);
  });

  test("newestAtMs null admits no park and no expiry (NFR-6)", () => {
    const evaluation = evaluateBudgets({
      budgets: budgetsOf({
        daily: { enabled: true, scope: "window", basis: "cost", ceiling: 1, windowSeconds: 60 },
      }),
      read: measured([{ scopeKey: "daily", cost: 999, tokens: 0, newestAtMs: null }]),
      nowMs: NOW,
    });
    const outcome = evaluation.outcomes.daily;
    expect(outcome?.status).toBe("failed");
    if (outcome === undefined) return;
    expect(Object.hasOwn(outcome, "expiresAtMs")).toBe(false);
  });
});

const conditionOf = (
  kind: ProviderConditionKind,
  waitSeconds = 60,
  expiresAtMs = NOW + 60_000,
): ProviderConditionResult => ({
  status: "parked",
  kind,
  waitSeconds,
  expiresAtMs,
  announcementCode:
    kind === "peak-window"
      ? "provider.peak.parked"
      : kind === "quota-exhausted"
        ? "provider.quota.parked"
        : kind === "budget-exhausted"
          ? "provider.budget.parked"
          : kind === "provider-outage"
            ? "provider.quota.unreachable"
            : kind === "credential-missing"
              ? "provider.credential.missing"
              : "provider.quota.auth_rejected",
  evidence: { conditionKinds: [kind], waitSeconds },
});

describe("TC-BUD-010 class P: a budget-parked subscription never licenses paid capacity", () => {
  const parkedSub = (): CombinedProviderCondition => ({
    status: "parked",
    cause: "budget-exhausted",
    conditions: ["budget-exhausted"],
    waitSeconds: 3600,
    expiresAtMs: NOW + 3600 * 1000,
    announcementCode: "provider.budget.parked",
    evidence: {
      budgetName: "daily",
      budgetScope: "window",
      budgetBasis: "cost",
      budgetMeasured: 40,
      budgetCeiling: 40,
    },
  });
  const clear: CombinedProviderCondition = { status: "clear" };
  const descriptor = (name: string, costClass: "subscription" | "pay-per-token" = "subscription") =>
    ({ name, class: costClass, enabled: true }) as ProviderDescriptor;

  test("three composable chain shapes never select paid", async () => {
    const configs: ProviderConfiguration[] = [];
    const shapes: readonly string[][] = [
      ["sub", "paid"],
      ["sub", "paid", "paidTwo"],
      ["sub", "paid"],
    ];
    for (const entries of shapes) {
      const parsed = parseProviderConfiguration({
        provider: {
          defaultChain: "default",
          entries: {
            sub: { class: "subscription" },
            paid: { class: "pay-per-token" },
            paidTwo: { class: "pay-per-token" },
          },
          chains: { default: { entries: [...entries], allowPaidFallback: true } },
          budgets: {
            daily: {
              enabled: true,
              scope: "window",
              basis: "cost",
              ceiling: 40,
              windowSeconds: 3600,
              entries: ["sub"],
            },
          },
        },
      });
      if (!parsed.ok) throw new Error(parsed.error.detail);
      configs.push(parsed.config);
    }
    for (const config of configs) {
      const read = recordedPort(
        measured([{ scopeKey: "daily", cost: 40, tokens: 0, newestAtMs: NOW - 60_000 }]),
      );
      const result = await resolveWith({ config, read });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const providerPark = result.parks.find((park) => park.name === "provider:sub");
      expect(providerPark?.cause).toBe("budget-exhausted");
      expect(providerPark?.expiresAtMs).toBeGreaterThan(NOW);
      expect(result.decision.kind).toBe("parked");
      if (result.decision.kind !== "parked") continue;
      expect(result.decision.park.cause).toBe("chain-exhausted");
      expect(result.decision.park.conditions).toContain("budget-exhausted");
      expect(result.decision.park.expiresAtMs).toBe(providerPark?.expiresAtMs);
      expect(
        result.skipped.some(
          (entry) =>
            ["paid", "paidTwo"].includes(entry.providerName) && entry.reason === "shadowed",
        ),
      ).toBe(true);
    }
  });

  test("even a paid-first chain never selects paid when the subscription is budget-parked", () => {
    const outcome = resolveProviderChain({
      chain: { name: "default", entries: ["paid", "sub"], allowPaidFallback: true },
      nowMs: NOW,
      states: {
        paid: { descriptor: descriptor("paid", "pay-per-token"), condition: clear },
        sub: { descriptor: descriptor("sub"), condition: parkedSub() },
      },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.decision.kind).toBe("parked");
  });
});

describe("TC-BUD-011 the MAX combination places budget-exhausted third", () => {
  const order = [
    "peak-window",
    "quota-exhausted",
    "budget-exhausted",
    "provider-outage",
    "credential-missing",
    "credential-rejected",
  ] as const;

  test("every adjacent pair in both input orders resolves to the declared-higher kind", () => {
    for (let index = 0; index < order.length - 1; index += 1) {
      const higher = order[index] as ProviderConditionKind;
      const lower = order[index + 1] as ProviderConditionKind;
      for (const pair of [
        [higher, lower],
        [lower, higher],
      ] as const) {
        const combined = combineProviderConditions(pair.map((kind) => conditionOf(kind)));
        expect(combined.status).toBe("parked");
        if (combined.status !== "parked") continue;
        expect(combined.cause, `${pair.join("|")}`).toBe(higher);
      }
    }
  });

  test("the six-way combination reproduces the whole declared order", () => {
    const combined = combineProviderConditions(
      [...order].reverse().map((kind) => conditionOf(kind)),
    );
    expect(combined.status).toBe("parked");
    if (combined.status !== "parked") return;
    expect(combined.cause).toBe("peak-window");
    expect(combined.conditions).toEqual([...order]);
    expect(combined.waitSeconds).toBe(60);
  });
});

describe("TC-BUD-013 the gate measures what the spend report measures", () => {
  test("one fold feeds both figures; the ticket and window scopes match the report", async () => {
    const root = makeTempRoot("provider-budget-parity");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const records = [
        makeSessionRecord({
          ref: REF,
          runId: "run-old",
          sessionId: "ses-old",
          tokens: { input: 100, output: 50, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
          cost: 10,
          capturedAt: new Date(NOW - 3 * 3600 * 1000).toISOString(),
        }),
        makeSessionRecord({
          ref: REF,
          runId: "run-new",
          sessionId: "ses-new",
          tokens: { input: 200, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
          cost: 30,
          capturedAt: new Date(NOW - 3600 * 1000).toISOString(),
        }),
      ];
      for (const [index, record] of records.entries()) {
        const appended = appendHarnessTelemetry(store, `parity-${index}`, record);
        expect(appended.ok).toBe(true);
      }
      const ticketRead = readSpendLedger(store, REF);
      if (!ticketRead.ok) throw new Error(ticketRead.error.code);
      const ticketFold = computeSpendReport(ticketRead.value, { workItemRef: REF });
      if (!ticketFold.ok) throw new Error("fold refused");
      const windowRead = readSpendLedger(store, REF);
      if (!windowRead.ok) throw new Error(windowRead.error.code);
      const windowFold = computeSpendReport(
        {
          ...windowRead.value,
          records: windowRead.value.records.filter(
            (record) => Date.parse(record.capturedAt) >= NOW - 2 * 3600 * 1000,
          ),
        },
        { workItemRef: REF },
      );
      if (!windowFold.ok) throw new Error("window fold refused");

      const port = createProviderSpendTotalsPort(store);
      const answer = await port.read({
        workItemRef: REF,
        scopes: [
          { scopeKey: "ticketCap", fromMs: 0 },
          { scopeKey: "windowCap", fromMs: NOW - 2 * 3600 * 1000 },
        ],
      });
      expect(answer.status).toBe("measured");
      if (answer.status !== "measured") return;
      const ticket = answer.totals.find((total) => total.scopeKey === "ticketCap");
      const window = answer.totals.find((total) => total.scopeKey === "windowCap");
      expect(ticket?.cost).toBe(ticketFold.data.costTotals.total);
      expect(ticket?.tokens).toBe(
        Object.values(ticketFold.data.tokensByClass).reduce((sum, value) => sum + value, 0),
      );
      expect(window?.cost).toBe(windowFold.data.costTotals.total);
      expect(window?.tokens).toBe(
        Object.values(windowFold.data.tokensByClass).reduce((sum, value) => sum + value, 0),
      );
      expect(window?.newestAtMs).toBe(NOW - 3600 * 1000);
      // No per-record data crosses the port: the projected shape is closed.
      for (const total of answer.totals) {
        const unknown = Object.keys(total).filter(
          (key) => !["scopeKey", "cost", "tokens", "newestAtMs", "sparse"].includes(key),
        );
        expect(unknown).toEqual([]);
      }
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-BUD-014 identical facts replay byte-identically regardless of declaration order", () => {
  test("a shuffled budget declaration changes no byte of the decision", async () => {
    const declarations: [string, ProviderBudgetDeclaration][] = [
      [
        "daily",
        { enabled: true, scope: "window", basis: "cost", ceiling: 40, windowSeconds: 3600 },
      ],
      ["ticketCap", { enabled: true, scope: "ticket", basis: "tokens", ceiling: 10 }],
      [
        "other",
        { enabled: true, scope: "window", basis: "tokens", ceiling: 5, windowSeconds: 600 },
      ],
    ];
    const read = recordedPort(
      measured([
        { scopeKey: "daily", cost: 40, tokens: 0, newestAtMs: NOW - 60_000 },
        { scopeKey: "ticketCap", cost: 0, tokens: 12, newestAtMs: NOW - 1_000 },
        { scopeKey: "other", cost: 0, tokens: 6, newestAtMs: NOW - 30_000 },
      ]),
    );
    const forward = await resolveWith({
      config: configWith(Object.fromEntries(declarations)),
      read,
    });
    const shuffledRead = recordedPort(
      measured([
        { scopeKey: "daily", cost: 40, tokens: 0, newestAtMs: NOW - 60_000 },
        { scopeKey: "ticketCap", cost: 0, tokens: 12, newestAtMs: NOW - 1_000 },
        { scopeKey: "other", cost: 0, tokens: 6, newestAtMs: NOW - 30_000 },
      ]),
    );
    const shuffled = await resolveWith({
      config: configWith(Object.fromEntries([...declarations].reverse())),
      read: shuffledRead,
    });
    expect(JSON.stringify(shuffled)).toBe(JSON.stringify(forward));
  });
});

describe("TC-BUD-017 class T: a ticket-scope failure does not block a paid entry", () => {
  const ticketBudget = budgetsOf({
    ticketCap: { enabled: true, scope: "ticket", basis: "cost", ceiling: 200, entries: ["sub"] },
  });
  const crossingRead = (): RecordedRead =>
    recordedPort(
      measured([{ scopeKey: "ticketCap", cost: 200, tokens: 0, newestAtMs: NOW - 1_000 }]),
    );

  test("paid after the failed subscription is selected, with no park and no refusal", async () => {
    const result = await resolveWith({ config: configWith(ticketBudget), read: crossingRead() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision).toMatchObject({ kind: "selected", providerName: "paid" });
    expect(skippedReasonOf(result, "sub")).toBe("budget-exhausted");
    expect(result.parks).toEqual([]);
    expect(result.announcements.map((entry) => entry.code)).toContain("provider.budget.crossed");
  });

  test("paid before the failed subscription is still selected", () => {
    const failed: CombinedProviderCondition = {
      status: "failed",
      cause: "budget-exhausted",
      conditions: ["budget-exhausted"],
      errorCode: "provider.budget.exceeded",
      announcementCode: "provider.budget.crossed",
      evidence: {
        budgetName: "ticketCap",
        budgetScope: "ticket",
        budgetBasis: "cost",
        budgetMeasured: 200,
        budgetCeiling: 200,
      },
    };
    const outcome = resolveProviderChain({
      chain: { name: "default", entries: ["paid", "sub"], allowPaidFallback: true },
      nowMs: NOW,
      states: {
        paid: {
          descriptor: { name: "paid", class: "pay-per-token", enabled: true },
          condition: { status: "clear" },
        },
        sub: {
          descriptor: { name: "sub", class: "subscription", enabled: true },
          condition: failed,
        },
      },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.decision).toMatchObject({ kind: "selected", providerName: "paid" });
    expect(outcome.decision.kind === "parked").toBe(false);
    expect(outcome.skipped).toEqual([{ providerName: "sub", reason: "budget-exhausted" }]);
  });
});

describe("TC-BUD-016 no second measurement path is reachable from the gate", () => {
  test("the budget tier imports no state read and the projection is the edge's one fold", () => {
    const budgetsText = readFileSync(
      join(process.cwd(), "packages/core/src/provider/budgets.ts"),
      "utf8",
    );
    for (const forbidden of ["readSpendLedger", "computeSpendReport", "#state", "adapters"]) {
      expect(budgetsText, forbidden).not.toContain(forbidden);
    }
    const edgeText = readFileSync(join(process.cwd(), "packages/cli/src/edge.ts"), "utf8");
    const projection = edgeText.slice(edgeText.indexOf("createProviderSpendTotalsPort"));
    expect(projection).toContain("readSpendLedger");
    expect(projection).toContain("computeSpendReport");
    expect(projection.indexOf("readSpendLedger")).toBeLessThan(
      projection.indexOf("computeSpendReport"),
    );
  });
});

describe("TC-BUD-001 the budget declaration matrix fails closed naming the field", () => {
  /** Resolve a declaration through the production catalog, exactly as configuration does. */
  const resolveDeclaration = (
    budget: Record<string, unknown>,
  ):
    | { readonly ok: true; readonly budgets: Record<string, ProviderBudgetDeclaration> }
    | {
        readonly ok: false;
        readonly code: string;
        readonly detail?: string;
        readonly layer?: string;
      } => {
    const resolved = resolveConfig({
      sources: [
        fileFacts(
          "project-committed",
          {
            provider: {
              entries: { sub: { class: "subscription" } },
              budgets: { b: budget },
            },
          },
          6,
        ),
      ],
    });
    if (!resolved.ok) {
      return { ok: false, code: resolved.error.code, layer: resolved.error.layer };
    }
    const parsed = parseAndValidateProviderConfiguration(resolved.value.values);
    if (!parsed.ok) return { ok: false, code: parsed.error.code, detail: parsed.error.detail };
    return { ok: true, budgets: parsed.config.budgets ?? {} };
  };

  test("the valid corpus validates for every declared combination of the six children", () => {
    let checked = 0;
    for (const scope of ["ticket", "window"] as const) {
      for (const basis of ["cost", "tokens"] as const) {
        for (const enabled of [true, false]) {
          for (const entries of [undefined, ["sub"]] as const) {
            const budget = {
              enabled,
              scope,
              basis,
              ceiling: 40,
              ...(scope === "window" ? { windowSeconds: 3600 } : {}),
              ...(entries === undefined ? {} : { entries }),
            };
            const result = resolveDeclaration(budget);
            const label = JSON.stringify(budget);
            expect(result.ok, label).toBe(true);
            if (!result.ok) continue;
            expect(result.budgets.b, label).toEqual({
              enabled,
              scope,
              basis,
              ceiling: 40,
              ...(scope === "window" ? { windowSeconds: 3600 } : {}),
              ...(entries === undefined ? {} : { entries }),
            });
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBe(16);
  });

  test("every invalid child refuses with the declared identity naming exactly the field", () => {
    const invalid: readonly {
      readonly label: string;
      readonly budget: Record<string, unknown>;
      readonly code: string;
      readonly field?: string;
    }[] = [
      {
        label: "unknown scope",
        budget: { scope: "weekly", basis: "cost", ceiling: 40 },
        code: "provider.chain.invalid",
        field: "provider.budgets.b.scope",
      },
      {
        label: "unknown basis",
        budget: { scope: "ticket", basis: "usd", ceiling: 40 },
        code: "provider.chain.invalid",
        field: "provider.budgets.b.basis",
      },
      {
        label: "ceiling 0",
        budget: { scope: "ticket", basis: "cost", ceiling: 0 },
        code: "provider.chain.invalid",
        field: "provider.budgets.b.ceiling",
      },
      {
        label: "ceiling -1",
        budget: { scope: "ticket", basis: "cost", ceiling: -1 },
        code: "provider.chain.invalid",
        field: "provider.budgets.b.ceiling",
      },
      {
        label: "windowSeconds 0",
        budget: { scope: "window", basis: "cost", ceiling: 40, windowSeconds: 0 },
        code: "provider.chain.invalid",
        field: "provider.budgets.b.windowSeconds",
      },
      {
        label: "windowSeconds on ticket",
        budget: { scope: "ticket", basis: "cost", ceiling: 40, windowSeconds: 60 },
        code: "provider.chain.invalid",
        field: "provider.budgets.b.windowSeconds",
      },
      {
        label: "windowSeconds absent on window",
        budget: { scope: "window", basis: "cost", ceiling: 40 },
        code: "provider.chain.invalid",
        field: "provider.budgets.b.windowSeconds",
      },
      {
        label: "an undeclared descriptor",
        budget: { scope: "ticket", basis: "cost", ceiling: 40, entries: ["ghost"] },
        code: "provider.chain.invalid",
        field: "provider.budgets.b.entries",
      },
      {
        label: "empty entries",
        budget: { scope: "ticket", basis: "cost", ceiling: 40, entries: [] },
        code: "provider.chain.invalid",
        field: "provider.budgets.b.entries",
      },
      {
        label: "a non-boolean enabled",
        budget: { enabled: "yes", scope: "ticket", basis: "cost", ceiling: 40 },
        code: "config.value.invalid",
        field: "provider.budgets.b.enabled",
      },
    ];

    for (const entry of invalid) {
      const result = resolveDeclaration(entry.budget);
      expect(result.ok, entry.label).toBe(false);
      if (result.ok) continue;
      expect(result.code, entry.label).toBe(entry.code);
      if (entry.code === "provider.chain.invalid") {
        expect(result.detail, entry.label).toBe(entry.field);
      } else {
        // A wrong type is the configuration layer's identity; the field-level
        // refusal is the same pure rule, asserted directly below.
        expect(result.layer, entry.label).toBe("project-committed");
      }
      expect(result, entry.label).not.toHaveProperty("budgets");
    }

    // The field-level rule is the same one configuration reaches: handed the
    // untyped child, it names the exact path, so a type defect is not silent.
    const direct = parseProviderBudgets(
      { b: { enabled: "yes", scope: "ticket", basis: "cost", ceiling: 40 } },
      { sub: { name: "sub", class: "subscription", enabled: true } },
    );
    expect(direct).toBe("provider.budgets.b.enabled");
  });

  test("no evaluation result exists for an invalid declaration", () => {
    const parsed = parseAndValidateProviderConfiguration({
      provider: {
        entries: { sub: { class: "subscription" } },
        budgets: { b: { scope: "window", basis: "cost", ceiling: 40 } },
      },
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect("config" in parsed).toBe(false);
    expect(parsed.error.detail).toBe("provider.budgets.b.windowSeconds");
  });
});

/**
 * GH-350 n5 (review remediation) — the budget accumulator has a null prototype,
 * so a child named like a prototype member is an ordinary declared budget
 * instead of silently replacing the record's prototype.
 */
describe("GH-350 n5 the budget accumulator has a null prototype", () => {
  test("a __proto__ child is an own key and the record carries no prototype", () => {
    const raw = JSON.parse(
      '{"__proto__":{"enabled":true,"scope":"ticket","basis":"cost","ceiling":5}}',
    ) as Record<string, unknown>;
    const parsed = parseProviderBudgets(raw, {
      sub: { name: "sub", class: "subscription", enabled: true },
    });
    expect(typeof parsed).not.toBe("string");
    if (typeof parsed === "string") throw new Error(parsed);
    expect(Object.getPrototypeOf(parsed)).toBeNull();
    expect(Object.hasOwn(parsed, "__proto__")).toBe(true);
  });
});
