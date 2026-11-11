/**
 * The one state-scope policy (GH-288 F-1, F-6, DEC-1, DEC-3, DEC-12, DEC-17).
 *
 * Two layers: the delivered host root (an absolute `<PREFIX>_STATE_DIR`
 * override wins, otherwise the injected home plus the brand state-directory
 * name) and a per-project state root `<host root>/projects/<project key>`
 * derived from the checkout identity marker. The host-root rule lives here and
 * nowhere else, so exactly one home-plus-brand composition and one override
 * precedence remain in the tree.
 *
 * Runtime-neutral and pure: it reads no filesystem, git metadata, clock, or
 * process state. The checkout facts and the marker read/write seam arrive
 * through injected inputs and ports; the adapter tier owns the I/O.
 */

import type { ConfigFailure, Result } from "../contracts/index.js";
import { OWNER_HOLD_MARKER_NAME } from "../contracts/owner-hold.js";
import {
  HOST_INDEX_ARTIFACT_NAME,
  PROJECT_IDENTIFIER_HEX_LENGTH,
  PROJECT_IDENTITY_MARKER_NAME,
  PROJECT_IDENTITY_SCHEMA,
  PROJECT_KEY_DISCRIMINATOR_HEX_LENGTH,
  PROJECT_KEY_FALLBACK_BASENAME,
  PROJECT_KEY_MAX_BASENAME_LENGTH,
  PROJECT_KEY_PATTERN,
  PROJECT_UNBOUND_SEGMENT,
  PROJECTS_CONTAINER_SEGMENT,
  PROJECTS_ERROR_CODES,
  STATE_MIGRATION_NOTE_PATH,
  type ProjectIdentityMarker,
  type ProjectIdentityMarkerRead,
  type ProjectScope,
} from "../contracts/projects.js";

const PROJECT_IDENTIFIER_PATTERN = new RegExp(
  `^[0-9a-f]{${String(PROJECT_IDENTIFIER_HEX_LENGTH)}}$`,
  "u",
);

/** The host-root rule's injected inputs (the delivered override contract). */
export type HostStateRootInput = {
  readonly environment: Readonly<Record<string, string | undefined>>;
  /** The brand-derived uppercase prefix (the product name is never hardcoded). */
  readonly environmentPrefix: string;
  /** The brand-derived default directory name. */
  readonly stateDirectoryName: string;
  readonly homeDirectory?: string;
};

const trimTrailingSeparators = (value: string): string => value.replace(/\/+$/u, "");

const isAbsolutePath = (value: string): boolean =>
  value.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(value);

const environmentVariableName = (environmentPrefix: string): string =>
  `${environmentPrefix.toUpperCase().replace(/_+$/u, "")}_STATE_DIR`;

/**
 * The exact `<PREFIX>_STATE_DIR` variable name the host-root rule reads.
 *
 * Exported so a composing site that must bind the same name in a detached
 * child's environment or in an installed unit consumes this one derivation
 * instead of composing the name a second time (GH-288 F-6, NFR-9).
 */
export const stateScopeEnvironmentName = (environmentPrefix: string): string =>
  environmentVariableName(environmentPrefix);

/**
 * Resolve the host state root: `<PREFIX>_STATE_DIR` wins outright when set;
 * the default is `<home>/<brand.stateDirectoryName>`. A relative override is
 * `config.value.invalid`. No ambient working directory participates.
 */
export const resolveHostStateRoot = (input: HostStateRootInput): Result<string, ConfigFailure> => {
  const name = environmentVariableName(input.environmentPrefix);
  const explicit = input.environment[name];
  if (explicit !== undefined && explicit.length > 0) {
    if (!isAbsolutePath(explicit)) {
      return {
        ok: false,
        error: { kind: "config", code: "config.value.invalid", key: name },
      };
    }
    return { ok: true, value: trimTrailingSeparators(explicit) };
  }
  const home = input.homeDirectory ?? input.environment.HOME ?? input.environment.USERPROFILE;
  if (home === undefined || home.length === 0 || home.trim().length === 0) {
    return { ok: false, error: { kind: "config", code: "config.value.invalid", key: name } };
  }
  const trimmed = trimTrailingSeparators(home.trim());
  return trimmed.length === 0
    ? { ok: false, error: { kind: "config", code: "config.value.invalid", key: name } }
    : { ok: true, value: `${trimmed}/${input.stateDirectoryName}` };
};

/** The legacy-detection facts: what the host root holds and whether a project root exists. */
export type LegacyStoreFacts = {
  /** The delivered store artifacts present directly at the host root. */
  readonly hostArtifacts: readonly string[];
  readonly projectRootExists: boolean;
};

