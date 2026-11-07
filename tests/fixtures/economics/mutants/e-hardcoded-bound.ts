/** Mutant E: hardcode the restart bound to 3 instead of reading the policy. */
export const MUTANT_ID = "e-hardcoded-bound";
export const EXPECTED_FAILURE = "configured bound";
export const admit = (count: number): boolean => count < 3;
