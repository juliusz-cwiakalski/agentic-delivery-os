/**
 * TC-WIRE-001 / TC-VOCAB-004 (compile-time half) — the control and effect
 * unions are literal-typed, and the caller principal is additive.
 */
import type {
  CallerPrincipal,
  ControlFrame,
  ControlInteractionClass,
  ControlWireType,
  DaemonInstanceOperation,
  DaemonLaneState,
  DaemonPreemptionState,
  EffectReceiptStatus,
  EffectState,
  QueueEntryRecord,
} from "../../packages/core/src/contracts/index";

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type WireTypes = Expect<
  Equal<
    ControlWireType,
    "poke" | "status" | "lane" | "subscribe" | "drain" | "stop" | "takeover" | "frame" | "degraded"
  >
>;
type Classes = Expect<Equal<ControlInteractionClass, "poke" | "query" | "subscribe" | "control">>;
type EffectStates = Expect<
  Equal<EffectState, "accepted" | "in-flight" | "applied" | "failed" | "unknown">
>;
type Receipts = Expect<
  Equal<EffectReceiptStatus, "applied" | "already-applied" | "failed" | "unknown">
>;
type Instances = Expect<
  Equal<DaemonInstanceOperation, "acquired" | "taken-over" | "released" | "immediate-stop">
>;
type LaneStates = Expect<
  Equal<DaemonLaneState, "delivering" | "detached" | "completed" | "failed" | "preempted">
>;
type Preemption = Expect<Equal<DaemonPreemptionState, "pending" | "applied" | "withdrawn">>;
type PrincipalShape = Expect<
  Equal<CallerPrincipal, { readonly kind: "local-same-user"; readonly id: string | null }>
>;
type AdditivePrincipal = Expect<"callerPrincipal" extends keyof QueueEntryRecord ? true : false>;
type FrameUnion = Expect<
  Extract<ControlFrame["kind"], "request" | "response" | "event" | "error"> extends never
    ? false
    : true
>;

export type DaemonProtocolTypeAssertions = [
  WireTypes,
  Classes,
  EffectStates,
  Receipts,
  Instances,
  LaneStates,
  Preemption,
  PrincipalShape,
  AdditivePrincipal,
  FrameUnion,
];
