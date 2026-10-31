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
  type PipelineRun,
  STATUS_MAX_EVIDENCE_SOURCES,
  STATUS_MAX_OPEN_PULL_REQUESTS,
  STATUS_MAX_PARKED_CHANGES,
  STATUS_MAX_PIPELINE_RUNS,
  STATUS_MAX_PROVIDER_ENTRIES,
  STATUS_MAX_PROVIDER_PARKS,
  STATUS_MAX_REASONS,
  STATUS_MAX_TITLE_CHARS,
  STATUS_MAX_TRACKER_FAMILY_ITEMS,
  STATUS_OWNER_ATTENTION_LABELS,
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
  type StatusRepositoryBinding,
  type StatusSection,
  type StatusSectionState,
  type StatusTrackerFamily,
  type StatusTrackerFamilyId,
  type StatusTrackerItem,
  type StatusWorkItemRead,
  type WorkItem,
} from "#contracts";

const DAY_MS = 86_400_000;
const MAX_DETAIL = 160;

const clampTitle = (title: string): string =>
  title.length > STATUS_MAX_TITLE_CHARS ? title.slice(0, STATUS_MAX_TITLE_CHARS) : title;

const clampDetail = (detail: string | undefined): string | undefined =>
  detail === undefined
    ? undefined
    : detail.length > MAX_DETAIL
      ? detail.slice(0, MAX_DETAIL)
      : detail;

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

const familyCounts = (rendered: readonly StatusTrackerItem[], total: number): StatusCounts => {
  const observed = rendered.filter((item) => item.itemState === "observed").length;
  const unknown = rendered.filter((item) => item.itemState === "unknown").length;
  return countOf(observed, unknown, total, total - rendered.length);
};

const capped = <T>(ranked: readonly T[], limit: number): readonly T[] => ranked.slice(0, limit);

