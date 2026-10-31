/**
 * Appendix A derivation matrix cases (TC-STATUS-004).
 *
 * One case per required cell plus paired item-unknown/section-unknown twins.
 * Each case states only the facts it changes; `harness.baseFacts` supplies the
 * fully observed remainder.
 */
import type {
  StatusFacts,
  StatusSectionId,
  StatusSectionState,
} from "../../../../packages/core/src/contracts/index";
import {
  ALL_AVAILABLE,
  activeChange,
  baseFacts,
  blockedBy,
  deliveryRequestRead,
  failedDeliveryRequestRead,
  failedPipelineRunRead,
  failedWorkItemRead,
  GITHUB_SLICE_AVAILABILITY,
  localContext,
  makeDeliveryRequest,
  makePipelineRun,
  makeWorkItem,
  malformedLocalContext,
  missingLocalContext,
  NOW_MS,
  parkView,
  pipelineRunRead,
  providerConfig,
  providerConfigRead,
  providers,
  REVIEWS_UNAVAILABLE,
  repository,
  unavailableBinding,
  workItemRead,
} from "../harness";

export type MatrixExpectation = {
  readonly state: StatusSectionState;
  readonly reason?: string;
};

export type MatrixCase = {
  readonly name: string;
  readonly facts: StatusFacts;
  readonly expected: Partial<Record<StatusSectionId, MatrixExpectation>>;
};

const BRANCH_NAME = "feat/GH-175/parked";

