/**
 * The two-layer state-scope vocabulary (GH-288 F-1, F-2, F-3, DM-1..DM-3).
 *
 * Runtime-neutral by construction: constants, closed vocabularies, and types
 * only. The artifact names, the key format bounds, the identity-marker schema,
 * the host-index schema, and the closed identity/daemon/handover vocabularies
 * are declared once here so no consumer spells a literal and tests import the
 * same constants the product uses. No product or binary name appears: every
 * name resolves from the injected brand identity.
 */

/** The git-common-directory marker holding one checkout's minted identity. */
export const PROJECT_IDENTITY_MARKER_NAME = "project-identity.json" as const;

/** The persisted identity-marker schema identity (DM-1). */
export const PROJECT_IDENTITY_SCHEMA = "delivery.projects.identity.v1" as const;

/** The host-level index document name inside the host root (F-2, DEC-1). */
export const HOST_INDEX_ARTIFACT_NAME = "host-index.json" as const;

/** The host-index document schema identity (F-2, DEC-1). */
export const HOST_INDEX_SCHEMA = "delivery.projects.host-index.v1" as const;

/** The container segment under the host root holding one root per project. */
export const PROJECTS_CONTAINER_SEGMENT = "projects" as const;

/** The declared host-scoped scope for an invocation outside any work tree (DEC-10). */
export const PROJECT_UNBOUND_SEGMENT = "unbound" as const;

/** The inclusive basename bound applied after sanitisation (F-1, DEC-3). */
export const PROJECT_KEY_MAX_BASENAME_LENGTH = 32 as const;

/** The basename that replaces one which sanitises to nothing (F-1, DEC-3). */
export const PROJECT_KEY_FALLBACK_BASENAME = "project" as const;

/** The discriminator length: the first eight lowercase hex of the identifier. */
export const PROJECT_KEY_DISCRIMINATOR_HEX_LENGTH = 8 as const;

/** The random project identifier length in lowercase hex characters (128 bits). */
export const PROJECT_IDENTIFIER_HEX_LENGTH = 32 as const;

/** The single-segment project key pattern (prefix, hyphen, discriminator). */
export const PROJECT_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?-[0-9a-f]{8}$/u;

/** The inclusive host-index entry bound (F-2, NFR-4 bounded work). */
export const HOST_INDEX_MAX_ENTRIES = 2_000 as const;

/** The revision an absent index starts from; absent is not corrupt (F-2). */
export const HOST_INDEX_INITIAL_REVISION = 0 as const;

/** The corrupt document's preserved sibling suffix (DEC-14). */
export const HOST_INDEX_CORRUPT_SUFFIX = ".corrupt" as const;

/** The closed maintenance outcome vocabulary (F-2, DEC-4, DEC-14, DEC-18). */
export const HOST_INDEX_MAINTENANCE_OUTCOMES = [
  "unchanged",
  "written",
  "conflict",
  "corrupt-replaced",
] as const;
export type HostIndexMaintenanceOutcome = (typeof HOST_INDEX_MAINTENANCE_OUTCOMES)[number];

/** One registration fact the maintenance fold upserts (F-2, DM-2). */
export type HostIndexRegistration = {
  readonly projectKey: string;
  readonly projectIdentifier: string;
  readonly root: string;
  readonly stateLocation: string;
  readonly recordedAt: string;
};

/**
 * The DEC-18 key guard's report: a key the index already holds under another
 * project identifier. The existing entry stays unchanged and no revision
 * advances; the colliding checkout does not adopt that state root.
 */
export type HostIndexConflict = {
  readonly projectKey: string;
  readonly existingIdentifier: string;
  readonly existingRoot: string;
  readonly candidateIdentifier: string;
  readonly candidateRoot: string;
};

/** One maintained index entry's declared field set, in order (F-2, DM-2). */
export const HOST_INDEX_ENTRY_FIELDS = [
  "projectKey",
  "projectIdentifier",
  "root",
  "stateLocation",
  "lastWrittenAt",
] as const;

/** The index document's declared top-level field set, in order (F-2, DM-2). */
export const HOST_INDEX_DOCUMENT_FIELDS = ["schema", "revision", "projects"] as const;

/**
 * The closed checkout-identity outcome vocabulary (DEC-17).
 *
 * One outcome per state: `unbound` (no git root), `mint` (marker absent),
 * `identity-unreadable` (git metadata unusable or marker unreadable /
 * inconsistent), and `state-unavailable` (marker creation failed). `refused`
 * is the pre-existing marker's refusal class, named by the delivered state.
 */
