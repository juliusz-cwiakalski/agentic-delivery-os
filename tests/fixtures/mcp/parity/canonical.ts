/**
 * Canonical JSON for the mirror-parity oracle (test plan §4.2).
 *
 * Object keys are sorted recursively; array order is preserved; no indentation.
 * Parity is asserted on this representation so object insertion order never
 * matters.
 */
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
};

/** Serialize one value as canonical JSON. */
export const canonicalJson = (value: unknown): string => JSON.stringify(canonical(value));

/** The canonical byte length (UTF-8) used by the payload-bound assertion. */
export const canonicalBytes = (value: unknown): number =>
  new TextEncoder().encode(canonicalJson(value)).length;
