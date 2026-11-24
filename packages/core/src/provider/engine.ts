/**
 * Provider engine composition (GH-182 PD-G).
 *
 * Pure policy plus injected clock, credential port, quota transport, and sleep
 * seams. The CLI edge wires production implementations; tests wire fakes. No
 * module-level singleton, cache, or side effect exists here.
 */
import type {
  AnnouncementCode,
  CombinedProviderCondition,
  CredentialFailureProjection,
  CredentialPort,
  CredentialReference,
  ProfileProbePort,
  ProfileProviderAvailability,
  ProviderAnnouncementRecord,
  ProviderChain,
  ProviderClock,
  ProviderConditionKind,
  ProviderConditionResult,
  ProviderConfiguration,
  ProviderDecision,
  ProviderDescriptor,
  ProviderEngineResult,
  ProviderErrorCode,
  ProviderParkEvidence,
  ProviderParkRecord,
  ProviderParkView,
  ProviderProfileConfiguration,
  ProviderQuotaView,
  ProviderResolveResult,
  ProviderSleep,
  ProviderSpendTotalsPort,
  ProviderWorkItemRefResolver,
  QuotaTransport,
  QuotaTransportResult,
  StateResult,
  StateStorePort,
} from "#contracts";
import { PROVIDER_DEFAULT_ZONE, type ProviderZoneFacts } from "#contracts";
import {
  budgetCrossedMessage,
  createParkAnnouncement,
  credentialRefusalNote,
  severityForAnnouncementCode,
} from "./announcements.js";
import {
  type BudgetEvaluation,
  budgetConditionsForEntry,
  budgetScopes,
  DEFAULT_WORK_ITEM_REF_CONTEXT_PATH,
  enabledBudgets,
  evaluateBudgets,
  resolveProviderWorkItemRef,
} from "./budgets.js";
import { type ChainEntryState, resolveProviderChain } from "./chain.js";
import { combineProviderConditions } from "./conditions.js";
import {
  createAnnouncementRecord,
  createParkRecord,
  persistProviderResolution,
  readProviderParkViews,
} from "./parks.js";
import { evaluatePeakWindow, normaliseZoneName, UTC_ZONE_FACTS } from "./peak.js";
import { selectProfile } from "./profile.js";
import { evaluateQuotaResponse } from "./quota.js";
import { selectProviderChain, validateProviderConfiguration } from "./validate.js";

export type ProviderEngineDependencies = {
  readonly clock: ProviderClock;
  readonly credentialPort: CredentialPort;
  readonly transport: QuotaTransport;
  readonly sleep: ProviderSleep;
  readonly stateStore?: StateStorePort;
  readonly newFenceToken?: () => string;
  /**
   * Bind the zone port to one declared zone (GH-350, ADR-0013 as revised). A
   * `UTC` window needs no seam; a non-UTC window with no facts refuses
   * `provider.peak.zone-unknown` before any evaluation.
   */
  readonly zoneFactsFor?: (zone: string) => ProviderZoneFacts | undefined;
  /**
   * The one read-only spend-totals port the budget gate consumes (GH-350,
   * DM-3). A composition that declares an enabled budget and supplies no port
   * refuses rather than measuring nothing.
   */
  readonly spendTotals?: ProviderSpendTotalsPort;
  /**
   * The local delivery-context tier of the ref seam (GH-350, TDR-0064). The
   * composition supplies it from the delivered `readLocalPmContext`; it is
   * called only when an enabled budget is evaluated and no explicit fact wins.
   */
  readonly resolveWorkItemRef?: ProviderWorkItemRefResolver;
  /** The path the unresolvable-ref refusal names (the delivered context path). */
  readonly workItemContextPath?: string;
};

/**
 * The profile-probe seam over the engine v1 condition vocabulary (GH-234 F-4).
 *
 * The caller supplies the availability verdict per provider (the engine's
 * condition evaluation or a fixed fact set); memoization per resolution pass is
 * the selection engine's responsibility, so a shared provider is probed once.
 */
export const createProfileProbePort = (
  evaluate: (providerName: string) => ProfileProviderAvailability,
): ProfileProbePort => ({ probe: evaluate });

