/**
 * The declared total scheduling precedence and the one-pass schedule fold
 * (GH-237 F-3, F-7, F-9, DM-9, DM-10, Appendix B, AC-F3-1(a), AC-F7-1,
 * AC-F9-1, AC-F10-1).
 *
 * Hard exclusions (readiness, dependency/deploy gates, parks, single-flight,
 * weight) remove a candidate with a named reason; they never reorder. Ordering
 * is rank class, then producer-before-consumer within one repository, then
 * priority ascending, then numeric suffix, then canonical ref text. Step 13b
 * projects at most one action per repository per pass and holds the remainder
 * `repo-claimed-in-pass`. Step 14 only proposes a preemption; it never violates
 * single-flight.
 */

import {
  QUEUE_BLOCKING_REASONS,
  QUEUE_DEFAULT_NEXT_ACTIONS,
  QUEUE_DEFAULT_PRIORITY,
  QUEUE_MAX_DEPLOY_READS,
  QUEUE_MAX_ENTRIES,
  QUEUE_MAX_EVALUATED_CANDIDATES,
  QUEUE_MAX_FINDINGS,
  QUEUE_MAX_HUMAN_BYTES,
  QUEUE_MAX_HUMAN_LINES,
  QUEUE_MAX_MACHINE_BYTES,
  QUEUE_MAX_NEXT_ACTIONS,
  QUEUE_MAX_REASONS,
  QUEUE_STUCK_PARK_FINDING_CODE,
  type QueueBlocking,
  type QueueBlockingReason,
  type QueueDeployEvidence,
  type QueueEntryProjection,
  type QueueEntryState,
  type QueueFinding,
  type QueueLeaseProjection,
  type QueueLeaseStatus,
  type QueueListData,
  type QueueNextAction,
  type QueueParkedReason,
  type OwnerHoldSource,
  type QueueParkProjection,
  type QueuePlanData,
  type QueueRankClass,
  type QueueReadyCloseClass,
  type QueueWeightClass,
  type QueueWeightClassSource,
  type QueueWeightProjection,
} from "#contracts";
import {
  createDeployGateState,
  evaluateDependencyGate,
  type QueueDeployGateState,
} from "./queue-deploy-gate.js";
import type { QueueGraphFold } from "./queue-graph.js";
import { isCloseRank, rankClassIndex, resolveRankClass } from "./queue-rank.js";
import {
  closeClassOf,
  evaluateQueueReadiness,
  type QueueCloseFact,
  type QueueParkEvaluation,
  type QueueSchedulerFacts,
} from "./queue-readiness.js";
import { isHeldByWeight, resolveQueueWeight, weightLoads } from "./queue-weight.js";

/** The default next-action cap. */
export const QUEUE_NEXT_DEFAULT = QUEUE_DEFAULT_NEXT_ACTIONS;

/** The owner-hold member projected on the read payloads. */
type ScheduleOwnerHold = {
  readonly source: OwnerHoldSource;
  readonly reason?: string;
};

/** One computed schedule over the injected facts. */
export type QueueSchedule = {
  readonly entries: readonly QueueEntryProjection[];
  readonly nextActions: readonly QueueNextAction[];
  readonly findings: readonly QueueFinding[];
  readonly leases: readonly QueueLeaseProjection[];
  readonly weights: readonly QueueWeightProjection[];
  readonly parks: readonly QueueParkProjection[];
  readonly truncated: boolean;
  readonly evaluatedCandidates: number;
  readonly deployReads: number;
  /** The active owner hold projected for the read payloads; absent when inactive. */
  readonly ownerHold?: ScheduleOwnerHold;
};

/** Options for the one-pass schedule fold. */
export type QueueScheduleOptions = {
  readonly next?: number;
};

type EntryState = {
  readonly ref: string;
  readonly repository?: string;
  readonly priority: number;
  readonly rankClass: QueueRankClass | undefined;
  readonly closeClass: QueueReadyCloseClass;
  readonly weightClass: QueueWeightClass;
  readonly weightClassSource: QueueWeightClassSource;
  readonly deps: readonly string[];
  readonly state: QueueEntryState;
  readonly blocking: readonly QueueBlocking[];
  readonly lease: QueueLeaseStatus;
  readonly deploy?: QueueDeployEvidence;
  readonly park?: QueueParkEvaluation;
  readonly projected: boolean;
};

