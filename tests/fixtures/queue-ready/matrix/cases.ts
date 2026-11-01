/**
 * The Appendix A condition-derivation matrix (GH-176 TC-QREADY-004).
 *
 * Every row observes the candidate through a provider-shaped identity (`"176"`
 * for `GH-176`) unless the row is explicitly about identity observation.
 */
import type {
  QueueReadyCloseClass,
  QueueReadyConditionId,
  QueueReadyConditionState,
  QueueReadyReason,
} from "../../../../packages/core/src/contracts/index";
import {
  ALL_AVAILABLE,
  activeChange,
  baseFacts,
  blockedBy,
  deliveryRequestRead,
  type FactsOverrides,
  failedPipelineRunRead,
  GITHUB_SLICE_AVAILABILITY,
  job,
  localContext,
  makePipelineRun,
  makeWorkItem,
  malformedLocalContext,
  missingLocalContext,
  observedHeadWithoutSha,
  parkView,
  pipelineRunRead,
  providerConfig,
  providerConfigFailed,
  providerConfigRead,
  providers,
  workItemRead,
} from "../harness";

export type MatrixCase = {
  readonly name: string;
  readonly facts: FactsOverrides;
  readonly states: readonly QueueReadyConditionState[];
  readonly reasons: readonly QueueReadyReason[];
  readonly ready: boolean;
  readonly closeClass?: QueueReadyCloseClass;
  readonly details?: Readonly<Record<QueueReadyConditionId, string>>;
};

const observed = (
  extra: readonly ReturnType<typeof makeWorkItem>[] = [],
  labels: readonly string[] = ["priority:high"],
  availability = ALL_AVAILABLE,
) => workItemRead([makeWorkItem({ entityId: "176", labels }), ...extra], availability);

const depsTarget = (
  targetId: string,
  deliveryState: "done" | "canceled" | "in-progress" | "ready",
  labels: readonly string[] = ["priority:high"],
) =>
  workItemRead([
    makeWorkItem({
      entityId: "176",
      labels,
      relations: [blockedBy(targetId)],
    }),
    makeWorkItem({ entityId: targetId, deliveryState }),
  ]);