/** A fixed-facts probe seam for replay/idempotence suites. */
export const createProviderFactsProbe = (
  facts: Readonly<Record<string, ProfileProviderAvailability>>,
): ProfileProbePort =>
  createProfileProbePort(
    (providerName) =>
      facts[providerName] ?? {
        available: false,
        condition: "provider-outage",
        blockers: [
          {
            kind: "condition",
            value: "provider-outage",
            detail: `provider ${providerName} has no supplied availability fact`,
          },
        ],
        source: `provider ${providerName}: no fact`,
      },
  );

/** The input of the shared nomination predicate (GH-294 F-1, TDR-0028). */
export type ProviderNominationInput = {
  readonly profiles: ProviderProfileConfiguration;
  readonly probe: ProfileProbePort;
  readonly nowMs: number;
  readonly agent?: string;
  /** The delivered hard capability gate, when the admitting composition requires it. */
  readonly requireVision?: boolean;
};

/** The closed refusal identities the nomination carries (TDR-0028 D2). */
const NOMINATION_REFUSAL_CODES = [
  "provider.profile.absent",
  "provider.profile.invalid",
  "provider.profile.capability-denied",
  "provider.profile.unavailable",
] as const;

/**
 * The nomination decision shared by both admission paths (TDR-0028 D3): the
 * delivered profile-selection seam run once; the selected profile is the
 * nomination, and every refusal carries the resolve identity the seam already
 * produced for the shape — `absent`/`invalid`/`capability-denied` at exit 1,
 * `unavailable` at exit 2 with the eligibility list. No dispatch-default
 * nomination concept exists (D5), and the returned shape is structurally the
 * dispatch/daemon nomination so both admission families bind one predicate.
 */
export const nominateProviderProfile = (
  input: ProviderNominationInput,
):
  | {
      readonly ok: true;
      readonly profile: string;
    }
  | {
      readonly ok: false;
      readonly refusal: {
        readonly code:
          | "provider.profile.absent"
          | "provider.profile.invalid"
          | "provider.profile.capability-denied"
          | "provider.profile.unavailable";
        readonly summary?: string;
        readonly eligibility?: readonly string[];
      };
    } => {
  const selection = selectProfile({
    profiles: input.profiles,
    probe: input.probe,
    nowMs: input.nowMs,
    ...(input.agent === undefined ? {} : { agent: input.agent }),
    ...(input.requireVision === undefined ? {} : { requireVision: input.requireVision }),
  });
  if (selection.ok) return { ok: true, profile: selection.decision.profile };
  if (!(NOMINATION_REFUSAL_CODES as readonly string[]).includes(selection.code)) {
    // The selection seam's refusal vocabulary is closed; reaching here means a
    // new selection identity was added without a nomination mapping — fail
    // closed rather than misclassify.
    throw new Error(`nomination refusal identity is not in the closed set: ${selection.code}`);
  }
  return {
    ok: false,
    refusal: {
      code: selection.code as (typeof NOMINATION_REFUSAL_CODES)[number],
      ...(selection.summary === undefined ? {} : { summary: selection.summary }),
      ...(selection.eligibility.length === 0
        ? {}
        : {
            eligibility: selection.eligibility.map(
              (entry) =>
                `${entry.profile}:${entry.verdict}${entry.blockers.length > 0 ? `:${entry.blockers.map((blocker) => blocker.kind).join("+")}` : ""}`,
            ),
          }),
    },
  };
};

export type ProviderEngine = {
  readonly resolve: (input: ProviderResolveInput) => Promise<ProviderResolveResult>;
  readonly quota: (input: ProviderQuotaInput) => Promise<ProviderEngineResult>;
  readonly parks: (input?: {
    readonly all?: boolean;
    readonly providerName?: string;
  }) => StateResult<readonly ProviderParkView[]>;
};

/**
 * A named profile's provider scope for `provider resolve --profile` (GH-234
 * F-9, Appendix C): resolution candidates are restricted to the named
 * profile's providers while the delivered envelope shape stays unchanged.
 */
