/**
 * The supervision golden normalizer (GH-295 TC-SUP-106, NFR-3, DM-1).
 *
 * The declared volatile fields are exactly three: the temporary repository
 * root, the injected run id, and timing. Everything else must survive
 * normalization byte for byte, so determinism is not bought by normalizing real
 * content away. This module is the one home of that discipline.
 */

/** The declared volatile fields, named for the behavioural assertion. */
export const NORMALIZER_REPLACEMENTS = ["temp-root", "run-id", "timing"] as const;

export type NormalizeInput = {
  readonly root: string;
  readonly runId: string;
};

type Envelope = {
  readonly runId?: unknown;
  readonly timing?: unknown;
  readonly [key: string]: unknown;
};

const replaceVolatileText = (text: string, input: NormalizeInput): string =>
  text.split(input.root).join("<temp-root>").split(input.runId).join("<run-id>");

/** Normalize the machine envelope: root and run id wherever they appear, timing. */
export const normalizeMachine = (text: string, input: NormalizeInput): Envelope => {
  const envelope = JSON.parse(replaceVolatileText(text, input)) as Envelope;
  return { ...envelope, timing: { totalMs: 0 } };
};

/** Normalize the human render: the same two textual volatile values. */
export const normalizeHuman = (text: string, input: NormalizeInput): string =>
  replaceVolatileText(text, input);

/** The committed-golden scan: a golden carrying any of these is stale. */
export const VOLATILE_GOLDEN_VALUES = ["run-supervision-fixture", "/tmp/"] as const;

/** Whether the text carries a non-zero timing value (the third volatile field). */
export const hasVolatileTiming = (text: string): boolean => /"totalMs":\s*[1-9]/u.test(text);
