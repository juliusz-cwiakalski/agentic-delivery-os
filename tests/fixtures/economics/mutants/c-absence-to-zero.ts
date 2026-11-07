/** Mutant C: coerce an absent traffic reading to zero. */
export const MUTANT_ID = "c-absence-to-zero";
export const EXPECTED_FAILURE = "traffic";
export const projectTraffic = (reading: { readonly status: "sourced" | "absent"; readonly value?: number }) =>
  reading.status === "sourced" ? reading.value : 0;
