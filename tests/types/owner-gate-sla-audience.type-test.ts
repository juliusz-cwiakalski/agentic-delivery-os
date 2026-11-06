/**
 * TC-SLA-024 type probe — the evaluation input carries a required audience
 * dimension, and the result echoes it.
 */
import {
  OWNER_GATE_SLA_POLICY,
  type OwnerGateSlaAudience,
  type OwnerGateSlaEvaluation,
  type OwnerGateSlaInput,
} from "../../packages/core/src/contracts/index";

type Assert<T extends true> = T;

export type AudienceVocabulary = Assert<
  OwnerGateSlaAudience extends "owner" | "coordinator" ? true : false
>;
export type InputAudienceRequired = Assert<
  Pick<OwnerGateSlaInput, "audience"> extends { audience: OwnerGateSlaAudience } ? true : false
>;
export type EvaluationAudience = Assert<
  OwnerGateSlaEvaluation["audience"] extends OwnerGateSlaAudience ? true : false
>;

const input: OwnerGateSlaInput = {
  audience: "owner",
  nowMs: 0,
  nowIso: "2026-11-06T12:00:00Z",
  policy: OWNER_GATE_SLA_POLICY,
  gates: [],
  decisions: [],
};

// @ts-expect-error — audience is a required field of the evaluation input.
const missingAudience: OwnerGateSlaInput = {
  nowMs: 0,
  nowIso: "2026-11-06T12:00:00Z",
  policy: OWNER_GATE_SLA_POLICY,
  gates: [],
  decisions: [],
};

export const probe = { input, missingAudience };