const clampNext = (value: number | undefined): number => {
  if (value === undefined || !Number.isFinite(value)) return QUEUE_NEXT_DEFAULT;
  const integer = Math.trunc(value);
  if (integer < 1) return 1;
  return Math.min(integer, QUEUE_MAX_NEXT_ACTIONS);
};

const compareText = (left: string, right: string): number => {
  const a = Array.from(left);
  const b = Array.from(right);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const leftPoint = a[index]?.codePointAt(0) ?? 0;
    const rightPoint = b[index]?.codePointAt(0) ?? 0;
    if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1;
  }
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
};

const suffixOf = (ref: string): string | undefined => /([0-9]+)$/.exec(ref)?.[1];

const compareNumericSuffix = (left: string, right: string): number => {
  const a = suffixOf(left);
  const b = suffixOf(right);
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  const bigA = BigInt(a);
  const bigB = BigInt(b);
  return bigA === bigB ? 0 : bigA < bigB ? -1 : 1;
};

const compareRefs = (left: string, right: string): number => {
  const numeric = compareNumericSuffix(left, right);
  return numeric !== 0 ? numeric : compareText(left, right);
};

const blocking = (
  reason: QueueBlockingReason | QueueParkedReason,
  detail?: string,
): QueueBlocking => (detail === undefined ? { reason } : { reason, detail });

const parkedReason = (cause: QueueParkEvaluation["cause"]): QueueParkedReason =>
  `parked:${cause ?? "provider-window"}`;

const reasonForCi = (reason: string | undefined): QueueBlockingReason => {
  switch (reason) {
    case "ci-failed":
      return "ci-failed";
    case "ci-pending":
      return "ci-pending";
    case "ci-canceled":
      return "ci-canceled";
    case "ci-none":
      return "ci-none";
    default:
      return "ci-unknown";
  }
};

const reasonForProvider = (reason: string | undefined): QueueBlockingReason => {
  switch (reason) {
    case "chain-parked":
      return "provider-chain-parked";
    case "no-enabled-entry":
      return "provider-no-enabled-entry";
    case "all-entries-parked":
      return "provider-all-entries-parked";
    default:
      return "provider-unknown";
  }
};

const leaseStatusOf = (
  facts: QueueSchedulerFacts,
  repository: string | undefined,
): QueueLeaseStatus => {
  if (repository === undefined) return { state: "free" };
  const lease = facts.leases.find((candidate) => candidate.repository === repository);
  if (lease === undefined) return { state: "free" };
  return {
    state: "held",
    holder: lease.holder,
    leaseId: lease.leaseId,
    heartbeatAgeMs: lease.heartbeatAgeMs,
  };
};

const isProducerOf = (fold: QueueGraphFold, producer: string, consumer: string): boolean =>
  fold.entries.find((entry) => entry.ref === consumer)?.edges.includes(producer) ?? false;

const isProducerInRepository = (
  fold: QueueGraphFold,
  repository: string | undefined,
  ref: string,
): boolean =>
  repository !== undefined &&
  fold.entries.some(
    (entry) => entry.repository === repository && entry.ref !== ref && entry.edges.includes(ref),
  );

const boundBlocking = (
  items: readonly QueueBlocking[],
): { readonly blocking: readonly QueueBlocking[]; readonly dropped: boolean } =>
  items.length <= QUEUE_MAX_REASONS
    ? { blocking: items, dropped: false }
    : { blocking: items.slice(0, QUEUE_MAX_REASONS), dropped: true };

