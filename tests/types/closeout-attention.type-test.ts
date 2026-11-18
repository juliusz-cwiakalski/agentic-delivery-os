/**
 * TC-CAP-051 type probe — `attention` is an additive projection class and the
 * data-bearing closeout fields stay optional.
 */
import type { ProjectionClass } from "../../packages/core/src/contracts/result";
import type { CloseoutData } from "../../packages/core/src/contracts/closeout";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

type AttentionIsClass = Expect<Equal<"attention" extends ProjectionClass ? true : false, true>>;
type ResidueIsOptional = Expect<
  Equal<{} extends Pick<CloseoutData, "residue"> ? true : false, true>
>;
type CapsuleIsOptional = Expect<
  Equal<{} extends Pick<CloseoutData, "capsule"> ? true : false, true>
>;
type SchemaUnchanged = Expect<Equal<CloseoutData["schemaId"], "delivery.closeout.v1">>;

export type Probes = [AttentionIsClass, ResidueIsOptional, CapsuleIsOptional, SchemaUnchanged];
