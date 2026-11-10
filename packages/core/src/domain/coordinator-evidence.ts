/**
 * The artifact-evidence stuck verdict (GH-241 F-3, DEC-4; AC-F3-1..4).
 *
 * Three read-only evidence classes over a state-sourced digest fingerprint plus
 * sourced session progress as a prefill-safety corroborator. No CPU signal, no
 * tracker/CI/network read, no clock read, and no model call exists here: every
 * time, fingerprint, and progress fact is injected.
 */
import {
  COORDINATOR_EVIDENCE_CLASSES,
  COORDINATOR_MAX_EVIDENCE_BYTES,
  type CoordinatorEvidenceClass,
  type CoordinatorEvidenceState,
  type CoordinatorPersistedVerdict,
  type CoordinatorProgressState,
  type CoordinatorStuckReason,
} from "#contracts";

/** The injected evidence facts for one evaluation. */
export type CoordinatorEvidenceFacts = {
  /** The injected evaluation time in epoch milliseconds. */
  readonly nowMs: number;
  /** The active expectation's issue time in epoch milliseconds. */
  readonly expectedAtMs: number;
  /** The resolved `coordinator.stuck-window` policy value. */
  readonly stuckWindowMs: number;
  /** The resolved `coordinator.progress-bound` policy value. */
  readonly progressBoundMs: number;
  /** Whether the state event-log cursor or open-question count advanced. */
  readonly fingerprintAdvanced: boolean;
  /** Whether a new session turn was sourced since the expectation. */
  readonly newTurn: CoordinatorProgressState;
  /** When the last positive sourced progress was observed (epoch ms), if any. */
  readonly progressObservedAtMs: number | null;
  /** The merge artifact class state (a verified-empty store is `stale`). */
  readonly merge: CoordinatorEvidenceState;
  /** The answer artifact class state (a verified-empty store is `stale`). */
  readonly answer: CoordinatorEvidenceState;
};

/** One evaluation: the verdict, its reason when persisted, and the evidence. */
export type CoordinatorStuckEvaluation =
  | { readonly verdict: "progressing" }
  | {
      readonly verdict: CoordinatorPersistedVerdict;
      readonly reason: CoordinatorStuckReason;
      readonly evidence: string;
      readonly classes: Readonly<Record<CoordinatorEvidenceClass, CoordinatorEvidenceState>>;
    };

/** A UTF-8 byte length without constructing an encoder. */
export const utf8ByteLength = (text: string): number => {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
};

/**
 * Bound a `key=value` corpus to the declared evidence byte ceiling.
 *
 * Whole pairs are kept while they fit; the corpus is never cut mid-pair and
 * never carries free text. A single oversized pair is dropped, leaving the
 * remaining bounded corpus.
 */
export const boundEvidence = (
  pairs: readonly (readonly [string, string | number | boolean | null])[],
  maxBytes: number = COORDINATOR_MAX_EVIDENCE_BYTES,
): string => {
  const rendered = pairs.map(
    ([key, value]) => `${key}=${value === null ? "unknown" : String(value)}`,
  );
  const kept: string[] = [];
  let total = 0;
  for (const pair of rendered) {
    const next = kept.length === 0 ? utf8ByteLength(pair) : total + 1 + utf8ByteLength(pair);
    if (next > maxBytes) continue;
    kept.push(pair);
    total = next;
  }
  return kept.join(" ");
};

/**
 * Evaluate the stuck verdict.
 *
 * Digest-consumption requires the fingerprint to advance AND a new session turn
 * (a positive `token-delta` or `session-traffic` reading). Positive sourced
 * progress within `progress-bound` vetoes a stuck verdict. All-unknown evidence
 * (or unreadable required stores mapped to `unknown`) is `unevaluable`; a
 * partially stale set with no advanced class is `stuck`.
 */
export const evaluateStuck = (facts: CoordinatorEvidenceFacts): CoordinatorStuckEvaluation => {
  const digest: CoordinatorEvidenceState =
    facts.fingerprintAdvanced && facts.newTurn === "positive"
      ? "advanced"
      : facts.newTurn === "unknown"
        ? "unknown"
        : "stale";
  const classes: Readonly<Record<CoordinatorEvidenceClass, CoordinatorEvidenceState>> = {
    "digest-consumed": digest,
    merge: facts.merge,
    answer: facts.answer,
  };
  const states = COORDINATOR_EVIDENCE_CLASSES.map((name) => classes[name]);
  if (states.includes("advanced")) return { verdict: "progressing" };

  // The prefill-safety corroborator: positive progress inside the bound vetoes.
  const progressAgeMs =
    facts.progressObservedAtMs === null ? null : facts.nowMs - facts.progressObservedAtMs;
  const progressVeto =
    facts.newTurn === "positive" &&
    progressAgeMs !== null &&
    progressAgeMs >= 0 &&
    progressAgeMs <= facts.progressBoundMs;
  if (progressVeto) return { verdict: "progressing" };

  const windowElapsedMs = facts.nowMs - facts.expectedAtMs;
  const windowElapsed = windowElapsedMs >= facts.stuckWindowMs;
  const allUnknown = states.every((state) => state === "unknown");
  const evidence = boundEvidence([
    ["digest-consumed", classes["digest-consumed"]],
    ["merge", classes.merge],
    ["answer", classes.answer],
    ["fingerprintAdvanced", facts.fingerprintAdvanced],
    ["newTurn", facts.newTurn],
    ["progressAgeMs", progressAgeMs],
    ["windowElapsedMs", Math.max(0, windowElapsedMs)],
    ["stuckWindowMs", facts.stuckWindowMs],
    ["progressBoundMs", facts.progressBoundMs],
  ]);

  if (!windowElapsed) return { verdict: "progressing" };
  if (allUnknown) {
    return { verdict: "unevaluable", reason: "evidence-unevaluable", evidence, classes };
  }
  return { verdict: "stuck", reason: "stuck-artifact-evidence", evidence, classes };
};