const evaluateEntry = (
  facts: QueueSchedulerFacts,
  deployState: QueueDeployGateState,
  ref: string,
  budgetExhausted: boolean,
): EntryState => {
  const entry = facts.fold.entries.find((candidate) => candidate.ref === ref);
  if (entry === undefined) throw new Error(`entry ${ref} is missing from the fold`);
  const close = facts.close[ref] ?? "none";
  const park = facts.parkEvaluations[ref];
  const weight = resolveQueueWeight(facts.plans[ref]);
  const rankClass = resolveRankClass(close, park);
  const base: Omit<EntryState, "state" | "blocking" | "projected"> = {
    ref,
    ...(entry.repository === undefined ? {} : { repository: entry.repository }),
    priority: entry.priority ?? QUEUE_DEFAULT_PRIORITY,
    rankClass,
    closeClass: closeClassOf(close as QueueCloseFact),
    weightClass: weight.weightClass,
    weightClassSource: weight.source,
    deps: entry.edges,
    lease: leaseStatusOf(facts, entry.repository),
    ...(park === undefined ? {} : { park }),
  };

  if (budgetExhausted) {
    return {
      ...base,
      state: "not-ready",
      blocking: [blocking("not-ready", "evaluated-candidates-truncated")],
      projected: false,
    };
  }
  if (rankClass === undefined) {
    return {
      ...base,
      state: "stuck",
      blocking: [blocking("park-condition-stuck", `park:${park?.cause ?? "unknown"}`)],
      projected: false,
    };
  }
  if (facts.plans[ref]?.state === "invalid") {
    const plan = facts.plans[ref];
    return {
      ...base,
      state: "not-ready",
      blocking: [
        blocking("tier-unknown", `plan:${plan?.state === "invalid" ? plan.code : "invalid"}`),
      ],
      projected: false,
    };
  }

  const readiness = evaluateQueueReadiness(facts, ref);
  const condition = (id: string) => readiness.conditions.find((candidate) => candidate.id === id);
  const deps = condition("deps-satisfied");
  if (deps !== undefined && deps.state !== "satisfied") {
    const detail = deps.evidence[0]?.detail;
    return {
      ...base,
      state: "held",
      blocking: [
        blocking(deps.state === "unknown" ? "dependency-unobserved" : "dependency-open", detail),
      ],
      projected: false,
    };
  }
  let deployEvidence: QueueDeployEvidence | undefined;
  if (isCloseRank(rankClass) && entry.edges.length > 0) {
    for (const producer of entry.edges) {
      const gate = evaluateDependencyGate(facts, deployState, producer);
      if (!gate.ok) {
        return {
          ...base,
          state: "held",
          blocking: [blocking(gate.reason, `producer:${producer}`)],
          ...(gate.deploy === undefined ? {} : { deploy: gate.deploy }),
          projected: false,
        };
      }
      if (gate.deploy !== undefined) deployEvidence = gate.deploy;
    }
  }
  const owner = condition("no-owner-gate");
  if (owner !== undefined && owner.state !== "satisfied") {
    return {
      ...base,
      state: "held",
      blocking: [blocking("owner-gate", owner.evidence[0]?.detail)],
      projected: false,
    };
  }
  const tier = condition("tier-known");
  if (tier !== undefined && tier.state !== "satisfied") {
    return {
      ...base,
      state: "held",
      blocking: [blocking("tier-unknown", tier.evidence[0]?.detail)],
      projected: false,
    };
  }
  const ci = condition("ci-healthy");
  if (ci !== undefined && ci.state !== "satisfied") {
    return {
      ...base,
      state: "held",
      blocking: [blocking(reasonForCi(ci.evidence[0]?.reason), ci.evidence[0]?.detail)],
      projected: false,
    };
  }
  const provider = condition("provider-available");
  if (provider !== undefined && provider.state !== "satisfied") {
    return {
      ...base,
      state: "held",
      blocking: [
        blocking(reasonForProvider(provider.evidence[0]?.reason), provider.evidence[0]?.detail),
      ],
      projected: false,
    };
  }
  if (park?.state === "active") {
    return {
      ...base,
      state: "parked",
      blocking: [blocking(parkedReason(park.cause), `recheck:${park.recheckMs ?? 0}`)],
      projected: false,
    };
  }
  const repoFree = condition("repo-free");
  if (repoFree !== undefined && repoFree.state === "unknown") {
    return {
      ...base,
      state: "not-ready",
      blocking: [blocking("not-ready", "repository-binding-unresolved")],
      projected: false,
    };
  }
  const liveLease = facts.leases.find((candidate) => candidate.repository === entry.repository);
  if (liveLease !== undefined) {
    return {
      ...base,
      state: "held",
      blocking: [
        blocking(
          "lease-held",
          liveLease.ref === ref
            ? `holder:${liveLease.holder}; lease:${liveLease.leaseId}; self`
            : `holder:${liveLease.holder}; lease:${liveLease.leaseId}; ref:${liveLease.ref}`,
        ),
      ],
      projected: false,
    };
  }
  const heavy = isHeldByWeight(weight, facts.leases, facts.runner, ref);
  if (heavy !== undefined) {
    return {
      ...base,
      state: "held",
      blocking: [blocking("weight-class", `runner:${heavy.runner}; lease:${heavy.leaseId}`)],
      projected: false,
    };
  }
  return {
    ...base,
    state: "ready",
    blocking: [],
    ...(deployEvidence === undefined ? {} : { deploy: deployEvidence }),
    projected: false,
  };
};

