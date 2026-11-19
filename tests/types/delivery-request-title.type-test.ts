/**
 * TC-SYNC-004 type probe — the normalized delivery request's one additive field
 * is optional, string-typed, and absent by default (DM-1, AC-F1-6, NFR-6).
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it; the root
 * `pnpm typecheck` compiles it through `tests/types/tsconfig.json`.
 */
import type { DeliveryRequest } from "../../packages/core/src/contracts/index";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

type RequiredKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T];
type OptionalKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? K : never }[keyof T];

/** The field exists on the contract. */
type TitleIsDeclared = Expect<Equal<"title" extends keyof DeliveryRequest ? true : false, true>>;

/** It is optional: a required field would break every construction below. */
type TitleIsOptional = Expect<
  Equal<"title" extends OptionalKeys<DeliveryRequest> ? true : false, true>
>;

/** It is never required, in either direction of the key-set probe. */
type TitleIsNotRequired = Expect<
  Equal<"title" extends RequiredKeys<DeliveryRequest> ? true : false, false>
>;

/** It carries the provider-asserted string verbatim, never another signal. */
type TitleIsString = Expect<Equal<DeliveryRequest["title"], string | undefined>>;

/** Absence is the unknown signal: an omitted title reads as `undefined`. */
const withoutTitle: DeliveryRequest = {
  identity: { systemName: "github", entityId: "349" },
  sourceRef: "feat/GH-349/merge-closeout-queue-repair",
  targetRef: "main-tools",
  reviewState: "open",
  threads: [],
};

/** The same request with the provider-asserted title carried verbatim. */
const withTitle: DeliveryRequest = {
  ...withoutTitle,
  title: "feat(GH-349): additive contract surface",
};

type AbsentTitleReadsUnknown = Expect<Equal<(typeof withoutTitle)["title"], string | undefined>>;

export type Probes = [
  TitleIsDeclared,
  TitleIsOptional,
  TitleIsNotRequired,
  TitleIsString,
  AbsentTitleReadsUnknown,
];

export const absent = withoutTitle;
export const present = withTitle;

// @ts-expect-error title is the provider-asserted string, never a numeric signal
const wrongType: DeliveryRequest = { ...withoutTitle, title: 349 };
export const rejectedWrongType = wrongType;
