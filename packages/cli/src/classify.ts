/**
 * Classification chain (F-2, F-3): domain kind → app error code → table entry.
 *
 * Pure and total over declared discriminants; an unresolvable code is reported as such
 * rather than silently contained, and non-classifiable values are contained by
 * `fallback.internal` only at this explicit step.
 */
import {
  DOMAIN_KINDS,
  ERROR_TABLE,
  type ErrorTableEntry,
  FALLBACK_INTERNAL_CODE,
} from "@delivery-os/core/contracts";

export type CodeResolution =
  | { readonly ok: true; readonly entry: ErrorTableEntry }
  | { readonly ok: false; readonly reason: "unresolvable" };

const isDeclaredKind = (kind: string): kind is (typeof DOMAIN_KINDS)[number] =>
  (DOMAIN_KINDS as readonly string[]).includes(kind);

const entryForCode = (code: string): ErrorTableEntry | undefined =>
  (ERROR_TABLE as readonly ErrorTableEntry[]).find((entry) => entry.code === code);

/** Resolve a code to exactly one entry; "not found" is distinct from containment. */
export function resolveAppErrorCode(code: string): CodeResolution {
  const entry = entryForCode(code);
  return entry === undefined ? { ok: false, reason: "unresolvable" } : { ok: true, entry };
}

/**
 * Resolve a declared domain discriminant to exactly one entry.
 *
 * Throws for an undeclared kind or a declared kind with no mapping: classification
 * is total over declared kinds, so a missing mapping is a programming error.
 */
export function classifyDomainKind(kind: string, code?: string): ErrorTableEntry {
  if (!isDeclaredKind(kind)) {
    throw new Error(`undeclared domain kind: ${kind}`);
  }
  if (code !== undefined) {
    const resolved = resolveAppErrorCode(code);
    if (!resolved.ok || resolved.entry.domainKind !== kind) {
      throw new Error("no entry classifies domain discriminant");
    }
    return resolved.entry;
  }
  const matches = (ERROR_TABLE as readonly ErrorTableEntry[]).filter(
    (candidate) => candidate.domainKind === kind,
  );
  if (matches.length !== 1) throw new Error(`ambiguous or missing domain kind: ${kind}`);
  return matches[0] as ErrorTableEntry;
}

/**
 * The adapter-local `provider.payload.invalid` identity (GH-183 DM-11).
 *
 * It is deliberately not an error-table row: an explicit provider not-found has
 * its own `closeout` identity, and a malformed payload must never be confused
 * with it. It still needs a projection class, so this one narrow synthetic
 * entry is returned only for that exact (kind, code) pair.
 */
const ADAPTER_LOCAL_PAYLOAD_ENTRY: ErrorTableEntry = {
  code: "provider.payload.invalid",
  domainKind: "provider",
  category: "platform",
  retryable: false,
  consequence: "unknown",
  remediationHint:
    "Correct the malformed provider payload or fix the adapter normalization, then retry.",
  projectionClass: "platform-provider",
  summary: "A provider payload was malformed or unparsable.",
};

const adapterLocalEntry = (kind: string, code: unknown): ErrorTableEntry | undefined =>
  kind === "provider" && code === "provider.payload.invalid"
    ? ADAPTER_LOCAL_PAYLOAD_ENTRY
    : undefined;

const containedInternalEntry = (): ErrorTableEntry => {
  const resolution = resolveAppErrorCode(FALLBACK_INTERNAL_CODE);
  if (!resolution.ok) throw new Error(`${FALLBACK_INTERNAL_CODE} is not declared`);
  return resolution.entry;
};

/**
 * Classify any thrown value without carrying its raw content into the result.
 *
 * Declared kinds resolve through the ordinary chain; undeclared kinds, non-Error
 * values, rejected promises, and malformed results are contained by
 * `fallback.internal`. The thrown message/stack is never copied.
 */
export function classifyThrown(value: unknown): ErrorTableEntry {
  if (typeof value === "object" && value !== null && "kind" in value) {
    const kind = (value as { readonly kind?: unknown }).kind;
    if (typeof kind === "string" && isDeclaredKind(kind)) {
      const code = (value as { readonly code?: unknown }).code;
      try {
        if (code !== undefined && typeof code !== "string") return containedInternalEntry();
        const adapterLocal = adapterLocalEntry(kind, code);
        if (adapterLocal !== undefined) return adapterLocal;
        return classifyDomainKind(kind, code);
      } catch {
        return containedInternalEntry();
      }
    }
  }
  return containedInternalEntry();
}
