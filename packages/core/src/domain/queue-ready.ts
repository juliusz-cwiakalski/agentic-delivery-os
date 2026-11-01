/**
 * The pure queue-readiness evaluator, close classifier, ranker, and human
 * renderer (GH-176 F-3..F-14, D3).
 *
 * No I/O, clock, randomness, or ambient environment: every variable fact
 * (including `nowIso`/`nowMs`) arrives through `QueueReadyFacts`. The two
 * exported functions are the only executable surface; all helpers stay
 * internal.
 */

import {
  type BrandIdentity,
  type DeliveryRequest,
  QUEUE_READY_BRANCH_SEGMENT_MIN,
  QUEUE_READY_CONDITION_ORDER,
  QUEUE_READY_MAX_BRANCH_CHARS,
  QUEUE_READY_MAX_CANDIDATES,
  QUEUE_READY_MAX_DETAIL_CHARS,
  QUEUE_READY_MAX_EVIDENCE_PER_CONDITION,
  QUEUE_READY_MAX_HUMAN_BYTES,
  QUEUE_READY_MAX_HUMAN_LINES,
  QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES,
  QUEUE_READY_MAX_IDENTITY_CHARS,
  QUEUE_READY_MAX_LABEL_CHARS,
  QUEUE_READY_MAX_LABELS,
  QUEUE_READY_MAX_MACHINE_BYTES,
  QUEUE_READY_MAX_OWNER_CHARS,
  QUEUE_READY_MAX_REASONS,
  QUEUE_READY_MAX_REF_CHARS,
  QUEUE_READY_MAX_RELATIONS,
  QUEUE_READY_MAX_REPO_NAME_CHARS,
  QUEUE_READY_MAX_TIMESTAMP_CHARS,
  QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN,
  QUEUE_READY_OWNER_ATTENTION_LABELS,
  QUEUE_READY_RANK_CLASS_ORDER,
  QUEUE_READY_REASON_ORDER,
  QUEUE_READY_SCHEMA_VERSION,
  QUEUE_READY_SOURCE_FAILURE_REASONS,
  QUEUE_READY_SOURCE_ITEM_LIMIT,
  QUEUE_READY_SOURCE_PIPELINE_LIMIT,
  QUEUE_READY_TIER_LABELS,
  QUEUE_READY_WORK_ITEM_REF_PATTERN,
  type QueueReadyBlockingCondition,
  type QueueReadyCandidate,
  type QueueReadyClose,
  type QueueReadyCloseClass,
  type QueueReadyCondition,
  type QueueReadyConditionId,
  type QueueReadyEvidence,
  type QueueReadyFacts,
  type QueueReadyPayload,
  type QueueReadyPullRequest,
  type QueueReadyReason,
  type QueueReadyRepository,
  type QueueReadySummary,
  type QueueReadyWorkItemObservation,
  type QueueReadyWorkItemRelation,
  type WorkItem,
} from "#contracts";
import { classifyPipelineRuns } from "./ci-result.js";

const REF_PATTERN = new RegExp(QUEUE_READY_WORK_ITEM_REF_PATTERN, "i");
const NUMERIC_PATTERN = new RegExp(QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN);
const SUFFIX_PATTERN = /([0-9]+)$/;

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

const isAllDigits = (value: string): boolean => NUMERIC_PATTERN.test(value);

/**
 * UTF-8 byte length computed from code points, with no `TextEncoder`, `Buffer`,
 * `node:*`, or `bun:*` dependency so the domain stays runtime-neutral. A
 * surrogate pair is one 4-byte code point; a lone surrogate counts 3 bytes
 * (the replacement encoding).
 */
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

const serializedBytes = (payload: QueueReadyPayload): number =>
  utf8ByteLength(JSON.stringify(payload));

const numericSuffix = (ref: string): string | undefined => {
  const match = SUFFIX_PATTERN.exec(ref);
  return match?.[1];
};

/**
 * Arbitrary-precision numeric-suffix comparison. `Number` loses precision above
 * 2^53, so equal-length and very long suffixes are compared as BigInt; equal
 * numeric values tie and let the canonical-text key decide. A ref without a
 * numeric suffix ranks after every numeric suffix and ties with other
 * suffix-less refs.
 */
