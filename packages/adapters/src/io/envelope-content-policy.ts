/**
 * The pure envelope content policy builder (F-6, DM-5).
 *
 * Combines the one shared generic rule set with project hashed entries using an
 * injected pure hash function. It performs no I/O, reads no ambient state, and
 * never throws; the codec receives it as an injected typed input.
 */
import type { EnvelopeContentPolicy } from "@delivery-os/core/contracts";
import { findWindowMatches, matchGenericRules, privacyDigestInput } from "./privacy-rules.js";

/** One injected hashed entry: only the digest, id, and normalized length. */
export type HashedPolicyEntry = {
  readonly id: string;
  readonly hash: string;
  readonly length: number;
};

/** The pure inputs a caller supplies: a hash function and hashed entries. */
export type ContentPolicyInputs = {
  /** A pure digest over the versioned domain-separated preimage. */
  readonly hash: (preimage: string) => string;
  readonly entries: readonly HashedPolicyEntry[];
};

/**
 * Build a total content policy over the exact compact envelope JSON. Generic
 * rules take precedence deterministically; hashed entries are consulted next.
 */
export const buildEnvelopeContentPolicy = (inputs: ContentPolicyInputs): EnvelopeContentPolicy => {
  const digestToId = new Map<string, string>();
  for (const entry of inputs.entries) digestToId.set(entry.hash, entry.id);
  const lengths = [...new Set(inputs.entries.map((entry) => entry.length))];

  return (compactJson: string) => {
    for (const match of matchGenericRules(compactJson)) {
      if (match.suppressionClass !== null) continue;
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
