/**
 * The pure owner-gate SLA evaluator, ranker, policy validator, and human
 * renderer (GH-229 F-1..F-8, DM-1..DM-3).
 *
 * No I/O, clock, randomness, or ambient environment: every variable fact
 * (including `nowMs`, `nowIso`, policy, gate facts, and decision history) arrives
 * through `OwnerGateSlaInput`. The only executable exports are the evaluator,
 * renderer, validator, and the family-code formatter; all helpers stay internal.
 */
import {
  BOARD_ACTIONS_LABEL,
  BOARD_COLLECTOR_ERROR_PREFIX,
  BOARD_COLLECTOR_ERROR_SUFFIX,
  BOARD_HUMAN_SECTION_CAPS,
  BOARD_MAX_ACTIONS,
  BOARD_MAX_ASKS,
  BOARD_MAX_GATES,
  BOARD_MAX_HUMAN_BYTES,
  BOARD_MAX_HUMAN_LINE_BYTES,
  BOARD_MAX_HUMAN_LINES,
  BOARD_MAX_ID_CHARS,
  BOARD_MAX_KIND_CHARS,
  BOARD_MAX_LANES,
  BOARD_MAX_MACHINE_BYTES,
  BOARD_MAX_OWNER_CHARS,
  BOARD_MAX_PARKED,
  BOARD_MAX_PHASE_CHARS,
  BOARD_MAX_QUESTION_CHARS,
  BOARD_MAX_REASON_CHARS,
  BOARD_MAX_REF_CHARS,
  BOARD_MAX_UNTIL_CHARS,
  BOARD_MAX_WAIVED_BY_CHARS,
  BOARD_SCHEMA_VERSION,
  BOARD_SECTION_DROP_ORDER,
  type BoardActionRow,
  type BoardAskDefaultState,
  type BoardAskFact,
  type BoardAskRow,
  type BoardData,
  type BoardGateRecord,
  type BoardGateRow,
  type BoardLaneFact,
  type BoardLaneRow,
  type BoardParkedFact,
  type BoardParkedRow,
  type BoardProjection,
  type BoardProjectionInput,
  type BoardRepositoryEvidence,
  type BoardRepositoryFacts,
  type BrandIdentity,
  OWNER_GATE_SLA_CLOCK_SOURCE,
  OWNER_GATE_SLA_DECISION_PAYLOAD_SCHEMA,
  OWNER_GATE_SLA_DEFAULTS,
  OWNER_GATE_SLA_RANK_STATE_ORDER,
  type OwnerGateFact,
  type OwnerGateSlaAudience,
  type OwnerGateSlaComparator,
  type OwnerGateSlaDecisionRecord,
  type OwnerGateSlaDefault,
  type OwnerGateSlaEvaluation,
  type OwnerGateSlaInput,
  type OwnerGateSlaPolicy,
  type OwnerGateSlaPolicyRow,
  type OwnerGateSlaState,
  type OwnerGateUnknownAgeReason,
  STATUS_FACTS_SCHEMA_VERSION,
} from "#contracts";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** The declared collector-unavailable identity for one collector id (DEC-7). */
export const collectorUnavailableCode = (collectorId: string): string =>
  `${BOARD_COLLECTOR_ERROR_PREFIX}${collectorId}${BOARD_COLLECTOR_ERROR_SUFFIX}`;

/** A declared policy-map validation violation (PDR-0003 C-1/C-2, DEC-2). */
export type OwnerGateSlaPolicyViolation =
  | "duplicate-kind"
  | "never-merge-default"
  | "non-defaultable-default"
  | "defaultable-without-default"
  | "undeclared-default"
  | "invalid-threshold"
  | "invalid-comparator";

/**
 * Validate the injected policy map.
 *
 * The never-merge exclusion is structural: a never-merge row carrying a default
 * is rejected before any age comparison. A defaultable row must declare exactly
 * one genuine, declared default; a non-defaultable row must declare none.
 */
