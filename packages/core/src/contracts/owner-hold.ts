/**
 * The owner-hold vocabulary (GH-280 F-1, DM-1, DM-2, DM-9, DEC-7, D12).
 *
 * Runtime-neutral by construction: types and `as const` data only. The hold has
 * two equivalent sources — a brand-derived environment variable whose
 * non-empty value is the operator reason, and a marker file named
 * `owner-hold` inside the production store directory. The pure resolver lives
 * in the core domain tier and receives the environment record, the production
 * store directory, and the marker outcome as injected inputs; this module reads
 * no ambient environment, filesystem, clock, or network.
 */

/** The environment-variable suffix appended to the brand prefix (DM-2). */
export const OWNER_HOLD_ENV_SUFFIX = "OWNER_HOLD" as const;

/** The fixed marker file name inside the production store directory (DM-9). */
export const OWNER_HOLD_MARKER_NAME = "owner-hold" as const;

/** The reason bound applied before any payload, line, or log (NFR-5). */
export const OWNER_HOLD_MAX_REASON_CHARS = 160 as const;

/** The default owner-hold poll interval in seconds (F-2, NFR-3). */
export const OWNER_HOLD_DEFAULT_POLL_SECONDS = 300 as const;

/** The inclusive maximum accepted poll interval in seconds (F-2, NFR-3). */
export const OWNER_HOLD_MAX_POLL_SECONDS = 3_600 as const;

/** The inclusive minimum accepted poll interval in seconds (F-2, NFR-3). */
export const OWNER_HOLD_MIN_POLL_SECONDS = 1 as const;

/** The one bounded marker read: at most 4 096 bytes (F-1.7, NFR-1). */
export const OWNER_HOLD_MAX_MARKER_BYTES = 4_096 as const;

/** The two equivalent sources, in precedence order (DEC-7). */
export const OWNER_HOLD_SOURCES = ["env", "marker"] as const;
export type OwnerHoldSource = (typeof OWNER_HOLD_SOURCES)[number];

/**
 * One bounded marker outcome supplied by the runtime edge. `absent` is the only
 * inactive outcome; `present` carries at most 4 096 bytes; `unreadable` covers
 * a non-regular path, a stat failure, and a read failure and is fail-closed.
 */
export type OwnerHoldMarkerOutcome =
  | { readonly state: "absent" }
  | { readonly state: "present"; readonly content: string }
  | { readonly state: "unreadable" };

/**
 * One resolved hold fact: the inactive arm carries no source and no reason; the
 * active arm always names the source that won and carries a reason only when
 * the sanitized text is non-empty.
 */
export type OwnerHoldFact =
  | { readonly active: false }
  | {
      readonly active: true;
      readonly source: OwnerHoldSource;
      readonly reason?: string;
    };
