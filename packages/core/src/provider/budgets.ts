/**
 * Pure budget evaluation (GH-350 F-2, DM-3/DM-4, TDR-0057).
 *
 * A declared ceiling is compared against one injected, verified spend read.
 * Nothing here reads a store, a clock, or an environment: the totals arrive as
 * facts, the instant arrives as a fact, and the only outputs are conditions
 * (clear, a window park, or a ticket-scope failure).
 *
 * The park invariant is structural: a window park is constructible only with a
 * non-null `newestAtMs`, so no expiry is ever fabricated.
 */
import type {
  ProviderBudgetDeclaration,
  ProviderBudgetFacts,
  ProviderBudgetOutcome,
  ProviderConditionResult,
  ProviderParkEvidence,
  ProviderSpendTotals,
  ProviderSpendTotalsRead,
  ProviderSpendTotalsScope,
} from "#contracts";
import { SPEND_WORK_ITEM_REF_PATTERN } from "#contracts";

/** One enabled budget, with its declared name. */
export type EnabledBudget = {
  readonly name: string;
  readonly declaration: ProviderBudgetDeclaration;
};

/** Every enabled budget, sorted by name so evaluation order is declaration-order free. */
export const enabledBudgets = (
  budgets: Readonly<Record<string, ProviderBudgetDeclaration>> | undefined,
): readonly EnabledBudget[] =>
  Object.entries(budgets ?? {})
    .filter(([, declaration]) => declaration.enabled)
    .map(([name, declaration]) => ({ name, declaration }))
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

/**
 * The one read's scope projection: one scope per enabled budget, each naming its
 * lower bound (a ticket scope from the ref's beginning, a window scope from
 * `now - windowSeconds * 1000`). Both bases are returned per scope, so budgets on
 * different bases share this read.
 */
export const budgetScopes = (
  budgets: readonly EnabledBudget[],
  nowMs: number,
): readonly ProviderSpendTotalsScope[] =>
  budgets.map(({ name, declaration }) => ({
    scopeKey: name,
    fromMs: declaration.scope === "window" ? nowMs - (declaration.windowSeconds ?? 0) * 1_000 : 0,
  }));

/** The five closed evidence fields, and no sixth. */
const budgetEvidence = (facts: ProviderBudgetFacts): ProviderParkEvidence => ({
  budgetName: facts.budgetName,
  budgetScope: facts.scope,
  budgetBasis: facts.basis,
  budgetMeasured: facts.measured,
  budgetCeiling: facts.ceiling,
});

const totalsFor = (
  read: ProviderSpendTotalsRead,
  scopeKey: string,
): ProviderSpendTotals | undefined =>
  read.status === "measured" ? read.totals.find((entry) => entry.scopeKey === scopeKey) : undefined;

const measuredFigure = (
  declaration: ProviderBudgetDeclaration,
  totals: ProviderSpendTotals | undefined,
): number => {
  if (totals === undefined) return 0;
  return declaration.basis === "cost" ? totals.cost : totals.tokens;
};

export type BudgetEvaluationInput = {
  readonly budgets: Readonly<Record<string, ProviderBudgetDeclaration>> | undefined;
  readonly read: ProviderSpendTotalsRead;
  readonly nowMs: number;
};

export type BudgetEvaluation = {
  readonly outcomes: Readonly<Record<string, ProviderBudgetOutcome>>;
  /** The read the evaluation consumed; `undefined` means no gate and no read. */
  readonly scopes: readonly ProviderSpendTotalsScope[];
};

/**
 * Evaluate every enabled budget against one read (TDR-0057 D3).
 *
 * Clear below the ceiling; parked for a `window` scope at or above it, with the
 * exact expiry `newestAtMs + windowSeconds * 1000`; failed for a `ticket` scope
 * at or above it, with no expiry. A verified-empty read measures zero for every
 * scope, which is clear for any positive ceiling.
 */
export const evaluateBudgets = (input: BudgetEvaluationInput): BudgetEvaluation => {
  const budgets = enabledBudgets(input.budgets);
  const scopes = budgetScopes(budgets, input.nowMs);
  const outcomes: Record<string, ProviderBudgetOutcome> = {};
  for (const { name, declaration } of budgets) {
    const totals = totalsFor(input.read, name);
    const measured = input.read.status === "empty" ? 0 : measuredFigure(declaration, totals);
    const facts: ProviderBudgetFacts = {
      budgetName: name,
      scope: declaration.scope,
      basis: declaration.basis,
      measured,
      ceiling: declaration.ceiling,
    };
    if (measured < declaration.ceiling) {
      outcomes[name] = { status: "clear", budgetName: name };
      continue;
    }
    const sparse = totals?.sparse === true ? { sparse: true } : {};
    if (declaration.scope === "window") {
      const newestAtMs = totals?.newestAtMs ?? null;
      const windowSeconds = declaration.windowSeconds ?? 0;
      // NFR-6: a park is constructible only with a non-null newest observation
      // that is genuinely inside the trailing window, so `newest + window` is
      // strictly future. A boundary or stale observation cannot supply an
      // honest resume instant: the crossing fails rather than fabricating one.
      if (
        newestAtMs !== null &&
        windowSeconds > 0 &&
        newestAtMs > input.nowMs - windowSeconds * 1_000
      ) {
        const expiresAtMs = newestAtMs + windowSeconds * 1_000;
        const waitSeconds = Math.max(0, Math.floor((expiresAtMs - input.nowMs) / 1_000));
        outcomes[name] = {
          status: "parked",
          kind: "budget-exhausted",
          budgetName: name,
          waitSeconds,
          expiresAtMs,
          announcementCode: "provider.budget.parked",
          evidence: budgetEvidence(facts),
          facts,
          ...sparse,
        };
        continue;
      }
      // No contributing observation can supply an honest resume instant: the
      // crossing is a failed entry, never a park with a guessed expiry.
      outcomes[name] = {
        status: "failed",
        kind: "budget-exhausted",
        budgetName: name,
        announcementCode: "provider.budget.crossed",
        evidence: budgetEvidence(facts),
        facts,
        ...sparse,
      };
      continue;
    }
    outcomes[name] = {
      status: "failed",
      kind: "budget-exhausted",
      budgetName: name,
      announcementCode: "provider.budget.crossed",
      evidence: budgetEvidence(facts),
      facts,
      ...sparse,
    };
  }
  return { outcomes, scopes };
};