export type ProviderResolveProfileScope = {
  readonly name: string;
  readonly providers: readonly string[];
};

export type ProviderResolveInput = {
  readonly config: ProviderConfiguration;
  readonly chainName?: string;
  /** Named-profile context; restricts chain candidates to its providers. */
  readonly profile?: ProviderResolveProfileScope;
  readonly persist?: boolean;
  /**
   * Tier 1 of the ref seam (GH-350, TDR-0064): an explicitly supplied
   * ref-bearing fact. Today only the simulate fixture supplies one; its value
   * wins over the local delivery context.
   */
  readonly workItemRef?: string;
};

export type ProviderQuotaInput = {
  readonly config: ProviderConfiguration;
  readonly providerName?: string;
};

type EntryEvaluation = {
  readonly descriptor: ProviderDescriptor;
  readonly condition: CombinedProviderCondition;
  readonly park?: ProviderParkRecord;
  readonly announcement?: ProviderAnnouncementRecord;
  /**
   * The forwarded credential projection (DEC-14), carried in-process from the
   * park-evidence build to the rendered refusal and the announcement log line.
   * Never persisted: the park-record shape gains no field.
   */
  readonly credentialProjection?: CredentialFailureProjection;
};

/**
 * The DEC-14 in-process projection carrier: the three credential-failure
 * fields ride the parked condition object as projection data so the failure is
 * never collapsed to the failure-class-plus-reference evidence shape without
 * them alongside. The park-record shape stays closed and nothing persisted
 * carries them; the carrier lives exactly as long as the condition object.
 */
const credentialProjectionCarrier = new WeakMap<object, CredentialFailureProjection>();

/** The projection a resolution failure carries, if any (DEC-14). */
const credentialProjectionOf = (
  resolved: Extract<ReturnType<CredentialPort["resolve"]>, { ok: false }>,
): CredentialFailureProjection | undefined =>
  resolved.source === undefined && resolved.reason === undefined && resolved.remedy === undefined
    ? undefined
    : {
        ...(resolved.source === undefined ? {} : { source: resolved.source }),
        ...(resolved.reason === undefined ? {} : { reason: resolved.reason }),
        ...(resolved.remedy === undefined ? {} : { remedy: resolved.remedy }),
      };

/** The carried projection among one entry's condition results, if any. */
const carriedCredentialProjection = (
  results: readonly ProviderConditionResult[],
): CredentialFailureProjection | undefined => {
  for (const condition of results) {
    if (condition.status !== "parked") continue;
    const carried = credentialProjectionCarrier.get(condition);
    if (carried !== undefined) return carried;
  }
  return undefined;
};

const credentialReference = (
  config: ProviderConfiguration,
  credentialRef: string,
): CredentialReference | undefined => {
  const declared = config.credentials[credentialRef];
  if (declared === undefined) return undefined;
  return { referenceName: credentialRef, sourceKey: declared.sourceKey };
};

const parkedCondition = (
  kind: ProviderConditionKind,
  waitSeconds: number,
  nowMs: number,
  announcementCode: AnnouncementCode,
  evidence: ProviderParkEvidence,
): ProviderConditionResult => ({
  status: "parked",
  kind,
  waitSeconds,
  expiresAtMs: nowMs + waitSeconds * 1_000,
  announcementCode,
  evidence,
});