const entryOrder = (fold: QueueGraphFold, left: EntryState, right: EntryState): number => {
  const leftRank = left.rankClass === undefined ? 99 : rankClassIndex(left.rankClass);
  const rightRank = right.rankClass === undefined ? 99 : rankClassIndex(right.rankClass);
  if (leftRank !== rightRank) return leftRank - rightRank;
  if (left.repository !== undefined && left.repository === right.repository) {
    if (isProducerOf(fold, left.ref, right.ref)) return -1;
    if (isProducerOf(fold, right.ref, left.ref)) return 1;
  }
  if (left.priority !== right.priority) return left.priority - right.priority;
  return compareRefs(left.ref, right.ref);
};

const parkProjection = (
  record: QueueSchedulerFacts["parkRecords"][number],
): QueueParkProjection => ({
  ref: record.ref,
  cause: record.cause,
  conditionType: record.conditionType,
  recheckMs: record.recheckMs,
  ...(record.condition.type === "provider-window" ? { expiresAt: record.condition.expiresAt } : {}),
  lastEvaluatedAt: record.evaluatedAt,
  ...(record.clearObservedAt === undefined ? {} : { clearObservedAt: record.clearObservedAt }),
  recoveryState: record.recoveryState,
  ...(record.clearedAt === undefined ? {} : { clearedAt: record.clearedAt }),
});

const latestParks = (facts: QueueSchedulerFacts): readonly QueueParkProjection[] => {
  const latest = new Map<string, QueueSchedulerFacts["parkRecords"][number]>();
  for (const record of facts.parkRecords) latest.set(record.ref, record);
  return [...latest.values()]
    .sort((left, right) => compareText(left.ref, right.ref))
    .map(parkProjection);
};

/**
 * Project the active fact for the read payloads. The inactive arm projects
 * nothing, so an inactive run is byte-identical to the delivered payload.
 */
const ownerHoldProjection = (facts: QueueSchedulerFacts): ScheduleOwnerHold | undefined => {
  const hold = facts.ownerHold;
  if (hold === undefined || !hold.active) return undefined;
  return hold.reason === undefined
    ? { source: hold.source }
    : { source: hold.source, reason: hold.reason };
};

/**
 * Gate one entry under an active hold: `ready` becomes `held`; every other
 * state is preserved; `owner-hold` is first and the entry's own ordered reasons
 * follow unchanged. Projection is suppressed so the pass emits no action.
 */
const applyOwnerHold = (state: EntryState): EntryState => ({
  ...state,
  state: state.state === "ready" ? "held" : state.state,
  blocking: [
    blocking("owner-hold"),
    ...state.blocking.filter((item) => item.reason !== "owner-hold"),
  ],
  projected: false,
});

/**
 * Compute one deterministic scheduling pass. Hard exclusions remove; ordering
 * orders; step 13b projects at most one action per repository; step 14 emits a
 * preemption proposal only. An active owner hold gates every entry and emits no
 * next action and no preemption proposal (GH-280 F-4.1, F-4.2).
 */
