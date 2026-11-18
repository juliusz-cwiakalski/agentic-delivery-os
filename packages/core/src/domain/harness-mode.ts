/**
 * The declared integration mode and its origin (GH-335 F-2; DEC-2, TDR-0034).
 *
 * Pure: the mode is a declared value or the delivered default. It is never
 * inferred from ambient state, never read from an environment variable, and
 * never silently defaulted when an unknown value is present. Availability is a
 * closed comparison against the delivered default; no dispatch falls back.
 */
import {
  DEFAULT_HARNESS_MODE,
  HARNESS_MODES,
  type HarnessMode,
  type HarnessModeOrigin,
} from "#contracts";

/** One mode resolution: the mode with its origin, or a classified configuration refusal. */
export type HarnessModeResolution =
  | { readonly ok: true; readonly mode: HarnessMode; readonly origin: HarnessModeOrigin }
  | {
      readonly ok: false;
      readonly code: "config.value.invalid";
      readonly field: string;
      readonly summary: string;
    };

/** Whether a requested mode may run: only the delivered default may. */
export type HarnessModeAvailability =
  | { readonly available: true; readonly mode: HarnessMode }
  | {
      readonly available: false;
      readonly requested: HarnessMode;
      readonly availableMode: HarnessMode;
    };

/**
 * Resolve the declared mode value.
 *
 * Omitted → the delivered default with the `defaults` origin. Present and
 * recognised → `configured`. Present and unrecognised → `config.value.invalid`
 * naming the configuration path; never a silent default.
 */
export const resolveHarnessMode = (input: {
  readonly declared?: unknown;
  readonly configured?: boolean;
  readonly field?: string;
}): HarnessModeResolution => {
  const field = input.field ?? "harness.mode";
  const declared = input.declared;
  if (declared === undefined) {
    return { ok: true, mode: DEFAULT_HARNESS_MODE, origin: "defaults" };
  }
  if (typeof declared !== "string" || !(HARNESS_MODES as readonly string[]).includes(declared)) {
    return {
      ok: false,
      code: "config.value.invalid",
      field,
      summary: `mode ${String(declared)} is not a declared integration mode`,
    };
  }
  return {
    ok: true,
    mode: declared as HarnessMode,
    origin: input.configured === true ? "configured" : "defaults",
  };
};

/** Whether a resolved mode is the one the delivery may run. */
export const evaluateHarnessModeAvailability = (requested: HarnessMode): HarnessModeAvailability =>
  requested === DEFAULT_HARNESS_MODE
    ? { available: true, mode: requested }
    : { available: false, requested, availableMode: DEFAULT_HARNESS_MODE };
