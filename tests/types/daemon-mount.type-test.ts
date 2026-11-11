/**
 * TC-DAEMON-111 (compile-time half) — the daemon-mount contract is additive.
 *
 * Every added `DaemonComposition` and `ProductionCompositionFacts` member is
 * optional, so a literal without the new members and a literal with them both
 * satisfy the type; the `QueueComposition.degraded` union accepts an array, a
 * resolver, and the omitted member while the array member stays assignable.
 */
import type { DaemonComposition } from "../../packages/cli/src/daemon-compose";
import type { QueueComposition } from "../../packages/cli/src/edge";
import type { ProductionCompositionFacts } from "../../packages/cli/src/production";
import type { QueueDegradationReason } from "../../packages/core/src/contracts/index";

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

/* ------------------------------- DaemonComposition ------------------------ */

type SignalHostShape = {
  readonly once: (event: "SIGINT" | "SIGTERM", listener: () => void) => void;
  readonly removeListener: (event: "SIGINT" | "SIGTERM", listener: () => void) => void;
};

/** The three new inputs are optional, so their keys accept an absent value. */
type DaemonNewOptionalKeys = Expect<
  Equal<
    Extract<OptionalKeys<DaemonComposition>, "pid" | "signalHost" | "reentryEnvironment">,
    "pid" | "signalHost" | "reentryEnvironment"
  >
>;

/** A literal without the three members still satisfies the composition. */
type DaemonWithoutNewInputs = Omit<
  DaemonComposition,
  "pid" | "signalHost" | "reentryEnvironment"
>;
type DaemonWithoutNewInputsAccepted = Expect<DaemonWithoutNewInputs extends DaemonComposition ? true : false>;

/** A literal with all three satisfies the composition with the declared shapes. */
type DaemonWithNewInputs = Omit<
  DaemonComposition,
  "pid" | "signalHost" | "reentryEnvironment"
> & {
  readonly pid: number;
  readonly signalHost: SignalHostShape;
  readonly reentryEnvironment: Readonly<Record<string, string>>;
};
type DaemonWithNewInputsAccepted = Expect<DaemonWithNewInputs extends DaemonComposition ? true : false>;

/** The declared member types are exactly the additive shapes. */
type PidType = Expect<Equal<DaemonComposition["pid"], number | undefined>>;
type SignalHostType = Expect<Equal<DaemonComposition["signalHost"], SignalHostShape | undefined>>;
type ReentryEnvironmentType = Expect<
  Equal<DaemonComposition["reentryEnvironment"], Readonly<Record<string, string>> | undefined>
>;

/* --------------------------- ProductionCompositionFacts ------------------- */

type FactsNewOptionalKeys = Expect<
  Equal<Extract<OptionalKeys<ProductionCompositionFacts>, "daemonEntry" | "supervisor">, "daemonEntry" | "supervisor">
>;

type FactsWithoutNewInputs = Omit<ProductionCompositionFacts, "daemonEntry" | "supervisor">;
type FactsWithoutNewInputsAccepted = Expect<FactsWithoutNewInputs extends ProductionCompositionFacts ? true : false>;

type FactsWithNewInputs = Omit<ProductionCompositionFacts, "daemonEntry" | "supervisor"> & {
  readonly daemonEntry: string;
  readonly supervisor: NonNullable<ProductionCompositionFacts["supervisor"]>;
};
type FactsWithNewInputsAccepted = Expect<FactsWithNewInputs extends ProductionCompositionFacts ? true : false>;

type DaemonEntryType = Expect<Equal<ProductionCompositionFacts["daemonEntry"], string | undefined>>;

/* ----------------------------- QueueComposition.degraded ------------------ */

type DegradedMember = NonNullable<QueueComposition["degraded"]>;
type DegradedArrayAccepted = Expect<readonly QueueDegradationReason[] extends DegradedMember ? true : false>;
type DegradedResolverAccepted = Expect<
  (() => readonly QueueDegradationReason[]) extends DegradedMember ? true : false
>;
type DegradedOmittable = Expect<
  Equal<Extract<OptionalKeys<QueueComposition>, "degraded">, "degraded">
>;
type DegradedUnionExact = Expect<
  Equal<
    QueueComposition["degraded"],
    readonly QueueDegradationReason[] | (() => readonly QueueDegradationReason[]) | undefined
  >
>;

export type DaemonMountTypeAssertions = [
  DaemonNewOptionalKeys,
  DaemonWithoutNewInputsAccepted,
  DaemonWithNewInputsAccepted,
  PidType,
  SignalHostType,
  ReentryEnvironmentType,
  FactsNewOptionalKeys,
  FactsWithoutNewInputsAccepted,
  FactsWithNewInputsAccepted,
  DaemonEntryType,
  DegradedArrayAccepted,
  DegradedResolverAccepted,
  DegradedOmittable,
  DegradedUnionExact,
];