export const PROJECT_IDENTITY_OUTCOMES = [
  "unbound",
  "mint",
  "existing",
  "identity-unreadable",
  "state-unavailable",
] as const;
export type ProjectIdentityOutcome = (typeof PROJECT_IDENTITY_OUTCOMES)[number];

/** The three contract error identities of the `projects` family (F-3, DM-6). */
export const PROJECTS_ERROR_CODES = [
  "projects.identity-unreadable",
  "projects.registry-corrupt",
  "projects.state-unavailable",
] as const;
export type ProjectsErrorCode = (typeof PROJECTS_ERROR_CODES)[number];

/** The closed daemon-reachability reason vocabulary (F-5, Appendix C). */
export const DAEMON_REACHABILITY_REASONS = [
  "daemon-not-mounted",
  "state-absent",
  "socket-absent",
  "socket-unreachable",
] as const;
export type DaemonReachabilityReason = (typeof DAEMON_REACHABILITY_REASONS)[number];

/** The closed handover-state vocabulary (F-4, DEC-7). */
export const HANDOVER_STATES = ["engine", "shell", "in-transition"] as const;
export type HandoverState = (typeof HANDOVER_STATES)[number];

/** The one verb of the family (F-3); no other verb exists in this contract. */
export const PROJECTS_COMMAND_FAMILY = "projects" as const;

/** The family's only verb. */
export const PROJECTS_LIST_VERB = "list" as const;

/** The exact entry field set, in output order (F-3, DM-4, AC-F3-1). */
export const PROJECTS_ENTRY_FIELDS = [
  "projectKey",
  "root",
  "stateLocation",
  "daemonReachable",
  "handoverState",
] as const;

/** The exact `data` field set, in output order; no new top-level key (F-3). */
export const PROJECTS_LIST_DATA_FIELDS = ["projects", "hostIndexRevision"] as const;

/** The closed state-location classification vocabulary (DEC-8). */
export const PROJECT_STATE_LOCATIONS = ["first-use", "ready", "state-unavailable"] as const;
export type ProjectStateLocation = (typeof PROJECT_STATE_LOCATIONS)[number];

/** The daemon reachability value: nested so the entry keeps five fields (DEC-6). */
export type DaemonReachability =
  | { readonly reachable: true }
  | { readonly reachable: false; readonly reason: DaemonReachabilityReason };

/**
 * One persisted identity marker (DM-1).
 *
 * The mint-time basename travels beside the key so a rename or a move cannot
 * re-key the project, and the identifier is the durable random value the
 * discriminator derives from (DEC-3).
 */
export type ProjectIdentityMarker = {
  readonly schema: typeof PROJECT_IDENTITY_SCHEMA;
  readonly projectKey: string;
  readonly projectIdentifier: string;
  readonly basename: string;
};

/** One maintained host-index entry (F-2, DM-2). */
export type HostIndexEntry = {
  readonly projectKey: string;
  readonly projectIdentifier: string;
  readonly root: string;
  readonly stateLocation: string;
  readonly lastWrittenAt: string;
};

/** The host-index document as read: revision plus the maintained entries. */
export type HostIndexDocument = {
  readonly schema: typeof HOST_INDEX_SCHEMA;
  readonly revision: number;
  readonly projects: readonly HostIndexEntry[];
};

/** One `projects list` row: exactly the five contract fields (F-3, AC-F3-1). */
export type ProjectsListEntry = {
  readonly projectKey: string;
  readonly root: string;
  readonly stateLocation: string;
  readonly daemonReachable: DaemonReachability;
  readonly handoverState: HandoverState;
};

/** The `projects.v1` machine payload: the rows plus the revision that produced them. */
export type ProjectsListData = {
  readonly projects: readonly ProjectsListEntry[];
  readonly hostIndexRevision: number;
};

/**
 * One project scope: the derived state root for a resolved checkout, or the
 * declared `unbound` scope for an invocation outside every work tree. The
 * `stateLocation` is always derived from the key, never read from the index.
 */
export type ProjectScope =
  | {
      readonly kind: "project";
      readonly hostRoot: string;
      readonly projectKey: string;
      readonly projectIdentifier: string;
      readonly checkoutRoot: string;
      readonly stateLocation: string;
    }
  | {
      readonly kind: "unbound";
      readonly hostRoot: string;
      readonly stateLocation: string;
    };

/**
 * The bounded identity-marker read outcome supplied by the adapter seam.
 * `unreadable` covers a read failure and a non-regular path; `invalid` covers
 * unparsable content and a payload whose fields disagree with its key.
 */
export type ProjectIdentityMarkerRead =
  | { readonly state: "absent" }
  | { readonly state: "present"; readonly text: string }
  | { readonly state: "unreadable" };
