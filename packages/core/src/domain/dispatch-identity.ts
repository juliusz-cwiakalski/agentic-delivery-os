/**
 * Rename-invariant repository identity for dispatch evidence and authority
 * (GH-239 F-6; DEC-13; TDR-0015 §6, AC-F6-6).
 *
 * Resolution order: the scheduling engine's normalized `repository` key, the
 * checkout's configured VCS remote normalized the same way, then a persisted
 * first-use marker created through store-managed artifact semantics. A
 * checkout-path digest is never presented as an identity; when none resolves
 * the caller refuses cleanly.
 */

/** The half-open repository identity pattern: `host/owner/name`. */
const IDENTITY_PATTERN = /^[a-z0-9][a-z0-9.-]*\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** The identity sources in resolution order. */
export const DISPATCH_IDENTITY_SOURCES = ["scheduler", "remote", "marker"] as const;

export type DispatchIdentitySource = (typeof DISPATCH_IDENTITY_SOURCES)[number];

/** A resolved identity and the source that produced it. */
export type DispatchIdentityResolution =
  | {
      readonly ok: true;
      readonly repository: string;
      readonly source: DispatchIdentitySource;
    }
  | { readonly ok: false; readonly reason: "unresolvable" };

/** Normalize one component (host, owner, or name) deterministically. */
const normalizeComponent = (value: string): string => value.trim().replace(/\.git$/i, "");

/** The declared identity shape: a normalized `host/owner/name` key. */
export const isRepositoryIdentity = (value: string): boolean => IDENTITY_PATTERN.test(value);

/** Normalize a scheduler key (`host/owner/name`); undefined when unusable. */
export const normalizeDispatchRepositoryKey = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  const parts = trimmed.split("/");
  if (parts.length !== 3) return undefined;
  const [host, owner, name] = parts.map(normalizeComponent) as [string, string, string];
  if (host.length === 0 || owner.length === 0 || name.length === 0) return undefined;
  const normalized = `${host.toLowerCase()}/${owner}/${name}`;
  return isRepositoryIdentity(normalized) ? normalized : undefined;
};

/**
 * Normalize a configured VCS remote (`git@host:owner/name.git`,
 * `ssh://host/owner/name`, or `https://host/owner/name(.git)`) to the identity
 * shape. Any other remote form is not an identity.
 */
export const normalizeRepositoryRemote = (remote: string | undefined): string | undefined => {
  if (remote === undefined) return undefined;
  const trimmed = remote.trim();
  if (trimmed.length === 0) return undefined;

  const scp = /^(?:[^@/]+@)?([^:/]+):([^/]+)\/([^/]+?)(?:\.git)?$/.exec(trimmed);
  if (scp !== null) {
    const host = scp[1] as string;
    const owner = scp[2] as string;
    const name = scp[3] as string;
    return normalizeDispatchRepositoryKey(`${host}/${owner}/${name}`);
  }

  const url = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/i.exec(trimmed);
  if (url !== null) {
    const host = url[1] as string;
    const path = (url[2] as string).replace(/\.git$/i, "");
    const segments = path.split("/").filter((segment) => segment.length > 0);
    if (segments.length === 2) {
      return normalizeDispatchRepositoryKey(`${host}/${segments[0]}/${segments[1]}`);
    }
    return undefined;
  }

  // A bare `host/owner/name` remote is accepted; a local path or a checkout path
  // is not an identity and must never be turned into a digest.
  return normalizeDispatchRepositoryKey(trimmed);
};

/** The persisted first-use marker payload schema. */
export const DISPATCH_IDENTITY_SCHEMA = "delivery.dispatch.identity.v1" as const;

/** Parse a persisted marker into the repository it binds. */
export const parseIdentityMarker = (content: string): string | undefined => {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
    const record = parsed as { readonly schema?: unknown; readonly repository?: unknown };
    if (record.schema !== DISPATCH_IDENTITY_SCHEMA) return undefined;
    if (typeof record.repository !== "string") return undefined;
    return isRepositoryIdentity(record.repository) ? record.repository : undefined;
  } catch {
    return undefined;
  }
};

/** Serialize the marker payload for one identity. */
export const serializeIdentityMarker = (repository: string): string =>
  JSON.stringify({ schema: DISPATCH_IDENTITY_SCHEMA, repository });

/**
 * Resolve the identity from the declared inputs, in order.
 *
 * A checkout path participates only as a refusal trigger: it is never hashed
 * or presented as a stable identity.
 */
export const resolveDispatchIdentity = (input: {
  readonly schedulerKey?: string;
  readonly remoteUrl?: string;
  readonly persistedMarker?: string;
}): DispatchIdentityResolution => {
  // A persisted binding governs: a later derived value never re-keys history
  // (TDR-0015 §6).
  const marker =
    input.persistedMarker === undefined
      ? undefined
      : parseIdentityMarker(input.persistedMarker) ??
        normalizeDispatchRepositoryKey(input.persistedMarker);
  if (marker !== undefined) {
    return { ok: true, repository: marker, source: "marker" };
  }
  const scheduler = normalizeDispatchRepositoryKey(input.schedulerKey);
  if (scheduler !== undefined) {
    return { ok: true, repository: scheduler, source: "scheduler" };
  }
  const remote = normalizeRepositoryRemote(input.remoteUrl);
  if (remote !== undefined) {
    return { ok: true, repository: remote, source: "remote" };
  }
  return { ok: false, reason: "unresolvable" };
};