export const validateOwnerGateSlaPolicy = (
  policy: OwnerGateSlaPolicy,
): readonly OwnerGateSlaPolicyViolation[] => {
  const violations: OwnerGateSlaPolicyViolation[] = [];
  if (!Number.isFinite(policy.escalationThresholdMs) || policy.escalationThresholdMs <= 0) {
    violations.push("invalid-threshold");
  }
  if (!Number.isFinite(policy.expiryThresholdMs) || policy.expiryThresholdMs <= 0) {
    violations.push("invalid-threshold");
  }
  if (policy.comparator !== ">=" && policy.comparator !== ">") {
    violations.push("invalid-comparator");
  }
  const seen = new Set<string>();
  for (const row of policy.rows) {
    if (seen.has(row.kind)) violations.push("duplicate-kind");
    seen.add(row.kind);
    if (row.neverMerge && row.default !== null) violations.push("never-merge-default");
    if (!row.defaultable && row.default !== null) violations.push("non-defaultable-default");
    if (row.defaultable && row.default === null) violations.push("defaultable-without-default");
    if (
      row.default !== null &&
      !(OWNER_GATE_SLA_DEFAULTS as readonly string[]).includes(row.default)
    ) {
      violations.push("undeclared-default");
    }
  }
  return violations;
};

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const utf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x7f) bytes += 1;
    else if (point <= 0x7ff) bytes += 2;
    else if (point <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

const clampChars = (value: string, maximum: number, state: { clamped: boolean }): string => {
  const points = Array.from(value);
  if (points.length <= maximum) return value;
  state.clamped = true;
  return `${points.slice(0, maximum - 1).join("")}+`;
};

const truncateToBytes = (value: string, maximum: number): string => {
  if (maximum <= 0) return "";
  if (utf8ByteLength(value) <= maximum) return value;
  const limit = maximum - 1;
  let bytes = 0;
  let result = "";
  for (const point of value) {
    const pointBytes = utf8ByteLength(point);
    if (bytes + pointBytes > limit) break;
    bytes += pointBytes;
    result += point;
  }
  return `${result}+`;
};

type ActivityEvidence =
  | { readonly state: "known"; readonly atMs: number }
  | { readonly state: "unknown"; readonly reason: OwnerGateUnknownAgeReason };

const parseActivity = (activityAt: string | null | undefined): ActivityEvidence => {
  if (activityAt === undefined || activityAt === null) {
    return { state: "unknown", reason: "activity-timestamp-absent" };
  }
  const trimmed = activityAt.trim();
  if (trimmed.length === 0) return { state: "unknown", reason: "activity-timestamp-absent" };
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed)
    ? { state: "known", atMs: parsed }
    : { state: "unknown", reason: "activity-timestamp-unparseable" };
};

const crossed = (age: number, threshold: number, comparator: OwnerGateSlaComparator): boolean =>
  comparator === ">" ? age > threshold : age >= threshold;

const rowFor = (policy: OwnerGateSlaPolicy, kind: string): OwnerGateSlaPolicyRow | undefined =>
  policy.rows.find((row) => row.kind === kind);

type Draft = {
  readonly record: BoardGateRecord;
  readonly decision?: OwnerGateSlaDecisionRecord;
  readonly rankAge: number | null;
};

const evaluateGate = (
  fact: OwnerGateFact,
  input: OwnerGateSlaInput,
  existing: OwnerGateSlaDecisionRecord | undefined,
  cap: { clamped: boolean },
): Draft => {
  const id = clampChars(fact.id, BOARD_MAX_ID_CHARS, cap);
  const kind = clampChars(fact.kind, BOARD_MAX_ID_CHARS, cap);
  const ref = clampChars(fact.ref, BOARD_MAX_REF_CHARS, cap);
  const waivedBy =
    fact.waivedBy === undefined ? null : clampChars(fact.waivedBy, BOARD_MAX_WAIVED_BY_CHARS, cap);
  const activity = parseActivity(fact.activityAt);

  if (activity.state === "unknown") {
    const record: BoardGateRecord = {
      id,
      kind,
      ref,
      age: null,
      ageUnknownReason: activity.reason,
      slaState: existing === undefined ? "escalated" : "default-applied",
      default: existing === undefined ? null : existing.appliedDefault,
      waivedBy,
    };
    return { record, rankAge: null };
  }

  const age = input.nowMs - activity.atMs;
  if (existing !== undefined) {
    return {
      record: {
        id,
        kind,
        ref,
        age,
        slaState: "default-applied",
        default: existing.appliedDefault,
        waivedBy,
      },
      rankAge: age,
    };
  }

  const policyRow = rowFor(input.policy, fact.kind);
  const escalation = crossed(age, input.policy.escalationThresholdMs, input.policy.comparator);
  const expiry = crossed(age, input.policy.expiryThresholdMs, input.policy.comparator);
  const eligible =
    expiry &&
    policyRow !== undefined &&
    policyRow.defaultable &&
    !policyRow.neverMerge &&
    policyRow.default !== null;

  if (eligible && policyRow !== undefined && policyRow.default !== null) {
    const decision: OwnerGateSlaDecisionRecord = {
      schemaId: OWNER_GATE_SLA_DECISION_PAYLOAD_SCHEMA,
      gateId: fact.id,
      gateKind: fact.kind,
      workItemRef: fact.ref,
      appliedDefault: policyRow.default,
      appliedAt: input.nowIso,
      thresholdCrossedMs: input.policy.expiryThresholdMs,
      clockSource: OWNER_GATE_SLA_CLOCK_SOURCE,
    };
    return {
      record: {
        id,
        kind,
        ref,
        age,
        slaState: "default-applied",
        default: policyRow.default,
        waivedBy,
      },
      decision,
      rankAge: age,
    };
  }

  const slaState: OwnerGateSlaState = escalation || expiry ? "escalated" : "fresh";
  return {
    record: { id, kind, ref, age, slaState, default: null, waivedBy },
    rankAge: age,
  };
};

