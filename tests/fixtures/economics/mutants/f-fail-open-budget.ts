/** Mutant F: treat an unreadable store as a count-0 budget and admit. */
export const MUTANT_ID = "f-fail-open-budget";
export const EXPECTED_FAILURE = "state.store.torn";
export const classifyUnreadable = (): { readonly outcome: "admit"; readonly count: 0 } => ({
  outcome: "admit",
  count: 0,
});
