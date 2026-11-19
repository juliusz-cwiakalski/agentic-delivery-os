/**
 * TC-F4-009 type probes — the close-milestone argument and write shapes admit
 * only the milestone identity (GH-349, AC-F4-5, NFR-9).
 *
 * Not named `*.test.ts`; `tests/types/tsconfig.json` compiles it.
 */
import type {
  CloseoutMilestoneArguments,
  CloseoutMilestoneFacts,
  CloseoutMilestoneWithheldReason,
  CloseoutProviderRuntime,
  MilestoneReadObservation,
} from "../../packages/core/src/contracts/index";

export const minimal: CloseoutMilestoneArguments = { milestone: "4" };

// @ts-expect-error a second operand is not representable
export const withSecondOperand: CloseoutMilestoneArguments = { milestone: "4", source: "x" };

// @ts-expect-error create is not an argument shape
export const createArguments: CloseoutMilestoneArguments = { action: "create", milestone: "4" };

// @ts-expect-error attach is not an argument shape
export const attachArguments: CloseoutMilestoneArguments = { action: "attach", milestone: "4" };

// @ts-expect-error detach is not an argument shape
export const detachArguments: CloseoutMilestoneArguments = { action: "detach", milestone: "4" };

// @ts-expect-error rename is not an argument shape
export const renameArguments: CloseoutMilestoneArguments = { action: "rename", milestone: "4" };

// @ts-expect-error reopen is not an argument shape
export const reopenArguments: CloseoutMilestoneArguments = { action: "reopen", milestone: "4" };

type CloseMilestoneInput =
  NonNullable<CloseoutProviderRuntime["closeMilestone"]> extends (input: infer Input) => unknown
    ? Input
    : never;

export const validWrite: CloseMilestoneInput = { milestone: "4" };

// @ts-expect-error the write carries no attach flag
export const attachWrite: CloseMilestoneInput = { milestone: "4", attach: true };

// @ts-expect-error the write carries no second target
export const secondTargetWrite: CloseMilestoneInput = { milestone: "4", target: "other" };

export const facts: CloseoutMilestoneFacts = {
  declaration: "M4: Jaiship-native delivery",
  observation: { observation: "unavailable" },
};

export const withheldReason: CloseoutMilestoneWithheldReason = "attached-set-truncated";

// @ts-expect-error an unknown-state residue reason does not exist
export const unknownStateReason: CloseoutMilestoneWithheldReason = "unknown-state";

export const observation: MilestoneReadObservation = {
  observation: "observed",
  value: { identity: { systemName: "github", entityId: "4" }, state: "unknown", attachedItems: [] },
};
