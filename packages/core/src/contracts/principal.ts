/**
 * The reserved caller principal (GH-238 C-2, DM-8, AC-F4-5).
 *
 * Runtime-neutral: types and `as const` data only. The principal is an
 * additive, optional intent-record field and a required v1 control-frame field.
 * It is never authorization.
 */

/** The closed principal-kind set. */
export const CALLER_PRINCIPAL_KINDS = ["local-same-user"] as const;
export type CallerPrincipalKind = (typeof CALLER_PRINCIPAL_KINDS)[number];

/** A bounded id length; `null` is the explicit unknown identity. */
export const CALLER_PRINCIPAL_MAX_ID_CHARS = 128 as const;

/** The reserved principal shape. */
export type CallerPrincipal = {
  readonly kind: CallerPrincipalKind;
  readonly id: string | null;
};

/** The one production principal: the local same-user caller. */
export const LOCAL_CALLER_PRINCIPAL: CallerPrincipal = {
  kind: "local-same-user",
  id: null,
} as const;