const severityRank = (state: OwnerGateSlaState): number => {
  const index = OWNER_GATE_SLA_RANK_STATE_ORDER.indexOf(state);
  return index < 0 ? OWNER_GATE_SLA_RANK_STATE_ORDER.length : index;
};

const compareAge = (left: number | null, right: number | null): number => {
  if (left === right) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  return right - left;
};

const compareDrafts = (left: Draft, right: Draft): number => {
  const severity = severityRank(left.record.slaState) - severityRank(right.record.slaState);
  if (severity !== 0) return severity;
  const age = compareAge(left.rankAge, right.rankAge);
  if (age !== 0) return age;
  return compareText(left.record.id, right.record.id);
};

/** Evaluate the injected facts into the bounded board projection. */
export const evaluateOwnerGateSla = (input: OwnerGateSlaInput): OwnerGateSlaEvaluation => {
  const cap = { clamped: false };
  const decisions = new Map<string, OwnerGateSlaDecisionRecord>();
  for (const decision of input.decisions) {
    if (!decisions.has(decision.gateId)) decisions.set(decision.gateId, decision);
  }

  const drafts = input.gates.map((fact) => evaluateGate(fact, input, decisions.get(fact.id), cap));
  drafts.sort(compareDrafts);

  const rendered = drafts.slice(0, BOARD_MAX_GATES);
  const omitted = Math.max(0, drafts.length - rendered.length);
  const applied = new Set<string>();
  const decisionsToApply: OwnerGateSlaDecisionRecord[] = [];
  for (const draft of drafts) {
    if (draft.decision === undefined) continue;
    if (applied.has(draft.decision.gateId)) continue;
    applied.add(draft.decision.gateId);
    decisionsToApply.push(draft.decision);
  }

  return {
    audience: input.audience,
    gates: rendered.map((draft) => draft.record),
    truncated: omitted > 0 || cap.clamped,
    omitted,
    decisionsToApply,
  };
};

/** Project the evaluation into the board `data` payload. */
export const toBoardData = (
  evaluation: OwnerGateSlaEvaluation,
  collectors: BoardData["collectors"],
): BoardData => {
  const data: BoardData = {
    schemaVersion: BOARD_SCHEMA_VERSION,
    audience: evaluation.audience,
    scope: "repository",
    selection: "current",
    repositories: [],
    lanes: [],
    gates: evaluation.gates.map((record) => ({
      ...record,
      repository: "",
      condition: `${record.kind}:${record.slaState}`,
      owner: null,
      ownerSource: "gate-audience",
    })),
    asks: [],
    actions: [],
    parked: [],
    collectors,
    ownerHold: { active: false },
    stateSource: STATUS_FACTS_SCHEMA_VERSION,
    truncated: evaluation.truncated,
    omitted: evaluation.omitted,
    omittedBySection: {
      repositories: 0,
      lanes: 0,
      gates: evaluation.omitted,
      asks: 0,
      actions: 0,
      parked: 0,
    },
  };
  // The evaluator already bounds the gate count and field widths. This final
  // guard is deterministic and marks a defensive clamp rather than throwing.
  if (utf8ByteLength(JSON.stringify(data)) <= BOARD_MAX_MACHINE_BYTES) return data;
  const kept = data.gates.slice(0, Math.max(0, data.gates.length - 1));
  return {
    ...data,
    gates: kept,
    truncated: true,
    omitted: data.omitted + (data.gates.length - kept.length),
  };
};

