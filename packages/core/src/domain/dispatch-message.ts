/**
 * The `last-message` composition order and the closed absence ladder
 * (GH-354 F-4; API-4, API-9; DM-3, DM-5, DM-6; DEC-4; TDR-0058 DC-4, DC-5).
 *
 * The composition order is FIXED: redact -> flatten -> bound -> mark. The
 * redactor is the delivered serialization chokepoint injected by the composition
 * edge, so a registered credential straddling the 512-character cut is replaced
 * BEFORE the cut is applied and cannot survive as a prefix. No general
 * scrubbing is claimed: prose and values the harness itself printed pass through
 * within the bound.
 */
import {
  DISPATCH_MAX_LAST_MESSAGE_CHARS,
  DISPATCH_MESSAGE_REASONS,
  type DispatchMessageReason,
} from "#contracts";

/** The declared ladder, in its binding order (an earlier rung wins). */
export const DISPATCH_MESSAGE_LADDER: readonly DispatchMessageReason[] = DISPATCH_MESSAGE_REASONS;

/** The first rung that answers when several conditions hold. */
export const firstMessageReason = (
  reasons: readonly DispatchMessageReason[],
): DispatchMessageReason | undefined =>
  DISPATCH_MESSAGE_LADDER.find((reason) => reasons.includes(reason));

/**
 * Replace every registered credential VALUE with `[redacted]`.
 *
 * This applies the delivered serialization chokepoint's replace semantics to
 * session text, over the SAME registered set the chokepoint receives, so the
 * policy has one source (the set) and the observable behaviour is identical. It
 * runs BEFORE the bound, which is the whole point: a credential straddling the
 * 512-character cut is removed before the cut is applied.
 */
export const replaceRegisteredCredentials = (text: string, secrets: readonly string[]): string =>
  secrets.reduce(
    (value, secret) => (secret.length === 0 ? value : value.split(secret).join("[redacted]")),
    text,
  );

/** Flatten stored text to ONE line: every line break and tab becomes a space. */
export const flattenMessageText = (text: string): string =>
  text
    .replace(/[\r\n\t]+/gu, " ")
    .replace(/ {2,}/gu, " ")
    .trim();

/**
 * Compose the answer: redact first, then flatten, then bound, then mark.
 *
 * `truncated` is derived from the POST-redaction (flattened) length, so a
 * credential that was removed cannot make the answer look longer than it is.
 */
export const composeDispatchMessage = (input: {
  readonly text: string;
  /** The registered credential VALUES the answer is redacted with. */
  readonly secrets: readonly string[];
  readonly bound?: number;
}): { readonly message: string; readonly truncated: boolean } => {
  const bound = input.bound ?? DISPATCH_MAX_LAST_MESSAGE_CHARS;
  const redacted = replaceRegisteredCredentials(input.text, input.secrets);
  const flattened = flattenMessageText(redacted);
  const truncated = flattened.length > bound;
  return { message: truncated ? flattened.slice(0, bound) : flattened, truncated };
};
