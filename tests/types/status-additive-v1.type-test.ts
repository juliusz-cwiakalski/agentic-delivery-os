/**
 * TC-ATT-003 backward-compatibility type probe — a pre-change consumer reading
 * only sections 1-6 and their pre-change fields still compiles against the
 * extended `delivery.status.v1` contract (DEC-16 additive-only).
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it; root `typecheck`
 * compiles it through `tests/types/tsconfig.json`.
 */
import type {
  StatusDigest,
  StatusFinding,
  StatusHygieneAssertion,
  StatusParkedWorkItem,
  StatusReadyItem,
  StatusReadyToMergeState,
  StatusSection,
  StatusTrackerItem,
} from "../../packages/core/src/contracts";

type Assert<T extends true> = T;

/** The ready-to-merge derivation row never admits `not-delivered` (Appendix C). */
export type ReadyNeverNotDelivered = Assert<
  "not-delivered" extends StatusReadyToMergeState ? false : true
>;

/** The pre-change consumer reads only the shipped six sections and fields. */
export const consumeShippedSections = (digest: StatusDigest): number => {
  let count = 0;
  for (const section of digest.sections) {
    switch (section.id) {
      case "tracker":
        count += (section.families ?? []).length;
        break;
      case "changes-and-prs":
        count += (section.pullRequests ?? []).length;
        break;
      case "ci":
        count += (section.runs ?? []).length;
        break;
      case "lanes-or-queue":
        count += (section.items ?? []).length;
        break;
      case "providers":
        count += (section.entries ?? []).length + (section.parks ?? []).length;
        break;
      case "parked-work":
        count += (section.items ?? []).length;
        break;
      default:
        break;
    }
    count += section.counts.total;
    void section.state;
    void section.evidence;
    void section.truncated;
  }
  return count;
};

/** The additive fields are optional, readonly, and never required on sections 1-6. */
const shippedSection: StatusSection = {
  id: "tracker",
  title: "Tracker",
  state: "observed",
  evidence: { sources: [], reasons: ["observed"] },
  counts: { observed: 0, unknown: 0, total: 0, omitted: 0 },
  truncated: false,
};

export const withoutFindings: StatusSection = shippedSection;

export const withOptionalFindings: StatusSection = {
  ...shippedSection,
  findings: [
    {
      code: "ci.red-on-main",
      severity: "high",
      count: 1,
      members: ["run-1"],
      evidenceRef: "run-1",
    } satisfies StatusFinding,
  ],
};

export const handBackAdditive: StatusTrackerItem = {
  workItemRef: "GH-1",
  title: "Hand back",
  family: "ownerHandBacks",
  itemState: "observed",
  age: 93_600_000,
  ageUnknownReason: "activity-timestamp-absent",
  slaState: "escalated",
};

export const hygieneAssertions: readonly StatusHygieneAssertion[] = [
  { assertion: "epic-membership", violations: 0, unknown: 0, satisfied: 1 },
];

export const parkedWithCondition: StatusParkedWorkItem = {
  workItemRef: "GH-2",
  itemState: "observed",
  condition: "waiting for review",
};

export const readyItem: StatusReadyItem = {
  ref: "501",
  class: "merge-ready",
  sourceRef: "feat/GH-501/x",
  targetRef: "main-tools",
  reviewState: "observed",
  ciResult: "succeeded",
};

// @ts-expect-error reason: a ready item class is the closed two-value set
export const invalidReadyClass: StatusReadyItem = { ...readyItem, class: "ready" };

// @ts-expect-error reason: findings are optional but, when present, must be the declared shape
export const invalidFinding: StatusSection = { ...shippedSection, findings: [{ severity: "low" }] };

export type Probes = [
  typeof withoutFindings,
  typeof withOptionalFindings,
  typeof handBackAdditive,
  typeof hygieneAssertions,
  typeof parkedWithCondition,
  typeof readyItem,
  typeof invalidReadyClass,
  typeof invalidFinding,
  typeof consumeShippedSections,
];