const ageLabel = (record: BoardGateRecord): string => {
  if (record.age === null) {
    return `unknown:${record.ageUnknownReason ?? "activity-timestamp-absent"}`;
  }
  if (record.age < 0) return `${record.age}ms`;
  if (record.age < HOUR_MS) return `${Math.floor(record.age / 60_000)}m`;
  if (record.age < 2 * DAY_MS) return `${Math.floor(record.age / HOUR_MS)}h`;
  return `${Math.floor(record.age / DAY_MS)}d`;
};

const ageMsLabel = (age: number): string => {
  if (age < 0) return `${age}ms`;
  if (age < HOUR_MS) return `${Math.floor(age / 60_000)}m`;
  if (age < 2 * DAY_MS) return `${Math.floor(age / HOUR_MS)}h`;
  return `${Math.floor(age / DAY_MS)}d`;
};

const collectorEvidence = (data: BoardData): string =>
  data.collectors.map((entry) => `${entry.collector}:${entry.outcome}`).join(",");

/** Strip control characters and line breaks so hostile content cannot forge lines. */
const neutralize = (value: string): string =>
  Array.from(value)
    .filter((character) => {
      const point = character.codePointAt(0) ?? 0;
      return point >= 0x20 && point !== 0x7f;
    })
    .join("");

const boundedText = (value: string, maximum: number): string =>
  clampChars(neutralize(value), maximum, { clamped: false });

const gateRow = (
  repository: string,
  record: BoardGateRecord,
  audience: OwnerGateSlaAudience,
): BoardGateRow => {
  const owner =
    record.kind === "waiver"
      ? record.waivedBy === null
        ? null
        : boundedText(record.waivedBy, BOARD_MAX_OWNER_CHARS)
      : audience;
  return {
    ...record,
    repository,
    condition: `${record.kind}:${record.slaState}`,
    owner,
    ownerSource: record.kind === "waiver" ? "gate-waiver-authorizer" : "gate-audience",
  };
};

const defaultableByRef = (
  facts: readonly OwnerGateFact[],
  policy: OwnerGateSlaPolicy,
): Map<string, OwnerGateSlaDefault> => {
  const byRef = new Map<string, OwnerGateSlaDefault>();
  for (const fact of facts) {
    const row = rowFor(policy, fact.kind);
    if (row === undefined || !row.defaultable || row.default === null) continue;
    if (!byRef.has(fact.ref)) byRef.set(fact.ref, row.default);
  }
  return byRef;
};

const askRow = (
  repository: string,
  fact: BoardAskFact,
  drawn: Map<string, OwnerGateSlaDefault>,
  appliedRefs: ReadonlySet<string>,
): BoardAskRow => {
  const drawnDefault = fact.ref === null ? undefined : drawn.get(fact.ref);
  const state: BoardAskDefaultState =
    drawnDefault === undefined
      ? "none"
      : fact.ref !== null && appliedRefs.has(fact.ref)
        ? "applied"
        : "pending";
  return {
    repository,
    id: boundedText(fact.id, BOARD_MAX_ID_CHARS),
    type: boundedText(fact.type, BOARD_MAX_KIND_CHARS),
    ref: fact.ref === null ? null : boundedText(fact.ref, BOARD_MAX_REF_CHARS),
    lane: boundedText(fact.lane, BOARD_MAX_REF_CHARS),
    question: boundedText(fact.question, BOARD_MAX_QUESTION_CHARS),
    askedAt: fact.askedAt,
    age: fact.age,
    status: "open",
    owner: fact.owner === null ? null : boundedText(fact.owner, BOARD_MAX_OWNER_CHARS),
    ownerSource: "ask-audience",
    drawnDefault: drawnDefault ?? null,
    defaultState: state,
  };
};

