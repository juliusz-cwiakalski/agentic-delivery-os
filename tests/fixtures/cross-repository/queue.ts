/**
 * The member queue world (GH-310 F-2, F-4, DM-6, DEC-2, DEC-21): a real edge
 * queue program over an injected state store with a declared two-member plan,
 * per-member repository bindings, and per-member scheduler facts. Nothing
 * reaches the network; the member identities come from the shared cross-repository
 * fixture constants and, when a case needs real checkouts, from two-members.ts.
 */

import type { PlanMemberDeclaration } from "../../../packages/core/src/contracts/index";
import type {
  QueuePlanFact,
  QueueWorkItemFact,
} from "../../../packages/core/src/domain/queue-readiness";
import { createQueueEdgeHarness, type QueueEdgeHarness } from "../queue/cli/harness";
import { ciSucceeded, observed } from "../queue/schedule/harness";
import { API_MEMBER, CHANGE_REF, memberRef, WEB_MEMBER } from "./constants";

/** The declared member plan this fixture feeds the queue composition. */
export const memberDeclarations: readonly PlanMemberDeclaration[] = [
  {
    repoKey: API_MEMBER.repoKey,
    slice: API_MEMBER.slice,
    branch: API_MEMBER.branch,
    pullRequest: API_MEMBER.pullRequest,
    dependsOn: [],
    gates: ["ci-green", "push-parity"],
  },
  {
    repoKey: WEB_MEMBER.repoKey,
    slice: WEB_MEMBER.slice,
    branch: WEB_MEMBER.branch,
    pullRequest: WEB_MEMBER.pullRequest,
    dependsOn: [API_MEMBER.repoKey],
    gates: ["ci-green", "push-parity"],
  },
];

/** The two member refs in declared order. */
export const MEMBER_REFS = {
  api: memberRef(API_MEMBER.repoKey),
  web: memberRef(WEB_MEMBER.repoKey),
} as const;

type MutableFacts = {
  plans: Record<string, QueuePlanFact>;
  workItems: Record<string, QueueWorkItemFact>;
  ci: Record<string, unknown>;
  close: Record<string, unknown>;
};

/** Seed one observed member fact set for both member refs. */
const seedMemberFacts = (
  harness: QueueEdgeHarness,
  input: {
    readonly apiDeliveryState?: "ready" | "done" | "canceled";
    readonly withPlanFacts?: boolean;
  } = {},
): void => {
  const facts = harness.factSource as unknown as MutableFacts;
  for (const ref of Object.values(MEMBER_REFS)) {
    if (input.withPlanFacts !== false) {
      facts.plans[ref] = { state: "valid", tier: "full" };
    }
    facts.workItems[ref] = observed({ deliveryState: input.apiDeliveryState ?? "ready" });
    facts.ci[ref] = ciSucceeded();
    facts.close[ref] = "none";
  }
};

export type MemberQueueHarness = {
  readonly harness: QueueEdgeHarness;
  /** Flip the prerequisite member's observed landing state. */
  readonly land: () => void;
};

/**
 * Build a queue edge harness whose composed plan read declares the two
 * members. `withMembers: false` composes the delivered single-ref path.
 */
export const createMemberQueueHarness = (
  label: string,
  options: {
    readonly withMembers?: boolean;
    readonly countWrites?: boolean;
    readonly apiDeliveryState?: "ready" | "done" | "canceled";
  } = {},
): MemberQueueHarness => {
  const harness = createQueueEdgeHarness(`members-${label}`, {
    ...(options.countWrites === true ? { countWrites: true } : {}),
    overrides: {
      ...(options.withMembers === false
        ? {}
        : {
            readPlanMembers: (ref: string) => (ref === CHANGE_REF ? memberDeclarations : undefined),
          }),
    },
  });
  seedMemberFacts(harness, {
    ...(options.apiDeliveryState === undefined
      ? {}
      : { apiDeliveryState: options.apiDeliveryState }),
  });
  return {
    harness,
    land: () => {
      const facts = harness.factSource as unknown as MutableFacts;
      facts.workItems[MEMBER_REFS.api] = observed({ deliveryState: "done" });
    },
  };
};