/** The names the legacy predicate excludes by contract (spec A4). */
const LEGACY_EXCLUDED_NAMES: readonly string[] = [
  HOST_INDEX_ARTIFACT_NAME,
  OWNER_HOLD_MARKER_NAME,
  PROJECTS_CONTAINER_SEGMENT,
  PROJECT_UNBOUND_SEGMENT,
];

/**
 * The pure legacy-detection predicate (GH-288 F-8, AC-F8-2, A4).
 *
 * A host is unmigrated when its host root still holds at least one delivered
 * store artifact while the resolved project state root does not exist. The host
 * index, the host-wide owner-hold marker, the project container and the
 * `unbound` scope are excluded by name, so a migrated host never warns. The
 * predicate returns the one bounded warning; it never moves, deletes, or opens
 * a store.
 */
export const legacyStoreWarning = (facts: LegacyStoreFacts): string | undefined => {
  if (facts.projectRootExists) return undefined;
  const artifacts = facts.hostArtifacts.filter(
    (name) =>
      !LEGACY_EXCLUDED_NAMES.includes(name) && !name.startsWith(`${HOST_INDEX_ARTIFACT_NAME}.`),
  );
  if (artifacts.length === 0) return undefined;
  return (
    "the host root still holds delivery store artifacts while this checkout has no project " +
    `state root, so delivery state is not repository-scoped yet; see ${STATE_MIGRATION_NOTE_PATH} ` +
    "for the one-step move (nothing was moved or deleted)"
  );
};

/** The host index document path under the host root (declared once). */
export const hostIndexPath = (hostRoot: string): string =>
  `${trimTrailingSeparators(hostRoot)}/${HOST_INDEX_ARTIFACT_NAME}`;

/** The project container path under the host root. */
export const projectsContainerPath = (hostRoot: string): string =>
  `${trimTrailingSeparators(hostRoot)}/${PROJECTS_CONTAINER_SEGMENT}`;

/** The declared `unbound` state root beside the project container (DEC-10). */
export const unboundStateRoot = (hostRoot: string): string =>
  `${trimTrailingSeparators(hostRoot)}/${PROJECT_UNBOUND_SEGMENT}`;

/** The derived project state root: always from the key, never recorded (F-2). */
export const projectStateRoot = (hostRoot: string, projectKey: string): string =>
  `${projectsContainerPath(hostRoot)}/${projectKey}`;

/**
 * Sanitise one checkout directory name (F-1, DEC-3): lowercased, every run
 * outside `[a-z0-9]` collapsed to one `-`, leading and trailing separators
 * stripped, bounded to 32 characters, with the declared `project` fallback and
 * `unbound` refused as a basename.
 */
export const sanitizeProjectBasename = (directoryName: string): string => {
  const collapsed = directoryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  const bounded = collapsed.slice(0, PROJECT_KEY_MAX_BASENAME_LENGTH).replace(/-+$/u, "");
  if (bounded.length === 0 || bounded === PROJECT_UNBOUND_SEGMENT) {
    return PROJECT_KEY_FALLBACK_BASENAME;
  }
  return bounded;
};

/** The checkout directory's own name (the last path segment), separators trimmed. */
export const checkoutDirectoryName = (checkoutRoot: string): string => {
  const trimmed = checkoutRoot.replace(/[\\/]+$/u, "");
  const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return index < 0 ? trimmed : trimmed.slice(index + 1);
};

/** The discriminator: the first eight lowercase hex of the identifier (DEC-3). */
export const projectDiscriminator = (projectIdentifier: string): string =>
  projectIdentifier.slice(0, PROJECT_KEY_DISCRIMINATOR_HEX_LENGTH);

/** Mint the key shape `<sanitised basename>-<discriminator>`. */
export const projectKeyFor = (basename: string, projectIdentifier: string): string =>
  `${basename}-${projectDiscriminator(projectIdentifier)}`;

/** Serialize one marker payload (deterministic field order, newline-terminated). */
export const serializeProjectIdentityMarker = (marker: ProjectIdentityMarker): string =>
  `${JSON.stringify(
    {
      schema: marker.schema,
      projectKey: marker.projectKey,
      projectIdentifier: marker.projectIdentifier,
      basename: marker.basename,
    },
    null,
    2,
  )}\n`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Parse and validate one persisted marker. A payload is accepted only when its
 * schema matches, all four fields are strings, the identifier is 32 lowercase
 * hex characters, and the recorded key is exactly the sanitised recorded
 * basename plus the discriminator the identifier derives (DEC-3, DEC-17).
 */
