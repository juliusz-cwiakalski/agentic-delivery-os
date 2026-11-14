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

import type { QueueEntryProjection } from "./queue.js";

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

/**
 * The delivered migration note (GH-288 F-8, AC-F8-3). The legacy-detection
 * warning names this path, so the warning and the document cannot drift.
 */
export const STATE_MIGRATION_NOTE_PATH = "doc/guides/migrating-to-per-repository-state.md" as const;

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

/**
 * The project configuration document (GH-309 F-1, DM-1): the brand-derived
 * configuration directory holds `projects.yaml` beside the delivered
 * project-committed configuration file. Declared fields only — groups with a
 * key, a display name, an optional workspace root, and members that each
 * declare exactly one repository selector plus a tracker kind. No product or
 * binary name appears here.
 */
export const PROJECT_GROUPS_CONFIG_SCHEMA = "delivery.projects.groups.v1" as const;

/** The configuration document's artifact name inside the config directory. */
export const PROJECT_GROUPS_CONFIG_ARTIFACT_NAME = "projects.yaml" as const;

/**
 * The tracker kinds with an implemented adapter (GH-309 NG-5): only GitHub is
 * exercised initially. Any other non-empty declared kind stays valid
 * configuration and classifies `not-yet-supported` at read time.
 */
export const IMPLEMENTED_TRACKER_KINDS = ["github"] as const;
export type ImplementedTrackerKind = (typeof IMPLEMENTED_TRACKER_KINDS)[number];

/** One declared member: exactly one of `root` or `repoKey`, plus a kind. */
export type ProjectGroupMemberDeclaration = {
  readonly root?: string;
  readonly repoKey?: string;
  readonly trackerKind: string;
};

/** One declared group in the configuration document (DM-1). */
export type ProjectGroupDeclaration = {
  readonly groupKey: string;
  readonly name: string;
  readonly workspaceRoot?: string;
  readonly members: readonly ProjectGroupMemberDeclaration[];
};

/**
 * One validated member: the selector is narrowed to exactly one side, the
 * tracker kind is any non-empty declared string, and an unimplemented kind is
 * never rejected here — it classifies at read time (OQ-1, NG-5).
 */
export type ProjectGroupMemberSelected =
  | { readonly kind: "root"; readonly root: string; readonly trackerKind: string }
  | { readonly kind: "repoKey"; readonly repoKey: string; readonly trackerKind: string };

/** One validated group in declared order (OQ-1: non-empty unique key, non-empty members). */
export type ProjectGroupValidated = {
  readonly groupKey: string;
  readonly name: string;
  readonly workspaceRoot?: string;
  readonly members: readonly ProjectGroupMemberSelected[];
};

/** The validated configuration: zero groups is the valid empty listing (opt-in adoption). */
export type ProjectGroupsConfig =
  | { readonly state: "empty" }
  | { readonly state: "loaded"; readonly groups: readonly ProjectGroupValidated[] };

/**
 * Why a configuration document classified config-invalid: the pinned OQ-1
 * self-contradiction cases (duplicate group key; a member declaring both,
 * neither, or a twice-resolving selector; an empty member list) plus the
 * generic declared-schema failures, which carry a detail string instead.
 */
export type ProjectConfigInvalidReason =
  | { readonly case: "schema"; readonly detail: string }
  | { readonly case: "duplicate-groupKey"; readonly groupKey: string }
  | { readonly case: "member-both-selectors"; readonly groupKey: string; readonly index: number }
  | { readonly case: "member-no-selector"; readonly groupKey: string; readonly index: number }
  | {
      readonly case: "member-duplicate-selector";
      readonly groupKey: string;
      readonly index: number;
    }
  | { readonly case: "empty-members"; readonly groupKey: string };

/** The classified configuration-error identities of the group surface (GH-309 F-2). */
export const PROJECT_GROUP_ERROR_CODES = [
  "projects.config-invalid",
  "projects.unknown-group",
  "projects.scope-unavailable",
] as const;
export type ProjectGroupErrorCode = (typeof PROJECT_GROUP_ERROR_CODES)[number];

/** The group envelope's schema identity (DM-2). */
export const PROJECT_GROUPS_LIST_SCHEMA = "project-groups.v1" as const;

/** The exact group entry field set, in output order; workspaceRoot is optional (DM-2). */
export const PROJECT_GROUP_FIELDS = ["groupKey", "name", "workspaceRoot", "members"] as const;

/** The exact member entry field set, in output order (DM-2). */
export const PROJECT_GROUP_MEMBER_FIELDS = [
  "repoKey",
  "root",
  "trackerKind",
  "state",
  "health",
  "daemonReachable",
] as const;

