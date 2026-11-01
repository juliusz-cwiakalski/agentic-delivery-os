/**
 * Ranking cases (TC-QREADY-017).
 */

export const numericCandidates = ["GH-9", "GH-10", "GH-100", "GH-7", "GH-007"] as const;
export const numericOrder = ["GH-007", "GH-7", "GH-9", "GH-10", "GH-100"] as const;

/** Suffixes above 2^53 plus a >=20-digit pair that forces arbitrary precision. */
export const largeSuffixCandidates = [
  "GH-10000000000000001",
  "GH-9999999999999999",
  "GH-10000000000000000",
  "GH-99999999999999999999",
  "GH-100000000000000000000",
] as const;
export const largeSuffixOrder = [
  "GH-9999999999999999",
  "GH-10000000000000000",
  "GH-10000000000000001",
  "GH-99999999999999999999",
  "GH-100000000000000000000",
] as const;

export const classOrderBelowLimit = ["GH-175", "GH-179", "GH-170", "GH-181"] as const;
export const classOrderBelowLimitExpected = [
  ["GH-175", "merge-ready"],
  ["GH-179", "review-pending"],
  ["GH-170", "new-start"],
  ["GH-181", "not-ready"],
] as const;

export const classOrderAtLimitCandidates = ["GH-179", "GH-170", "GH-181"] as const;
export const classOrderAtLimitExpected = [
  ["GH-179", "review-pending"],
  ["GH-170", "unknown"],
  ["GH-181", "not-ready"],
] as const;