export const matrixCases: readonly MatrixCase[] = [
  {
    name: "all-satisfied",
    facts: { tracker: observed(), changes: deliveryRequestRead([]) },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "satisfied", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "no-active-park",
    ],
    details: {
      "repo-free": "repo:local-context",
      "tier-known": "tier:priority-label; label:priority:high",
    },
    ready: true,
    closeClass: "new-start",
  },
  {
    name: "deps-done",
    facts: { tracker: depsTarget("179", "done") },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "satisfied", "satisfied"],
    reasons: [
      "dependencies-done",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "no-active-park",
    ],
    details: { "deps-satisfied": "done:1; open:0; unknown:0" },
    ready: true,
  },
  {
    name: "deps-canceled",
    facts: { tracker: depsTarget("179", "canceled") },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "satisfied", "satisfied"],
    reasons: [
      "dependencies-done",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "no-active-park",
    ],
    details: { "deps-satisfied": "done:1; open:0; unknown:0" },
    ready: true,
  },
  {
    name: "deps-open",
    facts: { tracker: depsTarget("179", "in-progress") },
    states: ["unsatisfied", "satisfied", "satisfied", "satisfied", "satisfied", "satisfied"],
    reasons: [
      "dependency-open",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "no-active-park",
    ],
    details: { "deps-satisfied": "done:0; open:1; unknown:0" },
    ready: false,
    closeClass: "not-ready",
  },
  {
    name: "deps-unobserved",
    facts: {
      tracker: workItemRead([
        makeWorkItem({
          entityId: "176",
          labels: ["priority:high"],
          relations: [blockedBy("999")],
        }),
      ]),
    },
    states: ["unknown", "satisfied", "satisfied", "satisfied", "satisfied", "satisfied"],
    reasons: [
      "dependency-unobserved",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "no-active-park",
    ],
    details: { "deps-satisfied": "done:0; open:0; unknown:1" },
    ready: false,
  },
  {
    name: "deps-unavailable",
    facts: { tracker: observed([], ["priority:high"], GITHUB_SLICE_AVAILABILITY) },
    states: ["unknown", "satisfied", "satisfied", "satisfied", "satisfied", "satisfied"],
    reasons: [
      "signal-unavailable",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "no-active-park",
    ],
    ready: false,
  },
  {
    name: "candidate-unobserved-first",
    facts: {
      tracker: workItemRead([makeWorkItem({ entityId: "177" })], GITHUB_SLICE_AVAILABILITY),
    },
    states: ["unknown", "satisfied", "unknown", "unknown", "satisfied", "satisfied"],
    reasons: [
      "work-item-unobserved",
      "no-active-change",
      "work-item-unobserved",
      "work-item-unobserved",
      "ci-succeeded",
      "no-active-park",
    ],
    ready: false,
  },
  {
    name: "repo-other-active",
    facts: { tracker: observed(), localContext: localContext({ activeChange: activeChange() }) },
    states: ["satisfied", "unsatisfied", "satisfied", "satisfied", "satisfied", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "other-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "no-active-park",
    ],
    details: { "repo-free": "repo:local-context; active-change:GH-175" },
    ready: false,
  },
  {
    name: "repo-candidate-active",
    facts: {
      tracker: observed(),
      localContext: localContext({ activeChange: activeChange({ workItemRef: "gh-176" }) }),
    },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "satisfied", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "candidate-is-active",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "no-active-park",
    ],
    details: { "repo-free": "repo:local-context; candidate-is-active" },
    ready: true,
  },
  {
    name: "repo-missing",
    facts: { tracker: observed(), localContext: missingLocalContext() },
    states: ["satisfied", "unknown", "satisfied", "satisfied", "satisfied", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "local-context-missing",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "no-active-park",
    ],
    ready: false,
  },
  {
    name: "repo-malformed",
    facts: { tracker: observed(), localContext: malformedLocalContext() },
    states: ["satisfied", "unknown", "satisfied", "satisfied", "satisfied", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "local-context-malformed",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "no-active-park",
    ],
    ready: false,
  },
  {
    name: "tier-medium",
    facts: { tracker: observed([], ["priority:medium"]) },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "satisfied", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "no-active-park",
    ],
    details: { "tier-known": "tier:priority-label; label:priority:medium" },
    ready: true,
  },
  {
    name: "tier-absent",
    facts: { tracker: observed([], []) },
    states: ["satisfied", "satisfied", "unknown", "satisfied", "satisfied", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-absent",
      "no-owner-labels",
      "ci-succeeded",
      "no-active-park",
    ],
    details: { "tier-known": "tier:priority-label; none" },
    ready: false,
  },
  {
    name: "tier-conflict",
    facts: { tracker: observed([], ["priority:high", "priority:low"]) },
    states: ["satisfied", "satisfied", "unsatisfied", "satisfied", "satisfied", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-conflict",
      "no-owner-labels",
      "ci-succeeded",
      "no-active-park",
    ],
    details: { "tier-known": "tier:priority-label; labels:priority:high,priority:low" },
    ready: false,
  },
  {
    name: "tier-signal-unavailable",
    facts: {
      tracker: workItemRead([makeWorkItem({ entityId: "176", labels: ["priority:high"] })], {
        ...GITHUB_SLICE_AVAILABILITY,
        blockedDependencies: "available",
        ownerHandBacks: "unavailable",
      }),
    },
    states: ["satisfied", "satisfied", "unknown", "unknown", "satisfied", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "signal-unavailable",
      "signal-unavailable",
      "ci-succeeded",
      "no-active-park",
    ],
    ready: false,
  },
  {
    name: "owner-gate",
    facts: { tracker: observed([], ["priority:high", "hand-back"]) },
    states: ["satisfied", "satisfied", "satisfied", "unsatisfied", "satisfied", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "owner-labels",
      "ci-succeeded",
      "no-active-park",
    ],
    details: { "no-owner-gate": "owner-labels:hand-back" },
    ready: false,
  },
  {
    name: "owner-gate-both",
    facts: { tracker: observed([], ["priority:high", "human-input-needed", "hand-back"]) },
    states: ["satisfied", "satisfied", "satisfied", "unsatisfied", "satisfied", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "owner-labels",
      "ci-succeeded",
      "no-active-park",
    ],
    details: { "no-owner-gate": "owner-labels:hand-back,human-input-needed" },
    ready: false,
  },
  {
    name: "ci-pending",
    facts: {
      tracker: observed(),
      ci: pipelineRunRead([makePipelineRun({ entityId: "1", jobs: [job("build", "running")] })]),
    },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "unsatisfied", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-pending",
      "no-active-park",
    ],
    details: { "ci-healthy": "result:pending" },
    ready: false,
  },
  {
    name: "ci-failed",
    facts: {
      tracker: observed(),
      ci: pipelineRunRead([makePipelineRun({ entityId: "1", jobs: [job("build", "failed")] })]),
    },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "unsatisfied", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-failed",
      "no-active-park",
    ],
    ready: false,
  },
  {
    name: "ci-canceled",
    facts: {
      tracker: observed(),
      ci: pipelineRunRead([makePipelineRun({ entityId: "1", jobs: [job("build", "canceled")] })]),
    },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "unsatisfied", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-canceled",
      "no-active-park",
    ],
    ready: false,
  },
  {
    name: "ci-none",
    facts: { tracker: observed(), ci: pipelineRunRead([]) },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "unsatisfied", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-none",
      "no-active-park",
    ],
    ready: false,
  },
  {
    name: "ci-all-skipped-is-none",
    facts: {
      tracker: observed(),
      ci: pipelineRunRead([makePipelineRun({ entityId: "1", jobs: [job("build", "skipped")] })]),
    },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "unsatisfied", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-none",
      "no-active-park",
    ],
    ready: false,
  },
  {
    name: "ci-unresolved-sha",
    facts: { tracker: observed(), repository: observedHeadWithoutSha() },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "unknown", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "commit-unresolved",
      "no-active-park",
    ],
    ready: false,
  },
  {
    name: "ci-read-failed",
    facts: { tracker: observed(), ci: failedPipelineRunRead("read-failed") },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "unknown", "satisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "read-failed",
      "no-active-park",
    ],
    details: { "ci-healthy": "failureClass:provider.payload.invalid" },
    ready: false,
  },
  {
    name: "provider-no-chain",
    facts: {
      tracker: observed(),
      providers: providers({
        config: providerConfigRead(providerConfig({ defaultChain: undefined })),
      }),
    },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "satisfied", "unknown"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "provider-chain-not-declared",
    ],
    ready: false,
  },
  {
    name: "provider-unresolved-defensive",
    facts: {
      tracker: observed(),
      providers: providers({
        config: providerConfigRead(providerConfig({ defaultChain: "missing" })),
      }),
    },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "satisfied", "unknown"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "provider-chain-unresolved",
    ],
    ready: false,
  },
  {
    name: "provider-config-invalid",
    facts: {
      tracker: observed(),
      providers: providers({
        config: providerConfigFailed("config-invalid", "config.value.invalid"),
      }),
    },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "satisfied", "unknown"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "config-invalid",
    ],
    details: { "provider-available": "failureCode:config.value.invalid" },
    ready: false,
  },
  {
    name: "provider-chain-unresolved-command",
    facts: {
      tracker: observed(),
      providers: providers({
        config: providerConfigFailed("provider-chain-unresolved", "config.value.invalid"),
      }),
    },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "satisfied", "unknown"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "provider-chain-unresolved",
    ],
    details: { "provider-available": "failureCode:config.value.invalid" },
    ready: false,
  },
  {
    name: "provider-park-fold-failed",
    facts: {
      tracker: observed(),
      providers: providers({
        parks: { ok: false, reason: "state-unreadable", failureCode: "state.store.torn" },
      }),
    },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "satisfied", "unknown"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "state-unreadable",
    ],
    details: { "provider-available": "failureCode:state.store.torn" },
    ready: false,
  },
  {
    name: "provider-no-enabled",
    facts: {
      tracker: observed(),
      providers: providers({
        config: providerConfigRead(
          providerConfig({
            entries: { primary: { name: "primary", class: "subscription", enabled: false } },
          }),
        ),
      }),
    },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "satisfied", "unsatisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "no-enabled-entry",
    ],
    details: { "provider-available": "chain:primary" },
    ready: false,
  },
  {
    name: "provider-all-parked",
    facts: {
      tracker: observed(),
      providers: providers({ parks: { ok: true, parks: [parkView()] } }),
    },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "satisfied", "unsatisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "all-entries-parked",
    ],
    details: { "provider-available": "chain:primary" },
    ready: false,
  },
  {
    name: "provider-chain-parked",
    facts: {
      tracker: observed(),
      providers: providers({
        parks: {
          ok: true,
          parks: [
            parkView({
              name: "chain:primary",
              subjectKind: "chain",
              subjectName: "primary",
              cause: "peak-window",
              expiresAt: "2026-11-01T06:00:00Z",
            }),
          ],
        },
      }),
    },
    states: ["satisfied", "satisfied", "satisfied", "satisfied", "satisfied", "unsatisfied"],
    reasons: [
      "no-blocked-dependencies",
      "no-active-change",
      "tier-label",
      "no-owner-labels",
      "ci-succeeded",
      "chain-parked",
    ],
    details: {
      "provider-available": "chain:primary; until:2026-11-01T06:00:00Z; cause:peak-window",
    },
    ready: false,
  },
  {
    name: "candidate-unobserved-empty-page",
    facts: { tracker: workItemRead([]) },
    states: ["unknown", "satisfied", "unknown", "unknown", "satisfied", "satisfied"],
    reasons: [
      "work-item-unobserved",
      "no-active-change",
      "work-item-unobserved",
      "work-item-unobserved",
      "ci-succeeded",
      "no-active-park",
    ],
    ready: false,
  },
];

export const baseMatrixFacts = baseFacts;
