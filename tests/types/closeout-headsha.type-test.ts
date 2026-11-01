/**
 * TC-CLOSE-006 type probe — `DeliveryRequest.headSha` is an additive optional
 * string; absent stays absent and a required-field rewrite fails typecheck.
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it;
 * `tests/types/tsconfig.json` compiles it through the root `typecheck` script.
 */
import type { DeliveryRequest } from "../../packages/core/src/contracts/ports";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type Expect<T extends true> = T;

/** The field is optional: an empty object satisfies its Pick. */
type HeadShaIsOptional = Expect<Equal<{} extends Pick<DeliveryRequest, "headSha"> ? true : false, true>>;

/** When present, the value is a string. */
type HeadShaIsString = Expect<Equal<NonNullable<DeliveryRequest["headSha"]>, string>>;

/** Existing fields remain required and unchanged. */
type IdentityRemains = Expect<Equal<DeliveryRequest["identity"]["entityId"], string>>;

export type Probes = [HeadShaIsOptional, HeadShaIsString, IdentityRemains];
