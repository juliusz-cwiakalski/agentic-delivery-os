/**
 * The pure status aggregator and human renderer (GH-175 F-2..F-11, D3).
 *
 * No I/O, clock, randomness, or ambient environment: every variable fact
 * (including `nowMs`/`nowIso`) arrives through `StatusFacts`. The two exported
 * functions are the only executable surface; all helpers stay internal.
 */
import {
  type BrandIdentity,
  type DeliveryRequest,
  OWNER_GATE_SLA_POLICY,
  type OwnerGateFact,
  type OwnerGateSlaState,
  type OwnerGateUnknownAgeReason,
  type PipelineRun,
  type SpendDigestSection,
  STATUS_FINDING_REGISTRY,
  STATUS_FINDING_SEVERITIES,
  STATUS_HUMAN_CLAMP_MARKER,
  STATUS_HYGIENE_ASSERTIONS,
  STATUS_HYGIENE_LABEL_CONVENTIONS,
  STATUS_LANE_ATTENTION_STATES,
  STATUS_MAX_DETAIL_CHARS,
  STATUS_MAX_EVIDENCE_SOURCES,
  STATUS_MAX_FINDING_MEMBERS,
  STATUS_MAX_FINDINGS_PER_SECTION,
  STATUS_MAX_HUMAN_BYTES,
  STATUS_MAX_HUMAN_LINES,
  STATUS_MAX_ITEMS_PER_SECTION,
  STATUS_MAX_OPEN_PULL_REQUESTS,
  STATUS_MAX_PARKED_CHANGES,
  STATUS_MAX_PIPELINE_RUNS,
  STATUS_MAX_PROVIDER_ENTRIES,
  STATUS_MAX_PROVIDER_PARKS,
  STATUS_MAX_READY_ITEMS,
  STATUS_MAX_REASONS,
  STATUS_MAX_TITLE_CHARS,
  STATUS_MAX_TRACKER_FAMILY_ITEMS,
  STATUS_OWNER_ATTENTION_LABELS,
  STATUS_PLACEHOLDER_SECTION_IDS,
  STATUS_PRIMARY_BRANCH,
  STATUS_SCHEMA_VERSION,
  STATUS_SECTION_TITLES,
  STATUS_SOURCE_ITEM_LIMIT,
  STATUS_SOURCE_PIPELINE_LIMIT,
  STATUS_STALL_THRESHOLD_DAYS,
  STATUS_TRACKER_FAMILIES,
  type StatusActiveChange,
  type StatusCiResult,
  type StatusCounts,
  type StatusDeliveryRequestRead,
  type StatusDigest,
  type StatusEvidence,
  type StatusEvidenceOutcome,
  type StatusEvidenceReason,
  type StatusEvidenceSource,
  type StatusFacts,
  type StatusFinding,
  type StatusFindingSeverity,
  type StatusHygieneAssertion,
  type StatusHygieneFinding,
  type StatusLocalContextRead,
  type StatusParkedWorkEntry,
  type StatusParkedWorkItem,
  type StatusPipelineRunRead,
  type StatusProviderConfigRead,
  type StatusProviderEntry,
  type StatusProviderPark,
  type StatusPullRequestItem,
  type StatusReadFailure,
  type StatusReadyItem,
  type StatusRepositoryBinding,
  type StatusSection,
  type StatusSectionState,
  type StatusTrackerAvailability,
  type StatusTrackerFamily,
  type StatusTrackerFamilyId,
  type StatusTrackerItem,
  type StatusWorkItemRead,
  type WorkItem,
} from "#contracts";
import { rankBlockerQuestions } from "./blockers.js";
import { classifyPipelineRuns } from "./ci-result.js";
import {
  isReservedEscalationQuestion,
  projectReservedSlotQuestions,
} from "./coordinator-escalation.js";
import { evaluateOwnerGateSla } from "./owner-gate-sla.js";

const DAY_MS = 86_400_000;

const clampTitle = (title: string): string =>
  title.length > STATUS_MAX_TITLE_CHARS ? title.slice(0, STATUS_MAX_TITLE_CHARS) : title;

