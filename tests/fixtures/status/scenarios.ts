/**
 * Shared corpus scenario facts (TC-ATT-033). Every corpus case name maps to one
 * deterministic, in-process fact set; no scenario reads the clock, network, or
 * live tree.
 */
import type { StatusFacts } from "../../../packages/core/src/contracts/index";
import {
  ALL_AVAILABLE,
  ASSERTIONS_AVAILABLE,
  activeChange,
  allCapsFacts,
  baseFacts,
  blockersUnreadable,
  capSizedFacts,
  deliveryRequestRead,
  failedDeliveryRequestRead,
  failedPipelineRunRead,
  failedSpend,
  failedRun,
  failedWorkItemRead,
  GITHUB_SLICE_AVAILABILITY,
  localContext,
  makeDeliveryRequest,
  makeWorkItem,
  malformedLocalContext,
  missingLocalContext,
  parkView,
  pipelineRunRead,
  primaryRepository,
  providerConfig,
  providerConfigRead,
  providers,
  REVIEWS_AVAILABLE,
  REVIEWS_UNAVAILABLE,
  repository,
  unavailableBinding,
  workItemRead,
} from "./harness";

const noChain = () =>
  providerConfigRead(providerConfig({ defaultChain: undefined, chains: {}, entries: {} }));

const unresolvedChain = () =>
  providerConfigRead(
    providerConfig({
      defaultChain: "ghost",
      entries: { primary: { name: "primary", class: "subscription", enabled: true } },
      chains: {
        primary: { name: "primary", entries: ["primary"], allowPaidFallback: false },
      },
    }),
  );

export const corpusScenarios = [
  "fully-observed",
  "tracker-degraded-github",
  "failed-reads-degraded",
  "missing-context-unavailable",
  "active-park-observed",
  "missing-credential-unknown",
  "unresolved-sha-unknown",
  "unresolved-binding-unavailable",
  "torn-park-degraded",
  "unresolved-chain-unknown",
  "malformed-context-unknown",
  "changes-unknown-pr-failed",
  "four-red-runs-grouped",
  "ci-read-failed-no-finding",
  "hygiene-assertions-tri-state",
  "hygiene-absence-violation",
  "hygiene-satisfied-arm",
  "hygiene-all-unknown",
  "owner-gate-escalated-observed",
  "owner-gate-unknown-age-escalated",
  "parked-condition-present",
  "parked-stale-no-condition-grouped",
  "lanes-not-delivered-vocabulary",
  "placeholders-not-delivered",
  "blockers-unreadable-unknown",
  "mixed-attention-ranked",
  "owner-hold-active",
  "no-findings-attention-zero",
  "ready-merge-ready-ranked",
  "ready-review-unknown-degraded",
  "ready-read-failed-unknown",
  "all-caps-bound",
  "spend-read-failed",
] as const;

export type CorpusScenario = (typeof corpusScenarios)[number];

