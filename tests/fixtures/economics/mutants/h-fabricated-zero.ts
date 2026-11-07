/** Mutant H: render a missing re-pay delta as 0 instead of null-with-warning. */
export const MUTANT_ID = "h-fabricated-zero";
export const EXPECTED_FAILURE = "repayTokens";
export const amplificationForMissingRepay = (): number => 0;