const evaluateQuotaCondition = async (
  deps: ProviderEngineDependencies,
  config: ProviderConfiguration,
  descriptor: ProviderDescriptor,
  nowMs: number,
): Promise<ProviderConditionResult | undefined> => {
  const quota = descriptor.quota;
  if (quota === undefined || !quota.enabled) return undefined;
  const reference = credentialReference(config, quota.credentialRef);
  if (reference === undefined) {
    return parkedCondition(
      "credential-missing",
      quota.credentialParkTtlSeconds,
      nowMs,
      "provider.credential.missing",
      {
        conditionKinds: ["credential-missing"],
        waitSeconds: quota.credentialParkTtlSeconds,
        failureClass: "config.credential.missing",
        credentialRefName: quota.credentialRef,
      },
    );
  }
  const resolved = deps.credentialPort.resolve(reference);
  if (!resolved.ok) {
    // FORWARDING ONLY (DEC-14): the classified projection rides the parked
    // condition as in-process data for the announcement line and the rendered
    // refusal. The park-construction semantics are untouched (any failure
    // parks today; pending-park stays reserved for #395) and the evidence
    // keeps its closed shape.
    const condition = parkedCondition(
      "credential-missing",
      quota.credentialParkTtlSeconds,
      nowMs,
      "provider.credential.missing",
      {
        conditionKinds: ["credential-missing"],
        waitSeconds: quota.credentialParkTtlSeconds,
        failureClass: "config.credential.missing",
        credentialRefName: quota.credentialRef,
      },
    );
    const credential = credentialProjectionOf(resolved);
    if (credential !== undefined) credentialProjectionCarrier.set(condition, credential);
    return condition;
  }
  let result: QuotaTransportResult;
  try {
    result = await deps.transport.send({
      endpoint: quota.endpoint,
      method: "GET",
      timeoutMs: quota.timeoutMs,
      credential: resolved.material,
    });
  } catch {
    return parkedCondition(
      "provider-outage",
      quota.outageParkTtlSeconds,
      nowMs,
      "provider.quota.unreachable",
      {
        conditionKinds: ["provider-outage"],
        waitSeconds: quota.outageParkTtlSeconds,
        failureClass: "transport",
      },
    );
  }
  const evaluation = evaluateQuotaResponse(result, quota.thresholdPercent, nowMs);
  if (evaluation.status === "clear") return undefined;
  if (evaluation.status === "parked") {
    return {
      status: "parked",
      kind: "quota-exhausted",
      waitSeconds: evaluation.waitSeconds,
      expiresAtMs: evaluation.expiresAtMs,
      announcementCode: "provider.quota.parked",
      evidence: evaluation.evidence,
    };
  }
  if (evaluation.errorCode === "provider.quota.exceeded") {
    return {
      status: "failed",
      kind: "quota-exhausted",
      errorCode: evaluation.errorCode,
      announcementCode: evaluation.announcementCode,
      evidence: { failureClass: evaluation.failureClass, httpStatus: evaluation.httpStatus },
    };
  }
  if (evaluation.errorCode === "provider.auth.rejected") {
    return parkedCondition(
      "credential-rejected",
      quota.credentialParkTtlSeconds,
      nowMs,
      evaluation.announcementCode,
      {
        conditionKinds: ["credential-rejected"],
        waitSeconds: quota.credentialParkTtlSeconds,
        failureClass: evaluation.failureClass,
        httpStatus: evaluation.httpStatus,
      },
    );
  }
  return parkedCondition(
    "provider-outage",
    quota.outageParkTtlSeconds,
    nowMs,
    evaluation.announcementCode,
    {
      conditionKinds: ["provider-outage"],
      waitSeconds: quota.outageParkTtlSeconds,
      failureClass: evaluation.failureClass,
      httpStatus: evaluation.httpStatus,
    },
  );
};

const zoneFactsForPeak = (
  deps: ProviderEngineDependencies,
  zone: string,
): ProviderZoneFacts | undefined => {
  const normalised = normaliseZoneName(zone);
  return normalised === PROVIDER_DEFAULT_ZONE ? UTC_ZONE_FACTS : deps.zoneFactsFor?.(normalised);
};

/** Refuse a non-UTC window whose zone the composition cannot resolve, before evaluation. */
const zoneRefusal = (
  deps: ProviderEngineDependencies,
  config: ProviderConfiguration,
  names: readonly string[],
):
  | {
      readonly ok: false;
      readonly errorCode: ProviderErrorCode;
      readonly summary: string;
      readonly announcementCode?: AnnouncementCode;
    }
  | undefined => {
  for (const name of names) {
    const peak = config.entries[name]?.peak;
    if (peak === undefined) continue;
    if (zoneFactsForPeak(deps, peak.timezone) === undefined) {
      return failure(
        "provider.peak.zone-unknown",
        `provider ${name} declares peak zone ${peak.timezone}, which this composition cannot resolve; correct the zone name, or run where zone data is available (a UTC declaration needs none)`,
      );
    }
  }
  return undefined;
};

