/**
 * The pure embedded-metadata envelope codec (F-5, DEC-9).
 *
 * Adapter-internal module: the write path is adapter-only and carriers are
 * adapter machinery, so the codec lives here rather than in the runtime-neutral
 * core `./contracts` tier. Root behaviour tests import this module by relative
 * path across the established dev edge; no package subpath is added.
 *
 * Purity: no ambient environment, clock, randomness, or `node:*` / `bun:*`
 * imports. Serialization is deterministic, and the byte length is measured with
 * the platform `TextEncoder`.
 *
 * Carriers are encoded as brand-neutral `delivery.metadata.v1` markers: an
 * invisible HTML comment block, a provider custom-field value, or a compact
 * inline marker. Human-readable content is never displaced.
 */

import type { CarrierKind } from "@delivery-os/core/contracts";
import {
  type DegradationReason,
  ENVELOPE_KINDS,
  ENVELOPE_MAX_BYTES,
  ENVELOPE_SCHEMA_ID,
  type EnvelopeKind,
  type EnvelopeV1Payload,
  type MetadataEnvelopeV1,
} from "@delivery-os/core/contracts";

/** The provider custom-field name that carries an envelope (brand-neutral). */
export const ENVELOPE_FIELD_NAME = "delivery.metadata.v1" as const;

const SCHEMA_VERSION_PATTERN = /^delivery\.metadata\.v\d+$/;
const COMMENT_MARKER = /<!--\s*(delivery\.metadata\.v\d+)\s+(\{[\s\S]*?\})\s*-->/g;
const COMPACT_MARKER = /\[(delivery\.metadata\.v\d+):(\{[\s\S]*?\})\]/g;

/** A serialized envelope in its carrier form. */
export type SerializedCarrier =
  | { readonly carrier: "invisible-comment-block"; readonly text: string }
  | {
      readonly carrier: "provider-custom-field";
      readonly fieldName: typeof ENVELOPE_FIELD_NAME;
      readonly fieldValue: string;
    }
  | { readonly carrier: "compact-marker"; readonly text: string };

/** Why serialization was refused. */
export type EnvelopeSerializationFailure = "payload-not-closed" | "size-bound-exceeded";

/** The result of serializing one envelope into one carrier. */
export type EnvelopeSerialization =
  | { readonly ok: true; readonly carrier: SerializedCarrier; readonly byteLength: number }
  | {
      readonly ok: false;
      readonly failure: EnvelopeSerializationFailure;
      readonly byteLength: number;
    };

/** Input for serialization: the envelope, the chosen carrier, and human content. */
export type SerializeEnvelopeInput = {
  readonly envelope: MetadataEnvelopeV1;
  readonly carrier: CarrierKind;
  readonly humanContent: string;
};

/** A read either yields the v1 envelope or visible degradation evidence. */
export type EnvelopeParseResult =
  | {
      readonly ok: true;
      readonly envelope: MetadataEnvelopeV1;
      readonly humanContent: string;
    }
  | { readonly ok: false; readonly reason: DegradationReason; readonly humanContent: string };

