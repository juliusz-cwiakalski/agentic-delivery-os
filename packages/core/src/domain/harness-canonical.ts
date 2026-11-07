/**
 * Canonical serialization for harness evidence, liveness reports, and telemetry
 * payloads (GH-233 NFR-1).
 *
 * Object keys are sorted recursively, so map insertion order never changes the
 * canonical text. The function is pure and runtime-neutral.
 */

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    const result: Record<string, unknown> = {};
    for (const [key, child] of entries) result[key] = canonical(child);
    return result;
  }
  return value;
};

/** Serialize a value with recursively sorted keys and no trailing whitespace. */
export const canonicalHarnessJson = (value: unknown): string => JSON.stringify(canonical(value));
