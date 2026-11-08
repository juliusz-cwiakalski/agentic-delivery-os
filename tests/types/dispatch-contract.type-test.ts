/**
 * TC-EVID-001 / TC-EVID-006 / TC-EVID-007 type slice — the dispatch attempt,
 * comparison, divergence, handover, authority, and envelope shapes are declared
 * and closed; a widened union, an optional required field, or a missing field
 * fails compilation.
 *
 * Not named `*.test.ts`: `pnpm typecheck` compiles it through
 * `tests/types/tsconfig.json`.
 */
import type {
  DispatchAttemptRecord,
  DispatchAuthorityView,
  DispatchComparisonClass,
  DispatchComparisonOutcome,
  DispatchComparisonRecord,
  DispatchCorroborationRecord,
  DispatchDivergenceRecord,
  DispatchEnvelopeData,
  DispatchEvidenceClass,
  DispatchHandoverRecord,
  DispatchHandoverState,
  DispatchSummaryData,
} from "../../packages/core/src/contracts/dispatch";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

/** The evidence class is exactly the four declared literals (AC-F4-5). */
type EvidenceClassUnion = Expect<
  Equal<DispatchEvidenceClass, "pilot" | "controlled-proof" | "smoke" | "fixture">
>;
type UnknownEvidenceClassRejected = Expect<
  Equal<"production" extends DispatchEvidenceClass ? true : false, false>
>;
type EvidenceClassIsNotWidened = Expect<
  Equal<string extends DispatchEvidenceClass ? true : false, false>
>;

/** The comparison class and outcome unions are closed (AC-F4-6). */
type ComparisonClassUnion = Expect<
  Equal<DispatchComparisonClass, "verify-change" | "tracker-truth" | "not-applicable">
>;
type ComparisonOutcomeUnion = Expect<
  Equal<DispatchComparisonOutcome, "match" | "mismatch" | "not-applicable">
>;
type UnknownComparisonClassRejected = Expect<
  Equal<"bash-truth" extends DispatchComparisonClass ? true : false, false>
>;

/** The comparison record keeps `token` nullable and every field required. */
type ComparisonTokenIsNullable = Expect<
  Equal<NonNullable<DispatchComparisonRecord["token"]> extends string ? true : false, true>
>;
type ComparisonTokenAcceptsNull = Expect<
  Equal<null extends DispatchComparisonRecord["token"] ? true : false, true>
>;
type ComparisonReasonOptional = Expect<
  Equal<undefined extends DispatchComparisonRecord["reason"] ? true : false, true>
>;

/** The attempt record carries every declared field with the declared type. */
type AttemptSchema = Expect<Equal<DispatchAttemptRecord["schema"], "delivery.dispatch.attempt.v1">>;
type AttemptEvidenceClass = Expect<
  Equal<DispatchAttemptRecord["evidenceClass"], DispatchEvidenceClass>
>;
type AttemptOutcome = Expect<
  Equal<
    DispatchAttemptRecord["outcome"],
    "completed" | "premature-end" | "failed" | "refused" | "timed-out"
  >
>;
type AttemptComparison = Expect<
  Equal<DispatchAttemptRecord["comparison"], DispatchComparisonRecord>
>;
type AttemptCorroboration = Expect<
  Equal<DispatchAttemptRecord["corroboration"], DispatchCorroborationRecord>
>;
type AttemptFalseSuccessRequired = Expect<
  Equal<undefined extends DispatchAttemptRecord["falseSuccess"] ? true : false, false>
>;
type AttemptEvidenceRefsBounded = Expect<
  Equal<DispatchAttemptRecord["evidenceRefs"], readonly string[]>
>;

/** The envelope requires `outcome` beside `result` (TDR-0010). */
type EnvelopeOutcomeRequired = Expect<
  Equal<undefined extends DispatchEnvelopeData["outcome"] ? true : false, false>
>;
type EnvelopeResultIsToken = Expect<
  Equal<DispatchEnvelopeData["result"] extends string ? true : false, true>
>;
type EnvelopeHandoverState = Expect<
  Equal<DispatchEnvelopeData["handoverState"], DispatchHandoverState>
>;

/** The divergence and handover records are append-only shapes. */
type DivergenceSchema = Expect<
  Equal<DispatchDivergenceRecord["schema"], "delivery.dispatch.divergence.v1">
>;
type DivergenceState = Expect<Equal<DispatchDivergenceRecord["state"], "open" | "resolved">>;
type HandoverSchema = Expect<
  Equal<DispatchHandoverRecord["schema"], "delivery.dispatch.handover.v1">
>;
type HandoverOperation = Expect<
  Equal<DispatchHandoverRecord["operation"], "authoritative" | "dual-run">
>;

/** The derived authority view names its schema and closed authority value. */
type AuthoritySchema = Expect<
  Equal<DispatchAuthorityView["schema"], "delivery.dispatch.authority.v1">
>;
type AuthorityValue = Expect<
  Equal<DispatchAuthorityView["authority"], "dual-run" | "authoritative">
>;

/** The summary shape carries the verdict conjunction parts. */
type SummaryEligibility = Expect<Equal<DispatchSummaryData["eligibility"], boolean>>;
type SummaryVerdict = Expect<
  Equal<DispatchSummaryData["verdict"], "eligible" | "ineligible" | "unverifiable">
>;

export type Probes = [
  EvidenceClassUnion,
  UnknownEvidenceClassRejected,
  EvidenceClassIsNotWidened,
  ComparisonClassUnion,
  ComparisonOutcomeUnion,
  UnknownComparisonClassRejected,
  ComparisonTokenIsNullable,
  ComparisonTokenAcceptsNull,
  ComparisonReasonOptional,
  AttemptSchema,
  AttemptEvidenceClass,
  AttemptOutcome,
  AttemptComparison,
  AttemptCorroboration,
  AttemptFalseSuccessRequired,
  AttemptEvidenceRefsBounded,
  EnvelopeOutcomeRequired,
  EnvelopeResultIsToken,
  EnvelopeHandoverState,
  DivergenceSchema,
  DivergenceState,
  HandoverSchema,
  HandoverOperation,
  AuthoritySchema,
  AuthorityValue,
  SummaryEligibility,
  SummaryVerdict,
];