const parkedRow = (repository: string, fact: BoardParkedFact): BoardParkedRow => ({
  repository,
  ref: boundedText(fact.ref, BOARD_MAX_REF_CHARS),
  reason: fact.reason,
  until: fact.until === null ? null : boundedText(fact.until, BOARD_MAX_UNTIL_CHARS),
  ...(fact.untilReason === undefined ? {} : { untilReason: fact.untilReason }),
  ...(fact.preservation === undefined ? {} : { preservation: fact.preservation }),
  ...(fact.providerProfile === undefined
    ? {}
    : { providerProfile: boundedText(fact.providerProfile, BOARD_MAX_KIND_CHARS) }),
  owner: fact.owner === null ? null : boundedText(fact.owner, BOARD_MAX_OWNER_CHARS),
  ownerSource: "park-control",
});

const laneRow = (repository: string, fact: BoardLaneFact): BoardLaneRow => ({
  repository,
  ref: boundedText(fact.ref, BOARD_MAX_REF_CHARS),
  laneId: boundedText(fact.laneId, BOARD_MAX_ID_CHARS),
  state: fact.state,
  phase: fact.phase === null ? null : boundedText(fact.phase, BOARD_MAX_PHASE_CHARS),
  ...(fact.phase === null && fact.phaseUnknownReason !== undefined
    ? { phaseUnknownReason: fact.phaseUnknownReason }
    : {}),
  holder: fact.holder === null ? null : boundedText(fact.holder, BOARD_MAX_OWNER_CHARS),
  ...(fact.leaseId === undefined ? {} : { leaseId: boundedText(fact.leaseId, BOARD_MAX_ID_CHARS) }),
  ...(fact.reason === undefined
    ? {}
    : { reason: boundedText(fact.reason, BOARD_MAX_REASON_CHARS) }),
  owner: fact.holder === null ? null : boundedText(fact.holder, BOARD_MAX_OWNER_CHARS),
  ownerSource: "lane-lease-holder",
});

const compareTextBy =
  <T>(key: (row: T) => string) =>
  (left: T, right: T): number =>
    compareText(key(left), key(right));

/**
 * Whether the run needs its one decision-history read (NFR-5): a defaultable
 * gate can cross expiry, or an ask joins a defaultable gate on its ref.
 */
export const boardNeedsDecisionHistory = (input: {
  readonly gates: readonly OwnerGateFact[];
  readonly asks: readonly BoardAskFact[];
  readonly policy: OwnerGateSlaPolicy;
  readonly nowMs: number;
}): boolean => {
  const drawn = defaultableByRef(input.gates, input.policy);
  if (
    input.asks.some(
      (ask) =>
        (ask.audience === undefined || ask.audience === "owner") &&
        ask.ref !== null &&
        drawn.has(ask.ref),
    )
  ) {
    return true;
  }
  return input.gates.some((gate) => {
    const row = rowFor(input.policy, gate.kind);
    if (row === undefined || !row.defaultable || row.default === null) return false;
    const activity = parseActivity(gate.activityAt);
    if (activity.state === "unknown") return false;
    return crossed(
      input.nowMs - activity.atMs,
      input.policy.expiryThresholdMs,
      input.policy.comparator,
    );
  });
};

const overCap = (value: string | undefined, maximum: number): boolean =>
  value !== undefined && Array.from(value).length > maximum;

const repositoryFieldsClamped = (repository: BoardRepositoryFacts): boolean =>
  repository.lanes.some(
    (lane) =>
      overCap(lane.ref, BOARD_MAX_REF_CHARS) ||
      overCap(lane.laneId, BOARD_MAX_ID_CHARS) ||
      overCap(lane.phase ?? undefined, BOARD_MAX_PHASE_CHARS) ||
      overCap(lane.holder ?? undefined, BOARD_MAX_OWNER_CHARS) ||
      overCap(lane.reason, BOARD_MAX_REASON_CHARS) ||
      overCap(lane.leaseId, BOARD_MAX_ID_CHARS),
  ) ||
  repository.gates.some(
    (gate) =>
      overCap(gate.id, BOARD_MAX_ID_CHARS) ||
      overCap(gate.kind, BOARD_MAX_ID_CHARS) ||
      overCap(gate.ref, BOARD_MAX_REF_CHARS) ||
      overCap(gate.waivedBy, BOARD_MAX_WAIVED_BY_CHARS),
  ) ||
  repository.asks.some(
    (ask) =>
      overCap(ask.id, BOARD_MAX_ID_CHARS) ||
      overCap(ask.type, BOARD_MAX_KIND_CHARS) ||
      overCap(ask.ref ?? undefined, BOARD_MAX_REF_CHARS) ||
      overCap(ask.lane, BOARD_MAX_REF_CHARS) ||
      overCap(ask.question, BOARD_MAX_QUESTION_CHARS) ||
      overCap(ask.owner ?? undefined, BOARD_MAX_OWNER_CHARS),
  ) ||
  repository.parks.some(
    (park) =>
      overCap(park.ref, BOARD_MAX_REF_CHARS) ||
      overCap(park.until ?? undefined, BOARD_MAX_UNTIL_CHARS) ||
      overCap(park.providerProfile, BOARD_MAX_KIND_CHARS) ||
      overCap(park.owner ?? undefined, BOARD_MAX_OWNER_CHARS),
  );