export const parseProjectIdentityMarker = (text: string): ProjectIdentityMarker | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) return undefined;
  const { schema, projectKey, projectIdentifier, basename } = parsed;
  if (schema !== PROJECT_IDENTITY_SCHEMA) return undefined;
  if (
    typeof projectKey !== "string" ||
    typeof projectIdentifier !== "string" ||
    typeof basename !== "string"
  ) {
    return undefined;
  }
  if (!PROJECT_IDENTIFIER_PATTERN.test(projectIdentifier)) return undefined;
  if (!PROJECT_KEY_PATTERN.test(projectKey)) return undefined;
  const expectedKey = projectKeyFor(sanitizeProjectBasename(basename), projectIdentifier);
  if (projectKey !== expectedKey) return undefined;
  return { schema: PROJECT_IDENTITY_SCHEMA, projectKey, projectIdentifier, basename };
};

/**
 * The lenient marker fields used only for DEC-16 naming: when the bytes parse
 * but the payload is out of shape, the recorded key and identifier are still
 * named in the refusal when they are readable as strings.
 */
const lenientIdentityFields = (
  text: string,
): {
  readonly projectKey?: string;
  readonly projectIdentifier?: string;
} => {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) return {};
    const { projectKey, projectIdentifier } = parsed;
    return {
      ...(typeof projectKey === "string" ? { projectKey } : {}),
      ...(typeof projectIdentifier === "string" ? { projectIdentifier } : {}),
    };
  } catch {
    return {};
  }
};

const markerNaming = (text: string): string => {
  const fields = lenientIdentityFields(text);
  if (fields.projectKey === undefined && fields.projectIdentifier === undefined) return "";
  const key = fields.projectKey === undefined ? "" : `key ${fields.projectKey}`;
  const identifier =
    fields.projectIdentifier === undefined ? "" : `identifier ${fields.projectIdentifier}`;
  return ` (${[key, identifier].filter((part) => part.length > 0).join(", ")})`;
};

/**
 * The two declared outputs every consumer selects from (GH-288 F-6, AC-F6-1):
 * the host root for host-wide controls (the owner-hold read) and the project
 * root for everything a repository owns (the store, the socket, the audit
 * ledger, the dispatch state, the retro sidecar). An `unbound` scope has no
 * project, so `projectRoot` is its declared host-scoped root; a consumer that
 * needs a project must read `scope.kind` first.
 */
export type StateScopeRoots = {
  readonly hostRoot: string;
  readonly projectRoot: string;
};

/** Select the host root and the project root from one resolved scope. */
export const stateScopeRoots = (outcome: ProjectScopeOutcome): StateScopeRoots => ({
  hostRoot: outcome.scope.hostRoot,
  projectRoot: outcome.scope.stateLocation,
});

/** The closed-outcome checkout facts supplied by the adapter seam (DEC-17). */
export type CheckoutIdentityFacts =
  | { readonly kind: "unbound" }
  | {
      readonly kind: "unreadable";
      readonly checkoutRoot: string;
      readonly dotGitPath: string;
    }
  | {
      readonly kind: "resolved";
      readonly checkoutRoot: string;
      readonly commonDir: string;
    };

/** The narrowed identity outcome carried in a success result (DEC-17). */
export type ProjectScopeOutcome =
  | { readonly outcome: "existing"; readonly scope: ProjectScope }
  | { readonly outcome: "mint"; readonly scope: ProjectScope }
  | { readonly outcome: "unbound"; readonly scope: ProjectScope };

/** One classified scope failure: configuration, identity, or state location. */
export type ProjectsScopeFailure =
  | {
      readonly kind: "config";
      readonly code: "config.value.invalid";
      readonly key: string;
    }
  | {
      readonly kind: "identity";
      readonly code: "projects.identity-unreadable";
      readonly summary: string;
    }
  | {
      readonly kind: "state";
      readonly code: "projects.state-unavailable";
      readonly summary: string;
    };

/** The identity-marker seam the adapter implements; no policy module reads I/O. */
export type ProjectIdentityPorts = {
  /** Read the raw marker text from the checkout's git common directory. */
  readonly readMarker: (commonDir: string) => ProjectIdentityMarkerRead;
  /** Create the marker once; returns the persisted text (the winner's on a race). */
  readonly writeMarker: (commonDir: string, text: string) => string | undefined;
  /** Mint one random 128-bit project identifier as 32 lowercase hex characters. */
  readonly newProjectIdentifier: () => string;
};

/** The complete policy input: injected facts plus the marker seam. */
export type ProjectScopeInput = HostStateRootInput & {
  readonly checkout: CheckoutIdentityFacts;
  readonly ports: ProjectIdentityPorts;
};

