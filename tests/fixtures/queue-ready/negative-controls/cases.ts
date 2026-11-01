/**
 * The 22 AC-F14-1 negative controls (TC-QREADY-021).
 */
import type {
  QueueReadyCloseClass,
  QueueReadyConditionId,
  QueueReadyConditionState,
  QueueReadyReason,
} from "../../../../packages/core/src/contracts/index";
import {
  activeChange,
  baseFacts,
  type FactsOverrides,
  failedDeliveryRequestRead,
  failedPipelineRunRead,
  failedWorkItemRead,
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
  unavailableBinding,
  workItemRead,
} from "../harness";

export type NegativeControl = {
  readonly id: number;
  readonly name: string;
  readonly facts: FactsOverrides;
  readonly target:
    | {
        readonly kind: "condition";
        readonly id: QueueReadyConditionId;
        readonly state: QueueReadyConditionState;
        readonly reason: QueueReadyReason;
      }
    | { readonly kind: "close"; readonly reason: "pr-association-unknown" };
  readonly ready: boolean;
  readonly closeClass: QueueReadyCloseClass;
};

const canary = (id: number) => `planted-queue-ready-control-${id}`;
const item = (id: number, extra: Partial<Parameters<typeof makeWorkItem>[0]> = {}) =>
  makeWorkItem({ entityId: "176", labels: ["priority:high"], title: canary(id), ...extra });

const condition = (
  id: QueueReadyConditionId,
  state: QueueReadyConditionState,
  reason: QueueReadyReason,
) => ({ kind: "condition" as const, id, state, reason });

