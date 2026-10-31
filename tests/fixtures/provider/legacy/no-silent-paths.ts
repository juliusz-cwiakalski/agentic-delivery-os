import { FAIL_OPEN_CASES } from "./fail-open-matrix";

export type NoSilentPathClass = {
  readonly id: string;
  readonly assertingTc: string;
  readonly legacyId?: string;
};

export const NO_SILENT_PATH_CLASSES: readonly NoSilentPathClass[] = [
  ...FAIL_OPEN_CASES.map((entry) => ({
    id: entry.id,
    assertingTc: "TC-PROV-052",
    legacyId: entry.legacyId,
  })),
  { id: "missing-credential", assertingTc: "TC-PROV-039" },
  { id: "loop-cap", assertingTc: "TC-PROV-023" },
  { id: "chain-exhaustion", assertingTc: "TC-PROV-009" },
  { id: "skipped-entry-outage", assertingTc: "TC-PROV-035" },
  { id: "peak-window", assertingTc: "TC-PROV-011" },
  { id: "quota-exhausted-valid-reset", assertingTc: "TC-PROV-014" },
];
