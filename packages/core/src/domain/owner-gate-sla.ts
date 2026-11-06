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
  BOARD_COLLECTOR_ERROR_PREFIX,
  BOARD_COLLECTOR_ERROR_SUFFIX,
  BOARD_MAX_GATES,
  BOARD_MAX_HUMAN_BYTES,
  BOARD_MAX_HUMAN_LINES,
  BOARD_MAX_ID_CHARS,
  BOARD_MAX_MACHINE_BYTES,
  BOARD_MAX_REF_CHARS,
  BOARD_MAX_WAIVED_BY_CHARS,
  BOARD_SCHEMA_VERSION,
  type BoardData,
  type BoardGateRecord,
  type BrandIdentity,
  OWNER_GATE_SLA_CLOCK_SOURCE,
  OWNER_GATE_SLA_DECISION_PAYLOAD_SCHEMA,
  OWNER_GATE_SLA_DEFAULTS,
  OWNER_GATE_SLA_RANK_STATE_ORDER,
  type OwnerGateFact,
  type OwnerGateSlaComparator,
  type OwnerGateSlaDecisionRecord,
  type OwnerGateSlaEvaluation,
  type OwnerGateSlaInput,
  type OwnerGateSlaPolicy,
  type OwnerGateSlaPolicyRow,
  type OwnerGateSlaState,
  type OwnerGateUnknownAgeReason,
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
    gates: evaluation.gates,
    truncated: evaluation.truncated,
    omitted: evaluation.omitted,
    collectors,
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

const gateLine = (record: BoardGateRecord): string =>
  `${record.id}  ${record.kind}  ${record.ref}  age=${ageLabel(record)}  sla=${record.slaState}  default=${record.default ?? "null"}  waivedBy=${record.waivedBy ?? "null"}`;

const collectorEvidence = (data: BoardData): string =>
  data.collectors.map((entry) => `${entry.collector}:${entry.outcome}`).join(",");

/**
 * Render the deterministic, TTY-independent, ANSI-free aging grid.
 *
 * The renderer never mutates the payload. It clamps each line to 400 UTF-8 bytes
 * and drops trailing lines only when the declared line/byte bound would be
 * exceeded, marking the drop with `+N`.
 */
export const renderBoardHuman = (data: BoardData, brand: BrandIdentity): string => {
  const evidence = collectorEvidence(data);
  const header =
    data.gates.length === 0
      ? `${truncateToBytes(brand.binaryName, 128)} board  observed-empty  collectors=${evidence}`
      : `${truncateToBytes(brand.binaryName, 128)} board  audience=${data.audience}  collectors=${evidence}`;
  const lines = data.gates.map((record) => truncateToBytes(gateLine(record), 400));
  const markerFor = (dropped: number): string | undefined => {
    if (dropped > 0) return `+${dropped} more gates omitted`;
    if (data.omitted > 0) return `+${data.omitted} more gates omitted`;
    return data.truncated ? "output clamped" : undefined;
  };
  const compose = (kept: readonly string[], dropped: number): string[] => {
    const marker = markerFor(dropped);
    return marker === undefined ? [header, ...kept] : [header, ...kept, marker];
  };
  let kept = lines.slice();
  let text = `${compose(kept, 0).join("\n")}\n`;
  while (
    kept.length > 0 &&
    (compose(kept, 0).length > BOARD_MAX_HUMAN_LINES ||
      utf8ByteLength(text) > BOARD_MAX_HUMAN_BYTES)
  ) {
    kept = kept.slice(0, kept.length - 1);
    text = `${compose(kept, data.omitted + (lines.length - kept.length)).join("\n")}\n`;
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