/** Input for parsing one carrier. */
export type ParseEnvelopeInput = {
  readonly carrier: CarrierKind;
  readonly text?: string;
  readonly fieldValue?: string;
  readonly expectedKind?: EnvelopeKind;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

/** Validate the closed v1 payload; unknown or missing fields are rejected. */
export const isClosedV1Payload = (value: unknown): value is EnvelopeV1Payload => {
  if (!isRecord(value) || !hasExactKeys(value, ["comment", "delivery"])) return false;
  const comment = value.comment;
  const delivery = value.delivery;
  if (!isRecord(comment) || !hasExactKeys(comment, ["producingAgent", "operatorAuthority"])) {
    return false;
  }
  if (!isRecord(delivery) || !hasExactKeys(delivery, ["workItemRef", "runId"])) return false;
  return (
    isNonEmptyString(comment.producingAgent) &&
    isNonEmptyString(comment.operatorAuthority) &&
    isNonEmptyString(delivery.workItemRef) &&
    isNonEmptyString(delivery.runId)
  );
};

type EnvelopeReadFailure = Exclude<DegradationReason, "missing">;

const readEnvelope = (
  value: unknown,
  expectedKind: EnvelopeKind | undefined,
):
  | { readonly ok: true; readonly envelope: MetadataEnvelopeV1 }
  | { readonly ok: false; readonly reason: EnvelopeReadFailure } => {
  if (!isRecord(value) || !hasExactKeys(value, ["schema", "kind", "payload"])) {
    return { ok: false, reason: "malformed" };
  }
  if (typeof value.schema !== "string") return { ok: false, reason: "malformed" };
  if (value.schema !== ENVELOPE_SCHEMA_ID) {
    return {
      ok: false,
      reason: SCHEMA_VERSION_PATTERN.test(value.schema) ? "unknown-version" : "malformed",
    };
  }
  if (
    typeof value.kind !== "string" ||
    !(ENVELOPE_KINDS as readonly string[]).includes(value.kind)
  ) {
    return { ok: false, reason: "wrong-kind" };
  }
  if (expectedKind !== undefined && value.kind !== expectedKind) {
    return { ok: false, reason: "wrong-kind" };
  }
  if (!isClosedV1Payload(value.payload)) return { ok: false, reason: "malformed" };
  return {
    ok: true,
    envelope: {
      schema: ENVELOPE_SCHEMA_ID,
      kind: value.kind as EnvelopeKind,
      payload: value.payload,
    },
  };
};

const byteLengthOf = (text: string): number => new TextEncoder().encode(text).length;

/** Remove every envelope marker, leaving no marker residue or extra blank line. */
const removeMarkers = (text: string): string => {
  const spans: Array<{ readonly start: number; readonly end: number }> = [];
  for (const pattern of [COMMENT_MARKER, COMPACT_MARKER]) {
    pattern.lastIndex = 0;
    for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
      spans.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  let result = text;
  for (const span of spans.sort((left, right) => right.start - left.start)) {
    result = stripSpan(result, span.start, span.end);
  }
  return result;
};

const stripSpan = (text: string, start: number, end: number): string => {
  const before = text.slice(0, start);
  const after = text.slice(end);
  if (before.endsWith("\n") && after.startsWith("\n")) return before + after.slice(1);
  if (before.length === 0 && after.startsWith("\n")) return after.slice(1);
  if (before.endsWith("\n") && after.length === 0) return before.slice(0, -1);
  return before + after;
};

/**
 * Strip the envelope from human-readable carrier text.
 *
 * The provider custom-field carrier keeps human content separate, so its text is
 * returned unchanged. The returned content is the original minus the invisible
 * envelope, with no marker residue.
 */
export const stripEnvelope = (carrier: CarrierKind, text: string): string =>
  carrier === "provider-custom-field" ? text : removeMarkers(text);

/** Serialize a v1 envelope into one declared carrier. */
export const serializeEnvelope = (input: SerializeEnvelopeInput): EnvelopeSerialization => {
  const { envelope } = input;
  if (
    envelope.schema !== ENVELOPE_SCHEMA_ID ||
    !(ENVELOPE_KINDS as readonly string[]).includes(envelope.kind) ||
    !isClosedV1Payload(envelope.payload)
  ) {
    return { ok: false, failure: "payload-not-closed", byteLength: 0 };
  }
  const json = JSON.stringify(envelope);
  const byteLength = byteLengthOf(json);
  if (byteLength > ENVELOPE_MAX_BYTES) {
    return { ok: false, failure: "size-bound-exceeded", byteLength };
  }
  switch (input.carrier) {
    case "invisible-comment-block":
      return {
        ok: true,
        byteLength,
        carrier: {
          carrier: "invisible-comment-block",
          text: `${input.humanContent}\n<!-- ${ENVELOPE_SCHEMA_ID} ${json} -->`,
        },
      };
    case "provider-custom-field":
      return {
        ok: true,
        byteLength,
        carrier: {
          carrier: "provider-custom-field",
          fieldName: ENVELOPE_FIELD_NAME,
          fieldValue: json,
        },
      };
    case "compact-marker":
      return {
        ok: true,
        byteLength,
        carrier: {
          carrier: "compact-marker",
          text: `${input.humanContent}[${ENVELOPE_SCHEMA_ID}:${json}]`,
        },
      };
    default:
      return assertNever(input.carrier);
  }
};

/** Parse one carrier; metadata problems degrade visibly and never fail the flow. */
export const parseEnvelope = (input: ParseEnvelopeInput): EnvelopeParseResult => {
  if (input.carrier === "provider-custom-field") {
    const fieldValue = input.fieldValue ?? "";
    if (fieldValue.length === 0) return { ok: false, reason: "missing", humanContent: "" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(fieldValue);
    } catch {
      return { ok: false, reason: "malformed", humanContent: "" };
    }
    const read = readEnvelope(parsed, input.expectedKind);
    if (!read.ok) return { ok: false, reason: read.reason, humanContent: "" };
    return { ok: true, envelope: read.envelope, humanContent: "" };
  }

  const text = input.text ?? "";
  const marker = input.carrier === "invisible-comment-block" ? COMMENT_MARKER : COMPACT_MARKER;
  marker.lastIndex = 0;
  const match = marker.exec(text);
  const humanContent = stripEnvelope(input.carrier, text);
  if (match === null) return { ok: false, reason: "missing", humanContent };
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[2] ?? "");
  } catch {
    return { ok: false, reason: "malformed", humanContent };
  }
  const read = readEnvelope(parsed, input.expectedKind);
  if (!read.ok) return { ok: false, reason: read.reason, humanContent };
  return { ok: true, envelope: read.envelope, humanContent };
};

/**
 * The audited raw-carrier escape hatch (F-5).
 *
 * Raw carrier text is reachable only through this explicit call; the normal
 * parse result never exposes the carrier.
 */
export const readRawCarrier = (text: string): { readonly raw: string } => ({ raw: text });

const assertNever = (value: never): never => {
  throw new Error(`unhandled carrier kind: ${String(value)}`);
};
