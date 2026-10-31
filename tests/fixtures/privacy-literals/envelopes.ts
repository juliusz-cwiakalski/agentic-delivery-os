/**
 * Synthetic envelope fixtures for the content-policy behaviour suite. All
 * payload values are fabricated; the guarded value is a rule positive from the
 * allowlisted fixture root.
 */
import type { CarrierKind, MetadataEnvelopeV1 } from "../../../packages/core/src/contracts";
import { CLOUD_TERM, PRIVATE_LITERAL } from "./activation";
import { RULE_POSITIVES } from "./rules";

export const GUARDED_VALUE = RULE_POSITIVES[4]?.value as string;
export const HUMAN_GUARDED_VALUE = RULE_POSITIVES[0]?.value as string;

export const CLEAN_ENVELOPE: MetadataEnvelopeV1 = {
  schema: "delivery.metadata.v1",
  kind: "work-item-comment",
  payload: {
    comment: { producingAgent: "synthetic-agent", operatorAuthority: "operator:synthetic" },
    delivery: { workItemRef: "GH-184", runId: "run-synthetic" },
  },
};

export const PAYLOAD_FIELDS = [
  "producingAgent",
  "operatorAuthority",
  "workItemRef",
  "runId",
] as const;

export type PayloadField = (typeof PAYLOAD_FIELDS)[number];

export const CARRIERS: readonly CarrierKind[] = [
  "invisible-comment-block",
  "provider-custom-field",
  "compact-marker",
];

/** Put one value into one payload string field. */
export const guardedEnvelope = (field: PayloadField, value: string): MetadataEnvelopeV1 => ({
  ...CLEAN_ENVELOPE,
  payload: {
    comment: {
      producingAgent:
        field === "producingAgent" ? value : CLEAN_ENVELOPE.payload.comment.producingAgent,
      operatorAuthority:
        field === "operatorAuthority" ? value : CLEAN_ENVELOPE.payload.comment.operatorAuthority,
    },
    delivery: {
      workItemRef: field === "workItemRef" ? value : CLEAN_ENVELOPE.payload.delivery.workItemRef,
      runId: field === "runId" ? value : CLEAN_ENVELOPE.payload.delivery.runId,
    },
  },
});

export const OVER_SIZE_ENVELOPE: MetadataEnvelopeV1 = {
  ...CLEAN_ENVELOPE,
  payload: {
    comment: {
      producingAgent: `${"a".repeat(1200)}${GUARDED_VALUE}`,
      operatorAuthority: "o".repeat(1200),
    },
    delivery: { workItemRef: "GH-184", runId: "run-synthetic" },
  },
};

export const HUMAN_CONTENT = `Human note that mentions ${HUMAN_GUARDED_VALUE} but is not part of the envelope.`;

export const HASHED_TERMS = [PRIVATE_LITERAL, CLOUD_TERM] as const;
