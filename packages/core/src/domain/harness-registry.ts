/**
 * The configured-harness instance registry (GH-233 F-1, F-6, DM-3, DM-4).
 *
 * Pure: maps a resolved harness kind to an injected adapter factory. Exactly
 * the two shipped kinds are registrable; registry/vocabulary drift fails. The
 * version probe is injected data: a failed probe yields an explicitly unknown
 * version plus a warning, never a fabricated version. An unknown kind is a
 * classified configuration failure naming the path and offending value, with
 * no adapter constructed and no silent default.
 */
import {
  DEFAULT_HARNESS_MODE,
  HARNESS_KINDS,
  HARNESS_VERSION_PROBE_TIMEOUT_MS,
  type HarnessInstance,
  type HarnessKind,
  type HarnessMode,
  type HarnessModeOrigin,
  type HarnessResult,
  type HarnessVersionProbe,
  type HarnessVersionWarning,
} from "#contracts";
import {
  evaluateHarnessVersion,
  type HarnessVersionEvaluation,
  indeterminateHarnessVersion,
} from "./harness-version-window.js";

/** The injected factory for one configured harness kind. */
export type HarnessAdapterRegistration = {
  readonly kind: HarnessKind;
  readonly create: (input: {
    readonly kind: HarnessKind;
    readonly observedVersion: string | null;
    readonly versionWarning?: HarnessVersionWarning;
  }) => HarnessInstance;
};

/** The injected version probe is the pinned contract seam (OQ-10, §4.4a). */
export type { HarnessVersionProbe } from "#contracts";

/** Return every registration/vocabulary drift, naming the harness. */
export const harnessRegistryViolations = (
  registrations: readonly HarnessAdapterRegistration[],
): string[] => {
  const violations: string[] = [];
  const kinds = registrations.map((registration) => registration.kind);
  for (const kind of new Set(kinds)) {
    if (kinds.filter((candidate) => candidate === kind).length !== 1) {
      violations.push(`harness ${kind} is registered more than once`);
    }
  }
  for (const registration of registrations) {
    if (!(HARNESS_KINDS as readonly string[]).includes(registration.kind)) {
      violations.push(`harness ${registration.kind} is not in the closed vocabulary`);
    }
  }
  for (const kind of HARNESS_KINDS) {
    if (!kinds.includes(kind)) violations.push(`harness ${kind} has no registration`);
  }
  return violations;
};

const failure = (
  kind: "config" | "harness",
  code: "config.value.invalid" | "harness.capability.gap",
  field: string,
  summary: string,
): HarnessResult<never> => ({ ok: false, error: { kind, code, field, summary } });

/**
 * Resolve one instance from a configured kind.
 *
 * `configurationPath` names the configuration key for classified failures; the
 * default is the harness branch's kind path. The version probe is invoked
 * exactly once with the declared deadline and the injected clock by reference;
 * `timed-out` and a rejection both yield an indeterminate version, and there is
 * no retry. The evaluation verdict and the resolved mode are carried on the
 * instance, so every consumer reads one verdict.
 */
export const resolveHarnessInstance = async (input: {
  readonly kind: string;
  readonly configurationPath?: string;
  readonly registrations: readonly HarnessAdapterRegistration[];
  readonly versionProbe: HarnessVersionProbe;
  /** The injected clock, passed to the probe by reference (NFR-2, §4.4a). */
  readonly now: () => number;
  /** The resolved integration mode; the delivered default when absent. */
  readonly mode?: HarnessMode;
  readonly modeOrigin?: HarnessModeOrigin;
}): Promise<HarnessResult<HarnessInstance>> => {
  const configurationPath = input.configurationPath ?? "harness.kind";
  const registration = input.registrations.find((entry) => entry.kind === input.kind);
  if (registration === undefined) {
    return failure(
      "config",
      "config.value.invalid",
      configurationPath,
      `harness kind ${input.kind} is not a declared harness`,
    );
  }
  let evaluation: HarnessVersionEvaluation;
  try {
    const outcome = await input.versionProbe({
      deadlineMs: HARNESS_VERSION_PROBE_TIMEOUT_MS,
      now: input.now,
    });
    evaluation =
      outcome.status === "answered"
        ? evaluateHarnessVersion(outcome.stdout)
        : indeterminateHarnessVersion();
  } catch {
    evaluation = indeterminateHarnessVersion();
  }
  const observedVersion = evaluation.observedVersion;
  // `observedVersion === null` always rides the delivered probe warning.
  const versionWarning: HarnessVersionWarning | undefined =
    observedVersion === null ? "version-probe-failed" : undefined;
  const instance = registration.create({
    kind: registration.kind,
    observedVersion,
    ...(versionWarning === undefined ? {} : { versionWarning }),
  });
  return {
    ok: true,
    value: {
      ...instance,
      versionVerdict: evaluation.verdict,
      mode: input.mode ?? DEFAULT_HARNESS_MODE,
      modeOrigin: input.modeOrigin ?? "defaults",
    },
  };
};