const identityFailure = (summary: string): ProjectsScopeFailure => ({
  kind: "identity",
  code: PROJECTS_ERROR_CODES[0],
  summary,
});

const stateFailure = (summary: string): ProjectsScopeFailure => ({
  kind: "state",
  code: PROJECTS_ERROR_CODES[2],
  summary,
});

const projectScopeOf = (
  hostRoot: string,
  checkoutRoot: string,
  marker: ProjectIdentityMarker,
  outcome: "existing" | "mint",
): ProjectScopeOutcome => ({
  outcome,
  scope: {
    kind: "project",
    hostRoot,
    projectKey: marker.projectKey,
    projectIdentifier: marker.projectIdentifier,
    checkoutRoot,
    stateLocation: projectStateRoot(hostRoot, marker.projectKey),
  },
});

/**
 * Resolve one invocation's scope (F-1, F-6, DEC-17).
 *
 * Not a work tree is the declared `unbound` scope and is never a failure. Git
 * metadata that cannot be resolved, or a marker that cannot be read or whose
 * key disagrees with its recorded fields, is an identity refusal. A marker that
 * cannot be created is a state-location failure, never a path-derived
 * substitute key.
 */
export const resolveProjectScope = (
  input: ProjectScopeInput,
): Result<ProjectScopeOutcome, ProjectsScopeFailure> => {
  const hostRoot = resolveHostStateRoot(input);
  if (!hostRoot.ok) {
    return {
      ok: false,
      error: {
        kind: "config",
        code: "config.value.invalid",
        key: hostRoot.error.key ?? environmentVariableName(input.environmentPrefix),
      },
    };
  }
  const root = hostRoot.value;
  if (input.checkout.kind === "unbound") {
    return {
      ok: true,
      value: {
        outcome: "unbound",
        scope: { kind: "unbound", hostRoot: root, stateLocation: unboundStateRoot(root) },
      },
    };
  }
  if (input.checkout.kind === "unreadable") {
    return {
      ok: false,
      error: identityFailure(
        `the git metadata of checkout ${input.checkout.checkoutRoot} is unusable ` +
          `(${input.checkout.dotGitPath} has no resolvable git directory)`,
      ),
    };
  }
  const checkout = input.checkout;
  const read = input.ports.readMarker(checkout.commonDir);
  if (read.state === "unreadable") {
    return {
      ok: false,
      error: identityFailure(
        `the identity marker of checkout ${checkout.checkoutRoot} cannot be read ` +
          `(${checkout.commonDir}/${PROJECT_IDENTITY_MARKER_NAME})`,
      ),
    };
  }
  if (read.state === "present") {
    const marker = parseProjectIdentityMarker(read.text);
    if (marker === undefined) {
      return {
        ok: false,
        error: identityFailure(
          `the identity marker of checkout ${checkout.checkoutRoot} is invalid or ` +
            `inconsistent with its recorded key${markerNaming(read.text)} ` +
            `(${checkout.commonDir}/${PROJECT_IDENTITY_MARKER_NAME})`,
        ),
      };
    }
    return { ok: true, value: projectScopeOf(root, checkout.checkoutRoot, marker, "existing") };
  }
  const projectIdentifier = input.ports.newProjectIdentifier();
  if (!PROJECT_IDENTIFIER_PATTERN.test(projectIdentifier)) {
    return {
      ok: false,
      error: stateFailure(
        `no project identity could be minted for checkout ${checkout.checkoutRoot}`,
      ),
    };
  }
  const basename = sanitizeProjectBasename(checkoutDirectoryName(checkout.checkoutRoot));
  const minted: ProjectIdentityMarker = {
    schema: PROJECT_IDENTITY_SCHEMA,
    projectKey: projectKeyFor(basename, projectIdentifier),
    projectIdentifier,
    basename,
  };
  const persisted = input.ports.writeMarker(
    checkout.commonDir,
    serializeProjectIdentityMarker(minted),
  );
  if (persisted === undefined) {
    return {
      ok: false,
      error: stateFailure(
        `the identity marker of checkout ${checkout.checkoutRoot} could not be created ` +
          `(${checkout.commonDir}/${PROJECT_IDENTITY_MARKER_NAME})`,
      ),
    };
  }
  const winner = parseProjectIdentityMarker(persisted);
  if (winner === undefined) {
    return {
      ok: false,
      error: identityFailure(
        `the identity marker of checkout ${checkout.checkoutRoot} is invalid or ` +
          `inconsistent with its recorded key (${checkout.commonDir}/${PROJECT_IDENTITY_MARKER_NAME})`,
      ),
    };
  }
  return { ok: true, value: projectScopeOf(root, checkout.checkoutRoot, winner, "mint") };
};