const compareNumericSuffix = (left: string, right: string): number => {
  const leftSuffix = numericSuffix(left);
  const rightSuffix = numericSuffix(right);
  if (leftSuffix === undefined && rightSuffix === undefined) return 0;
  if (leftSuffix === undefined) return 1;
  if (rightSuffix === undefined) return -1;
  const a = BigInt(leftSuffix);
  const b = BigInt(rightSuffix);
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

/** Numeric-aware entity comparison: equal all-digit values tie at this key. */
const compareNumericAware = (left: string, right: string): number => {
  if (isAllDigits(left) && isAllDigits(right)) {
    const a = BigInt(left);
    const b = BigInt(right);
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }
  return compareText(left, right);
};

const clampValue = (value: string, cap: number, state: { clamped: boolean }): string => {
  const points = Array.from(value);
  if (points.length <= cap) return value;
  state.clamped = true;
  return points.slice(0, cap).join("");
};

const clampDetail = (detail: string | undefined): string | undefined => {
  if (detail === undefined) return undefined;
  const points = Array.from(detail);
  return points.length > QUEUE_READY_MAX_DETAIL_CHARS
    ? points.slice(0, QUEUE_READY_MAX_DETAIL_CHARS).join("")
    : detail;
};

const evidence = (
  source: QueueReadyEvidence["source"],
  reason: QueueReadyReason,
  detail?: string,
): QueueReadyEvidence => {
  const clamped = clampDetail(detail);
  return clamped === undefined ? { source, reason } : { source, reason, detail: clamped };
};

const failureIdentity = (failure: {
  readonly failureCode?: string;
  readonly failureClass?: string;
}): string | undefined => {
  const parts: string[] = [];
  if (failure.failureCode !== undefined) parts.push(`failureCode:${failure.failureCode}`);
  if (failure.failureClass !== undefined) parts.push(`failureClass:${failure.failureClass}`);
  return parts.length === 0 ? undefined : parts.join("; ");
};

const observedItems = (facts: QueueReadyFacts): readonly WorkItem[] =>
  facts.tracker.ok ? facts.tracker.items : [];

const labelSignalAvailable = (facts: QueueReadyFacts): boolean =>
  facts.tracker.ok && facts.tracker.availability.ownerHandBacks === "available";

const relationSignalAvailable = (facts: QueueReadyFacts): boolean =>
  facts.tracker.ok && facts.tracker.availability.blockedDependencies === "available";

/* ----------------------------- identity rule ------------------------------ */

/** Candidate observation: candidate-set-scoped unique numeric suffix (spec §8.3). */
const observeCandidate = (
  candidate: string,
  requested: readonly string[],
  items: readonly WorkItem[],
): WorkItem | undefined => {
  for (const item of items) {
    if (item.identity.entityId.toLowerCase() === candidate.toLowerCase()) return item;
  }
  for (const item of items) {
    const id = item.identity.entityId;
    if (!isAllDigits(id)) continue;
    const sharing = requested.filter((ref) => numericSuffix(ref) === id);
    if (sharing.length === 1 && sharing[0] === candidate) return item;
  }
  return undefined;
};

/** `blocked-by` targets: observed-work-item-set-scoped unique numeric suffix. */
const resolveTarget = (targetId: string, items: readonly WorkItem[]): WorkItem | undefined => {
  for (const item of items) {
    if (item.identity.entityId.toLowerCase() === targetId.toLowerCase()) return item;
  }
  if (!isAllDigits(targetId)) return undefined;
  const carrying = items.filter((item) => {
    if (!REF_PATTERN.test(item.identity.entityId)) return false;
    return numericSuffix(item.identity.entityId) === targetId;
  });
  return carrying.length === 1 ? carrying[0] : undefined;
};

/* ------------------------------- predicates ------------------------------- */

type ConditionResult = QueueReadyCondition;

const unobservedCondition = (id: QueueReadyConditionId): ConditionResult => ({
  id,
  state: "unknown",
  evidence: [evidence("tracker", "work-item-unobserved")],
});

const depsCondition = (facts: QueueReadyFacts, item: WorkItem | undefined): ConditionResult => {
  if (item === undefined) return unobservedCondition("deps-satisfied");
  if (!relationSignalAvailable(facts)) {
    return {
      id: "deps-satisfied",
      state: "unknown",
      evidence: [evidence("tracker", "signal-unavailable")],
    };
  }
  const targets = item.relations.filter((relation) => relation.relationKind === "blocked-by");
  const counts = { done: 0, open: 0, unknown: 0 };
  const items = observedItems(facts);
  for (const relation of targets) {
    const target = resolveTarget(relation.target.entityId, items);
    if (target === undefined) {
      counts.unknown += 1;
    } else if (
      target.status.deliveryState === "done" ||
      target.status.deliveryState === "canceled"
    ) {
      counts.done += 1;
    } else {
      counts.open += 1;
    }
  }
  const detail = `done:${counts.done}; open:${counts.open}; unknown:${counts.unknown}`;
  if (targets.length === 0) {
    return {
      id: "deps-satisfied",
      state: "satisfied",
      evidence: [evidence("tracker", "no-blocked-dependencies")],
    };
  }
  if (counts.open > 0) {
    return {
      id: "deps-satisfied",
      state: "unsatisfied",
      evidence: [evidence("tracker", "dependency-open", detail)],
    };
  }
  if (counts.unknown > 0) {
    return {
      id: "deps-satisfied",
      state: "unknown",
      evidence: [evidence("tracker", "dependency-unobserved", detail)],
    };
  }
  return {
    id: "deps-satisfied",
    state: "satisfied",
    evidence: [evidence("tracker", "dependencies-done", detail)],
  };
};

const repoFreeCondition = (facts: QueueReadyFacts, candidate: string): ConditionResult => {
  if (!facts.localContext.ok) {
    return {
      id: "repo-free",
      state: "unknown",
      evidence: [
        evidence(
          "local-context",
          facts.localContext.reason === "missing"
            ? "local-context-missing"
            : "local-context-malformed",
        ),
      ],
    };
  }
  const active = facts.localContext.context.activeChange;
  if (active === undefined) {
    return {
      id: "repo-free",
      state: "satisfied",
      evidence: [evidence("local-context", "no-active-change", "repo:local-context")],
    };
  }
  if (active.workItemRef.toLowerCase() === candidate.toLowerCase()) {
    return {
      id: "repo-free",
      state: "satisfied",
      evidence: [
        evidence("local-context", "candidate-is-active", "repo:local-context; candidate-is-active"),
      ],
    };
  }
  return {
    id: "repo-free",
    state: "unsatisfied",
    evidence: [
      evidence(
        "local-context",
        "other-active-change",
        `repo:local-context; active-change:${active.workItemRef}`,
      ),
    ],
  };
};

const recognizedLabels = (
  labels: readonly string[],
  declared: readonly string[],
): readonly string[] => {
  const matched: string[] = [];
  for (const label of labels) {
    const token = declared.find((entry) => entry.toLowerCase() === label.toLowerCase());
    if (token !== undefined && !matched.includes(token)) matched.push(token);
  }
  return matched;
};

const tierCondition = (facts: QueueReadyFacts, item: WorkItem | undefined): ConditionResult => {
  if (item === undefined) return unobservedCondition("tier-known");
  if (!labelSignalAvailable(facts)) {
    return {
      id: "tier-known",
      state: "unknown",
      evidence: [evidence("tracker", "signal-unavailable")],
    };
  }
  const matched = recognizedLabels(item.labels, QUEUE_READY_TIER_LABELS);
  if (matched.length === 0) {
    return {
      id: "tier-known",
      state: "unknown",
      evidence: [evidence("tracker", "tier-absent", "tier:priority-label; none")],
    };
  }
  if (matched.length === 1) {
    const token = matched[0];
    return {
      id: "tier-known",
      state: "satisfied",
      evidence: [evidence("tracker", "tier-label", `tier:priority-label; label:${token ?? ""}`)],
    };
  }
  const sorted = [...matched].sort(compareText);
  return {
    id: "tier-known",
    state: "unsatisfied",
    evidence: [
      evidence("tracker", "tier-conflict", `tier:priority-label; labels:${sorted.join(",")}`),
    ],
  };
};

const ownerGateCondition = (
  facts: QueueReadyFacts,
  item: WorkItem | undefined,
): ConditionResult => {
  if (item === undefined) return unobservedCondition("no-owner-gate");
  if (!labelSignalAvailable(facts)) {
    return {
      id: "no-owner-gate",
      state: "unknown",
      evidence: [evidence("tracker", "signal-unavailable")],
    };
  }
  const matched = recognizedLabels(item.labels, QUEUE_READY_OWNER_ATTENTION_LABELS);
  if (matched.length === 0) {
    return {
      id: "no-owner-gate",
      state: "satisfied",
      evidence: [evidence("tracker", "no-owner-labels")],
    };
  }
  const sorted = [...matched].sort(compareText);
  return {
    id: "no-owner-gate",
    state: "unsatisfied",
    evidence: [evidence("tracker", "owner-labels", `owner-labels:${sorted.join(",")}`)],
  };
};

const bindingUnavailable = (facts: QueueReadyFacts): boolean =>
  facts.repository.binding.state !== "observed";

const ciCondition = (facts: QueueReadyFacts): ConditionResult => {
  if (bindingUnavailable(facts)) {
    const binding = facts.repository.binding;
    const reason = binding.state === "unavailable" ? binding.reason : "addressing-unresolved";
    return {
      id: "ci-healthy",
      state: "unknown",
      evidence: [evidence("repository-binding", reason)],
    };
  }
  if (facts.repository.head.sha === undefined) {
    return {
      id: "ci-healthy",
      state: "unknown",
      evidence: [evidence("ci", "commit-unresolved")],
    };
  }
  if (!facts.ci.ok) {
    const detail = failureIdentity(facts.ci);
    if (facts.ci.reason === "credential-unavailable") {
      return {
        id: "ci-healthy",
        state: "unknown",
        evidence: [evidence("ci", "credential-unavailable", detail)],
      };
    }
    if (facts.ci.reason === "commit-unresolved") {
      return {
        id: "ci-healthy",
        state: "unknown",
        evidence: [evidence("ci", "commit-unresolved", detail)],
      };
    }
    // Defensive only: the composed command reads check-runs only under an
    // observed binding, so a `not-configured` failure is unreachable there.
    // Map it distinctly from an attempted `read-failed` if the composition
    // changes; `signal-unavailable` is existing vocabulary (no new token).
    if (facts.ci.reason === "not-configured") {
      return {
        id: "ci-healthy",
        state: "unknown",
        evidence: [evidence("ci", "signal-unavailable", detail)],
      };
    }
    return {
      id: "ci-healthy",
      state: "unknown",
      evidence: [evidence("ci", "read-failed", detail)],
    };
  }
  const result = classifyPipelineRuns(facts.ci.items);
  const reason: QueueReadyReason =
    result === "succeeded"
      ? "ci-succeeded"
      : result === "failed"
        ? "ci-failed"
        : result === "pending"
          ? "ci-pending"
          : result === "canceled"
            ? "ci-canceled"
            : "ci-none";
  return {
    id: "ci-healthy",
    state: result === "succeeded" ? "satisfied" : "unsatisfied",
    evidence: [evidence("ci", reason, `result:${result}`)],
  };
};

const providerCondition = (facts: QueueReadyFacts): ConditionResult => {
  const configRead = facts.providers.config;
  const parkRead = facts.providers.parks;
  const companion = evidence("provider-config", "engine-not-run");
  const unknown = (record: QueueReadyEvidence): ConditionResult => ({
    id: "provider-available",
    state: "unknown",
    evidence: [record, companion],
  });
  const unsatisfied = (record: QueueReadyEvidence): ConditionResult => ({
    id: "provider-available",
    state: "unsatisfied",
    evidence: [record, companion],
  });

  if (!configRead.ok) {
    const reason: QueueReadyReason =
      configRead.reason === "provider-chain-unresolved"
        ? "provider-chain-unresolved"
        : "config-invalid";
    const detail = failureIdentity({
      ...(configRead.failureCode === undefined ? {} : { failureCode: configRead.failureCode }),
    });
    return unknown(evidence("provider-config", reason, detail));
  }
  const config = configRead.config;
  const defaultChain = config.defaultChain;
  if (defaultChain === undefined) {
    return unknown(evidence("provider-config", "provider-chain-not-declared"));
  }
  const chain = config.chains[defaultChain];
  if (chain === undefined) {
    return unknown(evidence("provider-config", "provider-chain-unresolved"));
  }
  if (!parkRead.ok) {
    return unknown(
      evidence(
        "provider-parks",
        "state-unreadable",
        failureIdentity({
          ...(parkRead.failureCode === undefined ? {} : { failureCode: parkRead.failureCode }),
          ...(parkRead.failureClass === undefined ? {} : { failureClass: parkRead.failureClass }),
        }),
      ),
    );
  }
  const activeParks = parkRead.parks.filter((park) => park.state === "active");
  const chainPark = activeParks.find(
    (park) => park.subjectKind === "chain" && park.subjectName === chain.name,
  );
  if (chainPark !== undefined) {
    return unsatisfied(
      evidence(
        "provider-parks",
        "chain-parked",
        `chain:${chain.name}; until:${chainPark.expiresAt.length === 0 ? "none" : chainPark.expiresAt}; cause:${chainPark.cause.length === 0 ? "none" : chainPark.cause}`,
      ),
    );
  }
  const enabled = chain.entries.filter((name) => config.entries[name]?.enabled === true);
  if (enabled.length === 0) {
    return unsatisfied(evidence("provider-config", "no-enabled-entry", `chain:${chain.name}`));
  }
  const parkedNames = new Set(
    activeParks.flatMap((park) => (park.subjectKind === "provider" ? [park.subjectName] : [])),
  );
  const unparked = enabled.filter((name) => !parkedNames.has(name));
  if (unparked.length > 0) {
    return {
      id: "provider-available",
      state: "satisfied",
      evidence: [evidence("provider-parks", "no-active-park", `chain:${chain.name}`), companion],
    };
  }
  return unsatisfied(evidence("provider-parks", "all-entries-parked", `chain:${chain.name}`));
};

/* ------------------------------- close rule ------------------------------- */

const branchSegments = (sourceRef: string): readonly string[] => sourceRef.split("/");

const associates = (sourceRef: string, candidate: string): boolean => {
  const segments = branchSegments(sourceRef);
  if (segments.length < QUEUE_READY_BRANCH_SEGMENT_MIN) return false;
  if (segments.some((segment) => segment.length === 0)) return false;
  return segments.some((segment) => segment.toLowerCase() === candidate.toLowerCase());
};

const isOpenRequest = (request: DeliveryRequest): boolean =>
  request.reviewState !== "merged" && request.reviewState !== "closed";

const isMergedOrClosed = (request: DeliveryRequest): boolean =>
  request.reviewState === "merged" || request.reviewState === "closed";

const compareRequests = (left: DeliveryRequest, right: DeliveryRequest): number => {
  const identity = compareNumericAware(left.identity.entityId, right.identity.entityId);
  if (identity !== 0) return identity;
  const source = compareText(left.sourceRef, right.sourceRef);
  if (source !== 0) return source;
  const target = compareText(left.targetRef, right.targetRef);
  if (target !== 0) return target;
  return compareText(left.identity.entityId, right.identity.entityId);
};

type CloseResult = {
  readonly close: QueueReadyClose;
  readonly closeClass: QueueReadyCloseClass;
};

const closeFor = (facts: QueueReadyFacts, candidate: string, ready: boolean): CloseResult => {
  if (bindingUnavailable(facts) || !facts.changes.ok) {
    return {
      close: { association: "unknown", associatedCount: 0, reason: "pr-association-unknown" },
      closeClass: ready ? "unknown" : "not-ready",
    };
  }
  const read = facts.changes;
  const matching = read.items.filter((request) => associates(request.sourceRef, candidate));
  const openMatches = matching.filter(isOpenRequest);
  const atLimit = read.pageItemCount >= QUEUE_READY_SOURCE_ITEM_LIMIT;
  if (atLimit && openMatches.length === 0) {
    return {
      close: { association: "unknown", associatedCount: 0, reason: "pr-association-unknown" },
      closeClass: ready ? "unknown" : "not-ready",
    };
  }
  if (openMatches.length === 0) {
    const mergedMatch = matching.some(isMergedOrClosed);
    return {
      close: {
        association: "not-associated",
        associatedCount: 0,
        reason: mergedMatch ? "pr-not-open" : "pr-not-associated",
      },
      closeClass: ready ? "new-start" : "not-ready",
    };
  }
  const reviewSignalAvailable = read.availability.reviewState === "available";
  const mergeReadySet = openMatches.filter(
    (request) => reviewSignalAvailable && request.reviewState === "approved",
  );
  const selectedSet = mergeReadySet.length > 0 ? mergeReadySet : openMatches;
  const selected = [...selectedSet].sort(compareRequests)[0];
  if (selected === undefined) {
    return {
      close: { association: "unknown", associatedCount: 0, reason: "pr-association-unknown" },
      closeClass: ready ? "unknown" : "not-ready",
    };
  }
  const reviewStateObserved = reviewSignalAvailable;
  const pullRequest: QueueReadyPullRequest = {
    entityId: selected.identity.entityId,
    sourceRef: selected.sourceRef,
    targetRef: selected.targetRef,
    draft: selected.reviewState === "draft",
    reviewStateObserved,
    ...(reviewStateObserved ? { reviewState: selected.reviewState } : {}),
  };
  return {
    close: {
      association: "associated",
      associatedCount: openMatches.length,
      pullRequest,
      reason: "pr-associated",
    },
    closeClass: mergeReadySet.length > 0 ? "merge-ready" : "review-pending",
  };
};

/* --------------------------------- assembly ------------------------------- */

const evaluateConditions = (
  facts: QueueReadyFacts,
  candidate: string,
  item: WorkItem | undefined,
): readonly QueueReadyCondition[] => [
  depsCondition(facts, item),
  repoFreeCondition(facts, candidate),
  tierCondition(facts, item),
  ownerGateCondition(facts, item),
  ciCondition(facts),
  providerCondition(facts),
];

const blockingOf = (
  conditions: readonly QueueReadyCondition[],
): readonly QueueReadyBlockingCondition[] =>
  conditions
    .filter((condition) => condition.state !== "satisfied")
    .map((condition) => ({ id: condition.id, state: condition.state }));

const classRank = (value: QueueReadyCloseClass): number => {
  const index = QUEUE_READY_RANK_CLASS_ORDER.indexOf(value);
  return index === -1 ? QUEUE_READY_RANK_CLASS_ORDER.length : index;
};

const compareCandidates = (
  left: { readonly workItemRef: string; readonly closeClass: QueueReadyCloseClass },
  right: { readonly workItemRef: string; readonly closeClass: QueueReadyCloseClass },
): number => {
  const classOrder = classRank(left.closeClass) - classRank(right.closeClass);
  if (classOrder !== 0) return classOrder;
  const numeric = compareNumericSuffix(left.workItemRef, right.workItemRef);
  if (numeric !== 0) return numeric;
  return compareText(left.workItemRef, right.workItemRef);
};

const pageAtLimit = (facts: QueueReadyFacts): boolean =>
  (facts.tracker.ok && facts.tracker.pageItemCount >= QUEUE_READY_SOURCE_ITEM_LIMIT) ||
  (facts.changes.ok && facts.changes.pageItemCount >= QUEUE_READY_SOURCE_ITEM_LIMIT) ||
  (facts.ci.ok && facts.ci.pageItemCount >= QUEUE_READY_SOURCE_PIPELINE_LIMIT);

type CapState = { clamped: boolean };

const projectRelation = (
  relation: QueueReadyWorkItemRelation,
  cap: CapState,
): QueueReadyWorkItemRelation => ({
  relationKind: "blocked-by",
  target: { entityId: clampValue(relation.target.entityId, QUEUE_READY_MAX_IDENTITY_CHARS, cap) },
});

const projectWorkItem = (
  item: WorkItem | undefined,
  cap: CapState,
): QueueReadyWorkItemObservation => {
  if (item === undefined) return { state: "unknown", reason: "work-item-unobserved" };
  const labels = item.labels
    .slice(0, QUEUE_READY_MAX_LABELS)
    .map((label) => clampValue(label, QUEUE_READY_MAX_LABEL_CHARS, cap));
  if (item.labels.length > QUEUE_READY_MAX_LABELS) cap.clamped = true;
  const relations = item.relations
    .filter((relation) => relation.relationKind === "blocked-by")
    .slice(0, QUEUE_READY_MAX_RELATIONS)
    .map((relation) =>
      projectRelation({ relationKind: "blocked-by", target: relation.target }, cap),
    );
  if (
    item.relations.filter((relation) => relation.relationKind === "blocked-by").length >
    QUEUE_READY_MAX_RELATIONS
  ) {
    cap.clamped = true;
  }
  const updatedAt =
    item.updatedAt === undefined
      ? undefined
      : clampValue(item.updatedAt, QUEUE_READY_MAX_TIMESTAMP_CHARS, cap);
  return {
    state: "observed",
    itemState: item.status.deliveryState,
    labels,
    ...(updatedAt === undefined ? {} : { updatedAt }),
    ...(relations.length === 0 ? {} : { relations }),
  };
};

type ObservedWorkItem = Extract<QueueReadyWorkItemObservation, { state: "observed" }>;

const withRelations = (
  workItem: ObservedWorkItem,
  relations: readonly QueueReadyWorkItemRelation[],
): QueueReadyWorkItemObservation => ({
  state: "observed",
  itemState: workItem.itemState,
  labels: workItem.labels ?? [],
  ...(workItem.updatedAt === undefined ? {} : { updatedAt: workItem.updatedAt }),
  ...(relations.length === 0 ? {} : { relations }),
});

const withLabels = (
  workItem: ObservedWorkItem,
  labels: readonly string[],
): QueueReadyWorkItemObservation => ({
  state: "observed",
  itemState: workItem.itemState,
  labels,
  ...(workItem.updatedAt === undefined ? {} : { updatedAt: workItem.updatedAt }),
  ...(workItem.relations === undefined ? {} : { relations: workItem.relations }),
});

const projectPullRequest = (
  request: QueueReadyPullRequest | undefined,
  cap: CapState,
): QueueReadyPullRequest | undefined => {
  if (request === undefined) return undefined;
  return {
    entityId: clampValue(request.entityId, QUEUE_READY_MAX_IDENTITY_CHARS, cap),
    sourceRef: clampValue(request.sourceRef, QUEUE_READY_MAX_REF_CHARS, cap),
    targetRef: clampValue(request.targetRef, QUEUE_READY_MAX_REF_CHARS, cap),
    draft: request.draft,
    reviewStateObserved: request.reviewStateObserved,
    ...(request.reviewState === undefined ? {} : { reviewState: request.reviewState }),
  };
};

const projectClose = (close: QueueReadyClose, cap: CapState): QueueReadyClose => {
  const pullRequest = projectPullRequest(close.pullRequest, cap);
  return {
    association: close.association,
    associatedCount: close.associatedCount,
    ...(pullRequest === undefined ? {} : { pullRequest }),
    reason: close.reason,
  };
};

const projectRepository = (facts: QueueReadyFacts, cap: CapState): QueueReadyRepository => {
  const binding = facts.repository.binding;
  if (binding.state !== "observed") {
    return { state: "unavailable", reason: binding.reason };
  }
  return {
    state: "observed",
    host: "github.com",
    owner: clampValue(binding.owner, QUEUE_READY_MAX_OWNER_CHARS, cap),
    name: clampValue(binding.name, QUEUE_READY_MAX_REPO_NAME_CHARS, cap),
    remoteName: "origin",
  };
};

const projectHead = (facts: QueueReadyFacts, cap: CapState): QueueReadyPayload["head"] => {
  const head = facts.repository.head;
  const branch =
    head.branch === undefined
      ? undefined
      : clampValue(head.branch, QUEUE_READY_MAX_BRANCH_CHARS, cap);
  return {
    ...(branch === undefined ? {} : { branch }),
    ...(head.sha === undefined ? {} : { sha: head.sha }),
  };
};

const summaryOf = (candidates: readonly QueueReadyCandidate[]): QueueReadySummary => ({
  candidates: candidates.length,
  ready: candidates.filter((candidate) => candidate.ready).length,
  notReady: candidates.filter((candidate) => !candidate.ready).length,
  mergeReady: candidates.filter((candidate) => candidate.closeClass === "merge-ready").length,
  reviewPending: candidates.filter((candidate) => candidate.closeClass === "review-pending").length,
  newStart: candidates.filter((candidate) => candidate.closeClass === "new-start").length,
  unknownClose: candidates.filter((candidate) => candidate.closeClass === "unknown").length,
});

const assembleReasons = (
  facts: QueueReadyFacts,
  candidates: readonly QueueReadyCandidate[],
  sourceAtLimit: boolean,
  clamped: boolean,
): { readonly reasons: readonly QueueReadyReason[]; readonly overflow: boolean } => {
  const grouped: QueueReadyReason[][] = [];
  const present = new Set<QueueReadyReason>();
  for (const candidate of candidates) {
    for (const condition of candidate.conditions) {
      for (const record of condition.evidence) present.add(record.reason);
    }
    present.add(candidate.close.reason);
  }
  const configRead = facts.providers.config;
  const configReason: QueueReadyReason | undefined = !configRead.ok
    ? configRead.reason === "provider-chain-unresolved"
      ? "provider-chain-unresolved"
      : "config-invalid"
    : undefined;
  const chainNotDeclared = configRead.ok && configRead.config.defaultChain === undefined;
  const chainUnresolved =
    configRead.ok &&
    configRead.config.defaultChain !== undefined &&
    configRead.config.chains[configRead.config.defaultChain] === undefined;
  const parkFoldFailed = !facts.providers.parks.ok;
  // DM-1 group 5: walk the rank-ordered candidates → QUEUE_READY_CONDITION_ORDER
  // → each condition's evidence order. QUEUE_READY_SOURCE_FAILURE_REASONS is a
  // membership set only; it never drives emission order.
  const sourceFailureMembers = new Set<string>(QUEUE_READY_SOURCE_FAILURE_REASONS);
  const sourceFailureWalk: QueueReadyReason[] = [];
  const walked = new Set<QueueReadyReason>();
  for (const candidate of candidates) {
    for (const conditionId of QUEUE_READY_CONDITION_ORDER) {
      const condition = candidate.conditions.find((entry) => entry.id === conditionId);
      if (condition === undefined) continue;
      for (const record of condition.evidence) {
        if (sourceFailureMembers.has(record.reason) && !walked.has(record.reason)) {
          walked.add(record.reason);
          sourceFailureWalk.push(record.reason);
        }
      }
    }
  }
  for (const group of QUEUE_READY_REASON_ORDER) {
    if (group.group === "condition-source-failure") {
      grouped.push(sourceFailureWalk);
      continue;
    }
    const selected: QueueReadyReason[] = [];
    for (const reason of group.reasons) {
      if (reason === "source-truncated") {
        if (sourceAtLimit) selected.push(reason);
        continue;
      }
      if (reason === "value-clamped") {
        if (clamped) selected.push(reason);
        continue;
      }
      if (reason === "addressing-unresolved" || reason === "remote-unsupported") {
        const binding = facts.repository.binding;
        if (binding.state === "unavailable" && binding.reason === reason) selected.push(reason);
        continue;
      }
      if (reason === "config-invalid") {
        if (configReason === "config-invalid") selected.push(reason);
        continue;
      }
      if (reason === "provider-chain-not-declared") {
        if (chainNotDeclared) selected.push(reason);
        continue;
      }
      if (reason === "provider-chain-unresolved") {
        if (configReason === "provider-chain-unresolved" || chainUnresolved) selected.push(reason);
        continue;
      }
      if (reason === "state-unreadable") {
        if (parkFoldFailed) selected.push(reason);
        continue;
      }
      if (present.has(reason)) selected.push(reason);
    }
    grouped.push(selected);
  }
  const unique: QueueReadyReason[] = [];
  for (const group of grouped) {
    for (const reason of group) {
      if (!unique.includes(reason)) unique.push(reason);
    }
  }
  if (unique.length > QUEUE_READY_MAX_REASONS) {
    return { reasons: unique.slice(0, QUEUE_READY_MAX_REASONS), overflow: true };
  }
  return { reasons: unique, overflow: false };
};

/** Evaluate the injected facts into the bounded `delivery.queue-ready.v1` payload. */
export const evaluateQueueReady = (facts: QueueReadyFacts): QueueReadyPayload => {
  const cap: CapState = { clamped: false };
  const requested = facts.candidates.slice(0, QUEUE_READY_MAX_CANDIDATES);
  const items = observedItems(facts);
  type Draft = {
    readonly workItemRef: string;
    readonly ready: boolean;
    readonly closeClass: QueueReadyCloseClass;
    readonly item: WorkItem | undefined;
    readonly conditions: readonly QueueReadyCondition[];
    readonly blockingConditions: readonly QueueReadyBlockingCondition[];
    readonly close: QueueReadyClose;
    readonly evidenceTruncated: boolean;
  };
  const drafts: Draft[] = requested.map((candidate) => {
    const item = observeCandidate(candidate, requested, items);
    const conditions = evaluateConditions(facts, candidate, item);
    const ready = conditions.every((condition) => condition.state === "satisfied");
    const close = closeFor(facts, candidate, ready);
    return {
      workItemRef: candidate,
      ready,
      closeClass: close.closeClass,
      item,
      conditions,
      blockingConditions: blockingOf(conditions),
      close: close.close,
      evidenceTruncated: false,
    };
  });
  drafts.sort(compareCandidates);

  const candidates: QueueReadyCandidate[] = drafts.map((draft, index) => ({
    workItemRef: draft.workItemRef,
    rank: index + 1,
    ready: draft.ready,
    closeClass: draft.closeClass,
    workItem: projectWorkItem(draft.item, cap),
    close: projectClose(draft.close, cap),
    conditions: draft.conditions.map((condition) => ({
      id: condition.id,
      state: condition.state,
      evidence: condition.evidence.slice(0, QUEUE_READY_MAX_EVIDENCE_PER_CONDITION),
    })),
    blockingConditions: draft.blockingConditions,
    truncated: draft.evidenceTruncated,
  }));

  const repository = projectRepository(facts, cap);
  const head = projectHead(facts, cap);
  const summary = summaryOf(candidates);
  const sourceAtLimit = pageAtLimit(facts);
  let assembled = assembleReasons(facts, candidates, sourceAtLimit, cap.clamped);
  let payloadTruncated = assembled.overflow || sourceAtLimit || cap.clamped;

  const build = (): QueueReadyPayload => ({
    schemaVersion: QUEUE_READY_SCHEMA_VERSION,
    generatedAt: facts.nowIso,
    repository,
    head,
    candidates,
    summary,
    reasons: assembled.reasons,
    truncated: payloadTruncated,
  });

  let payload = build();
  if (serializedBytes(payload) <= QUEUE_READY_MAX_MACHINE_BYTES) return payload;

  // Deterministic trailing-relation-then-label reduction, last rank first.
  cap.clamped = true;
  payloadTruncated = true;
  assembled = assembleReasons(facts, candidates, sourceAtLimit, true);
  payload = build();
  const fits = (): boolean => serializedBytes(build()) <= QUEUE_READY_MAX_MACHINE_BYTES;

  const reduceRelations = (): void => {
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const candidate = candidates[index];
      if (candidate === undefined || candidate.workItem.state !== "observed") continue;
      let relations = candidate.workItem.relations ?? [];
      while (relations.length > 0) {
        relations = relations.slice(0, relations.length - 1);
        candidates[index] = {
          ...candidate,
          workItem: withRelations(candidate.workItem, relations),
        };
        if (fits()) return;
      }
    }
  };

  const reduceLabels = (): void => {
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const candidate = candidates[index];
      if (candidate === undefined || candidate.workItem.state !== "observed") continue;
      let labels = candidate.workItem.labels ?? [];
      while (labels.length > 0) {
        labels = labels.slice(0, labels.length - 1);
        candidates[index] = {
          ...candidate,
          workItem: withLabels(candidate.workItem, labels),
        };
        if (fits()) return;
      }
    }
  };

  if (!fits()) reduceRelations();
  if (!fits()) reduceLabels();
  return build();
};

