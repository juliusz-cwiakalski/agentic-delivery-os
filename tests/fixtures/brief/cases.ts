/**
 * The shared brief fact cases (test-plan §4.7, §4.4, §4.5).
 *
 * Each case states only the facts it changes over the fully observed base.
 * The expected surface map is derived from the digest over the same facts for
 * the six digest surfaces and from the closed catalog for the three
 * placeholders, so it is independent of the brief projection under test.
 */
import {
  BRIEF_SURFACE_ORDER,
  type BriefSurfaceState,
  type StatusFacts,
} from "../../../packages/core/src/contracts/index";
import { aggregateStatus } from "../../../packages/core/src/domain/index";
import { matrixCases } from "../status/matrix/cases";
import {
  baseFacts,
  capSizedFacts,
  deliveryRequestRead,
  failedDeliveryRequestRead,
  failedPipelineRunRead,
  failedWorkItemRead,
  localContext,
  makeDeliveryRequest,
  makeWorkItem,
  missingLocalContext,
  REVIEWS_AVAILABLE,
  REVIEWS_UNAVAILABLE,
  workItemRead,
} from "./harness";

export type BriefCase = {
  readonly name: string;
  readonly facts: StatusFacts;
  readonly expected: {
    readonly surfaces: Readonly<Record<string, BriefSurfaceState>>;
  };
};

export const expectedSurfaces = (
  facts: StatusFacts,
): Readonly<Record<string, BriefSurfaceState>> => {
  const digest = aggregateStatus(facts);
  const states: Record<string, BriefSurfaceState> = {};
  for (const id of BRIEF_SURFACE_ORDER) {
    const section = digest.sections.find((entry) => entry.id === id);
    states[id] = section === undefined ? "not-delivered" : section.state;
  }
  return states;
};

const caseOf = (name: string, facts: StatusFacts): BriefCase => ({
  name,
  facts,
  expected: { surfaces: expectedSurfaces(facts) },
});

const handBack = (entityId: string, updatedAt?: string): ReturnType<typeof makeWorkItem> =>
  makeWorkItem({
    entityId,
    title: `Hand back ${entityId}`,
    labels: ["hand-back"],
    ...(updatedAt === undefined ? {} : { updatedAt }),
  });

const approvedPullRequests = (count: number) =>
  deliveryRequestRead(
    Array.from({ length: count }, (_, index) =>
      makeDeliveryRequest({ entityId: String(500 + index), reviewState: "approved" }),
    ),
    REVIEWS_AVAILABLE,
  );

export const briefCases: readonly BriefCase[] = [
  caseOf("fully-observed", baseFacts()),
  caseOf("verified-empty", baseFacts({ changes: deliveryRequestRead([]) })),
  caseOf("cap-sized", capSizedFacts()),
  caseOf(
    "failed-everything",
    baseFacts({
      tracker: failedWorkItemRead("credential-unavailable"),
      changes: failedDeliveryRequestRead("credential-unavailable"),
      ci: failedPipelineRunRead("credential-unavailable"),
      localContext: missingLocalContext(),
    }),
  ),
  caseOf("ready-approved", baseFacts({ changes: approvedPullRequests(2) })),
  caseOf(
    "ready-unknown-review",
    baseFacts({
      changes: deliveryRequestRead(
        [makeDeliveryRequest({ entityId: "501", reviewState: "approved" })],
        REVIEWS_UNAVAILABLE,
      ),
    }),
  ),
  caseOf("ready-cap-dropped", baseFacts({ changes: approvedPullRequests(9) })),
  caseOf(
    "owner-ages",
    baseFacts({
      tracker: workItemRead([
        handBack("GH-101", "2026-10-30T00:00:00Z"),
        handBack("GH-102"),
        handBack("GH-103", "not-a-date"),
        handBack("GH-104", "2026-12-01T00:00:00Z"),
      ]),
    }),
  ),
  caseOf(
    "owner-cap-omitted",
    baseFacts({
      tracker: workItemRead([
        handBack("GH-201", "2026-10-30T00:00:00Z"),
        handBack("GH-202", "2026-10-29T00:00:00Z"),
        handBack("GH-203", "2026-10-28T00:00:00Z"),
        handBack("GH-204", "2026-10-27T00:00:00Z"),
        handBack("GH-205", "2026-10-26T00:00:00Z"),
        handBack("GH-206", "2026-10-25T00:00:00Z"),
      ]),
    }),
  ),
  caseOf("owner-family-unavailable", baseFacts({ tracker: failedWorkItemRead("read-failed") })),
  caseOf("source-at-limit", baseFacts({ changes: approvedPullRequests(100) })),
  caseOf(
    "anonymous-guard",
    baseFacts({
      tracker: failedWorkItemRead("credential-unavailable"),
      changes: failedDeliveryRequestRead("credential-unavailable"),
      ci: failedPipelineRunRead("credential-unavailable"),
      localContext: localContext({}),
    }),
  ),
  ...matrixCases.map((entry) => caseOf(`matrix-${entry.name}`, entry.facts)),
];