type AnnouncementContext = {
  readonly workItemRef?: string;
  readonly sparseBudgets?: readonly string[];
};

const announcementContextFor = (
  park: ProviderParkRecord,
  context: AnnouncementContext,
): { workItemRef?: string; sparse?: boolean } => ({
  ...(context.workItemRef === undefined ? {} : { workItemRef: context.workItemRef }),
  ...(park.evidence.budgetName !== undefined &&
  (context.sparseBudgets ?? []).includes(park.evidence.budgetName)
    ? { sparse: true }
    : {}),
});

/**
 * The facts one evaluated entry's window is bound to.
 *
 * The zone refusal validates every evaluated entry before evaluation, so an
 * absent lookup here is an ordering regression rather than a UTC fallback. This
 * helper makes that non-optional: `UTC` keeps its definitional constant path,
 * and an unresolved non-UTC zone fails loudly instead of evaluating on UTC.
 */
const zoneFactsForEvaluatedEntry = (
  deps: ProviderEngineDependencies,
  zone: string,
): ProviderZoneFacts => {
  const facts = zoneFactsForPeak(deps, zone);
  if (facts === undefined) {
    throw new Error(
      `provider peak zone ${zone} reached evaluation without resolved facts; the zone refusal must run first`,
    );
  }
  return facts;
};

const evaluateEntry = async (
  deps: ProviderEngineDependencies,
  config: ProviderConfiguration,
  descriptor: ProviderDescriptor,
  nowMs: number,
  budgetConditions: readonly ProviderConditionResult[] = [],
  context: AnnouncementContext = {},
): Promise<EntryEvaluation> => {
  if (!descriptor.enabled) {
    return { descriptor, condition: { status: "clear" } };
  }
  const results: ProviderConditionResult[] = [...budgetConditions];
  if (descriptor.peak !== undefined) {
    const facts = zoneFactsForEvaluatedEntry(deps, descriptor.peak.timezone);
    results.push(evaluatePeakWindow(descriptor.peak, nowMs, facts));
  }
  const quota = await evaluateQuotaCondition(deps, config, descriptor, nowMs);
  if (quota !== undefined) results.push(quota);
  const condition = combineProviderConditions(results);
  const credentialProjection = carriedCredentialProjection(results);
  const projectionEntries = credentialProjection === undefined ? {} : { credentialProjection };
  if (condition.status !== "parked") return { descriptor, condition, ...projectionEntries };
  const park = createParkRecord({
    subjectKind: "provider",
    subjectName: descriptor.name,
    cause: condition.cause,
    conditions: condition.conditions,
    createdAtMs: nowMs,
    expiresAtMs: condition.expiresAtMs,
    evidence: condition.evidence,
  });
  return {
    descriptor,
    condition,
    park,
    ...projectionEntries,
    announcement: createParkAnnouncement(park, nowMs, {
      ...announcementContextFor(park, context),
      ...(credentialProjection === undefined ? {} : { credential: credentialProjection }),
    }),
  };
};

const failure = (
  errorCode: ProviderErrorCode,
  summary: string,
  announcementCode?: AnnouncementCode,
): {
  readonly ok: false;
  readonly errorCode: ProviderErrorCode;
  readonly summary: string;
  readonly announcementCode?: AnnouncementCode;
} => ({
  ok: false,
  errorCode,
  summary,
  ...(announcementCode === undefined ? {} : { announcementCode }),
});

const REFUSAL_FAILURE = (
  code: Extract<ProviderResolveResult, { ok: false }>["errorCode"],
  summary: string,
  announcementCode?: AnnouncementCode,
): Extract<ProviderResolveResult, { ok: false }> => ({
  ok: false,
  errorCode: code,
  summary,
  ...(announcementCode === undefined ? {} : { announcementCode }),
});