/* ------------------------------ human render ------------------------------ */

/**
 * Truncate a value to at most `maxBytes` UTF-8 bytes without splitting a code
 * point. An over-cap value keeps the longest code-point prefix that fits
 * `maxBytes - 1` bytes and appends `+`, so the marker counts toward the cap.
 */
const truncateToBytes = (value: string, maxBytes: number): string => {
  if (maxBytes <= 0) return "";
  if (utf8ByteLength(value) <= maxBytes) return value;
  const limit = maxBytes - 1;
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

const shortenSegment = (value: string): string =>
  truncateToBytes(value, QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES);

const HUMAN_CANDIDATE_LINE_MAX_BYTES = 400;
const HUMAN_HEADER_OWNER_MAX_BYTES = 128;
const HUMAN_HEADER_NAME_MAX_BYTES = 128;
const HUMAN_HEADER_BRANCH_MAX_BYTES = 256;

const humanDetail = (candidate: QueueReadyCandidate): string => {
  const blocking =
    candidate.blockingConditions.length === 0
      ? undefined
      : `blocking: ${candidate.blockingConditions
          .map((condition) => `${condition.id}=${condition.state}`)
          .join(", ")}`;
  const pullRequest = candidate.close.pullRequest;
  if (pullRequest !== undefined) {
    const closeEvidence = `${shortenSegment(`PR #${pullRequest.entityId}`)} ${shortenSegment(pullRequest.sourceRef)}`;
    return blocking === undefined ? closeEvidence : `${closeEvidence} | ${blocking}`;
  }
  if (candidate.ready && candidate.close.association === "not-associated") {
    return "all six readiness conditions satisfied";
  }
  if (candidate.ready && candidate.close.association === "unknown") {
    return "close association unknown";
  }
  return blocking ?? "blocking: none";
};

/** The header suffix after the injected binary name, with every field byte-capped. */
const humanHeaderTail = (payload: QueueReadyPayload): string | undefined => {
  if (payload.repository.state !== "observed" || payload.head.sha === undefined) return undefined;
  const owner = truncateToBytes(payload.repository.owner, HUMAN_HEADER_OWNER_MAX_BYTES);
  const name = truncateToBytes(payload.repository.name, HUMAN_HEADER_NAME_MAX_BYTES);
  const branch = truncateToBytes(payload.head.branch ?? "detached", HUMAN_HEADER_BRANCH_MAX_BYTES);
  return ` queue ready ${owner}/${name} @ ${branch} ${payload.head.sha.slice(0, 7)}`;
};

const humanCandidateLine = (candidate: QueueReadyCandidate): string =>
  `${candidate.rank}. ${candidate.workItemRef}  ${candidate.closeClass}  ${humanDetail(candidate)}  [repo:local-context; tier:priority-label]`;

const humanSummaryLine = (payload: QueueReadyPayload, dropped: boolean): string =>
  `ready ${payload.summary.ready} | not-ready ${payload.summary.notReady} | merge-ready ${payload.summary.mergeReady} | review-pending ${payload.summary.reviewPending} | unknown-close ${payload.summary.unknownClose}${payload.truncated || dropped ? "+more" : ""}`;

/**
 * Render the deterministic human digest from the payload and injected brand.
 *
 * Byte-aware and total over every legal payload: header fields and per-candidate
 * provider segments are capped by UTF-8 bytes, a candidate line is held to 400
 * bytes, and an over-bound digest drops trailing candidate lines in reverse
 * rank order (marking `+more`) instead of throwing. The drop is renderer-only:
 * the payload, its `truncated` flag, and `reasons` never change.
 */
export const renderQueueReadyHuman = (payload: QueueReadyPayload, brand: BrandIdentity): string => {
  const headerTail = humanHeaderTail(payload);
  const candidateLines = payload.candidates.map(humanCandidateLine);
  const compose = (binaryName: string, kept: readonly string[], dropped: boolean): string[] => {
    const lines: string[] = [];
    if (headerTail !== undefined) lines.push(`${binaryName}${headerTail}`);
    lines.push(humanSummaryLine(payload, dropped));
    lines.push(...kept);
    return lines;
  };
  const textOf = (lines: readonly string[]): string => `${lines.join("\n")}\n`;
  const violates = (lines: readonly string[], kept: number): boolean => {
    if (lines.length > QUEUE_READY_MAX_HUMAN_LINES) return true;
    if (utf8ByteLength(textOf(lines)) > QUEUE_READY_MAX_HUMAN_BYTES) return true;
    return lines
      .slice(lines.length - kept)
      .some((line) => utf8ByteLength(line) > HUMAN_CANDIDATE_LINE_MAX_BYTES);
  };

  let kept = candidateLines.slice();
  let dropped = false;
  let lines = compose(brand.binaryName, kept, dropped);
  while (kept.length > 0 && violates(lines, kept.length)) {
    kept = kept.slice(0, kept.length - 1);
    dropped = true;
    lines = compose(brand.binaryName, kept, dropped);
  }

  if (violates(lines, kept.length)) {
    // Only an over-long injected brand can reach here. Keep the header and
    // summary and shorten the binary-name token to the largest prefix that fits.
    dropped = true;
    const withoutBinaryName = textOf(compose("", kept, dropped));
    const allowed = QUEUE_READY_MAX_HUMAN_BYTES - utf8ByteLength(withoutBinaryName);
    const binaryName = allowed > 0 ? truncateToBytes(brand.binaryName, allowed) : "";
    lines = compose(binaryName, kept, dropped);
  }

  return textOf(lines);
};
