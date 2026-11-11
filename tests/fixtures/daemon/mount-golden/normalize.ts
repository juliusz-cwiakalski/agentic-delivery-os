/**
 * Normalization for the recorded daemon-status matrices.
 *
 * A status payload carries the absolute paths the fixture composed and the
 * fixture's own instants. Normalization replaces the per-run root with a stable
 * token so a recorded matrix is comparable across runs and machines. Nothing
 * else is dropped: a field that changes between two identical runs is a
 * determinism failure, not a normalization concern.
 */
export const normalizeStatus = (
  data: unknown,
  options: {
    readonly root: string;
    readonly stateDirectory: string;
    readonly scopeDigest?: string;
  },
): unknown => {
  const replace = (value: unknown): unknown => {
    if (typeof value === "string") {
      let text = value.replaceAll(options.stateDirectory, "<state-directory>");
      if (options.scopeDigest !== undefined) text = text.replaceAll(options.scopeDigest, "<scope>");
      return text.replaceAll(options.root, "<root>");
    }
    if (Array.isArray(value)) return value.map(replace);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
          key,
          replace(entry),
        ]),
      );
    }
    return value;
  };
  return replace(data);
};

/** Canonical JSON with sorted keys so a matrix compares byte for byte. */
export const canonicalJson = (value: unknown): string => {
  const sort = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(sort);
    if (entry !== null && typeof entry === "object") {
      return Object.fromEntries(
        Object.keys(entry as Record<string, unknown>)
          .sort()
          .map((key) => [key, sort((entry as Record<string, unknown>)[key])]),
      );
    }
    return entry;
  };
  return JSON.stringify(sort(value), null, 2);
};