export const negativeControls: readonly NegativeControl[] = [
  {
    id: 1,
    name: "deps-relations-unavailable",
    facts: { tracker: workItemRead([item(1)], GITHUB_SLICE_AVAILABILITY) },
    target: condition("deps-satisfied", "unknown", "signal-unavailable"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 2,
    name: "candidate-unobserved",
    facts: { tracker: workItemRead([makeWorkItem({ entityId: "177", title: canary(2) })]) },
    target: condition("deps-satisfied", "unknown", "work-item-unobserved"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 3,
    name: "pm-context-missing",
    facts: { tracker: workItemRead([item(3)]), localContext: missingLocalContext() },
    target: condition("repo-free", "unknown", "local-context-missing"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 4,
    name: "pm-context-malformed",
    facts: { tracker: workItemRead([item(4)]), localContext: malformedLocalContext() },
    target: condition("repo-free", "unknown", "local-context-malformed"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 5,
    name: "other-active-change",
    facts: {
      tracker: workItemRead([item(5)]),
      localContext: localContext({ activeChange: activeChange() }),
    },
    target: condition("repo-free", "unsatisfied", "other-active-change"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 6,
    name: "tier-absent",
    facts: { tracker: workItemRead([item(6, { labels: [] })]) },
    target: condition("tier-known", "unknown", "tier-absent"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 7,
    name: "tier-conflict",
    facts: { tracker: workItemRead([item(7, { labels: ["priority:high", "priority:low"] })]) },
    target: condition("tier-known", "unsatisfied", "tier-conflict"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 8,
    name: "owner-label-present",
    facts: { tracker: workItemRead([item(8, { labels: ["priority:high", "hand-back"] })]) },
    target: condition("no-owner-gate", "unsatisfied", "owner-labels"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 9,
    name: "ci-none",
    facts: { tracker: workItemRead([item(9)]), ci: pipelineRunRead([]) },
    target: condition("ci-healthy", "unsatisfied", "ci-none"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 10,
    name: "ci-pending",
    facts: {
      tracker: workItemRead([item(10)]),
      ci: pipelineRunRead([makePipelineRun({ entityId: "1", jobs: [job("build", "running")] })]),
    },
    target: condition("ci-healthy", "unsatisfied", "ci-pending"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 11,
    name: "ci-canceled",
    facts: {
      tracker: workItemRead([item(11)]),
      ci: pipelineRunRead([makePipelineRun({ entityId: "1", jobs: [job("build", "canceled")] })]),
    },
    target: condition("ci-healthy", "unsatisfied", "ci-canceled"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 12,
    name: "ci-failed",
    facts: {
      tracker: workItemRead([item(12)]),
      ci: pipelineRunRead([makePipelineRun({ entityId: "1", jobs: [job("build", "failed")] })]),
    },
    target: condition("ci-healthy", "unsatisfied", "ci-failed"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 13,
    name: "unresolved-sha",
    facts: { tracker: workItemRead([item(13)]), repository: observedHeadWithoutSha() },
    target: condition("ci-healthy", "unknown", "commit-unresolved"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 14,
    name: "check-runs-read-failed",
    facts: { tracker: workItemRead([item(14)]), ci: failedPipelineRunRead("read-failed") },
    target: condition("ci-healthy", "unknown", "read-failed"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 15,
    name: "no-default-provider-chain",
    facts: {
      tracker: workItemRead([item(15)]),
      providers: providers({
        config: providerConfigRead(providerConfig({ defaultChain: undefined })),
      }),
    },
    target: condition("provider-available", "unknown", "provider-chain-not-declared"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 16,
    name: "unresolved-provider-chain",
    facts: {
      tracker: workItemRead([item(16)]),
      providers: providers({
        config: providerConfigFailed("provider-chain-unresolved", "config.value.invalid"),
      }),
    },
    target: condition("provider-available", "unknown", "provider-chain-unresolved"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 17,
    name: "provider-park-fold-failed",
    facts: {
      tracker: workItemRead([item(17)]),
      providers: providers({ parks: { ok: false, reason: "state-unreadable" } }),
    },
    target: condition("provider-available", "unknown", "state-unreadable"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 18,
    name: "active-provider-park",
    facts: {
      tracker: workItemRead([item(18)]),
      providers: providers({ parks: { ok: true, parks: [parkView()] } }),
    },
    target: condition("provider-available", "unsatisfied", "all-entries-parked"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 19,
    name: "active-chain-park",
    facts: {
      tracker: workItemRead([item(19)]),
      providers: providers({
        parks: {
          ok: true,
          parks: [
            parkView({ name: "chain:primary", subjectKind: "chain", subjectName: "primary" }),
          ],
        },
      }),
    },
    target: condition("provider-available", "unsatisfied", "chain-parked"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 20,
    name: "pr-read-failure",
    facts: { tracker: workItemRead([item(20)]), changes: failedDeliveryRequestRead("read-failed") },
    target: { kind: "close", reason: "pr-association-unknown" },
    ready: true,
    closeClass: "unknown",
  },
  {
    id: 21,
    name: "binding-unavailable",
    facts: {
      tracker: workItemRead([item(21)]),
      repository: { binding: unavailableBinding(), head: { branch: "x", detached: false } },
      changes: failedDeliveryRequestRead("read-failed"),
    },
    target: condition("ci-healthy", "unknown", "addressing-unresolved"),
    ready: false,
    closeClass: "not-ready",
  },
  {
    id: 22,
    name: "at-limit-pr-no-match",
    facts: {
      tracker: workItemRead([item(22)]),
      changes: {
        ok: true,
        items: Array.from({ length: 100 }, (_, index) => ({
          identity: { systemName: "github", entityId: String(index + 1) },
          sourceRef: `feat/other-${index}/x`,
          targetRef: "main-tools",
          reviewState: "open" as const,
          threads: [],
        })),
        pageItemCount: 100,
        availability: {
          state: "available",
          refs: "available",
          reviewState: "unavailable",
          reviewThreads: "unavailable",
        },
      },
    },
    target: { kind: "close", reason: "pr-association-unknown" },
    ready: true,
    closeClass: "unknown",
  },
];

export const negativeControlBaseFacts = baseFacts;
export const failedWorkItem = failedWorkItemRead;
