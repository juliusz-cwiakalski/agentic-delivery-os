/**
 * Compile-time probes for the parity cell/entry vocabulary (TC-PARITY-004) and,
 * added in phase 5, the participation and refusal shape (TC-REG-001/005).
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it; the root typecheck
 * compiles it through `tests/types/tsconfig.json`.
 */
import type {
  ConformanceAdapterRegistration,
  ParityCell,
  ParityDifferenceClass,
  ParityObservation,
  ParticipationItem,
} from "@delivery-os/testkit";

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

// The registration shape is exactly provider + contract + builder (+ test-only writeHandler).
declare const registration: ConformanceAdapterRegistration;
export const registrationKeys: readonly string[] = Object.keys(registration);

export const registrationKind: ConformanceAdapterRegistration["provider"] = "control";

export const lifecycleRegistration: ConformanceAdapterRegistration = {
  provider: "control",
  contract: registration.contract,
  buildClient: registration.buildClient,
  // @ts-expect-error a lifecycle phase hook is not part of the registration shape
  lifecyclePhase: "deliver",
};

export const portRegistration: ConformanceAdapterRegistration = {
  provider: "control",
  contract: registration.contract,
  buildClient: registration.buildClient,
  // @ts-expect-error a port is not part of the registration shape
  port: "lifecycle",
};

// @ts-expect-error there is no sixth participation item
export const sixthItem: ParticipationItem = "lifecycle";