/**
 * Project the four sections from one repository's facts plus the delivered
 * gate evaluator (F-1, DM-2..DM-6, DM-10, DEC-15..DEC-19).
 */
export const projectBoard = (input: BoardProjectionInput): BoardProjection => {
  const repositories = [...input.repositories]
    .map((repository) => repository)
    .sort((left, right) => compareText(left.key, right.key));
  const lanes: BoardLaneRow[] = [];
  const gates: BoardGateRow[] = [];
  const asks: BoardAskRow[] = [];
  const actions: BoardActionRow[] = [];
  const parked: BoardParkedRow[] = [];
  const collectors: BoardRepositoryEvidence[] = [];
  const decisionsToApply: Record<string, readonly OwnerGateSlaDecisionRecord[]> = {};
  const omittedBySection = {
    repositories: input.omittedRepositories,
    lanes: 0,
    gates: 0,
    asks: 0,
    actions: 0,
    parked: 0,
  };

  for (const repository of repositories) {
    const evaluation = evaluateOwnerGateSla({
      audience: input.audience,
      nowMs: input.nowMs,
      nowIso: input.nowIso,
      policy: input.policy,
      gates: repository.gates,
      decisions: repository.decisions,
    });
    decisionsToApply[repository.key] = evaluation.decisionsToApply;
    for (const record of evaluation.gates)
      gates.push(gateRow(repository.key, record, input.audience));
    omittedBySection.gates += evaluation.omitted;

    const laneFacts = [...repository.lanes].sort(compareTextBy((fact) => fact.ref));
    for (const fact of laneFacts.slice(0, BOARD_MAX_LANES))
      lanes.push(laneRow(repository.key, fact));
    omittedBySection.lanes +=
      (repository.omittedLanes ?? 0) + Math.max(0, laneFacts.length - BOARD_MAX_LANES);

    const ownerAsks = repository.asks.filter(
      (ask) => ask.audience === undefined || ask.audience === "owner",
    );
    const askFacts = ownerAsks.slice(0, BOARD_MAX_ASKS);
    const drawn = defaultableByRef(repository.gates, input.policy);
    const appliedRefs = new Set(repository.decisions.map((decision) => decision.workItemRef));
    for (const fact of askFacts) asks.push(askRow(repository.key, fact, drawn, appliedRefs));
    omittedBySection.asks += Math.max(0, ownerAsks.length - BOARD_MAX_ASKS);

    const actionFacts = [...(repository.actions ?? [])].sort(
      compareTextBy((fact) => fact.actionId),
    );
    for (const fact of actionFacts.slice(0, BOARD_MAX_ACTIONS)) {
      actions.push({ ...fact, repository: repository.key });
    }
    omittedBySection.actions += Math.max(0, actionFacts.length - BOARD_MAX_ACTIONS);
    if (repository.actions !== undefined || repository.actionsSource !== undefined) {
      collectors.push({
        collector: "actions",
        outcome: repository.actionsSource ?? "available",
        repository: repository.key,
      });
    }

    const laneParks = repository.parks.filter(
      (park) => park.reason === "peak-window" || park.reason === "owner-hold",
    );
    const parkFacts = [...laneParks].sort(compareTextBy((fact) => fact.ref));
    for (const fact of parkFacts.slice(0, BOARD_MAX_PARKED))
      parked.push(parkedRow(repository.key, fact));
    omittedBySection.parked += Math.max(0, laneParks.length - BOARD_MAX_PARKED);

    collectors.push({ collector: "tracker", outcome: "available", repository: repository.key });
    collectors.push({ collector: "lanes", outcome: "available", repository: repository.key });
  }

  const omitted =
    omittedBySection.repositories +
    omittedBySection.lanes +
    omittedBySection.gates +
    omittedBySection.asks +
    omittedBySection.actions +
    omittedBySection.parked;
  const base: BoardData = {
    schemaVersion: BOARD_SCHEMA_VERSION,
    audience: input.audience,
    scope: input.scope,
    selection: input.selection,
    repositories: repositories.map((repository) => repository.key),
    lanes,
    gates,
    asks,
    actions,
    parked,
    collectors,
    ownerHold: input.ownerHold,
    stateSource: STATUS_FACTS_SCHEMA_VERSION,
    truncated: omitted > 0 || repositories.some(repositoryFieldsClamped),
    omitted,
    omittedBySection,
  };
  return { data: boundMachine(base), decisionsToApply };
};

