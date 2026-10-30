/**
 * Fixture comment adapter for the envelope read path (TC-META-002/003/006).
 *
 * Reads through the production codec and returns an agent-facing view; a
 * degraded read stays a view with visible evidence and heuristic provenance,
 * never a failure.
 */

import { parseEnvelope } from "../../../packages/adapters/src/io/envelope-codec";
import type {
  CarrierKind,
  CommentReadView,
  HeuristicProvenance,
} from "../../../packages/core/src/contracts/index";

/** Account-based heuristic provenance used by every degraded read (DEC-8). */
export const heuristicProvenance = (account: string): HeuristicProvenance => ({
  source: "account-heuristic",
  account,
  structural: false,
});

/** One comment read through a specific carrier. */
export type ReadCommentInput = {
  readonly carrier: CarrierKind;
  readonly account: string;
  readonly text?: string;
  readonly fieldValue?: string;
};

/** Read one comment carrier and return the agent-facing view. */
export const readComment = (input: ReadCommentInput): CommentReadView => {
  const parsed =
    input.carrier === "provider-custom-field"
      ? parseEnvelope({
          carrier: input.carrier,
          fieldValue: input.fieldValue ?? "",
          expectedKind: "work-item-comment",
        })
      : parseEnvelope({
          carrier: input.carrier,
          text: input.text ?? "",
          expectedKind: "work-item-comment",
        });
  if (parsed.ok) {
    return { body: parsed.humanContent, provenance: parsed.envelope.payload.comment };
  }
  return {
    body: parsed.humanContent,
    provenance: heuristicProvenance(input.account),
    degradation: { reason: parsed.reason, heuristics: heuristicProvenance(input.account) },
  };
};
