/** Mutant B: map CPU-busy to stalled (CPU is never a liveness signal). */
export const MUTANT_ID = "b-cpu-substitution";
export const EXPECTED_FAILURE = "cpu";
export const classifyCpu = (cpu: string): "stalled" | "absent" =>
  cpu === "busy" ? "stalled" : "absent";
