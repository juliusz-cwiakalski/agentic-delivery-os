/**
 * TC-POLICY-002 compile-time probe — the content policy is required (no
 * default-open overload), must return the contract verdict, and rejects excess
 * shape. Not named `*.test.ts`, so Bun discovery ignores it; the root
 * `typecheck` compiles it through `tests/types/tsconfig.json`.
 */

import {
  type SerializeEnvelopeInput,
  serializeEnvelope,
} from "../../packages/adapters/src/io/envelope-codec";
import type {
  EnvelopeContentPolicy,
  MetadataEnvelopeV1,
} from "../../packages/core/src/contracts/index";

const envelope: MetadataEnvelopeV1 = {
  schema: "delivery.metadata.v1",
  kind: "work-item-comment",
  payload: {
    comment: { producingAgent: "synthetic-agent", operatorAuthority: "operator:synthetic" },
    delivery: { workItemRef: "GH-184", runId: "run-synthetic" },
  },
};

const clean: EnvelopeContentPolicy = () => ({ ok: true });
const base = {
  envelope,
  carrier: "invisible-comment-block",
  humanContent: "body",
} as const satisfies Omit<SerializeEnvelopeInput, "policy">;

const accepted = serializeEnvelope({ ...base, policy: clean });

// @ts-expect-error reason: the policy member is required (no default-open overload)
const missingPolicy = serializeEnvelope(base);

// @ts-expect-error reason: a policy returning a non-contract verdict shape is rejected
const nonContractPolicy = serializeEnvelope({ ...base, policy: () => ({ ok: "yes" }) });

// @ts-expect-error reason: excess properties are rejected, so no policy-less escape hatch exists
const excessShape = serializeEnvelope({ ...base, policy: clean, defaultOpen: true });

export type Probes = [
  typeof accepted,
  typeof missingPolicy,
  typeof nonContractPolicy,
  typeof excessShape,
];
