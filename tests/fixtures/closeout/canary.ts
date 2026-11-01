/** The single fabricated no-leak canary (test-plan §4.8). */
export const CANARY_TOKEN = "closeout-canary-value-never-leaks-183";
export const CANARY_TEXT = "gh183-canary-never-leaks";

export const assertCanaryPresent = (text: string): boolean => text.includes(CANARY_TEXT);

export const leaksIn = (text: string): readonly string[] =>
  [CANARY_TOKEN, CANARY_TEXT].filter((marker) => text.includes(marker));