const createFailureAnnouncement = (
  descriptor: ProviderDescriptor,
  condition: Extract<CombinedProviderCondition, { status: "failed" }>,
  nowMs: number,
  context: AnnouncementContext = {},
): ProviderAnnouncementRecord =>
  createAnnouncementRecord({
    subjectKind: "provider",
    subjectName: descriptor.name,
    code: condition.announcementCode,
    severity: severityForAnnouncementCode(condition.announcementCode),
    createdAtMs: nowMs,
    message:
      condition.cause === "budget-exhausted"
        ? budgetCrossedMessage(descriptor.name, condition.evidence, {
            ...(context.workItemRef === undefined ? {} : { workItemRef: context.workItemRef }),
            ...(condition.evidence.budgetName !== undefined &&
            (context.sparseBudgets ?? []).includes(condition.evidence.budgetName)
              ? { sparse: true }
              : {}),
          })
        : `provider ${descriptor.name} cannot determine a resume time`,
    cause: condition.cause,
    conditions: condition.conditions,
    evidence: condition.evidence,
  });

const dedupeAnnouncements = (
  announcements: readonly ProviderAnnouncementRecord[],
): readonly ProviderAnnouncementRecord[] =>
  announcements.filter(
    (entry, index, all) =>
      all.findIndex((candidate) => candidate.identity === entry.identity) === index,
  );

/** The enabled budget names, in declared-name order (the ref requirement set). */
const enabledBudgetNames = (config: ProviderConfiguration): readonly string[] =>
  enabledBudgets(config.budgets).map(({ name }) => name);

/**
 * The budget gate (GH-350 F-2, DM-3/DM-4, TDR-0059/TDR-0064): resolve the ref
 * once, perform exactly one verified read, and evaluate every enabled budget.
 * No budget means no seam call, no read, and no condition.
 */
const evaluateBudgetGate = async (
  deps: ProviderEngineDependencies,
  config: ProviderConfiguration,
  explicitRef: string | undefined,
  nowMs: number,
): Promise<
  | { readonly ok: true; readonly ref?: string; readonly evaluation?: BudgetEvaluation }
  | { readonly ok: false; readonly refusal: Extract<ProviderResolveResult, { ok: false }> }
> => {
  const requiredBy = enabledBudgetNames(config);
  if (requiredBy.length === 0) return { ok: true };
  if (deps.spendTotals === undefined) {
    return {
      ok: false,
      refusal: REFUSAL_FAILURE(
        "provider.outage",
        `budget ${requiredBy.join(", ")} cannot be measured: this composition supplies no spend-totals seam`,
      ),
    };
  }
  const context = explicitRef === undefined ? deps.resolveWorkItemRef?.() : undefined;
  const resolution = resolveProviderWorkItemRef({
    ...(explicitRef === undefined ? {} : { explicit: explicitRef }),
    ...(context?.status === "resolved" ? { contextRef: context.workItemRef } : {}),
    contextPath: deps.workItemContextPath ?? DEFAULT_WORK_ITEM_REF_CONTEXT_PATH,
    requiredBy,
  });
  if (resolution.status === "unresolved") {
    return {
      ok: false,
      refusal: REFUSAL_FAILURE("input.value.rejected", resolution.summary),
    };
  }
  const read = await deps.spendTotals.read({
    workItemRef: resolution.workItemRef,
    scopes: budgetScopes(enabledBudgets(config.budgets), nowMs),
  });
  if (read.status === "failed") {
    return {
      ok: false,
      refusal: REFUSAL_FAILURE(
        read.code,
        `the spend ledger for ${resolution.workItemRef} could not be read (${read.code}); the budget cannot be measured and the decision is not clear`,
      ),
    };
  }
  return {
    ok: true,
    ref: resolution.workItemRef,
    evaluation: evaluateBudgets({ budgets: config.budgets, read, nowMs }),
  };
};

