/**
 * Storage-failure classification shared by the state facade and the driver edge
 * (GH-222 F-5, NFR-4).
 *
 * The production edge re-raises a full-disk write failure in the distinguishable
 * `StateStorageExhaustedFailure` form below; the facade maps that form to
 * `state.storage.exhausted` and every other write error to `state.write.failed`.
 * Runtime-neutral: it only inspects an unknown thrown value, so no runtime API
 * enters the state tier here.
 */

/** The marker carried by the distinguishable storage-exhaustion form. */
export const STATE_STORAGE_EXHAUSTION_MARKER = "state.storage.exhausted" as const;

/** The storage error codes a full device or a settled quota surfaces. */
export const EXHAUSTION_STORAGE_CODES = ["ENOSPC", "EDQUOT", "EFBIG"] as const;

/** The distinguishable exhaustion failure form raised at the driver edge. */
export type StateStorageExhaustedFailure = {
  readonly stateFailure: typeof STATE_STORAGE_EXHAUSTION_MARKER;
  readonly storageCode: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** The storage error code carried by a thrown value, when there is one. */
export const storageFailureCode = (error: unknown): string | undefined => {
  if (!isRecord(error)) return undefined;
  const code = error.code;
  return typeof code === "string" ? code : undefined;
};

/** Whether a thrown value models storage exhaustion (the ENOSPC family). */
export const isStorageExhaustion = (error: unknown): boolean => {
  if (isRecord(error) && error.stateFailure === STATE_STORAGE_EXHAUSTION_MARKER) return true;
  const code = storageFailureCode(error);
  return code !== undefined && (EXHAUSTION_STORAGE_CODES as readonly string[]).includes(code);
};

/** Build the exhaustion form the driver edge raises for a full-disk failure. */
export const storageExhaustionFailure = (storageCode: string): StateStorageExhaustedFailure => ({
  stateFailure: STATE_STORAGE_EXHAUSTION_MARKER,
  storageCode,
});
