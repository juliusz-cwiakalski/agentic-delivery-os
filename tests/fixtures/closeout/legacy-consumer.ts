/**
 * A synthetic legacy consumer of `delivery.closeout.v1` (GH-240 TC-CAP-051).
 *
 * It resolves steps by `stepId`, never by array position, and ignores unknown
 * step ids and unknown optional fields.
 */
import type { CloseoutData, CloseoutStep } from "../../../packages/core/src/contracts/index";

export type LegacyConsumerView = {
  readonly outcomes: Readonly<Record<string, string>>;
  readonly residue: number;
  readonly hasCapsule: boolean;
};

export const consumeCloseout = (
  data: CloseoutData & {
    readonly steps: readonly (CloseoutStep & { readonly future?: unknown })[];
  },
): LegacyConsumerView => {
  const outcomes: Record<string, string> = {};
  for (const step of data.steps) {
    if (typeof step.stepId !== "string") continue;
    outcomes[step.stepId] = step.outcome;
  }
  return {
    outcomes,
    residue: data.residue?.length ?? 0,
    hasCapsule: data.capsule !== undefined,
  };
};