export const factsFor = (scenario: string): StatusFacts => {
  switch (scenario) {
    case "fully-observed":
      return capSizedFacts();
    case "spend-read-failed":
      return baseFacts({ spend: failedSpend() });
    case "owner-hold-active":
      return baseFacts({
        spend: failedSpend(),
        providers: providers({
          ownerHold: {
            active: true,
            source: "marker",
            reason: "peak-hour cost pause",
          },
        }),
      });
    case "tracker-degraded-github":
      return baseFacts({ tracker: workItemRead([], GITHUB_SLICE_AVAILABILITY) });
    case "failed-reads-degraded":
      return baseFacts({
        tracker: failedWorkItemRead("read-failed"),
        changes: failedDeliveryRequestRead("read-failed"),
        ci: failedPipelineRunRead("read-failed"),
        localContext: localContext({ activeChange: activeChange() }),
        providers: providers({ config: noChain() }),
      });
    case "missing-context-unavailable":
      return baseFacts({
        localContext: missingLocalContext(),
        providers: providers({ config: noChain() }),
      });
    case "active-park-observed":
      return baseFacts({
        providers: providers({
          config: providerConfigRead(providerConfig()),
          parks: { ok: true, parks: [parkView()] },
        }),
      });
    case "missing-credential-unknown":
      return baseFacts({
        tracker: failedWorkItemRead("credential-unavailable"),
        changes: failedDeliveryRequestRead("credential-unavailable"),
        ci: failedPipelineRunRead("credential-unavailable"),
        localContext: localContext({ activeChange: activeChange() }),
      });
    case "unresolved-sha-unknown":
      return baseFacts({ repository: repository({ head: { detached: true } }) });
    case "unresolved-binding-unavailable":
      return baseFacts({
        repository: repository({ binding: unavailableBinding() }),
        localContext: missingLocalContext(),
      });
    case "torn-park-degraded":
      return baseFacts({
        providers: providers({
          parks: { ok: false, reason: "state-unreadable", failureCode: "state.store.torn" },
        }),
      });
    case "unresolved-chain-unknown":
      return baseFacts({ providers: providers({ config: unresolvedChain() }) });
    case "malformed-context-unknown":
      return baseFacts({ localContext: malformedLocalContext() });
    case "changes-unknown-pr-failed":
      return baseFacts({
        changes: failedDeliveryRequestRead("read-failed"),
        localContext: missingLocalContext(),
      });
    case "four-red-runs-grouped":
      return baseFacts({
        repository: primaryRepository(),
        ci: pipelineRunRead([
          failedRun("700"),
          failedRun("701"),
          failedRun("702"),
          failedRun("703"),
        ]),
      });
    case "ci-read-failed-no-finding":
      return baseFacts({
        repository: primaryRepository(),
        ci: failedPipelineRunRead("read-failed"),
      });
    case "hygiene-assertions-tri-state":
      return baseFacts({
        tracker: workItemRead(
          [
            makeWorkItem({
              entityId: "1",
              title: "Missing title",
              labels: ["epic:x", "points:3"],
              milestone: "Sprint 1",
            }),
            makeWorkItem({
              entityId: "2",
              title: "No epic",
              labels: ["bug", "points:2"],
              milestone: "Sprint 1",
            }),
            makeWorkItem({
              entityId: "3",
              title: "No points",
              labels: ["epic:x"],
              milestone: "Sprint 1",
            }),
            makeWorkItem({ entityId: "4", title: "No sprint", labels: ["epic:x", "points:1"] }),
            makeWorkItem({
              entityId: "5",
              title: "All good",
              labels: ["epic", "points:0"],
              milestone: "Sprint 1",
            }),
            makeWorkItem({ entityId: "6", title: "Closed", labels: [], deliveryState: "done" }),
          ],
          ASSERTIONS_AVAILABLE,
        ),
      });
    case "hygiene-absence-violation":
      return baseFacts({
        tracker: workItemRead(
          [
            makeWorkItem({
              entityId: "1",
              title: "No epic",
              labels: ["points:1"],
              milestone: "Sprint 1",
            }),
            makeWorkItem({
              entityId: "2",
              title: "No points",
              labels: ["epic:x"],
              milestone: "Sprint 1",
            }),
            makeWorkItem({ entityId: "3", title: "No sprint", labels: ["epic:x", "points:1"] }),
            makeWorkItem({
              entityId: "4",
              title: "Conforming",
              labels: ["epic:x", "points:2"],
              milestone: "Sprint 1",
            }),
          ],
          ASSERTIONS_AVAILABLE,
        ),
      });
    case "hygiene-satisfied-arm":
      return baseFacts({
        tracker: workItemRead(
          [
            makeWorkItem({
              entityId: "1",
              title: "Epic token",
              labels: ["epic", "points:1"],
              milestone: "Sprint 1",
            }),
            makeWorkItem({
              entityId: "2",
              title: "Epic prefix",
              labels: ["epic:payments", "points:0"],
              milestone: "Sprint 1",
            }),
            makeWorkItem({
              entityId: "3",
              title: "Points",
              labels: ["epic:x", "points:42"],
              milestone: "Sprint 1",
            }),
          ],
          ASSERTIONS_AVAILABLE,
        ),
      });
    case "hygiene-all-unknown":
      return baseFacts({
        tracker: workItemRead(
          [
            makeWorkItem({
              entityId: "1",
              title: "No epic",
              labels: ["bug"],
              milestone: "Sprint 1",
            }),
            makeWorkItem({
              entityId: "2",
              title: "No points",
              labels: ["epic:x"],
              milestone: "Sprint 1",
            }),
          ],
          ALL_AVAILABLE,
        ),
      });
    case "owner-gate-escalated-observed":
      return baseFacts({
        tracker: workItemRead(
          [
            makeWorkItem({
              entityId: "GH-1",
              labels: ["hand-back", "epic:x", "points:1"],
              milestone: "Sprint 1",
              updatedAt: "2026-10-29T00:00:00Z",
            }),
          ],
          ALL_AVAILABLE,
        ),
      });
    case "owner-gate-unknown-age-escalated":
      return baseFacts({
        tracker: workItemRead(
          [makeWorkItem({ entityId: "GH-1", labels: ["hand-back"] })],
          ALL_AVAILABLE,
        ),
      });
    case "parked-condition-present":
      return baseFacts({
        localContext: localContext({
          parkedChanges: [
            {
              workItemRef: "GH-1",
              condition: "waiting for review",
              parkedAt: "2026-10-30T00:00:00Z",
            },
          ],
        }),
      });
    case "parked-stale-no-condition-grouped":
      return baseFacts({
        localContext: localContext({
          parkedChanges: [
            { workItemRef: "GH-1", reason: "waiting" },
            { workItemRef: "GH-2", reason: "waiting" },
            { branch: "feat/GH-3/x", changeFolder: "doc/GH-3", reason: "waiting" },
            { workItemRef: "GH-4", condition: "waiting for design" },
            { workItemRef: "GH-5", parkedAt: "2026-09-01T00:00:00Z", reason: "waiting" },
          ],
        }),
      });
    case "lanes-not-delivered-vocabulary":
    case "placeholders-not-delivered":
    case "no-findings-attention-zero":
      return baseFacts();
    case "blockers-unreadable-unknown":
      return baseFacts({ blockers: blockersUnreadable() });
    case "mixed-attention-ranked":
      return capSizedFacts();
    case "ready-merge-ready-ranked":
      return baseFacts({
        changes: deliveryRequestRead(
          [
            makeDeliveryRequest({ entityId: "501", reviewState: "approved" }),
            makeDeliveryRequest({ entityId: "502", reviewState: "open" }),
            makeDeliveryRequest({ entityId: "503", reviewState: "draft" }),
          ],
          REVIEWS_AVAILABLE,
        ),
      });
    case "ready-review-unknown-degraded":
      return baseFacts({
        changes: deliveryRequestRead(
          [
            makeDeliveryRequest({ entityId: "501", reviewState: "approved" }),
            makeDeliveryRequest({ entityId: "502", reviewState: "open" }),
          ],
          REVIEWS_UNAVAILABLE,
        ),
      });
    case "ready-read-failed-unknown":
      return baseFacts({
        changes: failedDeliveryRequestRead("read-failed"),
        localContext: missingLocalContext(),
      });
    case "all-caps-bound":
      return allCapsFacts();
    default:
      throw new Error(`unknown corpus scenario ${scenario}`);
  }
};
