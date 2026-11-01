/**
 * Explicit corpus cases that are not already covered by the shared matrices.
 * Every entry carries an exact expected verdict.
 */
import type {
  QueueReadyCloseClass,
  QueueReadyConditionState,
} from "../../../../packages/core/src/contracts/index";
import {
  baseFacts,
  blockedBy,
  deliveryRequestRead,
  failedDeliveryRequestRead,
  job,
  makeDeliveryRequest,
  makePipelineRun,
  makeWorkItem,
  missingLocalContext,
  pipelineRunRead,
  providerConfigFailed,
  providers,
  REVIEWS_AVAILABLE,
  REVIEWS_UNAVAILABLE,
  workItemRead,
} from "../harness";
import { REF_64 } from "../refs/cases";

export type CorpusExpectation = {
  readonly ref: string;
  readonly states: readonly QueueReadyConditionState[];
  readonly ready: boolean;
  readonly closeClass: QueueReadyCloseClass;
  readonly rank: number;
  readonly association?: "associated" | "not-associated" | "unknown";
  readonly closeReason?: string;
  readonly associatedCount?: number;
  readonly candidateTruncated?: boolean;
  readonly payloadTruncated?: boolean;
  readonly reasons?: readonly string[];
};

export type ExtraCorpusCase = {
  readonly name: string;
  readonly facts: ReturnType<typeof baseFacts>;
  readonly expected: readonly CorpusExpectation[];
  readonly tags: readonly string[];
};

const item = (entityId: string, extra: Partial<Parameters<typeof makeWorkItem>[0]> = {}) =>
  makeWorkItem({ entityId, labels: ["priority:high"], ...extra });

const S: QueueReadyConditionState = "satisfied";
const U: QueueReadyConditionState = "unsatisfied";
const Q: QueueReadyConditionState = "unknown";

const allSatisfied: readonly QueueReadyConditionState[] = [S, S, S, S, S, S];

const long = (char: string, length = 200) => char.repeat(length);

