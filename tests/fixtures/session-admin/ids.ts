/**
 * The id-shape matrix I-01..I-07 (test-plan §4.7). Long ids and paths are
 * synthesized at runtime so the committed file carries no over-cap literal.
 */
export type IdCase = {
  readonly id: string;
  readonly label: string;
  readonly valid: boolean;
};

export const VALID_IDS = ["ses_abc-123", "ABC", "a", "0"] as const;

export const INVALID_IDS: readonly IdCase[] = [
  { id: "x'; DROP TABLE session; --", label: "I-02 quoted SQL", valid: false },
  { id: 'x" OR "1"="1', label: "I-03 quote OR", valid: false },
  { id: "x;y", label: "I-04 semicolon", valid: false },
  { id: "x y", label: "I-04 space", valid: false },
  { id: "x\ny", label: "I-04 newline", valid: false },
  { id: "x/*c*/y", label: "I-04 block comment", valid: false },
  { id: "sés", label: "I-05 non-ASCII", valid: false },
  { id: "", label: "I-05 empty", valid: false },
];

export const OVER_CAP_ID = "a".repeat(129);
export const OVER_CAP_PATH = `/synthetic/${"p".repeat(1018)}/opencode.db`;

export const allInvalidIds = (): readonly string[] => [
  ...INVALID_IDS.map((entry) => entry.id),
  OVER_CAP_ID,
];
