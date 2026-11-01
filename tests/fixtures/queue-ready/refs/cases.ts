/**
 * Grammar, canonicalization, duplicate, and cap cases (TC-QREADY-001/032).
 */

export const MALFORMED_REFS = [
  "gh",
  "176",
  "GH-",
  "GH-17a",
  "-GH-176",
  "GH--176",
  " GH-176",
  "GH-176 ",
  "GH 176",
  "GH-176\t",
  "gh-176!",
  "GH_176",
] as const;

export const DUPLICATE_GROUPS = [
  ["GH-176", "GH-176"],
  ["gh-176", "GH-176"],
  ["GH-176", "gh-176"],
  ["GH-007", "gh-007"],
] as const;

export const canonicalCases = [
  { input: "gh-176", canonical: "GH-176" },
  { input: "Gh-007", canonical: "GH-007" },
  { input: "PDEV-1", canonical: "PDEV-1" },
  { input: "ABC-000", canonical: "ABC-000" },
  { input: "gh-007", canonical: "GH-007" },
] as const;

/** 62 + "-1" = 64 characters: exactly at the canonical ref cap. */
export const REF_64 = `${"A".repeat(62)}-1`;
/** 61 + "-1" = 63 characters: the neighbouring accepted control. */
export const REF_63 = `${"A".repeat(61)}-1`;
/** 63 + "-2" = 65 characters: one over the cap. */
export const REF_65 = `${"A".repeat(63)}-2`;