const utf8Bytes = (value: string): number => {
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

const clampDetail = (detail: string | undefined): string | undefined => {
  if (detail === undefined) return undefined;
  if (utf8Bytes(detail) <= STATUS_MAX_DETAIL_CHARS) return detail;
  let bytes = 0;
  let result = "";
  for (const point of detail) {
    const size = utf8Bytes(point);
    if (bytes + size > STATUS_MAX_DETAIL_CHARS) break;
    bytes += size;
    result += point;
  }
  return result;
};

/** Ascending Unicode code-point comparison on normalized strings. */
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

const numeric = (value: string): number | undefined => {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Numeric-aware identity comparison, falling back to text. */
const compareIdentity = (left: string, right: string): number => {
  const a = numeric(left);
  const b = numeric(right);
  if (a !== undefined && b !== undefined) return a === b ? 0 : a < b ? -1 : 1;
  return compareText(left, right);
};

const refPattern = /^(.*)-(\d+)$/;
const refParts = (value: string): [string, number] | undefined => {
  const match = refPattern.exec(value);
  if (match === null) return undefined;
  const prefix = match[1];
  const digits = match[2];
  if (prefix === undefined || digits === undefined) return undefined;
  const number = Number(digits);
  return Number.isFinite(number) ? [prefix, number] : undefined;
};

/** `PREFIX-number` ascending, numeric-aware when both match; plain text otherwise. */
const compareWorkRef = (left: string, right: string): number => {
  const a = refParts(left);
  const b = refParts(right);
  if (a !== undefined && b !== undefined && a[0] === b[0]) {
    return a[1] === b[1] ? 0 : a[1] < b[1] ? -1 : 1;
  }
  return compareText(left, right);
};

const parseInstant = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const countOf = (
  observed: number,
  unknown: number,
  total: number,
  omitted: number,
): StatusCounts => ({ observed, unknown, total, omitted });

const zeroCounts = (): StatusCounts => countOf(0, 0, 0, 0);

/* ------------------------------ findings layer ----------------------------- */

/** One raw observation before grouping: a registry code and an identity member. */
export type StatusFindingObservation = {
  readonly code: string;
  readonly member: string;
};

/** The injectable registry seam: the shipped registry is the default (D-2). */
export type StatusFindingRegistryLike = Readonly<
  Record<string, { readonly severity: StatusFindingSeverity }>
>;

/** The injectable cap seam used by the defensive cap proof (DEC-15). */
export type StatusFindingLimits = {
  readonly findings: number;
  readonly members: number;
};

/** The grouped findings plus whether a declared drop occurred (DM-4, D-7). */
export type StatusFindingsEvaluation = {
  readonly findings: readonly StatusFinding[];
  readonly truncated: boolean;
};

type FindingGroup = {
  readonly code: string;
  readonly severity: StatusFindingSeverity;
  readonly firstIndex: number;
  count: number;
  readonly uniqueMembers: string[];
};

const severityRank = (severity: StatusFindingSeverity): number =>
  STATUS_FINDING_SEVERITIES.indexOf(severity);

const compareFindings = (left: FindingGroup, right: FindingGroup): number => {
  const severity = severityRank(left.severity) - severityRank(right.severity);
  if (severity !== 0) return severity;
  if (left.count !== right.count) return right.count - left.count;
  const code = compareText(left.code, right.code);
  if (code !== 0) return code;
  return left.firstIndex - right.firstIndex;
};

/**
 * Group registry-coded observations into bounded, ranked findings.
 *
 * The layer is pure and accepts its registry and caps so the defensive cap can
 * be exercised at this seam (DEC-15). Members are unique identities in first
 * observation order (the section's fixed rank order); `count` is the exact
 * observation total and may exceed `members.length` when identities repeat.
 */
export const evaluateStatusFindings = (
  observations: readonly StatusFindingObservation[],
  registry: StatusFindingRegistryLike = STATUS_FINDING_REGISTRY,
  limits: StatusFindingLimits = {
    findings: STATUS_MAX_FINDINGS_PER_SECTION,
    members: STATUS_MAX_FINDING_MEMBERS,
  },
): StatusFindingsEvaluation => {
  const groups = new Map<string, FindingGroup>();
  for (const [index, observation] of observations.entries()) {
    const definition = registry[observation.code];
    if (definition === undefined) continue;
    if (!(STATUS_FINDING_SEVERITIES as readonly string[]).includes(definition.severity)) continue;
    const existing = groups.get(observation.code);
    if (existing === undefined) {
      groups.set(observation.code, {
        code: observation.code,
        severity: definition.severity,
        firstIndex: index,
        count: 1,
        uniqueMembers: [observation.member],
      });
      continue;
    }
    existing.count += 1;
    if (!existing.uniqueMembers.includes(observation.member)) {
      existing.uniqueMembers.push(observation.member);
    }
  }
  const all = [...groups.values()];
  let truncated = all.some((group) => group.uniqueMembers.length > limits.members);
  all.sort(compareFindings);
  const retained = all.slice(0, Math.max(0, limits.findings));
  if (retained.length < all.length) truncated = true;
  return {
    findings: retained.map((group) => {
      const members = group.uniqueMembers.slice(0, Math.max(0, limits.members));
      return {
        code: group.code as StatusFinding["code"],
        severity: group.severity,
        count: group.count,
        members,
        evidenceRef: members[0] ?? "",
      };
    }),
    truncated,
  };
};

const withFindings = (
  section: StatusSection,
  observations: readonly StatusFindingObservation[],
): StatusSection => {
  const evaluation = evaluateStatusFindings(observations);
  if (evaluation.findings.length === 0 && !evaluation.truncated) return section;
  return {
    ...section,
    ...(evaluation.findings.length === 0 ? {} : { findings: evaluation.findings }),
    truncated: section.truncated || evaluation.truncated,
  };
};

type EvidenceSourceEntry = {
  readonly source: StatusEvidenceSource;
  readonly outcome: StatusEvidenceOutcome;
  readonly failureCode?: string;
  readonly failureClass?: string;
};

type SectionDraft = {
  readonly id: StatusSection["id"];
  readonly state: StatusSectionState;
  readonly counts: StatusCounts;
  readonly truncated: boolean;
  readonly sources: readonly EvidenceSourceEntry[];
  readonly reasons: readonly StatusEvidenceReason[];
};

const buildEvidence = (
  sources: readonly EvidenceSourceEntry[],
  reasons: readonly StatusEvidenceReason[],
): StatusEvidence => {
  const unique: StatusEvidenceReason[] = [];
  for (const reason of reasons) {
    if (!unique.includes(reason)) unique.push(reason);
    if (unique.length >= STATUS_MAX_REASONS) break;
  }
  return {
    sources: sources.slice(0, STATUS_MAX_EVIDENCE_SOURCES),
    reasons: unique.length === 0 ? ["source-unavailable"] : unique,
  };
};

const sectionBase = (
  draft: SectionDraft,
): Pick<StatusSection, "id" | "title" | "state" | "evidence" | "counts" | "truncated"> => ({
  id: draft.id,
  title: STATUS_SECTION_TITLES[draft.id],
  state: draft.state,
  evidence: buildEvidence(draft.sources, draft.reasons),
  counts: draft.counts,
  truncated: draft.truncated,
});

const reasonForReadFailure = (failure: StatusReadFailure): StatusEvidenceReason => {
  switch (failure.reason) {
    case "credential-unavailable":
      return "credential-unavailable";
    case "commit-unresolved":
      return "commit-unresolved";
    case "not-configured":
      return "source-unavailable";
    case "read-failed":
      return "read-failed";
    default:
      return "read-failed";
  }
};

const failureCodeOf = (failure: StatusReadFailure): string | undefined =>
  "failureCode" in failure ? failure.failureCode : undefined;
const failureClassOf = (failure: StatusReadFailure): string | undefined =>
  "failureClass" in failure ? failure.failureClass : undefined;

const readFailureSource = (
  source: StatusEvidenceSource,
  failure: StatusReadFailure,
): EvidenceSourceEntry => {
  const failureCode = failureCodeOf(failure);
  const failureClass = failureClassOf(failure);
  return {
    source,
    outcome: failure.reason === "not-configured" ? "not-configured" : "failed",
    ...(failureCode === undefined ? {} : { failureCode }),
    ...(failureClass === undefined ? {} : { failureClass }),
  };
};

const bindingReason = (
  binding: StatusRepositoryBinding,
): "addressing-unresolved" | "remote-unsupported" | undefined =>
  binding.state === "unavailable" ? binding.reason : undefined;

const isOpen = (item: WorkItem): boolean =>
  item.status.deliveryState !== "done" && item.status.deliveryState !== "canceled";

const refOf = (item: WorkItem): string => item.identity.entityId;

const allItems = (read: StatusWorkItemRead): readonly WorkItem[] => (read.ok ? read.items : []);

/* ---------------------------------- tracker -------------------------------- */

type FamilyResult = {
  readonly family: StatusTrackerFamily;
  readonly reasons: readonly StatusEvidenceReason[];
};

/**
 * Counts aggregate over the fully ranked family, before the render cap, so an
 * unknown item is never hidden by truncation; `omitted` remains the number of
 * ranked items the cap dropped.
 */
const familyCounts = (
  all: readonly StatusTrackerItem[],
  renderedCount: number,
  total: number,
): StatusCounts => {
  const observed = all.filter((item) => item.itemState === "observed").length;
  const unknown = all.filter((item) => item.itemState === "unknown").length;
  return countOf(observed, unknown, total, total - renderedCount);
};

const capped = <T>(ranked: readonly T[], limit: number): readonly T[] => ranked.slice(0, limit);

const ownerHandBackMatching = (items: readonly WorkItem[]): readonly WorkItem[] =>
  items.filter(
    (item) =>
      isOpen(item) &&
      item.labels.some((label) =>
        STATUS_OWNER_ATTENTION_LABELS.some(
          (attention) => attention.toLowerCase() === label.toLowerCase(),
        ),
      ),
  );

const ownerHandBackGroupOf = (item: WorkItem): number => {
  const labelCount: number = STATUS_OWNER_ATTENTION_LABELS.length;
  let group = labelCount;
  for (const [index, attention] of STATUS_OWNER_ATTENTION_LABELS.entries()) {
    if (item.labels.some((label) => label.toLowerCase() === attention.toLowerCase())) {
      group = Math.min(group, index);
    }
  }
  return group;
};

const rankOwnerHandBacks = (items: readonly WorkItem[]): readonly WorkItem[] =>
  [...ownerHandBackMatching(items)].sort((left, right) => {
    const group = ownerHandBackGroupOf(left) - ownerHandBackGroupOf(right);
    if (group !== 0) return group;
    const leftAt = parseInstant(left.updatedAt) ?? Number.POSITIVE_INFINITY;
    const rightAt = parseInstant(right.updatedAt) ?? Number.POSITIVE_INFINITY;
    if (leftAt !== rightAt) return leftAt < rightAt ? -1 : 1;
    return compareText(refOf(left), refOf(right));
  });

type OwnerGateProjection = {
  readonly age: number | null;
  readonly ageUnknownReason?: OwnerGateUnknownAgeReason;
  readonly slaState: OwnerGateSlaState;
};

/**
 * Project one hand-back through the delivered M1-S5 evaluator (D-4): the same
 * policy is imported by reference, the audience is the coordinator, no existing
 * decision record is injected, and `decisionsToApply` is discarded.
 */
const projectOwnerGate = (item: WorkItem, nowMs: number, nowIso: string): OwnerGateProjection => {
  const fact: OwnerGateFact = {
    id: refOf(item),
    kind: "owner-review",
    ref: refOf(item),
    ...(item.updatedAt === undefined ? {} : { activityAt: item.updatedAt }),
  };
  const evaluation = evaluateOwnerGateSla({
    audience: "coordinator",
    nowMs,
    nowIso,
    policy: OWNER_GATE_SLA_POLICY,
    gates: [fact],
    decisions: [],
  });
  const record = evaluation.gates[0];
  if (record === undefined) {
    return { age: null, ageUnknownReason: "activity-timestamp-absent", slaState: "escalated" };
  }
  return {
    age: record.age,
    ...(record.ageUnknownReason === undefined ? {} : { ageUnknownReason: record.ageUnknownReason }),
    slaState: record.slaState,
  };
};

const gateIsEscalated = (projection: OwnerGateProjection): boolean =>
  projection.slaState === "escalated" || projection.slaState === "default-applied";

const ownerHandBacksFamily = (
  items: readonly WorkItem[],
  available: boolean,
  projections: ReadonlyMap<string, OwnerGateProjection>,
): FamilyResult => {
  if (!available) {
    return {
      family: {
        family: "ownerHandBacks",
        state: "unavailable",
        reason: "signal-unavailable",
        counts: zeroCounts(),
        items: [],
      },
      reasons: ["signal-unavailable"],
    };
  }
  const ranked = rankOwnerHandBacks(items);
  const mapped = ranked.map((item): StatusTrackerItem => {
    const projection = projections.get(refOf(item));
    return {
      workItemRef: refOf(item),
      title: clampTitle(item.title),
      family: "ownerHandBacks",
      itemState: "observed",
      labels: [...item.labels],
      ...(projection === undefined
        ? {}
        : {
            age: projection.age,
            ...(projection.ageUnknownReason === undefined
              ? {}
              : { ageUnknownReason: projection.ageUnknownReason }),
            slaState: projection.slaState,
          }),
    };
  });
  const rendered = capped(mapped, STATUS_MAX_TRACKER_FAMILY_ITEMS);
  return {
    family: {
      family: "ownerHandBacks",
      state: "observed",
      counts: familyCounts(mapped, rendered.length, ranked.length),
      items: rendered,
    },
    reasons: ranked.length === 0 ? ["observed-empty"] : ["observed"],
  };
};

const blockedDependenciesFamily = (
  items: readonly WorkItem[],
  available: boolean,
): FamilyResult => {
  if (!available) {
    return {
      family: {
        family: "blockedDependencies",
        state: "unavailable",
        reason: "signal-unavailable",
        counts: zeroCounts(),
        items: [],
      },
      reasons: ["signal-unavailable"],
    };
  }
  const byId = new Map<string, WorkItem>();
  for (const item of items) byId.set(refOf(item), item);
  const blocked: { readonly item: WorkItem; readonly dependencyState: "open" | "unknown" }[] = [];
  for (const item of items) {
    if (!isOpen(item)) continue;
    const relations = item.relations.filter((relation) => relation.relationKind === "blocked-by");
    if (relations.length === 0) continue;
    let state: "open" | "unknown" | undefined;
    for (const relation of relations) {
      const target = byId.get(relation.target.entityId);
      if (
        target !== undefined &&
        (target.status.deliveryState === "done" || target.status.deliveryState === "canceled")
      ) {
        continue;
      }
      if (target === undefined) {
        state = "unknown";
        break;
      }
      state = "open";
    }
    if (state !== undefined) blocked.push({ item, dependencyState: state });
  }
  const ranked = [...blocked].sort((left, right) => {
    if (left.dependencyState !== right.dependencyState) {
      return left.dependencyState === "unknown" ? -1 : 1;
    }
    return compareText(refOf(left.item), refOf(right.item));
  });
  const mapped = ranked.map(
    (entry): StatusTrackerItem => ({
      workItemRef: refOf(entry.item),
      title: clampTitle(entry.item.title),
      family: "blockedDependencies",
      itemState: "observed",
      dependencyState: entry.dependencyState,
    }),
  );
  const rendered = capped(mapped, STATUS_MAX_TRACKER_FAMILY_ITEMS);
  return {
    family: {
      family: "blockedDependencies",
      state: "observed",
      counts: familyCounts(mapped, rendered.length, blocked.length),
      items: rendered,
    },
    reasons: blocked.length === 0 ? ["observed-empty"] : ["observed"],
  };
};

type StalledEntry = {
  readonly item: WorkItem;
  readonly activity: "stalled" | "unknown";
  readonly ageDays?: number;
};

const rankStalledEntries = (items: readonly WorkItem[], nowMs: number): readonly StalledEntry[] => {
  const entries: StalledEntry[] = [];
  for (const item of items) {
    if (!isOpen(item)) continue;
    if (item.updatedAt === undefined) {
      entries.push({ item, activity: "unknown" });
      continue;
    }
    const updatedAt = parseInstant(item.updatedAt);
    if (updatedAt === undefined) {
      entries.push({ item, activity: "unknown" });
      continue;
    }
    const ageDays = Math.floor((nowMs - updatedAt) / DAY_MS);
    if (ageDays > STATUS_STALL_THRESHOLD_DAYS) {
      entries.push({ item, activity: "stalled", ageDays });
    }
  }
  return [...entries].sort((left, right) => {
    if (left.activity !== right.activity) return left.activity === "stalled" ? -1 : 1;
    if (left.activity === "stalled" && right.activity === "stalled") {
      const age = (right.ageDays ?? 0) - (left.ageDays ?? 0);
      if (age !== 0) return age;
    }
    return compareText(refOf(left.item), refOf(right.item));
  });
};

const stallsFamily = (
  items: readonly WorkItem[],
  available: boolean,
  nowMs: number,
): FamilyResult => {
  if (!available) {
    return {
      family: {
        family: "stalls",
        state: "unavailable",
        reason: "signal-unavailable",
        counts: zeroCounts(),
        items: [],
      },
      reasons: ["signal-unavailable"],
    };
  }
  const ranked = rankStalledEntries(items, nowMs);
  const mapped = ranked.map(
    (entry): StatusTrackerItem => ({
      workItemRef: refOf(entry.item),
      title: clampTitle(entry.item.title),
      family: "stalls",
      itemState: entry.activity === "unknown" ? "unknown" : "observed",
      activity: entry.activity,
      ...(entry.ageDays === undefined ? {} : { ageDays: entry.ageDays }),
    }),
  );
  const rendered = capped(mapped, STATUS_MAX_TRACKER_FAMILY_ITEMS);
  return {
    family: {
      family: "stalls",
      state: "observed",
      counts: familyCounts(mapped, rendered.length, ranked.length),
      items: rendered,
    },
    reasons: ranked.length === 0 ? ["observed-empty"] : ["observed"],
  };
};

const hygieneEntryFindings = (item: WorkItem): readonly StatusHygieneFinding[] => {
  const findings: StatusHygieneFinding[] = [];
  if (item.title.trim().length === 0) findings.push("missing-title");
  if (item.labels.length === 0) findings.push("missing-labels");
  return findings;
};

const compareHygieneItems = (left: WorkItem, right: WorkItem): number => {
  const count = hygieneEntryFindings(right).length - hygieneEntryFindings(left).length;
  if (count !== 0) return count;
  return compareText(refOf(left), refOf(right));
};

const rankHygieneEntries = (
  items: readonly WorkItem[],
): readonly { readonly item: WorkItem; readonly findings: readonly StatusHygieneFinding[] }[] =>
  items
    .filter(isOpen)
    .map((item) => ({ item, findings: hygieneEntryFindings(item) }))
    .filter((entry) => entry.findings.length > 0)
    .sort((left, right) => compareHygieneItems(left.item, right.item));

const conformsEpic = (item: WorkItem): boolean => {
  const epicToken = STATUS_HYGIENE_LABEL_CONVENTIONS.epicToken.toLowerCase();
  const prefix = STATUS_HYGIENE_LABEL_CONVENTIONS.epicPrefix.toLowerCase();
  return item.labels.some((label) => {
    const lower = label.toLowerCase();
    return lower === epicToken || lower.startsWith(prefix);
  });
};

const conformsStoryPoints = (item: WorkItem): boolean => {
  const prefix = STATUS_HYGIENE_LABEL_CONVENTIONS.storyPointsPrefix.toLowerCase();
  return item.labels.some((label) => {
    if (!label.toLowerCase().startsWith(prefix)) return false;
    return /^\d+$/.test(label.slice(prefix.length).trim());
  });
};

const conformsInSprint = (item: WorkItem): boolean =>
  item.milestone !== undefined && item.milestone.trim().length > 0;

const assertionConforms = (assertion: string, item: WorkItem): boolean => {
  switch (assertion) {
    case "epic-membership":
      return conformsEpic(item);
    case "story-points":
      return conformsStoryPoints(item);
    case "in-sprint":
      return conformsInSprint(item);
    default:
      return false;
  }
};

const assertionAvailability = (
  availability: StatusTrackerAvailability,
  assertion: string,
): boolean => {
  const signal =
    assertion === "epic-membership"
      ? availability.epicMembership
      : assertion === "story-points"
        ? availability.storyPoints
        : availability.inSprint;
  return signal === "available";
};

type HygieneAssertionEvaluation = {
  readonly assertions: readonly StatusHygieneAssertion[];
  readonly observations: readonly StatusFindingObservation[];
};

const evaluateHygieneAssertions = (
  items: readonly WorkItem[],
  availability: StatusTrackerAvailability,
): HygieneAssertionEvaluation => {
  const open = items.filter(isOpen);
  const assertions: StatusHygieneAssertion[] = [];
  const observations: StatusFindingObservation[] = [];
  for (const assertion of STATUS_HYGIENE_ASSERTIONS) {
    if (!assertionAvailability(availability, assertion)) {
      assertions.push({ assertion, violations: 0, unknown: open.length, satisfied: 0 });
      continue;
    }
    const violating: WorkItem[] = [];
    let satisfied = 0;
    for (const item of open) {
      if (assertionConforms(assertion, item)) satisfied += 1;
      else violating.push(item);
    }
    assertions.push({ assertion, violations: violating.length, unknown: 0, satisfied });
    for (const item of [...violating].sort(compareHygieneItems)) {
      observations.push({ code: `tracker.hygiene.${assertion}`, member: refOf(item) });
    }
  }
  return { assertions, observations };
};

const hygieneFamily = (
  items: readonly WorkItem[],
  available: boolean,
  assertions: readonly StatusHygieneAssertion[] | undefined,
): FamilyResult => {
  if (!available) {
    return {
      family: {
        family: "hygiene",
        state: "unavailable",
        reason: "signal-unavailable",
        counts: zeroCounts(),
        items: [],
      },
      reasons: ["signal-unavailable"],
    };
  }
  const ranked = rankHygieneEntries(items);
  const mapped = ranked.map(
    (entry): StatusTrackerItem => ({
      workItemRef: refOf(entry.item),
      title: clampTitle(entry.item.title),
      family: "hygiene",
      itemState: "observed",
      findings: [...entry.findings],
    }),
  );
  const rendered = capped(mapped, STATUS_MAX_TRACKER_FAMILY_ITEMS);
  return {
    family: {
      family: "hygiene",
      state: "observed",
      counts: familyCounts(mapped, rendered.length, ranked.length),
      items: rendered,
      ...(assertions === undefined ? {} : { assertions }),
    },
    reasons: ranked.length === 0 ? ["observed-empty"] : ["observed"],
  };
};

const aggregateFamilies = (families: readonly StatusTrackerFamily[]): StatusCounts =>
  families.reduce<StatusCounts>(
    (total, family) => ({
      observed: total.observed + family.counts.observed,
      unknown: total.unknown + family.counts.unknown,
      total: total.total + family.counts.total,
      omitted: total.omitted + family.counts.omitted,
    }),
    zeroCounts(),
  );

const trackerSection = (facts: StatusFacts): StatusSection => {
  const bindingFailure = bindingReason(facts.repository.binding);
  const unavailableFamilies = (reason: StatusEvidenceReason): readonly StatusTrackerFamily[] =>
    STATUS_TRACKER_FAMILIES.map(
      (family): StatusTrackerFamily => ({
        family,
        state: "unavailable",
        reason,
        counts: zeroCounts(),
        items: [],
      }),
    );

  if (bindingFailure !== undefined) {
    return {
      ...sectionBase({
        id: "tracker",
        state: "unavailable",
        counts: zeroCounts(),
        truncated: false,
        sources: [
          { source: "repository-binding", outcome: "not-configured" },
          { source: "tracker", outcome: "not-configured" },
        ],
        reasons: [bindingFailure],
      }),
      families: unavailableFamilies(bindingFailure),
    };
  }

  if (!facts.tracker.ok) {
    const reason = reasonForReadFailure(facts.tracker);
    const state: StatusSectionState =
      facts.tracker.reason === "not-configured" ? "unavailable" : "unknown";
    return {
      ...sectionBase({
        id: "tracker",
        state,
        counts: zeroCounts(),
        truncated: false,
        sources: [readFailureSource("tracker", facts.tracker)],
        reasons: [reason],
      }),
      families: unavailableFamilies(reason),
    };
  }

  const read = facts.tracker;
  const items = allItems(read);
  const availability = read.availability;
  const handBacks = availability.ownerHandBacks === "available" ? rankOwnerHandBacks(items) : [];
  const gateProjections = new Map<string, OwnerGateProjection>();
  for (const item of handBacks) {
    gateProjections.set(refOf(item), projectOwnerGate(item, facts.nowMs, facts.nowIso));
  }
  const hygieneAssertions =
    availability.hygiene === "available"
      ? evaluateHygieneAssertions(items, availability)
      : undefined;
  const stallRanked =
    availability.stalls === "available" ? rankStalledEntries(items, facts.nowMs) : [];
  const hygieneRanked = availability.hygiene === "available" ? rankHygieneEntries(items) : [];
  const familyResults = [
    ownerHandBacksFamily(items, availability.ownerHandBacks === "available", gateProjections),
    blockedDependenciesFamily(items, availability.blockedDependencies === "available"),
    stallsFamily(items, availability.stalls === "available", facts.nowMs),
    hygieneFamily(items, availability.hygiene === "available", hygieneAssertions?.assertions),
  ];
  const families = familyResults.map((result) => result.family);
  const counts = aggregateFamilies(families);
  const familyReasons = familyResults.flatMap((result) => result.reasons);
  const allAvailable =
    availability.ownerHandBacks === "available" &&
    availability.blockedDependencies === "available" &&
    availability.stalls === "available" &&
    availability.hygiene === "available";
  const state: StatusSectionState = allAvailable ? "observed" : "degraded";
  const truncated = counts.omitted > 0 || read.pageItemCount >= STATUS_SOURCE_ITEM_LIMIT;
  const reasons: StatusEvidenceReason[] = [];
  for (const reason of familyReasons) if (!reasons.includes(reason)) reasons.push(reason);
  if (!allAvailable) reasons.push("signal-unavailable");
  if (counts.unknown > 0) reasons.push("item-signal-absent");
  if (truncated) reasons.push("source-truncated");
  if (counts.total === 0 && reasons.length === 0) reasons.push("observed-empty");

  const observations: StatusFindingObservation[] = [];
  for (const item of handBacks) {
    const projection = gateProjections.get(refOf(item));
    if (projection !== undefined && gateIsEscalated(projection)) {
      observations.push({ code: "tracker.owner-gate-escalated", member: refOf(item) });
    }
  }
  for (const entry of stallRanked) {
    if (entry.activity === "stalled") {
      observations.push({ code: "tracker.stalled-ticket", member: refOf(entry.item) });
    }
  }
  for (const entry of hygieneRanked) {
    for (const finding of entry.findings) {
      observations.push({ code: `tracker.hygiene.${finding}`, member: refOf(entry.item) });
    }
  }
  if (hygieneAssertions !== undefined) observations.push(...hygieneAssertions.observations);

  const section: StatusSection = {
    ...sectionBase({
      id: "tracker",
      state,
      counts,
      truncated,
      sources: [
        {
          source: "tracker",
          outcome: counts.total === 0 ? "observed-empty" : "read",
        },
      ],
      reasons,
    }),
    families,
  };
  return withFindings(section, observations);
};

/* --------------------------------- changes -------------------------------- */

const pullRequestItem = (
  request: DeliveryRequest,
  read: StatusDeliveryRequestRead,
): StatusPullRequestItem => {
  const signals = read.ok
    ? read.availability
    : { reviewState: "unavailable" as const, reviewThreads: "unavailable" as const };
  return {
    entityId: request.identity.entityId,
    sourceRef: request.sourceRef,
    targetRef: request.targetRef,
    deliveryState: request.reviewState,
    draft: request.reviewState === "draft",
    reviewState: signals.reviewState === "available" ? "observed" : "unknown",
    reviewThreads: signals.reviewThreads === "available" ? "observed" : "unknown",
  };
};

const comparePullRequests = (left: DeliveryRequest, right: DeliveryRequest): number => {
  const leftDraft = left.reviewState === "draft" ? 1 : 0;
  const rightDraft = right.reviewState === "draft" ? 1 : 0;
  if (leftDraft !== rightDraft) return leftDraft - rightDraft;
  const identity = compareIdentity(left.identity.entityId, right.identity.entityId);
  if (identity !== 0) return identity;
  const source = compareText(left.sourceRef, right.sourceRef);
  if (source !== 0) return source;
  return compareText(left.targetRef, right.targetRef);
};

type ActiveChangeState =
  | { readonly state: "observed"; readonly change: StatusActiveChange }
  | { readonly state: "observed-empty" }
  | { readonly state: "unknown"; readonly reason: StatusEvidenceReason };

const activeChangeOf = (local: StatusLocalContextRead): ActiveChangeState => {
  if (!local.ok) {
    return {
      state: "unknown",
      reason: local.reason === "missing" ? "local-context-missing" : "local-context-malformed",
    };
  }
  const change = local.context.activeChange;
  return change === undefined ? { state: "observed-empty" } : { state: "observed", change };
};

const changesSection = (facts: StatusFacts): StatusSection => {
  const bindingFailure = bindingReason(facts.repository.binding);
  const active = activeChangeOf(facts.localContext);
  const prRead = facts.changes;
  const sources: EvidenceSourceEntry[] = [];
  const reasons: StatusEvidenceReason[] = [];

  if (bindingFailure !== undefined) {
    sources.push({ source: "repository-binding", outcome: "not-configured" });
    reasons.push(bindingFailure);
  }
  if (facts.localContext.ok) {
    sources.push({ source: "local-context", outcome: "read" });
  } else {
    sources.push({
      source: "local-context",
      outcome: facts.localContext.reason === "missing" ? "not-configured" : "failed",
    });
    reasons.push(active.state === "unknown" ? active.reason : "source-unavailable");
  }
  if (prRead.ok) {
    sources.push({
      source: "changes",
      outcome: prRead.items.length === 0 ? "observed-empty" : "read",
    });
  } else {
    sources.push(readFailureSource("changes", prRead));
    reasons.push(reasonForReadFailure(prRead));
  }

  const pullRequests: readonly DeliveryRequest[] = prRead.ok ? prRead.items : [];
  const ranked = [...pullRequests].sort(comparePullRequests);
  const renderedRequests = capped(ranked, STATUS_MAX_OPEN_PULL_REQUESTS);
  const renderedItems = prRead.ok
    ? renderedRequests.map((request) => pullRequestItem(request, prRead))
    : [];
  const prSignalsUnavailable =
    !prRead.ok ||
    prRead.availability.state === "unavailable" ||
    prRead.availability.refs === "unavailable" ||
    prRead.availability.reviewState === "unavailable" ||
    prRead.availability.reviewThreads === "unavailable";
  const activeUsable = active.state === "observed" || active.state === "observed-empty";

  let state: StatusSectionState;
  if (bindingFailure !== undefined && !activeUsable) {
    state = "unavailable";
  } else if (!prRead.ok && !activeUsable) {
    state = "unknown";
  } else if (bindingFailure === undefined && prRead.ok && activeUsable && !prSignalsUnavailable) {
    state = "observed";
  } else {
    state = "degraded";
  }

  if (state === "degraded" || state === "unknown") {
    if (!reasons.includes("partial-evidence")) reasons.push("partial-evidence");
  }
  if (prSignalsUnavailable && prRead.ok) {
    if (!reasons.includes("signal-unavailable")) reasons.push("signal-unavailable");
  }
  if (prRead.ok && renderedItems.some((item) => item.reviewState === "unknown")) {
    if (!reasons.includes("item-signal-absent")) reasons.push("item-signal-absent");
  }
  const omitted = pullRequests.length - renderedItems.length;
  const truncated = prRead.ok && (omitted > 0 || prRead.pageItemCount >= STATUS_SOURCE_ITEM_LIMIT);
  if (truncated) reasons.push("source-truncated");
  if (reasons.length === 0) {
    reasons.push(
      state === "observed" && renderedItems.length === 0 ? "observed-empty" : "observed",
    );
  }
  const observedSignals = renderedItems.filter(
    (item) => item.reviewState === "observed" && item.reviewThreads === "observed",
  ).length;
  const counts = countOf(
    observedSignals,
    renderedItems.length - observedSignals,
    pullRequests.length,
    omitted,
  );

  const activeChange =
    active.state === "observed"
      ? {
          state: "observed" as const,
          workItemRef: active.change.workItemRef,
          ...(active.change.branch === undefined ? {} : { branch: active.change.branch }),
          ...(active.change.changeFolder === undefined
            ? {}
            : { changeFolder: active.change.changeFolder }),
        }
      : active.state === "observed-empty"
        ? { state: "observed-empty" as const }
        : { state: "unknown" as const, reason: active.reason };

  return {
    ...sectionBase({
      id: "changes-and-prs",
      state,
      counts,
      truncated,
      sources,
      reasons,
    }),
    activeChange,
    pullRequests: renderedItems,
  };
};

/* ------------------------------------ ci ---------------------------------- */

const jobSeverity = (run: PipelineRun): number => {
  const states = run.jobs.map((job) => job.jobState);
  if (states.includes("failed")) return 0;
  if (states.includes("running") || states.includes("queued")) return 1;
  if (states.includes("canceled")) return 2;
  if (states.includes("succeeded")) return 3;
  return 4;
};

const compareRuns = (left: PipelineRun, right: PipelineRun): number => {
  const severity = jobSeverity(left) - jobSeverity(right);
  if (severity !== 0) return severity;
  const leftIdentity = left.identity.entityId;
  const rightIdentity = right.identity.entityId;
  const bothNumeric = numeric(leftIdentity) !== undefined && numeric(rightIdentity) !== undefined;
  const identity = bothNumeric
    ? compareIdentity(rightIdentity, leftIdentity)
    : compareText(leftIdentity, rightIdentity);
  if (identity !== 0) return identity;
  return compareText(left.pipelineName, right.pipelineName);
};

const ciRedOnMainObservations = (facts: StatusFacts): readonly StatusFindingObservation[] => {
  if (facts.repository.binding.state !== "observed") return [];
  const head = facts.repository.head;
  if (head.sha === undefined || head.branch !== STATUS_PRIMARY_BRANCH) return [];
  const read = facts.ci;
  if (!read.ok) return [];
  return [...read.items]
    .sort(compareRuns)
    .filter((run) => run.jobs.some((entry) => entry.jobState === "failed"))
    .map((run) => ({ code: "ci.red-on-main", member: run.identity.entityId }));
};

const ciSection = (facts: StatusFacts): StatusSection => {
  const bindingFailure = bindingReason(facts.repository.binding);
  const head = facts.repository.head;
  const commit = {
    ...(head.branch === undefined ? {} : { branch: head.branch }),
    ...(head.sha === undefined ? {} : { sha: head.sha }),
  };
  if (bindingFailure !== undefined) {
    return {
      ...sectionBase({
        id: "ci",
        state: "unavailable",
        counts: zeroCounts(),
        truncated: false,
        sources: [{ source: "repository-binding", outcome: "not-configured" }],
        reasons: [bindingFailure],
      }),
      commit,
      result: "unknown",
      runs: [],
    };
  }
  if (head.sha === undefined) {
    return {
      ...sectionBase({
        id: "ci",
        state: "unknown",
        counts: zeroCounts(),
        truncated: false,
        sources: [{ source: "ci", outcome: "not-configured" }],
        reasons: ["commit-unresolved"],
      }),
      commit,
      result: "unknown",
      runs: [],
    };
  }
  const read: StatusPipelineRunRead = facts.ci;
  if (!read.ok) {
    return {
      ...sectionBase({
        id: "ci",
        state: "unknown",
        counts: zeroCounts(),
        truncated: false,
        sources: [readFailureSource("ci", read)],
        reasons: [reasonForReadFailure(read)],
      }),
      commit,
      result: "unknown",
      runs: [],
    };
  }
  const ranked = [...read.items].sort(compareRuns);
  const rendered = capped(ranked, STATUS_MAX_PIPELINE_RUNS);
  const omitted = read.items.length - rendered.length;
  const truncated = omitted > 0 || read.pageItemCount >= STATUS_SOURCE_PIPELINE_LIMIT;
  const result = classifyPipelineRuns(read.items);
  const reasons: StatusEvidenceReason[] = [result === "none" ? "observed-empty" : "observed"];
  if (truncated) reasons.push("source-truncated");
  return withFindings(
    {
      ...sectionBase({
        id: "ci",
        state: "observed",
        counts: countOf(read.items.length, 0, read.items.length, omitted),
        truncated,
        sources: [
          read.items.length === 0
            ? { source: "ci", outcome: "observed-empty" }
            : { source: "ci", outcome: "read" },
        ],
        reasons,
      }),
      commit,
      result,
      runs: rendered,
    },
    ciRedOnMainObservations(facts),
  );
};

/* ---------------------------------- lanes --------------------------------- */

const lanesSection = (): StatusSection => ({
  ...sectionBase({
    id: "lanes-or-queue",
    state: "not-delivered",
    counts: zeroCounts(),
    truncated: false,
    sources: [{ source: "queue-engine", outcome: "not-delivered" }],
    reasons: ["engine-not-delivered"],
  }),
  capability: "queue-lane-engine",
  expectedStory: "M2-S1",
  note: "no queue or lane engine exists in this release",
  items: [],
  attentionStates: [...STATUS_LANE_ATTENTION_STATES],
});

/* -------------------------------- providers ------------------------------- */

type ProviderChainLookup =
  | { readonly state: "declared"; readonly name: string; readonly entries: readonly string[] }
  | { readonly state: "absent" }
  | { readonly state: "unresolved" };

/**
 * Distinguishes "no default chain declared" (unavailable) from "a default chain
 * is declared but names no declared chain entry" (unknown, DM-9).
 */
const providerChainFor = (config: StatusProviderConfigRead): ProviderChainLookup => {
  if (!config.ok) return { state: "unresolved" };
  const defaultChain = config.config.defaultChain;
  if (defaultChain === undefined) return { state: "absent" };
  const chain = config.config.chains[defaultChain];
  return chain === undefined
    ? { state: "unresolved" }
    : { state: "declared", name: chain.name, entries: chain.entries };
};

const compareEntries = (left: StatusProviderEntry, right: StatusProviderEntry): number => {
  if (left.availability !== right.availability) {
    return left.availability === "parked" ? -1 : 1;
  }
  if (left.enabled !== right.enabled) return left.enabled ? -1 : 1;
  const name = compareText(left.name, right.name);
  if (name !== 0) return name;
  return compareText(left.class, right.class);
};

const compareProviderParks = (left: StatusProviderPark, right: StatusProviderPark): number => {
  const leftAt = parseInstant(left.expiresAt) ?? Number.POSITIVE_INFINITY;
  const rightAt = parseInstant(right.expiresAt) ?? Number.POSITIVE_INFINITY;
  if (leftAt !== rightAt) return leftAt < rightAt ? -1 : 1;
  if (left.subjectKind !== right.subjectKind) return left.subjectKind === "chain" ? -1 : 1;
  return compareText(left.name, right.name);
};

const providersSection = (facts: StatusFacts): StatusSection => {
  const configRead = facts.providers.config;
  const parkRead = facts.providers.parks;

  if (!configRead.ok) {
    const reason: StatusEvidenceReason =
      configRead.reason === "provider-chain-unresolved"
        ? "provider-chain-unresolved"
        : "config-invalid";
    const failureCode =
      configRead.reason === "provider-chain-unresolved"
        ? "config.value.invalid"
        : (configRead.failureCode ?? "config.value.invalid");
    return {
      ...sectionBase({
        id: "providers",
        state: "unknown",
        counts: zeroCounts(),
        truncated: false,
        sources: [{ source: "provider-config", outcome: "failed", failureCode }],
        reasons: [reason],
      }),
      chain: { state: "unknown" },
      entries: [],
      parks: [],
    };
  }

  const config = configRead.config;
  const chainInfo = providerChainFor(configRead);
  if (chainInfo.state === "unresolved") {
    return {
      ...sectionBase({
        id: "providers",
        state: "unknown",
        counts: zeroCounts(),
        truncated: false,
        sources: [
          { source: "provider-config", outcome: "failed", failureCode: "config.value.invalid" },
        ],
        reasons: ["provider-chain-unresolved"],
      }),
      chain: { state: "unknown" },
      entries: [],
      parks: [],
    };
  }
  if (chainInfo.state === "absent") {
    return {
      ...sectionBase({
        id: "providers",
        state: "unavailable",
        counts: zeroCounts(),
        truncated: false,
        sources: [
          { source: "provider-config", outcome: "not-configured" },
          ...(parkRead.ok ? [{ source: "provider-parks" as const, outcome: "read" as const }] : []),
        ],
        reasons: ["provider-chain-not-declared"],
      }),
      chain: { state: "absent" },
      entries: [],
      parks: [],
    };
  }

  const sources: EvidenceSourceEntry[] = [{ source: "provider-config", outcome: "read" }];
  const reasons: StatusEvidenceReason[] = [];
  const parkFailure = !parkRead.ok;
  if (parkRead.ok) {
    sources.push({
      source: "provider-parks",
      outcome: parkRead.parks.length === 0 ? "observed-empty" : "read",
    });
  } else {
    sources.push(
      readFailureSource("provider-parks", {
        ok: false,
        reason: "read-failed",
        ...(parkRead.failureCode === undefined ? {} : { failureCode: parkRead.failureCode }),
        ...(parkRead.failureClass === undefined ? {} : { failureClass: parkRead.failureClass }),
      }),
    );
    reasons.push("state-unreadable");
  }
  const activeParks = parkRead.ok ? parkRead.parks.filter((park) => park.state === "active") : [];
  const parkedProviderNames = new Set(
    activeParks.flatMap((park) => (park.subjectKind === "provider" ? [park.subjectName] : [])),
  );
  const entries: StatusProviderEntry[] = Object.values(config.entries).map((entry) => ({
    name: entry.name,
    class: entry.class,
    enabled: entry.enabled,
    availability: parkedProviderNames.has(entry.name) ? "parked" : "unverified",
    quotaDeclared: entry.quota !== undefined,
    peakDeclared: entry.peak !== undefined,
  }));
  const rankedEntries = [...entries].sort(compareEntries);
  const renderedEntries = capped(rankedEntries, STATUS_MAX_PROVIDER_ENTRIES);
  const providerParks: StatusProviderPark[] = activeParks.map((park) => ({
    name: park.name,
    subjectKind: park.subjectKind,
    subjectName: park.subjectName,
    cause: park.cause,
    conditions: [...park.conditions],
    expiresAt: park.expiresAt,
  }));
  const rankedParks = [...providerParks].sort(compareProviderParks);
  const renderedParks = capped(rankedParks, STATUS_MAX_PROVIDER_PARKS);
  const chainPark = activeParks.find(
    (park) => park.subjectKind === "chain" && park.subjectName === chainInfo.name,
  );
  const chain =
    chainPark === undefined
      ? {
          state: "declared" as const,
          name: chainInfo.name,
          entries: [...chainInfo.entries],
        }
      : {
          state: "parked" as const,
          name: chainInfo.name,
          entries: [...chainInfo.entries],
          cause: chainPark.cause,
          expiresAt: chainPark.expiresAt,
        };

  const omitted =
    entries.length - renderedEntries.length + providerParks.length - renderedParks.length;
  const total = entries.length + providerParks.length;
  const truncated = omitted > 0;
  if (truncated) reasons.push("source-truncated");
  const state: StatusSectionState = parkFailure ? "degraded" : "observed";
  if (state === "observed" && reasons.length === 0) {
    reasons.push(total === 0 ? "observed-empty" : "observed");
  }
  if (state === "degraded") reasons.push("partial-evidence");
  return {
    ...sectionBase({
      id: "providers",
      state,
      counts: countOf(total, 0, total, omitted),
      truncated,
      sources,
      reasons,
    }),
    chain,
    entries: renderedEntries,
    parks: renderedParks,
  };
};

/* --------------------------------- parked --------------------------------- */

const compareParked = (left: StatusParkedWorkEntry, right: StatusParkedWorkEntry): number => {
  const leftAt = parseInstant(left.parkedAt) ?? Number.POSITIVE_INFINITY;
  const rightAt = parseInstant(right.parkedAt) ?? Number.POSITIVE_INFINITY;
  if (leftAt !== rightAt) return leftAt < rightAt ? -1 : 1;
  if (left.workItemRef !== undefined && right.workItemRef !== undefined) {
    return compareWorkRef(left.workItemRef, right.workItemRef);
  }
  if (left.workItemRef !== undefined) return -1;
  if (right.workItemRef !== undefined) return 1;
  const folder = compareText(left.changeFolder ?? "", right.changeFolder ?? "");
  if (folder !== 0) return folder;
  const branch = compareText(left.branch ?? "", right.branch ?? "");
  if (branch !== 0) return branch;
  return compareText(left.reason ?? "", right.reason ?? "");
};

const parkedIdentity = (entry: StatusParkedWorkEntry): string =>
  entry.workItemRef ??
  `parked:${entry.changeFolder ?? "-"}|${entry.branch ?? "-"}|${entry.reason ?? "-"}`;

const parkedHasCondition = (entry: StatusParkedWorkEntry): boolean =>
  entry.condition !== undefined && entry.condition.trim().length > 0;

const parkedSection = (facts: StatusFacts): StatusSection => {
  const local = facts.localContext;
  if (!local.ok) {
    const missing = local.reason === "missing";
    return {
      ...sectionBase({
        id: "parked-work",
        state: missing ? "unavailable" : "unknown",
        counts: zeroCounts(),
        truncated: false,
        sources: [
          {
            source: "local-context",
            outcome: missing ? "not-configured" : "failed",
          },
        ],
        reasons: [missing ? "local-context-missing" : "local-context-malformed"],
      }),
      source: {
        kind: "local-pm-context",
        path: local.path,
        tracked: false,
        gitIgnored: true,
      },
      items: [],
    };
  }
  const entries = local.context.parkedChanges;
  const ranked = [...entries].sort(compareParked);
  const renderedEntries = capped(ranked, STATUS_MAX_PARKED_CHANGES);
  const items: StatusParkedWorkItem[] = renderedEntries.map((entry) => {
    const parkedAt = parseInstant(entry.parkedAt);
    const ageDays =
      parkedAt === undefined ? undefined : Math.floor((facts.nowMs - parkedAt) / DAY_MS);
    const reason = entry.reason === undefined ? undefined : clampDetail(entry.reason);
    const condition = entry.condition === undefined ? undefined : clampDetail(entry.condition);
    return {
      ...(entry.workItemRef === undefined ? {} : { workItemRef: entry.workItemRef }),
      ...(entry.branch === undefined ? {} : { branch: entry.branch }),
      ...(entry.changeFolder === undefined ? {} : { changeFolder: entry.changeFolder }),
      ...(reason === undefined ? {} : { reason }),
      ...(entry.parkedAt === undefined ? {} : { parkedAt: entry.parkedAt }),
      ...(ageDays === undefined ? {} : { ageDays }),
      ...(condition === undefined ? {} : { condition }),
      itemState: entry.workItemRef === undefined ? "unknown" : "observed",
    };
  });
  const unknown = items.filter((item) => item.itemState === "unknown").length;
  const omitted = entries.length - items.length;
  const truncated = omitted > 0;
  const reasons: StatusEvidenceReason[] = [entries.length === 0 ? "observed-empty" : "observed"];
  if (unknown > 0) reasons.push("item-signal-absent");
  if (truncated) reasons.push("source-truncated");
  const observations: StatusFindingObservation[] = [];
  for (const entry of ranked) {
    const ageKnown = parseInstant(entry.parkedAt) !== undefined;
    if (!ageKnown && !parkedHasCondition(entry)) {
      observations.push({ code: "parked.stale-no-condition", member: parkedIdentity(entry) });
    }
  }
  return withFindings(
    {
      ...sectionBase({
        id: "parked-work",
        state: "observed",
        counts: countOf(items.length - unknown, unknown, entries.length, omitted),
        truncated,
        sources: [
          entries.length === 0
            ? { source: "local-context", outcome: "observed-empty" }
            : { source: "local-context", outcome: "read" },
        ],
        reasons,
      }),
      source: {
        kind: "local-pm-context",
        path: local.context.path,
        tracked: false,
        gitIgnored: true,
      },
      items,
    },
    observations,
  );
};

/* ---------------------------- ready-to-merge ----------------------------- */

const ciResultOf = (facts: StatusFacts): StatusCiResult => {
  if (facts.repository.binding.state !== "observed") return "unknown";
  if (facts.repository.head.sha === undefined) return "unknown";
  const read = facts.ci;
  return read.ok ? classifyPipelineRuns(read.items) : "unknown";
};

const compareReadyItems = (left: StatusReadyItem, right: StatusReadyItem): number => {
  const leftRank = left.class === "merge-ready" ? 0 : 1;
  const rightRank = right.class === "merge-ready" ? 0 : 1;
  if (leftRank !== rightRank) return leftRank - rightRank;
  const ref = compareIdentity(left.ref, right.ref);
  if (ref !== 0) return ref;
  const source = compareText(left.sourceRef, right.sourceRef);
  if (source !== 0) return source;
  return compareText(left.targetRef, right.targetRef);
};

const readyToMergeSection = (facts: StatusFacts): StatusSection => {
  const bindingFailure = bindingReason(facts.repository.binding);
  if (bindingFailure !== undefined) {
    return {
      ...sectionBase({
        id: "ready-to-merge",
        state: "unavailable",
        counts: zeroCounts(),
        truncated: false,
        sources: [{ source: "repository-binding", outcome: "not-configured" }],
        reasons: [bindingFailure],
      }),
      items: [],
    };
  }
  const read = facts.changes;
  if (!read.ok) {
    const reason = reasonForReadFailure(read);
    return {
      ...sectionBase({
        id: "ready-to-merge",
        state: "unknown",
        counts: zeroCounts(),
        truncated: false,
        sources: [readFailureSource("changes", read)],
        reasons: [reason],
      }),
      items: [],
    };
  }
  const reviewAvailable = read.availability.reviewState === "available";
  const ciResult = ciResultOf(facts);
  const open = read.items.filter(
    (request) => request.reviewState !== "merged" && request.reviewState !== "closed",
  );
  const mapped: StatusReadyItem[] = open.map((request) => ({
    ref: request.identity.entityId,
    class: reviewAvailable && request.reviewState === "approved" ? "merge-ready" : "review-pending",
    sourceRef: request.sourceRef,
    targetRef: request.targetRef,
    reviewState: reviewAvailable ? "observed" : "unknown",
    ciResult,
  }));
  const ranked = [...mapped].sort(compareReadyItems);
  const rendered = capped(ranked, STATUS_MAX_READY_ITEMS);
  const omitted = mapped.length - rendered.length;
  const truncated = omitted > 0 || read.pageItemCount >= STATUS_SOURCE_ITEM_LIMIT;
  const observed = rendered.filter((item) => item.reviewState === "observed").length;
  const counts = countOf(observed, rendered.length - observed, mapped.length, omitted);
  const reasons: StatusEvidenceReason[] = [];
  if (reviewAvailable) {
    reasons.push(mapped.length === 0 ? "observed-empty" : "observed");
  } else {
    reasons.push("signal-unavailable", "partial-evidence");
  }
  if (truncated) reasons.push("source-truncated");
  return {
    ...sectionBase({
      id: "ready-to-merge",
      state: reviewAvailable ? "observed" : "degraded",
      counts,
      truncated,
      sources: [
        {
          source: "changes",
          outcome: mapped.length === 0 ? "observed-empty" : "read",
        },
      ],
      reasons,
    }),
    items: rendered,
  };
};

/* ----------------------------- typed questions ---------------------------- */

/**
 * Derive the digest `typed-questions` section from one verified blocker read.
 *
 * The section ranks open questions through the shared ranking (no second
 * comparator), renders the first eight with an exact omitted count, and treats
 * a failed/torn read as payload data: `unknown` + `state-unreadable`, never a
 * command failure and never a fabricated question.
 */
const typedQuestionsSection = (facts: StatusFacts): StatusSection => {
  const read = facts.blockers;
  if (!read.ok) {
    return {
      ...sectionBase({
        id: "typed-questions",
        state: "unknown",
        counts: zeroCounts(),
        truncated: false,
        sources: [
          {
            source: "blockers",
            outcome: "failed",
            ...(read.failureCode === undefined ? {} : { failureCode: read.failureCode }),
            ...(read.failureClass === undefined ? {} : { failureClass: read.failureClass }),
          },
        ],
        reasons: ["state-unreadable"],
      }),
      questions: [],
    };
  }
  const ranking = rankBlockerQuestions(read.value.questions, read.value.answers, facts.nowMs);
  const open = ranking.open;
  // The reserved escalation slot renders first by index even at the cap; up to
  // seven other questions follow in rank order and the lowest-ranked is
  // displaced and counted as omitted (GH-241 AC-F6-1). The predicate is
  // payload-only: no coordinator state is read here.
  const reserved = open.find((question) =>
    isReservedEscalationQuestion({
      type: question.type,
      audience: question.audience,
      lane: question.lane,
      ref: question.ref,
    }),
  );
  const slot = projectReservedSlotQuestions(
    open.map((question, index) => ({ id: question.id, index })),
    reserved?.id ?? null,
    { total: STATUS_MAX_ITEMS_PER_SECTION, others: STATUS_MAX_ITEMS_PER_SECTION - 1 },
  );
  const rendered = slot.rendered
    .map((entry) => open.find((question) => question.id === entry.id))
    .filter((question): question is (typeof open)[number] => question !== undefined);
  const omitted = slot.omitted;
  const reasons: StatusEvidenceReason[] = [open.length === 0 ? "observed-empty" : "observed"];
  if (omitted > 0) reasons.push("source-truncated");
  return {
    ...sectionBase({
      id: "typed-questions",
      state: "observed",
      counts: countOf(open.length, 0, open.length, omitted),
      truncated: omitted > 0,
      sources: [{ source: "blockers", outcome: open.length === 0 ? "observed-empty" : "read" }],
      reasons,
    }),
    questions: rendered.map((question) => ({
      id: question.id,
      type: question.type,
      audience: question.audience,
      lane: question.lane,
      ref: question.ref,
      question: question.question,
      options: question.options,
      askedAt: question.askedAt,
      age: question.age,
      rank: question.rank ?? 0,
    })),
  };
};

/* --------------------------------- spend ---------------------------------- */

/**
 * The spend section from the same read-side fold the command consumes (DM-6).
 *
 * Captured telemetry is `observed` with the summary figures; a verified-empty
 * read is `observed` with an absence-of-capture note (never a zero-spend claim);
 * a failed read is `unknown` carrying the state failure code as digest data.
 */
const spendSection = (spend: SpendDigestSection): StatusSection => {
  if (spend.state === "unknown") {
    return {
      ...sectionBase({
        id: "spend",
        state: "unknown",
        counts: zeroCounts(),
        truncated: false,
        sources: [{ source: "state-log", outcome: "failed", failureCode: spend.failureCode }],
        reasons: [spend.reason],
      }),
      spend,
      items: [],
    };
  }
  if (!spend.captured) {
    return {
      ...sectionBase({
        id: "spend",
        state: "observed",
        counts: zeroCounts(),
        truncated: false,
        sources: [{ source: "state-log", outcome: "observed-empty" }],
        reasons: ["observed-empty"],
      }),
      spend,
      note: "no captured telemetry (absence of capture)",
      items: [],
    };
  }
  return {
    ...sectionBase({
      id: "spend",
      state: "observed",
      counts: zeroCounts(),
      truncated: false,
      sources: [{ source: "state-log", outcome: "read" }],
      reasons: ["observed"],
    }),
    spend,
    items: [],
  };
};

/* -------------------------------- assembly -------------------------------- */

const summaryOf = (sections: readonly StatusSection[]): StatusDigest["summary"] => {
  const counts = {
    observed: 0,
    degraded: 0,
    unknown: 0,
    unavailable: 0,
    notDelivered: 0,
    actionable: 0,
    findingsTotal: 0,
    placeholderSectionCount: 0,
  };
  for (const section of sections) {
    switch (section.state) {
      case "observed":
        counts.observed += 1;
        break;
      case "degraded":
        counts.degraded += 1;
        break;
      case "unknown":
        counts.unknown += 1;
        break;
      case "unavailable":
        counts.unavailable += 1;
        break;
      case "not-delivered":
        counts.notDelivered += 1;
        break;
      default:
        break;
    }
    if ((STATUS_PLACEHOLDER_SECTION_IDS as readonly string[]).includes(section.id)) {
      counts.placeholderSectionCount += 1;
    }
    if (section.state === "observed" || section.state === "degraded") {
      counts.findingsTotal += section.findings?.length ?? 0;
      counts.actionable +=
        (section.families ?? []).reduce((sum, family) => sum + family.items.length, 0) +
        (section.pullRequests?.length ?? 0) +
        (section.runs?.length ?? 0) +
        (section.entries?.length ?? 0) +
        (section.parks?.length ?? 0) +
        (section.id === "parked-work" ? (section.items?.length ?? 0) : 0) +
        (section.id === "typed-questions" ? (section.questions?.length ?? 0) : 0);
    }
  }
  return { sections: sections.length, ...counts };
};

/** Aggregate the injected facts into the bounded `delivery.status.v1` digest. */
export const aggregateStatus = (facts: StatusFacts): StatusDigest => {
  // The prerequisite is a section-level sibling of `sources[]`, attached only to
  // a section whose credential-dependent source failed. The derived section set
  // comes from the digest itself (the closed `credential-unavailable` reason),
  // never a hardcoded list.
  const attachCredentialPrerequisite = (section: StatusSection): StatusSection => {
    const prerequisite = facts.credentialPrerequisite;
    if (prerequisite === undefined) return section;
    if (!section.evidence.reasons.includes("credential-unavailable")) return section;
    return {
      ...section,
      evidence: { ...section.evidence, credentialPrerequisite: prerequisite },
    };
  };
  // The active owner hold is attached to the derived providers evidence record
  // after derivation, so it is visible across every section state and changes
  // no state, count, source, reason, truncation, finding, or entry (GH-280 F-5).
  const attachOwnerHold = (section: StatusSection): StatusSection => {
    if (section.id !== "providers") return section;
    const hold = facts.providers.ownerHold;
    if (hold === undefined || !hold.active) return section;
    return {
      ...section,
      evidence: {
        ...section.evidence,
        ownerHold:
          hold.reason === undefined
            ? { source: hold.source }
            : { source: hold.source, reason: hold.reason },
      },
    };
  };
  const sections: readonly StatusSection[] = [
    trackerSection(facts),
    changesSection(facts),
    ciSection(facts),
    lanesSection(),
    providersSection(facts),
    parkedSection(facts),
    readyToMergeSection(facts),
    spendSection(facts.spend),
    typedQuestionsSection(facts),
  ]
    .map(attachCredentialPrerequisite)
    .map(attachOwnerHold);
  return {
    schemaVersion: STATUS_SCHEMA_VERSION,
    generatedAt: facts.nowIso,
    repository: facts.repository.binding,
    summary: summaryOf(sections),
    sections,
  };
};

/* ------------------------------ human render ------------------------------ */

const truncationSuffix = (section: StatusSection): string => {
  if (section.counts.omitted > 0) return `+${section.counts.omitted}`;
  return section.truncated ? "+more" : "";
};

/**
 * The operator-facing prerequisite on a section whose credential-dependent
 * source failed. Names only: the value never enters the human digest.
 */
const prerequisiteSuffix = (section: StatusSection): string => {
  const prerequisite = section.evidence.credentialPrerequisite;
  if (prerequisite === undefined) return "";
  return ` | requires ${prerequisite.sourceKey} (${prerequisite.referenceName})`;
};

/**
 * The bounded owner-hold token on the existing providers line, read from
 * `providers.evidence.ownerHold`; the existing human clamp remains the outer
 * bound. Absent when the hold is inactive.
 */
const ownerHoldSuffix = (section: StatusSection): string => {
  const hold = section.evidence.ownerHold;
  if (hold === undefined) return "";
  return hold.reason === undefined ? " | owner-hold" : ` | owner-hold: ${hold.reason}`;
};

const familyOf = (
  section: StatusSection,
  id: StatusTrackerFamilyId,
): StatusTrackerFamily | undefined => section.families?.find((family) => family.family === id);

const humanCiResult = (result: StatusCiResult | undefined): string => {
  if (result === undefined || result === "unknown") return "unknown";
  return result === "none" ? "none-reported" : result;
};

/** A source is known when its evidence outcome is a successful read. */
const sourceKnown = (section: StatusSection, source: StatusEvidenceSource): boolean =>
  section.evidence.sources.some(
    (entry) =>
      entry.source === source && (entry.outcome === "read" || entry.outcome === "observed-empty"),
  );

const attentionEntries = (
  digest: StatusDigest,
): readonly { readonly finding: StatusFinding; readonly sectionIndex: number }[] => {
  const entries: { finding: StatusFinding; sectionIndex: number }[] = [];
  for (const [sectionIndex, section] of digest.sections.entries()) {
    if (section.state !== "observed" && section.state !== "degraded") continue;
    for (const finding of section.findings ?? []) entries.push({ finding, sectionIndex });
  }
  return entries.sort((left, right) => {
    const severity = severityRank(left.finding.severity) - severityRank(right.finding.severity);
    if (severity !== 0) return severity;
    if (left.finding.count !== right.finding.count) return right.finding.count - left.finding.count;
    const code = compareText(left.finding.code, right.finding.code);
    if (code !== 0) return code;
    return left.sectionIndex - right.sectionIndex;
  });
};

const attentionLine = (digest: StatusDigest): string => {
  const entries = attentionEntries(digest);
  if (entries.length === 0) return "attention  0 findings ()";
  const preview = entries.slice(0, 3);
  const groups = preview.map((entry) => `${entry.finding.code}×${entry.finding.count}`).join(", ");
  const omitted = entries.length - preview.length;
  return `attention  ${entries.length} findings (${groups}${omitted > 0 ? `+${omitted}` : ""})`;
};

const clampHuman = (text: string): string => {
  const lines = text.split("\n");
  let result = text;
  const contentLines = lines.filter((line) => line.length > 0).length;
  if (contentLines > STATUS_MAX_HUMAN_LINES) {
    const kept = lines.slice(0, STATUS_MAX_HUMAN_LINES);
    result = `${kept.join("\n")}${STATUS_HUMAN_CLAMP_MARKER}\n`;
  }
  if (utf8Bytes(result) <= STATUS_MAX_HUMAN_BYTES) return result;
  const limit = STATUS_MAX_HUMAN_BYTES - utf8Bytes(STATUS_HUMAN_CLAMP_MARKER);
  let bytes = 0;
  let truncated = "";
  for (const point of result) {
    const size = utf8Bytes(point);
    if (bytes + size > limit) break;
    bytes += size;
    truncated += point;
  }
  return `${truncated}${STATUS_HUMAN_CLAMP_MARKER}`;
};

const formatShareRatio = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);

const spendHumanLine = (section: StatusSection): string => {
  const projection = section.spend;
  if (projection === undefined) {
    return `spend      unknown  state-unreadable (state-unreadable)`;
  }
  if (projection.state === "unknown") {
    return `spend      unknown  state-unreadable (${projection.failureCode})`;
  }
  if (!projection.captured) {
    return "spend      observed  no captured telemetry (absence of capture)";
  }
  const totals = projection.tokensByClass;
  const ratio = projection.ratio === null ? "null" : formatShareRatio(projection.ratio);
  const disclosure =
    projection.reconciliation === undefined
      ? ""
      : ` | reconcile ${projection.reconciliation.verdict} (tolerance ${String(projection.reconciliation.tolerance)}, basis ${projection.reconciliation.basis})`;
  return `spend      observed  input ${String(totals.input)} | output ${String(totals.output)} | reasoning ${String(totals.reasoning)} | cacheRead ${String(totals.cacheRead)} | cacheWrite ${String(totals.cacheWrite)} | restarts ${String(projection.restarts)} | amplification ${ratio}${disclosure}`;
};

/** Render the deterministic human digest from the digest and injected brand. */
export const renderStatusHuman = (digest: StatusDigest, brand: BrandIdentity): string => {
  const lines: string[] = [];
  const ci = digest.sections.find((section) => section.id === "ci");
  const sha = ci?.commit?.sha;
  if (digest.repository.state === "observed" && sha !== undefined) {
    const branch = ci?.commit?.branch ?? "detached";
    lines.push(
      `${brand.binaryName} status ${digest.repository.owner}/${digest.repository.name} @ ${branch} ${sha.slice(0, 7)}`,
    );
  }
  const tracker = digest.sections.find((section) => section.id === "tracker");
  const ownerHandBacks = tracker === undefined ? undefined : familyOf(tracker, "ownerHandBacks");
  const blocked = tracker === undefined ? undefined : familyOf(tracker, "blockedDependencies");
  const stalls = tracker === undefined ? undefined : familyOf(tracker, "stalls");
  const hygiene = tracker === undefined ? undefined : familyOf(tracker, "hygiene");
  if (tracker !== undefined) {
    const gates =
      ownerHandBacks?.state === "observed"
        ? String(
            tracker.findings?.find((finding) => finding.code === "tracker.owner-gate-escalated")
              ?.count ?? 0,
          )
        : "?";
    const assertionUnknown = (hygiene?.assertions ?? []).reduce(
      (sum, assertion) => sum + assertion.unknown,
      0,
    );
    lines.push(
      `tracker    ${tracker.state}  hand-backs ${ownerHandBacks?.counts.total ?? 0} | gates ${gates} escalated | blocked ${blocked?.state ?? "unavailable"} | stalls ${stalls?.counts.total ?? 0} (${stalls?.counts.unknown ?? 0} unknown) | hygiene ${hygiene?.counts.total ?? 0} (${assertionUnknown} unknown)${truncationSuffix(tracker)}${prerequisiteSuffix(tracker)}`,
    );
  }

  const changes = digest.sections.find((section) => section.id === "changes-and-prs");
  if (changes !== undefined) {
    const active = changes.activeChange;
    const activeText =
      active?.state === "observed"
        ? active.workItemRef
        : active?.state === "observed-empty"
          ? "none"
          : "unknown";
    const prKnown = sourceKnown(changes, "changes");
    const prCount = prKnown ? String(changes.pullRequests?.length ?? 0) : "?";
    const review = !prKnown
      ? "unknown"
      : changes.evidence.reasons.includes("signal-unavailable") ||
          (changes.pullRequests ?? []).some((item) => item.reviewState === "unknown")
        ? "unavailable"
        : "observed";
    lines.push(
      `changes    ${changes.state}  active ${activeText} | PRs ${prCount} (review state ${review})${truncationSuffix(changes)}${prerequisiteSuffix(changes)}`,
    );
  }

  if (ci !== undefined) {
    const runs = ci.runs ?? [];
    const jobs = runs.flatMap((run) => run.jobs);
    const failed = jobs.filter((job) => job.jobState === "failed").length;
    lines.push(
      `ci         ${ci.state}  ${humanCiResult(ci.result)} (${failed}/${jobs.length} jobs)${truncationSuffix(ci)}${prerequisiteSuffix(ci)}`,
    );
  }

  const lanes = digest.sections.find((section) => section.id === "lanes-or-queue");
  if (lanes !== undefined) {
    lines.push(`lanes      not-delivered  no queue or lane engine in this release`);
  }

  const providers = digest.sections.find((section) => section.id === "providers");
  if (providers !== undefined) {
    const chainState = providers.chain?.state;
    const chain =
      chainState === "declared" || chainState === "parked"
        ? (providers.chain?.name ?? "unknown")
        : chainState === "absent"
          ? "none"
          : "unknown";
    const parksKnown =
      sourceKnown(providers, "provider-parks") &&
      providers.state !== "unknown" &&
      providers.state !== "unavailable";
    const parkCount = parksKnown ? String(providers.parks?.length ?? 0) : "?";
    const entries = providers.state === "unknown" ? "?" : String(providers.entries?.length ?? 0);
    lines.push(
      `providers  ${providers.state}  chain ${chain} | active parks ${parkCount} | ${entries} entries${truncationSuffix(providers)}${prerequisiteSuffix(providers)}${ownerHoldSuffix(providers)}`,
    );
  }

  const parked = digest.sections.find((section) => section.id === "parked-work");
  if (parked !== undefined) {
    const count = parked.state === "observed" ? String(parked.items?.length ?? 0) : "?";
    lines.push(
      `parked     ${parked.state}  ${count} parked changes (git-ignored local state)${truncationSuffix(parked)}${prerequisiteSuffix(parked)}`,
    );
  }

  const ready = digest.sections.find((section) => section.id === "ready-to-merge");
  if (ready !== undefined) {
    const count =
      ready.state === "observed" || ready.state === "degraded"
        ? String(ready.items?.length ?? 0)
        : "?";
    const mergeReady =
      ready.state === "observed"
        ? String(
            (ready.items ?? []).filter((item) => "class" in item && item.class === "merge-ready")
              .length,
          )
        : "?";
    lines.push(
      `ready      ${ready.state}  ${count} ready-to-merge (merge-ready ${mergeReady})${truncationSuffix(ready)}${prerequisiteSuffix(ready)}`,
    );
  }

  const spend = digest.sections.find((section) => section.id === "spend");
  if (spend !== undefined) lines.push(`${spendHumanLine(spend)}${prerequisiteSuffix(spend)}`);

  const typed = digest.sections.find((section) => section.id === "typed-questions");
  if (typed !== undefined) {
    const count = typed.state === "observed" ? String(typed.questions?.length ?? 0) : "?";
    const reason =
      typed.state === "unknown" && typed.evidence.reasons.length > 0
        ? ` (${typed.evidence.reasons[0]})`
        : "";
    lines.push(
      `questions  ${typed.state}  ${count} open${reason}${truncationSuffix(typed)}${prerequisiteSuffix(typed)}`,
    );
  }

  lines.push(attentionLine(digest));

  return clampHuman(`${lines.join("\n")}\n`);
};