type BoardSectionKey = "parked" | "actions" | "asks" | "lanes" | "gates";

/** Drop rows tail-first in the declared order until the payload fits (DM-11). */
const boundMachine = (data: BoardData): BoardData => {
  let current = data;
  const counters = { ...data.omittedBySection };
  let omitted = data.omitted;
  const order: readonly BoardSectionKey[] = [...BOARD_SECTION_DROP_ORDER];
  for (const section of order) {
    while (
      utf8ByteLength(JSON.stringify(current)) > BOARD_MAX_MACHINE_BYTES &&
      current[section].length > 0
    ) {
      counters[section] += 1;
      omitted += 1;
      if (section === "parked") current = { ...current, parked: current.parked.slice(0, -1) };
      if (section === "actions") current = { ...current, actions: current.actions.slice(0, -1) };
      if (section === "asks") current = { ...current, asks: current.asks.slice(0, -1) };
      if (section === "lanes") current = { ...current, lanes: current.lanes.slice(0, -1) };
      if (section === "gates") current = { ...current, gates: current.gates.slice(0, -1) };
      current = {
        ...current,
        truncated: true,
        omitted,
        omittedBySection: { ...counters },
      };
    }
  }
  return current;
};

const sectionLine = (
  label: string,
  rows: readonly string[],
  cap: number,
  machineOmitted: number,
  humanDropped: number,
): string[] => {
  const kept = rows.slice(0, cap);
  const dropped = humanDropped + Math.max(0, rows.length - cap);
  const marker =
    dropped + machineOmitted > 0
      ? ` +${dropped + machineOmitted} more ${label.toLowerCase()} omitted`
      : "";
  return [truncateToBytes(`${label}${marker}`, BOARD_MAX_HUMAN_LINE_BYTES), ...kept];
};

/**
 * Render the deterministic, TTY-independent, ANSI-free four-section screen.
 *
 * The renderer never mutates the payload. It clamps each line to 400 UTF-8
 * bytes and drops trailing lines (last section first) only when the declared
 * line/byte bound would be exceeded, marking every drop with `+N more`.
 */