export const computeQueueSchedule = (
  facts: QueueSchedulerFacts,
  options: QueueScheduleOptions = {},
): QueueSchedule => {
  const nextCap = clampNext(options.next);
  const totalEntries = facts.fold.entries.length;
  const folded = facts.fold.entries.slice(0, QUEUE_MAX_ENTRIES);
  const deployState = createDeployGateState({
    ...facts.deploy,
    maxReads: facts.deploy.maxReads ?? QUEUE_MAX_DEPLOY_READS,
  });

  // Cheap ordering decides which candidates receive the expensive readiness
  // reads (NFR-6). The remainder are held with an explicit truncation reason.
  const cheap = folded
    .map((entry) => {
      const close = facts.close[entry.ref] ?? "none";
      const park = facts.parkEvaluations[entry.ref];
      return {
        ref: entry.ref,
        rankClass: resolveRankClass(close, park),
        priority: entry.priority ?? QUEUE_DEFAULT_PRIORITY,
      };
    })
    .sort((left, right) => {
      const leftRank = left.rankClass === undefined ? 99 : rankClassIndex(left.rankClass);
      const rightRank = right.rankClass === undefined ? 99 : rankClassIndex(right.rankClass);
      if (leftRank !== rightRank) return leftRank - rightRank;
      if (left.priority !== right.priority) return left.priority - right.priority;
      return compareRefs(left.ref, right.ref);
    });

  const evaluated = new Set(
    cheap.slice(0, QUEUE_MAX_EVALUATED_CANDIDATES).map((entry) => entry.ref),
  );
  const evaluatedStates = folded.map((entry) =>
    evaluateEntry(facts, deployState, entry.ref, !evaluated.has(entry.ref)),
  );
  const holdActive = facts.ownerHold?.active === true;
  const states = holdActive ? evaluatedStates.map(applyOwnerHold) : evaluatedStates;
  const byRef = new Map(states.map((state) => [state.ref, state]));

  const eligible = holdActive
    ? []
    : states
        .filter((state) => state.state === "ready")
        .sort((left, right) => entryOrder(facts.fold, left, right));

  // Step 13b: at most one projected action per repository per pass.
  const projectedRepositories = new Set<string>();
  const orderedEligible: EntryState[] = [];
  for (const state of eligible) {
    const repository = state.repository;
    if (repository !== undefined && projectedRepositories.has(repository)) {
      byRef.set(state.ref, {
        ...state,
        state: "held",
        blocking: [blocking("repo-claimed-in-pass", `repo:${repository}`)],
      });
      continue;
    }
    if (repository !== undefined) projectedRepositories.add(repository);
    orderedEligible.push(state);
    byRef.set(state.ref, { ...state, projected: true });
  }

  const nextActions: QueueNextAction[] = orderedEligible.map((state) => {
    const reason: QueueBlockingReason = isCloseRank(state.rankClass as QueueRankClass)
      ? "close-first"
      : isProducerInRepository(facts.fold, state.repository, state.ref)
        ? "producer-first"
        : state.rankClass === "resume-parked"
          ? "resume-parked"
          : "new-start";
    const bounded = boundBlocking(state.blocking);
    return {
      ref: state.ref,
      ...(state.repository === undefined ? {} : { repository: state.repository }),
      rankClass: state.rankClass as QueueRankClass,
      reason,
      priority: state.priority,
      weightClass: state.weightClass,
      weightClassSource: state.weightClassSource,
      lease: state.lease,
      blocking: bounded.blocking,
      ...(state.deploy === undefined ? {} : { deploy: state.deploy }),
    };
  });

  // Step 14: a close item blocked only by a new start's live lease proposes a
  // preemption; the close item is not scheduled in this pass.
  for (const state of states) {
    if (holdActive) break;
    if (
      state.state !== "held" ||
      state.repository === undefined ||
      state.rankClass === undefined ||
      !isCloseRank(state.rankClass)
    ) {
      continue;
    }
    const onlyLeaseHeld = state.blocking.length === 1 && state.blocking[0]?.reason === "lease-held";
    if (!onlyLeaseHeld) continue;
    const lease = facts.leases.find((candidate) => candidate.repository === state.repository);
    if (lease === undefined) continue;
    const holderClose = facts.close[lease.ref] ?? "none";
    if (holderClose !== "none") continue;
    nextActions.push({
      ref: state.ref,
      repository: state.repository,
      rankClass: state.rankClass,
      reason: "lease-held",
      priority: state.priority,
      weightClass: state.weightClass,
      weightClassSource: state.weightClassSource,
      lease: state.lease,
      blocking: [...state.blocking],
      preemption: {
        targetRef: state.ref,
        repository: state.repository,
        holder: lease.holder,
        parkCause: "preempted-for-close-item",
        conditionType: "preemption",
        closeRef: state.ref,
      },
    });
  }

  const findings: QueueFinding[] = states
    .filter((state) => state.state === "stuck")
    .map((state) => ({
      code: QUEUE_STUCK_PARK_FINDING_CODE,
      severity: "warning" as const,
      ref: state.ref,
      ...(state.repository === undefined ? {} : { repository: state.repository }),
      detail: "park condition cleared without a recovery record",
    }))
    .slice(0, QUEUE_MAX_FINDINGS);

  const cappedActions = nextActions.slice(0, nextCap);
  const reasonsTruncated = states.some((state) => state.blocking.length > QUEUE_MAX_REASONS);
  const entries: QueueEntryProjection[] = folded.map((entry) => {
    const state = byRef.get(entry.ref);
    if (state === undefined) throw new Error(`entry ${entry.ref} lost its state`);
    return {
      ref: state.ref,
      ...(state.repository === undefined ? {} : { repository: state.repository }),
      state: state.state,
      rankClass: state.rankClass ?? "new-start",
      priority: state.priority,
      weightClass: state.weightClass,
      weightClassSource: state.weightClassSource,
      deps: state.deps,
      blocking: boundBlocking(state.blocking).blocking,
    };
  });

  const leases: QueueLeaseProjection[] = facts.leases.map((lease) => ({
    repository: lease.repository,
    holder: lease.holder,
    leaseId: lease.leaseId,
    scope: lease.scope,
    ref: lease.ref,
    runner: lease.runner,
    weightClass: lease.weightClass,
    heartbeatAgeMs: lease.heartbeatAgeMs,
    ...(lease.takeover === undefined ? {} : { takeover: lease.takeover }),
  }));

  const truncated =
    totalEntries > QUEUE_MAX_ENTRIES ||
    states.length > evaluated.size ||
    nextActions.length > nextCap ||
    findings.length === QUEUE_MAX_FINDINGS ||
    reasonsTruncated;

  const ownerHold = ownerHoldProjection(facts);
  return {
    entries,
    nextActions: cappedActions,
    findings,
    leases,
    weights: weightLoads(facts.leases),
    parks: latestParks(facts),
    truncated,
    evaluatedCandidates: evaluated.size,
    deployReads: deployState.reads,
    ...(ownerHold === undefined ? {} : { ownerHold }),
  };
};

