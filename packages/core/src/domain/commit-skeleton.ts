/**
 * Deterministic commit skeleton (GH-227 F-2, DEC-11).
 *
 * The verifiable parts of the message are computed here, never generated: the
 * resolved ref, the phase/type candidate, the scope, and the breaking default.
 * Plan-phase title/summary/declared scope are the highest-signal template
 * input when a plan artifact exists.
 */
import {
  COMMIT_DEFAULT_TYPE,
  COMMIT_PHASE_TYPES,
  type CommitPlanPhaseContext,
  type CommitRefSource,
  type CommitSkeleton,
  type CommitType,
} from "#contracts";

/** One skeleton computation input; every fact is resolved before this call. */
export type CommitSkeletonInput = {
  readonly ref: string;
  readonly refSource: CommitRefSource;
  readonly phaseId?: string;
  readonly planPhase?: CommitPlanPhaseContext;
};

/** The documented default for a phase outside the table (never invented). */
export const commitTypeForPhase = (phaseId: string | undefined): CommitType => {
  if (phaseId === undefined) return COMMIT_DEFAULT_TYPE;
  return COMMIT_PHASE_TYPES[phaseId] ?? COMMIT_DEFAULT_TYPE;
};

/** Compute the deterministic skeleton; scope is always the resolved ref. */
export const resolveCommitSkeleton = (input: CommitSkeletonInput): CommitSkeleton => ({
  ref: input.ref,
  refSource: input.refSource,
  type: commitTypeForPhase(input.phaseId),
  scope: input.ref,
  breaking: false,
  ...(input.phaseId === undefined ? {} : { phaseId: input.phaseId }),
});
