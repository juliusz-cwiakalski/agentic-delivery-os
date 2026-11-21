/**
 * The pre-freeze environment fixture: the eight owner-named variables the
 * 2026-11-21 owner comment reproduced, the inert `ADOS_FOO=bar` marker, and the
 * declared-exception working-name variable. Pure data: no probe and no
 * filesystem effect live here; the behaviour cases drive the raw environment.
 *
 * This module holds `ADOS_` literals and never a `DELIVERY_OS_` literal, so it is
 * a declaration-only site of the pre-freeze shims, never a site of
 * `prior-environment-prefix`.
 */

export const PRE_FREEZE_VARIABLES = [
  "ADOS_CONFIG_ROOT",
  "ADOS_DS_BALANCE_CACHE_FILE",
  "ADOS_HOOK_ENV_ALLOWLIST",
  "ADOS_OPENAI_QUOTA_CACHE_FILE",
  "ADOS_PROFILES_DIR",
  "ADOS_PROVIDER_STATE_FILE",
  "ADOS_STATE_DIR",
  "ADOS_ZAI_QUOTA_CACHE_FILE",
] as const;

/** The one declared non-catalog-key input: the working-name override channel. */
export const PRE_FREEZE_WORKING_NAME_VARIABLE = "ADOS_WORKING_NAME";

/** A name with no mapping at all: the inertness control. */
export const PRE_FREEZE_INERT_VARIABLE = "ADOS_FOO";

/** The inert marker value: never a configuration value, never an error. */
export const PRE_FREEZE_INERT_VALUE = "bar";

/** The environment carrying exactly the eight owner-named variables, inert values. */
export const PRE_FREEZE_ENVIRONMENT: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(PRE_FREEZE_VARIABLES.map((name) => [name, "pre-freeze-fixture"])),
);