export const renderBoardHuman = (data: BoardData, brand: BrandIdentity): string => {
  const evidence = collectorEvidence(data);
  const empty =
    data.lanes.length === 0 &&
    data.gates.length === 0 &&
    data.asks.length === 0 &&
    data.actions.length === 0 &&
    data.parked.length === 0;
  const header =
    empty || data.scope === "unbound"
      ? `${truncateToBytes(brand.binaryName, 128)} board  observed-empty  scope=${data.scope}  selection=${data.selection}  repositories=${String(data.repositories.length)}  collectors=${evidence}`
      : `${truncateToBytes(brand.binaryName, 128)} board  audience=${data.audience}  scope=${data.scope}  selection=${data.selection}  repositories=${String(data.repositories.length)}  collectors=${evidence}`;

  const laneLines = data.lanes.map(
    (row) =>
      `${row.repository}  ${row.ref}  state=${row.state}  phase=${row.phase ?? row.phaseUnknownReason ?? "null"}  holder=${row.holder ?? "null"}`,
  );
  const gateLines = data.gates.map(
    (row) =>
      `${row.repository}  ${row.id}  ${row.kind}  ${row.ref}  age=${ageLabel(row)}  sla=${row.slaState}  default=${row.default ?? "null"}  waivedBy=${row.waivedBy ?? "null"}  owner=${row.owner ?? "null"}  cond=${row.condition}`,
  );
  const askLines = data.asks.map(
    (row) =>
      `${row.repository}  ${row.id}  ref=${row.ref ?? "null"}  age=${ageMsLabel(row.age)}  default=${row.drawnDefault ?? "none"}:${row.defaultState}  owner=${row.owner ?? "null"}`,
  );
  const actionLines = data.actions.map(
    (row) =>
      `${row.repository}  ${row.actionId}  owner=${row.owner}  level=${row.level}  age=${ageMsLabel(row.age)}  aging=${row.agingState}  window=${row.window}:${String(row.windowOpenCount)}/${String(row.windowLimit)}`,
  );
  const parkedLines = data.parked.map(
    (row) =>
      `${row.repository}  ${row.ref}  reason=${row.reason}  until=${row.until ?? row.untilReason ?? "null"}  owner=${row.owner ?? "null"}`,
  );

  const humanDropped: Record<BoardSectionKey, number> = {
    lanes: 0,
    gates: 0,
    asks: 0,
    actions: 0,
    parked: 0,
  };
  const compose = (): string[] => [
    header,
    ...sectionLine(
      "LANES",
      laneLines.slice(0, laneLines.length - humanDropped.lanes),
      BOARD_HUMAN_SECTION_CAPS.lanes,
      data.omittedBySection.lanes,
      humanDropped.lanes,
    ),
    ...sectionLine(
      "GATES",
      gateLines.slice(0, gateLines.length - humanDropped.gates),
      BOARD_HUMAN_SECTION_CAPS.gates,
      data.omittedBySection.gates,
      humanDropped.gates,
    ),
    ...sectionLine(
      "ASKS",
      askLines.slice(0, askLines.length - humanDropped.asks),
      BOARD_HUMAN_SECTION_CAPS.asks,
      data.omittedBySection.asks,
      humanDropped.asks,
    ),
    ...sectionLine(
      BOARD_ACTIONS_LABEL,
      actionLines.slice(0, actionLines.length - humanDropped.actions),
      BOARD_HUMAN_SECTION_CAPS.actions,
      data.omittedBySection.actions,
      humanDropped.actions,
    ),
    ...sectionLine(
      "PARKED",
      parkedLines.slice(0, parkedLines.length - humanDropped.parked),
      BOARD_HUMAN_SECTION_CAPS.parked,
      data.omittedBySection.parked,
      humanDropped.parked,
    ),
  ];
  let lines = compose().map((line) =>
    truncateToBytes(neutralize(line), BOARD_MAX_HUMAN_LINE_BYTES),
  );
  let text = `${lines.join("\n")}\n`;
  const dropOrder: readonly BoardSectionKey[] = [...BOARD_SECTION_DROP_ORDER];
  for (const section of dropOrder) {
    const total = {
      lanes: laneLines.length,
      gates: gateLines.length,
      asks: askLines.length,
      actions: actionLines.length,
      parked: parkedLines.length,
    }[section];
    while (
      humanDropped[section] < total &&
      (lines.length > BOARD_MAX_HUMAN_LINES || utf8ByteLength(text) > BOARD_MAX_HUMAN_BYTES)
    ) {
      humanDropped[section] += 1;
      lines = compose().map((line) =>
        truncateToBytes(neutralize(line), BOARD_MAX_HUMAN_LINE_BYTES),
      );
      text = `${lines.join("\n")}\n`;
    }
  }
  return text;
};

/** True when the code is the declared collector-unavailable family for any id. */
export const isCollectorUnavailableFamilyCode = (code: string): boolean => {
  if (!code.startsWith(BOARD_COLLECTOR_ERROR_PREFIX)) return false;
  if (!code.endsWith(BOARD_COLLECTOR_ERROR_SUFFIX)) return false;
  const id = code.slice(
    BOARD_COLLECTOR_ERROR_PREFIX.length,
    code.length - BOARD_COLLECTOR_ERROR_SUFFIX.length,
  );
  return /^[a-z][a-z0-9-]*$/.test(id);
};
