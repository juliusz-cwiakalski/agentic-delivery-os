/**
 * The one refusal-evidence corpus formatter (GH-235 D-7, DEC-9).
 *
 * Pure: deterministic `key=value` pairs joined by `"; "`, keys in the declared
 * fixed order per refusal class, no free-form prose, and a bounded total corpus
 * (<= `ECONOMICS_EVIDENCE_MAX_BYTES`). Values are counts, identities, and
 * references only — never prompt text or secret material. The frozen error
 * shape gains no field: the corpus is a string carried on the existing failure
 * fields, and the reference resolves to the delivery's durable records.
 */
import {
  ECONOMICS_EVIDENCE_BUDGET_KEYS,
  ECONOMICS_EVIDENCE_MAX_BYTES,
  ECONOMICS_EVIDENCE_SEPARATOR,
  ECONOMICS_EVIDENCE_STALL_KEYS,
  ECONOMICS_EVIDENCE_UNECONOMICAL_KEYS,
  ECONOMICS_REFERENCE_PREFIX,
} from "#contracts";

/** The corpus reference spelling that resolves to one delivery's records. */
export const economicsReferenceFor = (workItemRef: string): string =>
  `${ECONOMICS_REFERENCE_PREFIX}${workItemRef}`;

/** A parsed refusal corpus: stable keys to their string values. */
export type RefusalCorpus = Readonly<Record<string, string>>;

/** Pure UTF-8 byte length (no runtime encoder, no ambient API). */
const utf8Bytes = (text: string): number => {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

const valueOf = (value: string | number): string => {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("economics evidence value is not finite");
    return String(value);
  }
  if (value.length === 0) throw new Error("economics evidence value is empty");
  if (value.includes(ECONOMICS_EVIDENCE_SEPARATOR)) {
    throw new Error("economics evidence value contains the corpus separator");
  }
  return value;
};

/**
 * Render one ordered corpus. The total is bounded by the declared ceiling; an
 * over-bound corpus throws naming the bound rather than truncating meaning.
 */
export const formatRefusalCorpus = (
  entries: readonly (readonly [string, string | number])[],
): string => {
  const text = entries
    .map(([key, value]) => {
      if (key.length === 0 || key.includes("=")) {
        throw new Error("economics evidence key is empty or contains '='");
      }
      return `${key}=${valueOf(value)}`;
    })
    .join(ECONOMICS_EVIDENCE_SEPARATOR);
  const bytes = utf8Bytes(text);
  if (bytes > ECONOMICS_EVIDENCE_MAX_BYTES) {
    throw new Error(
      `economics evidence corpus is ${bytes} bytes, above the ${ECONOMICS_EVIDENCE_MAX_BYTES}-byte bound`,
    );
  }
  return text;
};

/** Parse a corpus back into stable keys; malformed pairs are dropped. */
export const parseRefusalCorpus = (text: string): RefusalCorpus => {
  const entries: Record<string, string> = {};
  for (const pair of text.split(ECONOMICS_EVIDENCE_SEPARATOR)) {
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    const key = pair.slice(0, index);
    const value = pair.slice(index + 1);
    if (key.length === 0 || value.length === 0) continue;
    entries[key] = value;
  }
  return entries;
};

/** The stall corpus: reason plus the three corroborating values and the bound. */
export const formatStallEvidence = (input: {
  readonly reason: string;
  readonly heartbeatAgeMs: number;
  readonly tokenDelta: number;
  readonly traffic: number;
  readonly stallBoundMs: number;
}): string => {
  const values: Readonly<Record<(typeof ECONOMICS_EVIDENCE_STALL_KEYS)[number], string | number>> = {
    reason: input.reason,
    heartbeatAgeMs: input.heartbeatAgeMs,
    tokenDelta: input.tokenDelta,
    traffic: input.traffic,
    stallBoundMs: input.stallBoundMs,
  };
  return formatRefusalCorpus(ECONOMICS_EVIDENCE_STALL_KEYS.map((key) => [key, values[key]] as const));
};

/** The budget corpus: reason, restart count, and the resolvable history reference. */
export const formatBudgetEvidence = (input: {
  readonly reason: string;
  readonly restarts: number;
  readonly workItemRef: string;
}): string => {
  const values: Readonly<Record<(typeof ECONOMICS_EVIDENCE_BUDGET_KEYS)[number], string | number>> = {
    reason: input.reason,
    restarts: input.restarts,
    historyRef: economicsReferenceFor(input.workItemRef),
  };
  return formatRefusalCorpus(ECONOMICS_EVIDENCE_BUDGET_KEYS.map((key) => [key, values[key]] as const));
};

/** The uneconomical corpus: reason, the re-pay token figure, and the records reference. */
export const formatUneconomicalEvidence = (input: {
  readonly reason: string;
  readonly repayTokens: number;
  readonly workItemRef: string;
}): string => {
  const values: Readonly<
    Record<(typeof ECONOMICS_EVIDENCE_UNECONOMICAL_KEYS)[number], string | number>
  > = {
    reason: input.reason,
    repayTokens: input.repayTokens,
    economicsRef: economicsReferenceFor(input.workItemRef),
  };
  return formatRefusalCorpus(
    ECONOMICS_EVIDENCE_UNECONOMICAL_KEYS.map((key) => [key, values[key]] as const),
  );
};

/**
 * The unevaluable-budget corpus: the classified condition and the delivery
 * reference. No count is fabricated (the budget could not be evaluated).
 */
export const formatUnevaluableEvidence = (input: {
  readonly reason: string;
  readonly workItemRef: string;
}): string =>
  formatRefusalCorpus([
    ["reason", input.reason],
    ["historyRef", economicsReferenceFor(input.workItemRef)],
  ]);

/** A stable capability-gap corpus naming the gap and the session identity. */
export const formatCapabilityGapEvidence = (input: {
  readonly reason: string;
  readonly capability: string;
  readonly sessionId: string;
}): string =>
  formatRefusalCorpus([
    ["reason", input.reason],
    ["capability", input.capability],
    ["session", input.sessionId],
  ]);

/** A stable incomplete-evidence corpus naming the missing or unevaluable fact. */
export const formatIncompleteEvidence = (input: {
  readonly reason: string;
  readonly field: string;
  readonly workItemRef: string;
}): string =>
  formatRefusalCorpus([
    ["reason", input.reason],
    ["field", input.field],
    ["historyRef", economicsReferenceFor(input.workItemRef)],
  ]);