/** Whether a blocking reason is in the declared closed vocabulary. */
export const isDeclaredBlockingReason = (reason: string): boolean =>
  (QUEUE_BLOCKING_REASONS as readonly string[]).includes(reason) || reason.startsWith("parked:");

/** The minimal union the human renderer accepts across the queue surfaces. */
export type QueueHumanData =
  | import("#contracts").QueueListData
  | import("#contracts").QueuePlanData
  | import("#contracts").QueueMutationData
  | import("#contracts").QueueClaimData
  | import("#contracts").QueueReleaseData
  | import("#contracts").QueueRemoveData
  | import("#contracts").QueueDependencyRemovalData;

const utf8Length = (text: string): number => new TextEncoder().encode(text).length;

const truncateUtf8 = (text: string, maxBytes: number): string => {
  if (maxBytes <= 0) return "";
  if (utf8Length(text) <= maxBytes) return text;
  const characters = Array.from(text);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (utf8Length(characters.slice(0, middle).join("")) <= maxBytes - 1) low = middle;
    else high = middle - 1;
  }
  return `${characters.slice(0, low).join("")}+`;
};

const capHuman = (lines: readonly string[]): string => {
  const overflow = lines.length > QUEUE_MAX_HUMAN_LINES;
  const kept = lines.slice(0, overflow ? QUEUE_MAX_HUMAN_LINES - 1 : QUEUE_MAX_HUMAN_LINES);
  if (overflow) kept.push("+more");
  const text = `${kept.join("\n")}\n`;
  return utf8Length(text) <= QUEUE_MAX_HUMAN_BYTES
    ? text
    : truncateUtf8(text, QUEUE_MAX_HUMAN_BYTES);
};

/**
 * Enforce NFR-9's serialized machine byte cap. Trailing entries, then actions,
 * then findings/parks/leases/weights are dropped until the payload fits, and
 * `truncated` plus `truncationReason` are set so the cut is explicit.
 */
