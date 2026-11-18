/**
 * The supported-version window, the probe-output grammar, and the pure verdict
 * (GH-335 F-1; DEC-1, DEC-11; AC-F1-1, AC-F1-4, AC-F1-5).
 *
 * Pure over injected probe output: no process, no store, no clock, no
 * environment. The window is pinned data with no configuration key that widens
 * or narrows it. The grammar has one home (the contract constant); an
 * off-grammar, empty, multi-line, partial, or extended answer is
 * `indeterminate` — never a substring match, never a partial version, never a
 * permissive pass. A near-miss that merely contains a supported prefix parses
 * and is out of window.
 */
import {
  HARNESS_SUPPORTED_VERSION_WINDOW,
  HARNESS_VERSION_PROBE_PATTERN,
  type HarnessVersionVerdict,
} from "#contracts";

/** The obligation the verdict places on the caller. */
export type HarnessVersionRequirement = "proceed" | "refuse-unsupported" | "refuse-unknown";

/** One evaluation: the verdict, the normalized version (or explicit null), and the obligation. */
export type HarnessVersionEvaluation = {
  readonly verdict: HarnessVersionVerdict;
  readonly observedVersion: string | null;
  readonly requirement: HarnessVersionRequirement;
};

/** Drop at most one trailing line terminator; interior newlines survive. */
const withoutOneLineTerminator = (raw: string): string => {
  if (raw.endsWith("\r\n")) return raw.slice(0, -2);
  if (raw.endsWith("\n")) return raw.slice(0, -1);
  return raw;
};

/**
 * Parse and normalize one probe answer to the bare semantic version.
 *
 * `undefined` means the answer is outside the declared grammar.
 */
export const normalizeHarnessVersion = (raw: string): string | undefined => {
  const line = withoutOneLineTerminator(raw);
  if (line.length === 0) return undefined;
  const match = HARNESS_VERSION_PROBE_PATTERN.exec(line);
  if (match === null) return undefined;
  const major = match[1];
  const minor = match[2];
  const patch = match[3];
  if (major === undefined || minor === undefined || patch === undefined) return undefined;
  return `${major}.${minor}.${patch}`;
};

/**
 * Whether a normalized version's minor line is inside the window.
 *
 * `window` exists so the non-vacuity fixtures can widen or unbounded the data
 * and prove the comparison reads the window rather than a literal (TC-005,
 * V-18/V-19). Production never passes it: the pinned constant is the only value
 * a shipped path evaluates, and no configuration key reaches it.
 */
export const harnessVersionInWindow = (
  version: string,
  window: readonly string[] = HARNESS_SUPPORTED_VERSION_WINDOW.minors,
): boolean => {
  const segments = version.split(".");
  const major = segments[0];
  const minor = segments[1];
  if (major === undefined || minor === undefined || segments.length !== 3) return false;
  return window.includes(`${major}.${minor}`);
};

/** The indeterminate evaluation: no version, and the unknown-version obligation. */
export const indeterminateHarnessVersion = (): HarnessVersionEvaluation => ({
  verdict: "indeterminate",
  observedVersion: null,
  requirement: "refuse-unknown",
});

/** Evaluate one probe answer against the window (pinned unless a fixture widens it). */
export const evaluateHarnessVersion = (
  raw: string,
  window: readonly string[] = HARNESS_SUPPORTED_VERSION_WINDOW.minors,
): HarnessVersionEvaluation => {
  const normalized = normalizeHarnessVersion(raw);
  if (normalized === undefined) return indeterminateHarnessVersion();
  if (!harnessVersionInWindow(normalized, window)) {
    return { verdict: "outside", observedVersion: normalized, requirement: "refuse-unsupported" };
  }
  return { verdict: "inside", observedVersion: normalized, requirement: "proceed" };
};