export const extraCorpusCases: readonly ExtraCorpusCase[] = [
  {
    name: "ref-length-max-64",
    facts: baseFacts({
      candidates: [REF_64],
      tracker: workItemRead([item(REF_64)]),
    }),
    expected: [
      {
        ref: REF_64,
        states: allSatisfied,
        ready: true,
        closeClass: "new-start",
        rank: 1,
        association: "not-associated",
        closeReason: "pr-not-associated",
        associatedCount: 0,
      },
    ],
    tags: ["ref-cap", "appendix-g:new-start"],
  },
  {
    name: "ready-unknown-association",
    facts: baseFacts({
      tracker: workItemRead([item("176")]),
      changes: failedDeliveryRequestRead("read-failed"),
    }),
    expected: [
      {
        ref: "GH-176",
        states: allSatisfied,
        ready: true,
        closeClass: "unknown",
        rank: 1,
        association: "unknown",
        closeReason: "pr-association-unknown",
        payloadTruncated: false,
      },
    ],
    tags: ["close:unknown", "appendix-g:ready-unknown-association"],
  },
  {
    name: "all-unknown-degraded",
    facts: baseFacts({
      repository: {
        binding: { state: "unavailable", reason: "addressing-unresolved" },
        head: { branch: "x", detached: false },
      },
      tracker: { ok: false, reason: "not-configured" },
      changes: { ok: false, reason: "not-configured" },
      ci: { ok: false, reason: "not-configured" },
      providers: providers({
        config: providerConfigFailed("config-invalid"),
        parks: { ok: false, reason: "state-unreadable" },
      }),
      localContext: {
        ok: true,
        context: { path: ".ai/local/pm-context.yaml", tracked: false, parkedChanges: [] },
      },
    }),
    expected: [
      {
        ref: "GH-176",
        states: [Q, S, Q, Q, Q, Q],
        ready: false,
        closeClass: "not-ready",
        rank: 1,
        association: "unknown",
        closeReason: "pr-association-unknown",
        payloadTruncated: false,
      },
    ],
    tags: ["source-failure:issues", "source-failure:binding", "appendix-g:all-unknown"],
  },
  {
    name: "at-limit-pr-no-match",
    facts: baseFacts({
      tracker: workItemRead([item("176")]),
      changes: deliveryRequestRead(
        Array.from({ length: 100 }, (_, index) =>
          makeDeliveryRequest({ entityId: String(index + 1), sourceRef: `feat/other-${index}/x` }),
        ),
        REVIEWS_UNAVAILABLE,
        100,
      ),
    }),
    expected: [
      {
        ref: "GH-176",
        states: allSatisfied,
        ready: true,
        closeClass: "unknown",
        rank: 1,
        association: "unknown",
        closeReason: "pr-association-unknown",
        candidateTruncated: false,
        payloadTruncated: true,
        reasons: ["source-truncated", "pr-association-unknown"],
      },
    ],
    tags: ["at-limit:pulls", "close:unknown"],
  },
  {
    name: "source-truncated-issues",
    facts: baseFacts({ tracker: workItemRead([item("176")], undefined, 100) }),
    expected: [
      {
        ref: "GH-176",
        states: allSatisfied,
        ready: true,
        closeClass: "new-start",
        rank: 1,
        candidateTruncated: false,
        payloadTruncated: true,
        reasons: ["source-truncated"],
      },
    ],
    tags: ["at-limit:issues"],
  },
  {
    name: "reasons-cap-7",
    facts: baseFacts({
      tracker: workItemRead(
        [item("176", { labels: ["priority:high", long("x")] })],
        {
          ownerHandBacks: "unavailable",
          blockedDependencies: "available",
          stalls: "available",
          hygiene: "available",
        },
        100,
      ),
      changes: failedDeliveryRequestRead("read-failed"),
      providers: providers({
        config: providerConfigFailed("config-invalid"),
        parks: { ok: false, reason: "state-unreadable" },
      }),
      localContext: missingLocalContext(),
    }),
    expected: [
      {
        ref: "GH-176",
        states: [S, Q, Q, Q, S, Q],
        ready: false,
        closeClass: "not-ready",
        rank: 1,
        payloadTruncated: true,
        reasons: [
          "source-truncated",
          "value-clamped",
          "config-invalid",
          "state-unreadable",
          "local-context-missing",
          "signal-unavailable",
        ],
      },
    ],
    tags: ["reason-cap", "value-clamped", "at-limit:issues"],
  },
  {
    name: "detail-clamp",
    facts: baseFacts({
      tracker: workItemRead([item("176")]),
      localContext: {
        ok: true,
        context: {
          path: ".ai/local/pm-context.yaml",
          tracked: false,
          activeChange: { workItemRef: `GH-${"9".repeat(300)}` },
          parkedChanges: [],
        },
      },
    }),
    expected: [
      {
        ref: "GH-176",
        states: [S, U, S, S, S, S],
        ready: false,
        closeClass: "not-ready",
        rank: 1,
        candidateTruncated: false,
        payloadTruncated: false,
      },
    ],
    tags: ["detail-clamp"],
  },
  {
    name: "secret-canary",
    facts: baseFacts({
      tracker: workItemRead([
        makeWorkItem({
          entityId: "176",
          title: "planted-queue-ready-secret-canary",
          labels: ["priority:high"],
        }),
      ]),
      localContext: {
        ok: true,
        context: {
          path: ".ai/local/pm-context.yaml",
          tracked: false,
          activeChange: { workItemRef: "GH-176" },
          parkedChanges: [],
        },
      },
    }),
    expected: [
      {
        ref: "GH-176",
        states: allSatisfied,
        ready: true,
        closeClass: "new-start",
        rank: 1,
      },
    ],
    tags: ["secret-canary"],
  },
  {
    name: "cap-sized-8",
    facts: baseFacts({
      candidates: Array.from({ length: 8 }, (_, index) => `GH-${index + 1}`),
      tracker: workItemRead(Array.from({ length: 8 }, (_, index) => item(String(index + 1)))),
    }),
    expected: Array.from({ length: 8 }, (_, index) => ({
      ref: `GH-${index + 1}`,
      states: allSatisfied,
      ready: true,
      closeClass: "new-start" as const,
      rank: index + 1,
    })),
    tags: ["candidate-cap"],
  },
  {
    name: "ranking-numeric-ties",
    facts: baseFacts({
      candidates: ["GH-9", "GH-10", "GH-100", "GH-7", "GH-007"],
      tracker: workItemRead(["9", "10", "100", "7", "007"].map((entityId) => item(entityId))),
    }),
    expected: [
      { ref: "GH-007", states: allSatisfied, ready: true, closeClass: "new-start", rank: 1 },
      { ref: "GH-7", states: allSatisfied, ready: true, closeClass: "new-start", rank: 2 },
      { ref: "GH-9", states: allSatisfied, ready: true, closeClass: "new-start", rank: 3 },
      { ref: "GH-10", states: allSatisfied, ready: true, closeClass: "new-start", rank: 4 },
      { ref: "GH-100", states: allSatisfied, ready: true, closeClass: "new-start", rank: 5 },
    ],
    tags: ["ranking"],
  },
  {
    name: "canonical-leading-zeros",
    facts: baseFacts({
      candidates: ["gh-176", "gh-007", "GH-7"],
      tracker: workItemRead([item("176"), item("007"), item("7")]),
    }),
    expected: [
      { ref: "GH-007", states: allSatisfied, ready: true, closeClass: "new-start", rank: 1 },
      { ref: "GH-7", states: allSatisfied, ready: true, closeClass: "new-start", rank: 2 },
      { ref: "GH-176", states: allSatisfied, ready: true, closeClass: "new-start", rank: 3 },
    ],
    tags: ["canonical"],
  },
  {
    name: "provider-over-cap-fields",
    facts: baseFacts({
      repository: {
        binding: {
          state: "observed",
          host: "github.com",
          owner: long("o"),
          name: long("n"),
          remoteName: "origin",
        },
        head: { branch: long("b", 300), sha: "b31ec47", detached: false },
      },
      tracker: workItemRead([
        makeWorkItem({
          entityId: "176",
          labels: [
            "priority:high",
            ...Array.from({ length: 19 }, (_, index) => `${long("l")}${index}`),
          ],
          relations: Array.from({ length: 20 }, (_, index) => ({
            relationKind: "blocked-by" as const,
            target: { systemName: long("s"), entityId: `${long("9")}${index}` },
          })),
          updatedAt: long("u", 60),
        }),
      ]),
      changes: deliveryRequestRead(
        Array.from({ length: 3 }, (_, index) =>
          makeDeliveryRequest({
            entityId: long("8"),
            systemName: long("s"),
            sourceRef: `feat/GH-176/${long("r")}`,
            targetRef: long("t"),
          }),
        ),
        REVIEWS_UNAVAILABLE,
      ),
    }),
    expected: [
      {
        ref: "GH-176",
        states: [Q, S, S, S, S, S],
        ready: false,
        closeClass: "review-pending",
        rank: 1,
        associatedCount: 3,
        candidateTruncated: false,
        payloadTruncated: true,
        reasons: ["value-clamped"],
      },
    ],
    tags: ["provider-cap-overflow"],
  },
  {
    name: "close-selected-merge-ready",
    facts: baseFacts({
      tracker: workItemRead([item("176")]),
      changes: deliveryRequestRead(
        [
          makeDeliveryRequest({ entityId: "201", sourceRef: "feat/GH-176/a", reviewState: "open" }),
          makeDeliveryRequest({
            entityId: "202",
            sourceRef: "feat/GH-176/b",
            reviewState: "approved",
          }),
        ],
        { ...REVIEWS_AVAILABLE, reviewThreads: "unavailable" },
      ),
    }),
    expected: [
      {
        ref: "GH-176",
        states: allSatisfied,
        ready: true,
        closeClass: "merge-ready",
        rank: 1,
        association: "associated",
        closeReason: "pr-associated",
        associatedCount: 2,
      },
    ],
    tags: ["close:merge-ready"],
  },
  {
    name: "close-associated-count-three",
    facts: baseFacts({
      tracker: workItemRead([item("176")]),
      changes: deliveryRequestRead(
        [
          makeDeliveryRequest({ entityId: "1", sourceRef: "feat/GH-176/a" }),
          makeDeliveryRequest({ entityId: "2", sourceRef: "feat/GH-176/b" }),
          makeDeliveryRequest({ entityId: "3", sourceRef: "feat/GH-176/c" }),
          makeDeliveryRequest({ entityId: "4", sourceRef: "feat/GH-176/d", reviewState: "merged" }),
        ],
        REVIEWS_UNAVAILABLE,
      ),
    }),
    expected: [
      {
        ref: "GH-176",
        states: allSatisfied,
        ready: true,
        closeClass: "review-pending",
        rank: 1,
        association: "associated",
        closeReason: "pr-associated",
        associatedCount: 3,
      },
    ],
    tags: ["close:review-pending", "associated-count"],
  },
  {
    name: "not-ready-ci-at-limit-neutral",
    facts: baseFacts({
      tracker: workItemRead([item("176")]),
      ci: pipelineRunRead(
        [
          makePipelineRun({ entityId: "1", jobs: [job("build", "succeeded")] }),
          ...Array.from({ length: 19 }, (_, index) =>
            makePipelineRun({ entityId: String(index + 2), jobs: [job("build", "skipped")] }),
          ),
        ],
        20,
      ),
    }),
    expected: [
      {
        ref: "GH-176",
        states: allSatisfied,
        ready: true,
        closeClass: "new-start",
        rank: 1,
        candidateTruncated: false,
        payloadTruncated: true,
        reasons: ["source-truncated"],
      },
    ],
    tags: ["at-limit:ci"],
  },
  {
    name: "provider-over-cap-byte-budget",
    facts: baseFacts({
      tracker: workItemRead([
        makeWorkItem({
          entityId: "176",
          labels: ["priority:high", ...Array.from({ length: 19 }, (_, index) => long("l") + index)],
          relations: Array.from({ length: 20 }, (_, index) => ({
            relationKind: "blocked-by" as const,
            target: { systemName: long("s"), entityId: long("9") + index },
          })),
          updatedAt: long("u", 60),
        }),
      ]),
    }),
    expected: [
      {
        ref: "GH-176",
        states: [Q, S, S, S, S, S],
        ready: false,
        closeClass: "not-ready",
        rank: 1,
        payloadTruncated: true,
        reasons: ["value-clamped"],
      },
    ],
    tags: ["provider-cap-byte-budget"],
  },
  {
    name: "not-ready-provider-unresolved",
    facts: baseFacts({
      tracker: workItemRead([item("176")]),
      providers: providers({
        config: providerConfigFailed("provider-chain-unresolved", "config.value.invalid"),
      }),
    }),
    expected: [
      {
        ref: "GH-176",
        states: [S, S, S, S, S, Q],
        ready: false,
        closeClass: "not-ready",
        rank: 1,
        reasons: ["provider-chain-unresolved"],
      },
    ],
    tags: ["source-failure:chain-unresolved", "provider-cap-row"],
  },
];

export const extraCorpusCaseNames = extraCorpusCases.map((entry) => entry.name);