const ownerHandBacksFamily = (items: readonly WorkItem[], available: boolean): FamilyResult => {
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
  const matching = items.filter(
    (item) =>
      isOpen(item) &&
      item.labels.some((label) =>
        STATUS_OWNER_ATTENTION_LABELS.some(
          (attention) => attention.toLowerCase() === label.toLowerCase(),
        ),
      ),
  );
  const groupOf = (item: WorkItem): number => {
    const labelCount: number = STATUS_OWNER_ATTENTION_LABELS.length;
    let group = labelCount;
    for (const [index, attention] of STATUS_OWNER_ATTENTION_LABELS.entries()) {
      if (item.labels.some((label) => label.toLowerCase() === attention.toLowerCase())) {
        group = Math.min(group, index);
      }
    }
    return group;
  };
  const ranked = [...matching].sort((left, right) => {
    const group = groupOf(left) - groupOf(right);
    if (group !== 0) return group;
    const leftAt = parseInstant(left.updatedAt) ?? Number.POSITIVE_INFINITY;
    const rightAt = parseInstant(right.updatedAt) ?? Number.POSITIVE_INFINITY;
    if (leftAt !== rightAt) return leftAt < rightAt ? -1 : 1;
    return compareText(refOf(left), refOf(right));
  });
  const rendered = capped(ranked, STATUS_MAX_TRACKER_FAMILY_ITEMS).map(
    (item): StatusTrackerItem => ({
      workItemRef: refOf(item),
      title: clampTitle(item.title),
      family: "ownerHandBacks",
      itemState: "observed",
      labels: [...item.labels],
    }),
  );
  return {
    family: {
      family: "ownerHandBacks",
      state: "observed",
      counts: familyCounts(rendered, matching.length),
      items: rendered,
    },
    reasons: matching.length === 0 ? ["observed-empty"] : ["observed"],
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
  const rendered = capped(ranked, STATUS_MAX_TRACKER_FAMILY_ITEMS).map(
    (entry): StatusTrackerItem => ({
      workItemRef: refOf(entry.item),
      title: clampTitle(entry.item.title),
      family: "blockedDependencies",
      itemState: "observed",
      dependencyState: entry.dependencyState,
    }),
  );
  return {
    family: {
      family: "blockedDependencies",
      state: "observed",
      counts: familyCounts(rendered, blocked.length),
      items: rendered,
    },
    reasons: blocked.length === 0 ? ["observed-empty"] : ["observed"],
  };
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
  const entries: {
    readonly item: WorkItem;
    readonly activity: "stalled" | "unknown";
    readonly ageDays?: number;
  }[] = [];
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
  const ranked = [...entries].sort((left, right) => {
    if (left.activity !== right.activity) return left.activity === "stalled" ? -1 : 1;
    if (left.activity === "stalled" && right.activity === "stalled") {
      const age = (right.ageDays ?? 0) - (left.ageDays ?? 0);
      if (age !== 0) return age;
    }
    return compareText(refOf(left.item), refOf(right.item));
  });
  const rendered = capped(ranked, STATUS_MAX_TRACKER_FAMILY_ITEMS).map(
    (entry): StatusTrackerItem => ({
      workItemRef: refOf(entry.item),
      title: clampTitle(entry.item.title),
      family: "stalls",
      itemState: entry.activity === "unknown" ? "unknown" : "observed",
      activity: entry.activity,
      ...(entry.ageDays === undefined ? {} : { ageDays: entry.ageDays }),
    }),
  );
  return {
    family: {
      family: "stalls",
      state: "observed",
      counts: familyCounts(rendered, entries.length),
      items: rendered,
    },
    reasons: entries.length === 0 ? ["observed-empty"] : ["observed"],
  };
};

const hygieneFamily = (items: readonly WorkItem[], available: boolean): FamilyResult => {
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
  const entries: { readonly item: WorkItem; readonly findings: readonly StatusHygieneFinding[] }[] =
    [];
  for (const item of items) {
    if (!isOpen(item)) continue;
    const findings: StatusHygieneFinding[] = [];
    if (item.title.trim().length === 0) findings.push("missing-title");
    if (item.labels.length === 0) findings.push("missing-labels");
    if (findings.length > 0) entries.push({ item, findings });
  }
  const ranked = [...entries].sort((left, right) => {
    const count = right.findings.length - left.findings.length;
    if (count !== 0) return count;
    return compareText(refOf(left.item), refOf(right.item));
  });
  const rendered = capped(ranked, STATUS_MAX_TRACKER_FAMILY_ITEMS).map(
    (entry): StatusTrackerItem => ({
      workItemRef: refOf(entry.item),
      title: clampTitle(entry.item.title),
      family: "hygiene",
      itemState: "observed",
      findings: [...entry.findings],
    }),
  );
  return {
    family: {
      family: "hygiene",
      state: "observed",
      counts: familyCounts(rendered, entries.length),
      items: rendered,
    },
    reasons: entries.length === 0 ? ["observed-empty"] : ["observed"],
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
  const familyResults = [
    ownerHandBacksFamily(items, availability.ownerHandBacks === "available"),
    blockedDependenciesFamily(items, availability.blockedDependencies === "available"),
    stallsFamily(items, availability.stalls === "available", facts.nowMs),
    hygieneFamily(items, availability.hygiene === "available"),
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
  return {
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
    prRead.availability.reviewState === "unavailable" ||
    prRead.availability.reviewThreads === "unavailable";
  const activeUsable = active.state === "observed" || active.state === "observed-empty";

  let state: StatusSectionState;
  if (bindingFailure !== undefined && !activeUsable) {
    state = "unavailable";
  } else if (!prRead.ok && !activeUsable) {
    state = "unknown";
  } else if (prRead.ok && activeUsable && !prSignalsUnavailable) {
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
  const identity = compareIdentity(right.identity.entityId, left.identity.entityId);
  if (identity !== 0) return identity;
  return compareText(left.pipelineName, right.pipelineName);
};

const ciResultOf = (runs: readonly PipelineRun[]): StatusCiResult => {
  const states = runs.flatMap((run) => run.jobs.map((job) => job.jobState));
  if (states.includes("failed")) return "failed";
  if (states.includes("running") || states.includes("queued")) return "pending";
  if (states.includes("canceled")) return "canceled";
  if (states.includes("succeeded")) {
    return states.every((state) => state === "succeeded" || state === "skipped")
      ? "succeeded"
      : "none";
  }
  return "none";
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
  const result = ciResultOf(read.items);
  const reasons: StatusEvidenceReason[] = [result === "none" ? "observed-empty" : "observed"];
  if (truncated) reasons.push("source-truncated");
  return {
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
  };
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
});

/* -------------------------------- providers ------------------------------- */

const providerChainFor = (
  config: StatusProviderConfigRead,
): { readonly name: string; readonly entries: readonly string[] } | undefined => {
  if (!config.ok) return undefined;
  const defaultChain = config.config.defaultChain;
  if (defaultChain === undefined) return undefined;
  const chain = config.config.chains[defaultChain];
  return chain === undefined ? undefined : { name: chain.name, entries: chain.entries };
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
  if (chainInfo === undefined) {
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
    return {
      ...(entry.workItemRef === undefined ? {} : { workItemRef: entry.workItemRef }),
      ...(entry.branch === undefined ? {} : { branch: entry.branch }),
      ...(entry.changeFolder === undefined ? {} : { changeFolder: entry.changeFolder }),
      ...(reason === undefined ? {} : { reason }),
      ...(entry.parkedAt === undefined ? {} : { parkedAt: entry.parkedAt }),
      ...(ageDays === undefined ? {} : { ageDays }),
      itemState: entry.workItemRef === undefined ? "unknown" : "observed",
    };
  });
  const unknown = items.filter((item) => item.itemState === "unknown").length;
  const omitted = entries.length - items.length;
  const truncated = omitted > 0;
  const reasons: StatusEvidenceReason[] = [entries.length === 0 ? "observed-empty" : "observed"];
  if (unknown > 0) reasons.push("item-signal-absent");
  if (truncated) reasons.push("source-truncated");
  return {
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
    if (section.state === "observed" || section.state === "degraded") {
      counts.actionable +=
        (section.families ?? []).reduce((sum, family) => sum + family.items.length, 0) +
        (section.pullRequests?.length ?? 0) +
        (section.runs?.length ?? 0) +
        (section.entries?.length ?? 0) +
        (section.parks?.length ?? 0) +
        (section.id === "parked-work" ? (section.items?.length ?? 0) : 0);
    }
  }
  return { sections: sections.length, ...counts };
};

/** Aggregate the injected facts into the bounded `delivery.status.v1` digest. */
export const aggregateStatus = (facts: StatusFacts): StatusDigest => {
  const sections: readonly StatusSection[] = [
    trackerSection(facts),
    changesSection(facts),
    ciSection(facts),
    lanesSection(),
    providersSection(facts),
    parkedSection(facts),
  ];
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

const familyOf = (
  section: StatusSection,
  id: StatusTrackerFamilyId,
): StatusTrackerFamily | undefined => section.families?.find((family) => family.family === id);

const humanCiResult = (result: StatusCiResult | undefined): string => {
  if (result === undefined || result === "unknown") return "unknown";
  return result === "none" ? "none-reported" : result;
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
    lines.push(
      `tracker    ${tracker.state}  hand-backs ${ownerHandBacks?.counts.total ?? 0} | blocked ${blocked?.state ?? "unavailable"} | stalls ${stalls?.counts.total ?? 0} (${stalls?.counts.unknown ?? 0} unknown) | hygiene ${hygiene?.counts.total ?? 0}${truncationSuffix(tracker)}`,
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
    const prKnown =
      changes.pullRequests !== undefined &&
      changes.state !== "unknown" &&
      changes.state !== "unavailable";
    const prCount = prKnown ? String(changes.pullRequests?.length ?? 0) : "?";
    const review = !prKnown
      ? "unknown"
      : (changes.pullRequests ?? []).some((item) => item.reviewState === "unknown")
        ? "unavailable"
        : "observed";
    lines.push(
      `changes    ${changes.state}  active ${activeText} | PRs ${prCount} (review state ${review})${truncationSuffix(changes)}`,
    );
  }

  if (ci !== undefined) {
    const runs = ci.runs ?? [];
    const jobs = runs.flatMap((run) => run.jobs);
    const failed = jobs.filter((job) => job.jobState === "failed").length;
    lines.push(
      `ci         ${ci.state}  ${humanCiResult(ci.result)} (${failed}/${jobs.length} jobs)${truncationSuffix(ci)}`,
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
    const parksKnown = providers.parks !== undefined;
    const parkCount = parksKnown ? String(providers.parks?.length ?? 0) : "?";
    const entries = providers.state === "unknown" ? "?" : String(providers.entries?.length ?? 0);
    lines.push(
      `providers  ${providers.state}  chain ${chain} | active parks ${parkCount} | ${entries} entries${truncationSuffix(providers)}`,
    );
  }

  const parked = digest.sections.find((section) => section.id === "parked-work");
  if (parked !== undefined) {
    const count = parked.state === "observed" ? String(parked.items?.length ?? 0) : "?";
    lines.push(
      `parked     ${parked.state}  ${count} parked changes (git-ignored local state)${truncationSuffix(parked)}`,
    );
  }

  return `${lines.join("\n")}\n`;
};