/** The declared budgets that govern one entry (`entries` absent means every entry). */
export const budgetsGoverning = (
  budgets: Readonly<Record<string, ProviderBudgetDeclaration>> | undefined,
  entryName: string,
): readonly string[] =>
  enabledBudgets(budgets)
    .filter(
      ({ declaration }) =>
        declaration.entries === undefined || declaration.entries.includes(entryName),
    )
    .map(({ name }) => name);

/** One budget outcome as a condition result for its governing entry. */
export const budgetCondition = (outcome: ProviderBudgetOutcome): ProviderConditionResult => {
  if (outcome.status === "clear") return { status: "clear" };
  if (outcome.status === "parked") {
    return {
      status: "parked",
      kind: "budget-exhausted",
      waitSeconds: outcome.waitSeconds,
      expiresAtMs: outcome.expiresAtMs,
      announcementCode: outcome.announcementCode,
      evidence: outcome.evidence,
    };
  }
  return {
    status: "failed",
    kind: "budget-exhausted",
    errorCode: "provider.budget.exceeded",
    announcementCode: outcome.announcementCode,
    evidence: outcome.evidence,
  };
};

/** The budget conditions one entry carries, in declared-name order. */
export const budgetConditionsForEntry = (
  budgets: Readonly<Record<string, ProviderBudgetDeclaration>> | undefined,
  evaluation: BudgetEvaluation | undefined,
  entryName: string,
): readonly ProviderConditionResult[] => {
  if (evaluation === undefined) return [];
  return budgetsGoverning(budgets, entryName).map((name) =>
    budgetCondition(evaluation.outcomes[name] as ProviderBudgetOutcome),
  );
};

/* ------------------------------------------------------------------------- *
 * The budget work-item ref seam (GH-350 F-2, TDR-0062).
 *
 * Pure: the three-tier precedence, the delivered ref-pattern test, and the
 * refusal shape. No I/O, no state read, no environment read, no clock. The
 * composition supplies the context tier from the delivered `readLocalPmContext`
 * reader; a hermetic surface (simulate) supplies only an explicit fact. It
 * lives in the provider tier because the provider policy may import only the
 * contracts and its own modules; the budget module is the ref's consumer.
 * ------------------------------------------------------------------------- */

/**
 * The delivered local delivery-context path, relative to the invoking working
 * directory. The composition supplies the absolute path so the refusal names
 * where the fact was looked for.
 */
export const DEFAULT_WORK_ITEM_REF_CONTEXT_PATH = ".ai/local/pm-context.yaml" as const;

const WORK_ITEM_REF_PATTERN = new RegExp(SPEND_WORK_ITEM_REF_PATTERN, "u");

/** The declared canonical ref shape, exactly as `spend --ref` validates it. */
export const isWorkItemRef = (value: unknown): value is string =>
  typeof value === "string" && WORK_ITEM_REF_PATTERN.test(value);

/**
 * One ref-resolution request: the explicit fact (tier 1), the local-context
 * value (tier 2, already read by the composition), the path the refusal names,
 * and the enabled budget names that require the measurement.
 */
export type ProviderWorkItemRefInput = {
  readonly explicit?: string;
  readonly contextRef?: string;
  readonly contextPath: string;
  readonly requiredBy: readonly string[];
};

export type ProviderWorkItemRefOutcome =
  | {
      readonly status: "resolved";
      readonly workItemRef: string;
      readonly source: "explicit" | "context";
    }
  | { readonly status: "unresolved"; readonly summary: string };

const budgetList = (names: readonly string[]): string => names.join(", ");

/**
 * Resolve the ref the budget measures (TDR-0062 D2/D4).
 *
 * An explicitly supplied ref-bearing fact wins; otherwise the local delivery
 * context answers; otherwise the evaluation refuses. A value that fails the
 * delivered ref pattern is unresolvable — it is never passed to the fold and
 * never echoed in the refusal. The refusal names the enabled budget(s), the
 * context path, and the remedy (TDR-0062 D4).
 */
export const resolveProviderWorkItemRef = (
  input: ProviderWorkItemRefInput,
): ProviderWorkItemRefOutcome => {
  if (input.explicit !== undefined && isWorkItemRef(input.explicit)) {
    return { status: "resolved", workItemRef: input.explicit, source: "explicit" };
  }
  if (input.contextRef !== undefined && isWorkItemRef(input.contextRef)) {
    return { status: "resolved", workItemRef: input.contextRef, source: "context" };
  }
  return {
    status: "unresolved",
    summary:
      `budget ${budgetList(input.requiredBy)} cannot be measured: no active work-item ref was found ` +
      `at ${input.contextPath}. Run inside an active delivery context (the change the delivery is ` +
      `working), or disable the budget; a budget crossing is never measured as zero.`,
  };
};
