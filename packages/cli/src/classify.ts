/**
 * Classification chain (F-2, F-3): domain kind → app error code → table entry.
 *
 * Pure and total over declared discriminants; an unresolvable code is reported as such
 * rather than silently contained, and non-classifiable values are contained by
 * `fallback.internal` only at this explicit step.
 */
import {
  BOARD_COLLECTOR_ERROR_PREFIX,
  BOARD_COLLECTOR_ERROR_SUFFIX,
  DOMAIN_KINDS,
  ERROR_TABLE,
  ERROR_TABLE_FAMILIES,
  type ErrorTableEntry,
  type ErrorTableFamily,
  FALLBACK_INTERNAL_CODE,
  MERGE_GATE_ERROR_PREFIX,
  MERGE_GATE_ERROR_SUFFIX,
} from "@delivery-os/core/contracts";

export type CodeResolution =
  | { readonly ok: true; readonly entry: ErrorTableEntry }
  | { readonly ok: false; readonly reason: "unresolvable" };

const isDeclaredKind = (kind: string): kind is (typeof DOMAIN_KINDS)[number] =>
  (DOMAIN_KINDS as readonly string[]).includes(kind);

const entryForCode = (code: string): ErrorTableEntry | undefined =>
  (ERROR_TABLE as readonly ErrorTableEntry[]).find((entry) => entry.code === code);

const COLLECTOR_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/**
 * The declared `status.collector.<id>.unavailable` family (GAP-3, DEC-7).
 *
 * Only the declared prefix/suffix pair and a non-empty collector-id slot are
 * admitted; the family never widens to another namespace or suffix. The
 * documented closed id set is enforced by the sync check, while the runtime
 * admits the same family shape so an injected collector id stays nameable.
 */
const collectorFamilyEntry = (code: string, kind?: string): ErrorTableEntry | undefined => {
  if (kind !== undefined && kind !== "status") return undefined;
  if (!code.startsWith(BOARD_COLLECTOR_ERROR_PREFIX)) return undefined;
  if (!code.endsWith(BOARD_COLLECTOR_ERROR_SUFFIX)) return undefined;
  const id = code.slice(
    BOARD_COLLECTOR_ERROR_PREFIX.length,
    code.length - BOARD_COLLECTOR_ERROR_SUFFIX.length,
  );
  if (!COLLECTOR_ID_PATTERN.test(id)) return undefined;
  const base = entryForCode("status.collector.tracker.unavailable");
  return base === undefined ? undefined : { ...base, code };
};

const MERGE_GATE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

const mergeGateFamily = (): ErrorTableFamily | undefined =>
  (ERROR_TABLE_FAMILIES as readonly ErrorTableFamily[]).find(
    (family) => family.slotPrefix === MERGE_GATE_ERROR_PREFIX,
  );

/**
 * The declared `merge.gate.<gate-id>.failed` family (DEC-7, GAP-13, NFR-8).
 *
 * The runtime admits the declared prefix/suffix pair and a well-formed gate-id
 * slot. Registry membership is validated where the effective declared gate set
 * is resolved: the transaction only ever emits a code for an id it resolved
 * from the registry, and the sync check proves the documented/static cases. No
 * other namespace or suffix is admitted.
 */
const mergeGateFamilyEntry = (code: string, kind?: string): ErrorTableEntry | undefined => {
  if (kind !== undefined && kind !== "merge") return undefined;
  if (!code.startsWith(MERGE_GATE_ERROR_PREFIX)) return undefined;
  if (!code.endsWith(MERGE_GATE_ERROR_SUFFIX)) return undefined;
  const id = code.slice(
    MERGE_GATE_ERROR_PREFIX.length,
    code.length - MERGE_GATE_ERROR_SUFFIX.length,
  );
  if (!MERGE_GATE_ID_PATTERN.test(id)) return undefined;
  const family = mergeGateFamily();
  if (family === undefined) return undefined;
  return {
    code,
    domainKind: family.domainKind,
    category: family.category,
    retryable: family.retryable,
    consequence: family.consequence,
    remediationHint: family.remediationHint,
    projectionClass: family.projectionClass,
    ...(family.summary === undefined ? {} : { summary: family.summary }),
  };
};

/** Resolve a code to exactly one entry; "not found" is distinct from containment. */
export function resolveAppErrorCode(code: string): CodeResolution {
  const entry = entryForCode(code) ?? collectorFamilyEntry(code) ?? mergeGateFamilyEntry(code);
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
 *
 * `domainKind: "provider"` here is the adapter-local provider-I/O identity used
 * by the closeout read refinement. It is not the AI-model provider engine
 * reserved by DEC-15/F-14, which has its own table entries; this entry adds no
 * member to `DOMAIN_KINDS` and no error-table row.
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
