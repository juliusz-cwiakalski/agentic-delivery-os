/** Mutant A: classify stalled when token delta is rising (the defect class). */
export const MUTANT_ID = "a-prefill-misclassification";
export const EXPECTED_FAILURE = "tokenDelta";
export const classify = (input: {
  readonly heartbeatAgeMs: number;
  readonly tokenDelta?: number;
  readonly traffic?: number;
}): "stalled" | "progressing" =>
  (input.tokenDelta ?? 0) > 0 ? "stalled" : "progressing";