/** The closed per-member aggregation outcome vocabulary (DM-5, F-5). */
export const PROJECT_MEMBER_OUTCOMES = [
  "observed",
  "not-yet-supported",
  "state-unavailable",
  "unregistered",
] as const;
export type ProjectMemberOutcome = (typeof PROJECT_MEMBER_OUTCOMES)[number];

/**
 * The closed member health vocabulary (OQ-3 pin): the three non-`observed`
 * outcomes map to same-named health values; `observed` splits into `healthy`
 * (clean read) and `degraded` (read succeeded but reports a degradation).
 */
export const PROJECT_MEMBER_HEALTH_VALUES = [
  "healthy",
  "degraded",
  "state-unavailable",
  "not-yet-supported",
  "unregistered",
] as const;
export type ProjectMemberHealth = (typeof PROJECT_MEMBER_HEALTH_VALUES)[number];

/** One degraded-member entry: the member's key and its outcome (DM-2). */
export type ProjectDegradedMember = {
  readonly repoKey: string;
  readonly outcome: ProjectMemberOutcome;
};

/** One member entry of the group envelope (DM-2): exactly the declared fields. */
export type ProjectGroupMemberEntry = {
  readonly repoKey: string;
  readonly root: string;
  readonly trackerKind: string;
  readonly state: HandoverState;
  readonly health: ProjectMemberHealth;
  readonly daemonReachable: DaemonReachability;
};

/** One group entry of the group envelope (DM-2); workspaceRoot is absent when unconfigured. */
export type ProjectGroupEntry = {
  readonly groupKey: string;
  readonly name: string;
  readonly workspaceRoot?: string;
  readonly members: readonly ProjectGroupMemberEntry[];
};

/**
 * The `project-groups.v1` machine payload (DM-2): the groups plus the
 * aggregation keys, which appear only when a member degraded (F-5).
 */
export type ProjectGroupsListData = {
  readonly groups: readonly ProjectGroupEntry[];
  readonly partial?: boolean;
  readonly degradedMembers?: readonly ProjectDegradedMember[];
};

/**
 * One member's contribution to a group-scoped work read (GH-309 F-5, F-6):
 * the same classification the group surface carries plus the queue entries the
 * member contributes, split by the scheduling read's own states. A member whose
 * outcome is not `observed` contributes no records — its three collections stay
 * empty rather than vanishing from `members[]`.
 */
export type ProjectScopedMemberWork = {
  readonly repoKey: string;
  readonly root: string;
  readonly trackerKind: string;
  readonly outcome: ProjectMemberOutcome;
  readonly health: ProjectMemberHealth;
  readonly running: readonly QueueEntryProjection[];
  readonly waiting: readonly QueueEntryProjection[];
  readonly parked: readonly QueueEntryProjection[];
};

/**
 * The group-scoped work payload behind `queue list --project <groupKey>` and
 * `status --project <groupKey>` (F-5, F-6): per-member work in declared order
 * plus the same aggregation keys the group surface carries. Every new key lives
 * under `data`; no top-level envelope key is added.
 */
export type ProjectScopedWorkData = {
  readonly groupKey: string;
  readonly members: readonly ProjectScopedMemberWork[];
  readonly partial?: boolean;
  readonly degradedMembers?: readonly ProjectDegradedMember[];
};

/**
 * The flat record set's command family (GH-309 F-7, ODR-0004): the delivered
 * name of the per-checkout enumeration. `projects` names the group surface;
 * `repos` names the flat record set.
 */
export const REPOS_COMMAND_FAMILY = "repos" as const;

/** The flat family's only verb (F-7); the token is shared with `projects`. */
export const REPOS_LIST_VERB = PROJECTS_LIST_VERB;

/** The flat surface's three contract error identities, moved by the rename (F-7). */
export const REPOS_ERROR_CODES = [
  "repos.identity-unreadable",
  "repos.registry-corrupt",
  "repos.state-unavailable",
] as const;
export type ReposErrorCode = (typeof REPOS_ERROR_CODES)[number];

/** The exact flat entry field set, in output order (F-7, DM-3). */
export const REPOS_ENTRY_FIELDS = [
  "repoKey",
  "root",
  "stateLocation",
  "daemonReachable",
  "handoverState",
] as const;

/** The exact flat `data` field set, in output order; no new top-level key (F-7). */
export const REPOS_LIST_DATA_FIELDS = ["repos", "hostIndexRevision"] as const;

/** One `repos list` row: exactly the five contract fields, with the renamed key. */
export type ReposListEntry = {
  readonly repoKey: string;
  readonly root: string;
  readonly stateLocation: string;
  readonly daemonReachable: DaemonReachability;
  readonly handoverState: HandoverState;
};

/** The `repos.v1` machine payload: the renamed rows plus the producing revision. */
export type ReposListData = {
  readonly repos: readonly ReposListEntry[];
  readonly hostIndexRevision: number;
};
