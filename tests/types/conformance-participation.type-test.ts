/**
 * Compile-time probes for the parity cell/entry vocabulary (TC-PARITY-004) and,
 * added in phase 5, the participation and refusal shape (TC-REG-001/005).
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it; the root typecheck
 * compiles it through `tests/types/tsconfig.json`.
 */
import type { ParityCell, ParityDifferenceClass, ParityObservation } from "@delivery-os/testkit";

export const cellSame: ParityCell = { kind: "same-as-reference" };
export const cellGap: ParityCell = { kind: "gap", reason: "provider-unsupported" };
export const cellDifference: ParityCell = {
  kind: "declared-difference",
  registerId: "gitlab-read-pipeline-run",
};

export const cellWithClass: ParityCell = {
  kind: "declared-difference",
  registerId: "gitlab-read-pipeline-run",
  // @ts-expect-error a cell never carries a difference class
  differenceClass: "pipeline-model",
};

// @ts-expect-error a free-text cell value is not representable
export const freeTextCell: ParityCell = { kind: "free-text", value: "GitLab differs" };

// @ts-expect-error there is no seventh difference class
export const seventhClass: ParityDifferenceClass = "timing-model";

export const observed: ParityObservation = { state: "observed", value: "issue-key" };
export const unobservable: ParityObservation = {
  state: "not-observable",
  why: "operation models no state",
};

// @ts-expect-error an observation state is a closed two-member union
export const unknownState: ParityObservation = { state: "unknown", value: "x" };
