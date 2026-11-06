/**
 * Delegation policy fixtures: the shipped map and deep-copy variants.
 * The production map is never mutated.
 */
import {
  BLOCKER_DELEGATION_POLICY,
  BLOCKER_DELEGATION_POLICY_ROWS,
  type BlockerDelegationPolicy,
} from "../../../../packages/core/src/contracts/index";

export const shippedPolicy = (): BlockerDelegationPolicy => ({
  rows: BLOCKER_DELEGATION_POLICY_ROWS.map((row) => ({ ...row })),
});

export const productionPolicy = (): BlockerDelegationPolicy => BLOCKER_DELEGATION_POLICY;

/** A deep copy that explicitly delegates coordinator -> owner. */
export const coordinatorOwnerAllowed = (): BlockerDelegationPolicy => ({
  rows: BLOCKER_DELEGATION_POLICY_ROWS.map((row) =>
    row.questionAudience === "coordinator" && row.answeringAudience === "owner"
      ? { ...row, allowed: true, policy: "allowed" as const }
      : { ...row },
  ),
});

/** A deep copy missing the coordinator -> owner row (a declared refusal). */
export const missingCoordinatorOwner = (): BlockerDelegationPolicy => ({
  rows: BLOCKER_DELEGATION_POLICY_ROWS.filter(
    (row) => !(row.questionAudience === "coordinator" && row.answeringAudience === "owner"),
  ).map((row) => ({ ...row })),
});

/** A deep copy with a fifth duplicate combination. */
export const withFifthRow = (): BlockerDelegationPolicy => ({
  rows: [
    ...BLOCKER_DELEGATION_POLICY_ROWS.map((row) => ({ ...row })),
    {
      questionAudience: "owner",
      answeringAudience: "owner",
      allowed: true,
      policy: "allowed",
    },
  ],
});