export const matrixCases: readonly MatrixCase[] = [
  {
    name: "fully-observed",
    facts: baseFacts(),
    expected: {
      tracker: { state: "observed" },
      "changes-and-prs": { state: "observed" },
      ci: { state: "observed" },
      "lanes-or-queue": { state: "not-delivered" },
      providers: { state: "observed" },
      "parked-work": { state: "observed" },
    },
  },
  {
    name: "tracker-degraded-github-slice",
    facts: baseFacts({ tracker: workItemRead([], GITHUB_SLICE_AVAILABILITY) }),
    expected: {
      tracker: { state: "degraded", reason: "signal-unavailable" },
    },
  },
  {
    name: "tracker-unknown-read-failed",
    facts: baseFacts({ tracker: failedWorkItemRead("read-failed") }),
    expected: {
      tracker: { state: "unknown", reason: "read-failed" },
    },
  },
  {
    name: "tracker-unknown-credential-unavailable",
    facts: baseFacts({ tracker: failedWorkItemRead("credential-unavailable") }),
    expected: {
      tracker: { state: "unknown", reason: "credential-unavailable" },
    },
  },
  {
    name: "tracker-unavailable-no-binding",
    facts: baseFacts({ repository: repository({ binding: unavailableBinding() }) }),
    expected: {
      tracker: { state: "unavailable", reason: "addressing-unresolved" },
      ci: { state: "unavailable", reason: "addressing-unresolved" },
    },
  },
  {
    name: "tracker-item-unknown-stalls",
    facts: baseFacts({
      tracker: workItemRead([
        makeWorkItem({ entityId: "1", updatedAt: undefined }),
        makeWorkItem({ entityId: "2", updatedAt: "2026-10-01T00:00:00Z" }),
      ]),
    }),
    expected: {
      tracker: { state: "observed", reason: "item-signal-absent" },
    },
  },
  {
    name: "changes-degraded-pr-failed",
    facts: baseFacts({
      changes: failedDeliveryRequestRead(),
      localContext: localContext({ activeChange: activeChange() }),
    }),
    expected: {
      "changes-and-prs": { state: "degraded", reason: "partial-evidence" },
    },
  },
  {
    name: "changes-unknown-both-failed",
    facts: baseFacts({ changes: failedDeliveryRequestRead(), localContext: missingLocalContext() }),
    expected: {
      "changes-and-prs": { state: "unknown", reason: "local-context-missing" },
    },
  },
  {
    name: "changes-unavailable-no-binding-active-absent",
    facts: baseFacts({
      repository: repository({ binding: unavailableBinding() }),
      localContext: missingLocalContext(),
    }),
    expected: {
      "changes-and-prs": { state: "unavailable", reason: "addressing-unresolved" },
    },
  },
  {
    name: "changes-degraded-review-unavailable",
    facts: baseFacts({
      changes: deliveryRequestRead([makeDeliveryRequest({ entityId: "501" })], REVIEWS_UNAVAILABLE),
    }),
    expected: {
      "changes-and-prs": { state: "degraded", reason: "signal-unavailable" },
    },
  },
  {
    name: "changes-observed-active-empty",
    facts: baseFacts({ changes: deliveryRequestRead([]), localContext: localContext({}) }),
    expected: {
      "changes-and-prs": { state: "observed", reason: "observed-empty" },
    },
  },
  {
    name: "ci-unknown-sha-unresolved",
    facts: baseFacts({ repository: repository({ head: { detached: true } }) }),
    expected: {
      ci: { state: "unknown", reason: "commit-unresolved" },
    },
  },
  {
    name: "ci-unknown-read-failed",
    facts: baseFacts({ ci: failedPipelineRunRead("read-failed") }),
    expected: {
      ci: { state: "unknown", reason: "read-failed" },
    },
  },
  {
    name: "providers-degraded-park-failed",
    facts: baseFacts({
      providers: providers({
        parks: {
          ok: false,
          reason: "state-unreadable",
          failureCode: "state.store.torn",
        },
      }),
    }),
    expected: {
      providers: { state: "degraded", reason: "state-unreadable" },
    },
  },
  {
    name: "providers-unknown-config-invalid",
    facts: baseFacts({
      providers: providers({
        config: { ok: false, reason: "config-invalid", failureCode: "config.value.invalid" },
      }),
    }),
    expected: {
      providers: { state: "unknown", reason: "config-invalid" },
    },
  },
  {
    name: "providers-unknown-chain-unresolved",
    facts: baseFacts({
      providers: providers({
        config: {
          ok: false,
          reason: "provider-chain-unresolved",
          failureCode: "config.value.invalid",
        },
      }),
    }),
    expected: {
      providers: { state: "unknown", reason: "provider-chain-unresolved" },
    },
  },
  {
    name: "providers-unavailable-no-chain",
    facts: baseFacts({
      providers: providers({
        config: providerConfigRead(
          providerConfig({ defaultChain: undefined, chains: {}, entries: {} }),
        ),
      }),
    }),
    expected: {
      providers: { state: "unavailable", reason: "provider-chain-not-declared" },
    },
  },
  {
    name: "providers-observed-parked",
    facts: baseFacts({
      providers: providers({
        parks: { ok: true, parks: [parkView({ state: "active" })] },
      }),
    }),
    expected: {
      providers: { state: "observed" },
    },
  },
  {
    name: "parked-observed-empty",
    facts: baseFacts({ localContext: localContext({}) }),
    expected: {
      "parked-work": { state: "observed", reason: "observed-empty" },
    },
  },
  {
    name: "parked-unknown-malformed",
    facts: baseFacts({ localContext: malformedLocalContext() }),
    expected: {
      "parked-work": { state: "unknown", reason: "local-context-malformed" },
    },
  },
  {
    name: "parked-unavailable-missing",
    facts: baseFacts({ localContext: missingLocalContext() }),
    expected: {
      "parked-work": { state: "unavailable", reason: "local-context-missing" },
    },
  },
  {
    name: "parked-item-unknown-without-ref",
    facts: baseFacts({
      localContext: localContext({
        parkedChanges: [{ branch: BRANCH_NAME, reason: "waiting" }],
      }),
    }),
    expected: {
      "parked-work": { state: "observed", reason: "item-signal-absent" },
    },
  },
  {
    name: "tracker-blocked-observed-empty-jira",
    facts: baseFacts({
      tracker: workItemRead(
        [
          makeWorkItem({ entityId: "10", relations: [blockedBy("11")] }),
          makeWorkItem({ entityId: "11", deliveryState: "done" }),
        ],
        ALL_AVAILABLE,
      ),
    }),
    expected: {
      tracker: { state: "observed", reason: "observed-empty" },
    },
  },
  {
    name: "ci-observed-none-no-runs",
    facts: baseFacts({ ci: pipelineRunRead([]), nowMs: NOW_MS }),
    expected: {
      ci: { state: "observed", reason: "observed-empty" },
    },
  },
] as const;
