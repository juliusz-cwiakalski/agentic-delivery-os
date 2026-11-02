/** The mutant corpus: each case disables one guard and must fail naming it. */
import {
  CLOSEOUT_INTEGRATION_BASE,
  type CloseoutStep,
} from "../../../../packages/core/src/contracts/index";
import {
  buildCloseoutPlan,
  deriveCloseoutOperationId,
  evaluateBranchSafety,
  renderCloseoutHuman,
  resolveCloseoutBaseRef,
} from "../../../../packages/core/src/domain/closeout";
import { sha256Hex } from "../../../../packages/core/src/domain/sha256";
import { CANARY_TEXT } from "../canary";
import { makeDependent, makeFacts, makeMergedRequest, observed, testDependent } from "../harness";

export type MutantCase = {
  readonly id: string;
  readonly prohibited: string;
  readonly real: () => unknown;
  readonly mutant: () => unknown;
  readonly violates: (value: unknown) => boolean;
};

const step = (steps: readonly CloseoutStep[], id: string): CloseoutStep | undefined =>
  steps.find((entry) => entry.stepId === id);

const fnv1a = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
};

export const MUTANT_CASES: readonly MutantCase[] = [
  {
    id: "fnv1a-identity",
    prohibited: "FNV-1a is not a 64-hex SHA-256 operation id",
    real: () =>
      deriveCloseoutOperationId({
        workspaceId: "w",
        workItemRef: "GH-183",
        engine: "github",
        capabilityContext: "supported",
        operation: "write-work-item",
        arguments: { add: ["delivered"] },
        target: { systemName: "github", entityId: "183" },
      }),
    mutant: () => fnv1a("closeout"),
    violates: (value) => typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value),
  },
  {
    id: "unavailable-signal-as-empty",
    prohibited: "an unavailable relation signal is never an empty blocker set",
    real: () => {
      const plan = buildCloseoutPlan(
        makeFacts({
          dependents: observed([
            testDependent(makeDependent("200"), { observation: "unavailable" }),
          ]),
        }),
      );
      return step(plan.steps, "owed-flip-sweep")?.operations.length;
    },
    mutant: () =>
      buildCloseoutPlan(
        makeFacts({ dependents: observed([testDependent(makeDependent("200"), observed([]))]) }),
      ).steps.find((entry) => entry.stepId === "owed-flip-sweep")?.operations.length,
    violates: (value) => value !== 0,
  },
  {
    id: "detached-as-unrelated",
    prohibited: "a clean detached-at-delivery-head checkout is restorable",
    real: () => {
      const plan = buildCloseoutPlan(
        makeFacts({ checkout: { state: "detached-at-delivery-head", head: "h" } }),
      );
      return step(plan.steps, "checkout-restore")?.operations.length;
    },
    mutant: () => {
      const plan = buildCloseoutPlan(makeFacts({ checkout: { state: "unrelated", head: "h" } }));
      return step(plan.steps, "checkout-restore")?.operations.length;
    },
    violates: (value) => value !== 1,
  },
  {
    id: "protected-set-bypass",
    prohibited: "the protected ref set always wins",
    real: () =>
      evaluateBranchSafety({
        mergedObserved: true,
        sourceRef: "release/candidate",
        branchName: "release/candidate",
        localHead: "a".repeat(40),
        mergedHeadSha: "a".repeat(40),
        protectedRefs: ["release/candidate"],
        checkedOutElsewhere: false,
        currentCheckout: "base",
        restoreRequired: false,
        restoreSucceeded: true,
        earlierFailure: false,
      }).safe,
    mutant: () =>
      evaluateBranchSafety({
        mergedObserved: true,
        sourceRef: "release/candidate",
        branchName: "release/candidate",
        localHead: "a".repeat(40),
        mergedHeadSha: "a".repeat(40),
        protectedRefs: [],
        checkedOutElsewhere: false,
        currentCheckout: "base",
        restoreRequired: false,
        restoreSucceeded: true,
        earlierFailure: false,
      }).safe,
    violates: (value) => value === true,
  },
  {
    id: "gap-as-success",
    prohibited: "a declared gap is never reported as success",
    real: () =>
      buildCloseoutPlan(makeFacts()).steps.find((s) => s.stepId === "comment-resolution")?.outcome,
    mutant: () => "applied",
    violates: (value) => value === "applied",
  },
  {
    id: "success-on-partial",
    prohibited: "a failed operation is never reported as applied",
    real: () => "failed",
    mutant: () => "applied",
    violates: (value) => value === "applied",
  },
  {
    id: "wide-projection",
    prohibited: "human output never carries a comment/title canary",
    real: () => {
      const plan = buildCloseoutPlan(makeFacts());
      return renderCloseoutHuman({
        schemaId: "delivery.closeout.v1",
        command: "closeout",
        workItemRef: plan.workItemRef,
        mode: "plan",
        baseRef: plan.baseRef,
        steps: plan.steps,
        summary: plan.summary,
        ledgerKey: "closeout.operations:GH-183",
      });
    },
    mutant: () => `${CANARY_TEXT}\n`,
    violates: (value) => typeof value === "string" && value.includes(CANARY_TEXT),
  },
  {
    id: "moved-head-equality",
    prohibited: "a moved local head is refused",
    real: () =>
      evaluateBranchSafety({
        mergedObserved: true,
        sourceRef: "feat/GH-183/x",
        branchName: "feat/GH-183/x",
        localHead: "b".repeat(40),
        mergedHeadSha: "a".repeat(40),
        protectedRefs: ["main-tools"],
        checkedOutElsewhere: false,
        currentCheckout: "base",
        restoreRequired: false,
        restoreSucceeded: true,
        earlierFailure: false,
      }).safe,
    mutant: () => true,
    violates: (value) => value === true,
  },
];

export const realIntegrationBase = (): string =>
  resolveCloseoutBaseRef({ observation: "observed", value: makeMergedRequest() }) ||
  CLOSEOUT_INTEGRATION_BASE;
