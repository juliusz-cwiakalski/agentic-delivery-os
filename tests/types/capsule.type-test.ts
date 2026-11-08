/**
 * TC-CAP-002 type probe — the capsule kind and writer vocabularies are closed
 * unions; a literal outside them or a widened `string` is not assignable.
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it; the root
 * `pnpm typecheck` compiles it through `tests/types/tsconfig.json`.
 */
import type {
  CapsuleEvent,
  CapsuleEventKind,
  CapsuleWriter,
} from "../../packages/core/src/contracts/capsule";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

/** A widened `string` is not assignable to the closed kind union. */
type WideStringIsRejected = Expect<Equal<string extends CapsuleEventKind ? true : false, false>>;

/** A literal outside the vocabulary is not assignable. */
type UnknownKindIsRejected = Expect<
  Equal<"capsule.unknown" extends CapsuleEventKind ? true : false, false>
>;

/** An unknown writer is not assignable either. */
type UnknownWriterIsRejected = Expect<Equal<"agent" extends CapsuleWriter ? true : false, false>>;

/** The writer union is exactly the four declared identities. */
type WriterUnion = Expect<Equal<CapsuleWriter, "phase" | "commit" | "verify" | "closeout">>;

/** Every declared kind is a string literal, never `any`/`unknown`. */
type KindIsString = Expect<Equal<CapsuleEventKind extends string ? true : false, true>>;

/** The envelope carries the schema id. */
type EnvelopeShape = Expect<Equal<CapsuleEvent["schemaId"], "delivery.capsule.event.v1">>;

export type Probes = [
  WideStringIsRejected,
  UnknownKindIsRejected,
  UnknownWriterIsRejected,
  WriterUnion,
  KindIsString,
  EnvelopeShape,
];