/** Build the pure engine over injected seams. */
export const createProviderEngine = (deps: ProviderEngineDependencies): ProviderEngine => {
  const evaluateAll = async (
    config: ProviderConfiguration,
    names: readonly string[],
    nowMs: number,
    evaluation: BudgetEvaluation | undefined,
    context: AnnouncementContext,
  ): Promise<EntryEvaluation[]> => {
    const evaluations: EntryEvaluation[] = [];
    for (const name of names) {
      const descriptor = config.entries[name];
      if (descriptor === undefined) continue;
      evaluations.push(
        await evaluateEntry(
          deps,
          config,
          descriptor,
          nowMs,
          budgetConditionsForEntry(config.budgets, evaluation, name),
          context,
        ),
      );
    }
    return evaluations;
  };

  return {
    async resolve(input: ProviderResolveInput): Promise<ProviderResolveResult> {
      const validation = validateProviderConfiguration(input.config);
      if (validation !== undefined) {
        return failure(validation.code, validation.detail);
      }
      const selection = selectProviderChain(input.config, input.chainName);
      if (!selection.ok) return failure(selection.error.code, selection.error.detail);
      let chain: ProviderChain = selection.chain;
      if (input.profile !== undefined) {
        const allowed = new Set(input.profile.providers);
        const entries = chain.entries.filter((entry) => allowed.has(entry));
        if (entries.length === 0) {
          return failure(
            "provider.chain.empty",
            `profile ${input.profile.name} declares no provider in chain ${chain.name}`,
          );
        }
        chain = { ...chain, entries };
      }
      const nowMs = deps.clock.nowMs();
      // The declared zone is validated before any spend read: an unresolvable
      // zone refuses `provider.peak.zone-unknown` without touching the spend
      // seam (GH-350 F-1/F-2). The budget gate then runs before any probe,
      // credential read, transport call, or state write: an unresolvable ref
      // refuses once here (TDR-0064 D4).
      const zoneFailure = zoneRefusal(deps, input.config, chain.entries);
      if (zoneFailure !== undefined) return zoneFailure;
      const gate = await evaluateBudgetGate(deps, input.config, input.workItemRef, nowMs);
      if (!gate.ok) return gate.refusal;
      const sparseBudgets =
        gate.evaluation === undefined
          ? []
          : Object.values(gate.evaluation.outcomes)
              .filter((outcome) => outcome.status !== "clear" && outcome.sparse === true)
              .map((outcome) => outcome.budgetName);
      const context: AnnouncementContext = {
        ...(gate.ref === undefined ? {} : { workItemRef: gate.ref }),
        ...(sparseBudgets.length === 0 ? {} : { sparseBudgets }),
      };
      const evaluations = await evaluateAll(
        input.config,
        chain.entries,
        nowMs,
        gate.evaluation,
        context,
      );
      const states: Record<string, ChainEntryState> = {};
      const parks: ProviderParkRecord[] = [];
      const parkAnnouncements: ProviderAnnouncementRecord[] = [];
      const failedAnnouncements: ProviderAnnouncementRecord[] = [];
      for (const evaluation of evaluations) {
        states[evaluation.descriptor.name] = {
          descriptor: evaluation.descriptor,
          condition: evaluation.condition,
        };
        if (evaluation.condition.status === "failed") {
          // Not a park and never persisted: the classified failed verdict keeps
          // its announcement in the command-result list while the walk continues
          // (F-2/AC-F2-6, DM-7).
          failedAnnouncements.push(
            createFailureAnnouncement(evaluation.descriptor, evaluation.condition, nowMs, context),
          );
          continue;
        }
        if (evaluation.park !== undefined) parks.push(evaluation.park);
        if (evaluation.announcement !== undefined) parkAnnouncements.push(evaluation.announcement);
      }
      const outcome = resolveProviderChain({ chain, states, nowMs });
      if (!outcome.ok) {
        const ref = gate.ref === undefined ? "" : ` (work item ${gate.ref})`;
        return failure(outcome.errorCode, `${outcome.detail}${ref}`, outcome.announcementCode);
      }
      const decision: ProviderDecision = outcome.decision;
      if (decision.kind === "parked") {
        parks.push(decision.park);
        parkAnnouncements.push(
          createParkAnnouncement(
            decision.park,
            nowMs,
            announcementContextFor(decision.park, context),
          ),
        );
      }
      if (input.persist !== false && deps.stateStore !== undefined) {
        const persisted = persistProviderResolution({
          store: deps.stateStore,
          fenceToken: deps.newFenceToken?.() ?? `provider-${nowMs}`,
          nowMs,
          parks,
          announcements: parkAnnouncements,
        });
        if (!persisted.ok) {
          return failure("provider.outage", `provider state write failed: ${persisted.error.code}`);
        }
        return {
          ok: true,
          chainName: chain.name,
          decision,
          skipped: outcome.skipped,
          parks,
          announcements: dedupeAnnouncements([
            ...failedAnnouncements,
            ...parkAnnouncements,
            ...persisted.value.newAnnouncements,
          ]),
        };
      }
      return {
        ok: true,
        chainName: chain.name,
        decision,
        skipped: outcome.skipped,
        parks,
        announcements: dedupeAnnouncements([...failedAnnouncements, ...parkAnnouncements]),
      };
    },

    async quota(input: ProviderQuotaInput): Promise<ProviderEngineResult> {
      const validation = validateProviderConfiguration(input.config);
      if (validation !== undefined) {
        return failure(validation.code, validation.detail);
      }
      const names =
        input.providerName === undefined
          ? input.config.defaultChain === undefined
            ? Object.keys(input.config.entries)
            : (input.config.chains[input.config.defaultChain]?.entries ?? [])
          : [input.providerName];
      for (const name of names) {
        if (input.config.entries[name] === undefined) {
          return failure("provider.chain.empty", `provider ${name} is not declared`);
        }
      }
      const zoneFailure = zoneRefusal(deps, input.config, names);
      if (zoneFailure !== undefined) return zoneFailure;
      const nowMs = deps.clock.nowMs();
      const evaluations = await evaluateAll(input.config, names, nowMs, undefined, {});
      const views: ProviderQuotaView[] = [];
      const announcements: ProviderAnnouncementRecord[] = [];
      for (const evaluation of evaluations) {
        const condition = evaluation.condition;
        if (condition.status === "failed") {
          return failure(
            condition.errorCode,
            `${evaluation.descriptor.name}: ${condition.announcementCode}`,
            condition.announcementCode,
          );
        }
        if (condition.status === "parked") {
          if (
            condition.cause === "provider-outage" ||
            condition.cause === "credential-missing" ||
            condition.cause === "credential-rejected"
          ) {
            const errorCode =
              condition.cause === "provider-outage"
                ? "provider.outage"
                : condition.cause === "credential-missing"
                  ? "config.credential.missing"
                  : "provider.auth.rejected";
            // FORWARDING ONLY (DEC-14): the reconstructed refusal carries the
            // classified projection on the rendered line — the summary is the
            // refusal's text channel; the code stays the delivered identity.
            const credential =
              condition.cause === "credential-missing"
                ? evaluation.credentialProjection
                : undefined;
            return failure(
              errorCode,
              `${evaluation.descriptor.name}: ${condition.announcementCode}${credentialRefusalNote(credential)}`,
              condition.announcementCode,
            );
          }
        }
        parksPush(views, evaluation, nowMs);
        if (evaluation.announcement !== undefined) announcements.push(evaluation.announcement);
      }
      return { ok: true, providers: views, announcements };
    },

    parks(input = {}) {
      if (deps.stateStore === undefined) {
        return {
          ok: false,
          error: {
            kind: "state",
            code: "state.write.failed",
            consequence: "not_landed",
            location: { path: "provider-parks.json" },
          },
        };
      }
      return readProviderParkViews(deps.stateStore, deps.clock.nowMs(), input);
    },
  };
};

const parksPush = (
  views: ProviderQuotaView[],
  evaluation: EntryEvaluation,
  _nowMs: number,
): void => {
  const condition = evaluation.condition;
  if (condition.status === "parked" && evaluation.park !== undefined) {
    views.push({
      providerName: evaluation.descriptor.name,
      status: "parked",
      cause: condition.cause,
      conditions: condition.conditions,
      resumeAt: evaluation.park.expiresAt,
      evidence: condition.evidence,
    });
    return;
  }
  views.push({
    providerName: evaluation.descriptor.name,
    status: "clear",
    conditions: [],
    evidence: {},
  });
};
