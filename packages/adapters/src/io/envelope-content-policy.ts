/**
 * The pure envelope content policy builder (F-6, DM-5).
 *
 * Combines the one shared generic rule set with project hashed entries using an
 * injected pure hash function. It performs no I/O, reads no ambient state, and
 * the returned policy never throws. Invalid injected inputs fail closed at
 * construction time, before any serialization can rely on the policy.
 */
import type { EnvelopeContentPolicy } from "@delivery-os/core/contracts";
import {
  findWindowMatches,
  matchGenericRules,
  PRIVACY_CAPS,
  privacyDigestInput,
} from "./privacy-rules.js";

/** One injected hashed entry: only the digest, id, and normalized length. */
export type HashedPolicyEntry = {
  readonly id: string;
  readonly hash: string;
  readonly length: number;
  /** Optional explicit algorithm declaration; only `sha256` is accepted. */
  readonly algorithm?: "sha256";
};

/** The pure inputs a caller supplies: a hash function and hashed entries. */
export type ContentPolicyInputs = {
  /** A pure digest over the versioned domain-separated preimage. */
  readonly hash: (preimage: string) => string;
  readonly entries: readonly HashedPolicyEntry[];
};

const LOWER_HEX_64 = /^[0-9a-f]{64}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isIntegerInRange = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= PRIVACY_CAPS.minLength &&
  value <= PRIVACY_CAPS.maxLength;

/**
 * Fail-closed construction validation. The builder is the trust boundary for
 * injected entries: a malformed, duplicate, or over-cap input throws instead
 * of yielding a policy that silently allows every hashed literal.
 */
const validateInputs = (inputs: ContentPolicyInputs): void => {
  if (!isRecord(inputs)) throw new Error("privacy policy: inputs must be an object");
  if (typeof inputs.hash !== "function") {
    throw new Error("privacy policy: hash must be a function");
  }
  if (!Array.isArray(inputs.entries)) {
    throw new Error("privacy policy: entries must be an array");
  }
  const ids = new Set<string>();
  const digests = new Set<string>();
  const lengths = new Set<number>();
  for (const [index, rawEntry] of inputs.entries.entries()) {
    if (!isRecord(rawEntry)) {
      throw new Error(`privacy policy: entry ${index} must be an object`);
    }
    if (!isNonEmptyString(rawEntry.id)) {
      throw new Error(`privacy policy: entry ${index} requires a non-empty id`);
    }
    const id = rawEntry.id;
    if (ids.has(id)) throw new Error(`privacy policy: duplicate entry id ${id}`);
    ids.add(id);
    if (rawEntry.algorithm !== undefined && rawEntry.algorithm !== "sha256") {
      throw new Error(`privacy policy: entry ${id} uses an unsupported algorithm`);
    }
    if (typeof rawEntry.hash !== "string" || !LOWER_HEX_64.test(rawEntry.hash)) {
      throw new Error(`privacy policy: entry ${id} requires a 64-character lowercase hex digest`);
    }
    if (digests.has(rawEntry.hash)) {
      throw new Error(`privacy policy: duplicate digest for entry ${id}`);
    }
    digests.add(rawEntry.hash);
    if (!isIntegerInRange(rawEntry.length)) {
      throw new Error(
        `privacy policy: entry ${id} length must be an integer between ${PRIVACY_CAPS.minLength} and ${PRIVACY_CAPS.maxLength}`,
      );
    }
    lengths.add(rawEntry.length);
  }
  if (lengths.size > PRIVACY_CAPS.maxDistinctLengths) {
    throw new Error(
      `privacy policy: distinct length cap exceeded (${lengths.size} > ${PRIVACY_CAPS.maxDistinctLengths})`,
    );
  }
};

/**
 * Build a total content policy over the exact compact envelope JSON. Generic
 * rules take precedence deterministically; hashed entries are consulted next.
 *
 * Documentation-placeholder suppression is deliberately not applied here:
 * machine-generated metadata payloads have no documentation context, so a
 * marker-carrying guarded value is still denied at the emitter.
 */
export const buildEnvelopeContentPolicy = (inputs: ContentPolicyInputs): EnvelopeContentPolicy => {
  validateInputs(inputs);
  const digestToId = new Map<string, string>();
  for (const entry of inputs.entries) digestToId.set(entry.hash, entry.id);
  const lengths = [...new Set(inputs.entries.map((entry) => entry.length))];

  return (compactJson: string) => {
    for (const match of matchGenericRules(compactJson)) {
      return { ok: false, ruleOrEntryId: match.id };
    }
    if (lengths.length > 0) {
      const matches = findWindowMatches(
        compactJson,
        lengths,
        (window) => inputs.hash(privacyDigestInput(window)),
        (digest) => digestToId.has(digest),
      );
      const first = matches[0];
      if (first !== undefined) {
        const id = digestToId.get(first.digest);
        if (id !== undefined) return { ok: false, ruleOrEntryId: id };
      }
    }
    return { ok: true };
  };
};
