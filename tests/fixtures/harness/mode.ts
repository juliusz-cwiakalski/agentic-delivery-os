/**
 * The mode configuration fixtures (test plan §4.1 rule 3, TC-HARNESS-009).
 *
 * Synthetic only: one row per configuration shape the typed harness branch can
 * carry for `harness.mode`, plus the ambient canary the resolution must ignore.
 */
export type ModeFixture = {
  readonly id: string;
  readonly declared: unknown;
  readonly configured: boolean;
  readonly expected: "defaults" | "configured" | "config.value.invalid";
  readonly note: string;
};

export const MODE_FIXTURES: readonly ModeFixture[] = [
  {
    id: "MODE-absent",
    declared: undefined,
    configured: false,
    expected: "defaults",
    note: "the branch states no mode",
  },
  {
    id: "MODE-explicit-default",
    declared: "per-invocation-private-server",
    configured: true,
    expected: "configured",
    note: "the default spelled out explicitly",
  },
  {
    id: "MODE-unknown",
    declared: "daemon",
    configured: true,
    expected: "config.value.invalid",
    note: "a value outside the closed vocabulary",
  },
  {
    id: "MODE-wrong-typed",
    declared: 42,
    configured: true,
    expected: "config.value.invalid",
    note: "a non-string value",
  },
  {
    id: "MODE-empty",
    declared: "",
    configured: true,
    expected: "config.value.invalid",
    note: "an empty string is not a mode",
  },
];

/** The ambient canary: shaped like a mode, never read by the resolution. */
export const MODE_AMBIENT_CANARY = {
  variable: "HARNESS_MODE",
  value: "managed-background-service",
} as const;