const boundQueueData = <T extends QueueListData | QueuePlanData>(data: T): T => {
  if (utf8Length(JSON.stringify(data)) <= QUEUE_MAX_MACHINE_BYTES) return data;
  const entries = [...data.entries];
  const nextActions = "nextActions" in data ? [...(data as QueuePlanData).nextActions] : undefined;
  const findings = [...data.findings];
  const parks = [...data.parks];
  const leases = [...data.leases];
  const weights = [...data.weights];
  const build = (): T =>
    ({
      ...data,
      entries,
      ...(nextActions === undefined ? {} : { nextActions }),
      findings,
      parks,
      leases,
      weights,
      truncated: true,
      truncationReason: "machine-byte-cap",
    }) as T;
  const dropTail = (lists: unknown[][]): boolean => {
    for (const list of lists) {
      if (list.length === 0) continue;
      const chunk = Math.max(1, Math.floor(list.length / 10));
      list.splice(list.length - chunk, chunk);
      return true;
    }
    return false;
  };
  let current = build();
  while (utf8Length(JSON.stringify(current)) > QUEUE_MAX_MACHINE_BYTES) {
    const dropped = dropTail([
      entries,
      ...(nextActions === undefined ? [] : [nextActions]),
      findings,
      parks,
      leases,
      weights,
    ]);
    if (!dropped) break;
    current = build();
  }
  return current;
};

/** Bound a `queue list` payload to the NFR-9 machine byte cap. */
export const boundQueueReadData = (data: QueueListData): QueueListData => boundQueueData(data);

/** Bound a `queue plan` payload to the NFR-9 machine byte cap. */
export const boundQueuePlanData = (data: QueuePlanData): QueuePlanData => boundQueueData(data);

/**
 * Deterministic human text for the queue family. When defined, the key=value
 * summary (`result=`, `ref=`, `lease=`, `next=`, `degraded=`) prints before any
 * human detail.
 */
export const renderQueueHuman = (data: QueueHumanData): string => {
  if ("nextActions" in data) {
    const lines = [
      `next=${data.nextActions.length}; entries=${data.counts.entries}; leases=${data.counts.leases}; parks=${data.counts.parks}; degraded=${data.degraded.join(",") || "none"}`,
      ...data.nextActions.map(
        (action, index) =>
          `${index + 1}. ${action.ref} ${action.rankClass} ${action.reason}${action.preemption === undefined ? "" : " preemption"}`,
      ),
    ];
    return capHuman(lines);
  }
  if ("entries" in data) {
    return capHuman([
      `entries=${data.counts.entries}; leases=${data.counts.leases}; parks=${data.counts.parks}; degraded=${data.degraded.join(",") || "none"}`,
      ...data.entries.map((entry) => `${entry.ref} ${entry.state} ${entry.rankClass}`),
    ]);
  }
  if ("selectedRef" in data) {
    return capHuman([
      `result=${data.result}; ref=${data.selectedRef}; lease=${data.lease.leaseId}; degraded=${data.degraded.join(",") || "none"}`,
    ]);
  }
  // The GH-292 lifecycle payloads carry the recomputed ready set; the readySet
  // member discriminates them from the delivered mutation shapes (TC-QLC-010).
  if ("readySet" in data && "reason" in data) {
    return capHuman([
      `result=${data.result}; ref=${data.ref}; reason=${data.reason}; ready=${data.readySet.length}; degraded=${data.degraded.join(",") || "none"}`,
      ...(data.readySet.length > 0 ? [data.readySet.join(", ")] : []),
    ]);
  }
  if ("readySet" in data && "edges" in data) {
    return capHuman([
      `result=${data.result}; ref=${data.ref}; edges=${data.edges.join(",") || "none"}; ready=${data.readySet.length}; degraded=${data.degraded.join(",") || "none"}`,
      ...(data.readySet.length > 0 ? [data.readySet.join(", ")] : []),
    ]);
  }
  if ("ref" in data) {
    return capHuman([
      `result=${data.result}; ref=${data.ref}; degraded=${data.degraded.join(",") || "none"}`,
    ]);
  }
  if ("result" in data) {
    return capHuman([
      `result=${data.result}; lease=${data.lease?.leaseId ?? "none"}; degraded=${data.degraded.join(",") || "none"}`,
    ]);
  }
  return "result=ok\n";
};
