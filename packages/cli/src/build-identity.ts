/**
 * The compile-time build identity (F-2, DM-1).
 *
 * The identity is one constant object injected by the additive build entry
 * (`scripts/build-binary.ts`) through the pinned compiler's define mechanism.
 * It is read through a presence guard, so a workspace run, a test, or an
 * embedder that never injects it keeps the delivered `0.0.0`/`dev` defaults
 * verbatim. This module imports nothing ambient and holds no working-name
 * literal: the artifact name is derived at the one declared build-side site.
 */

/** The five declared identity fields captured at build time (DM-1). */
export type BuildIdentity = {
  readonly version: string;
  readonly commit: string;
  readonly builtAt: string;
  readonly dirty: boolean;
  readonly channel: string;
};

/**
 * The compiler's define target. A non-injected run leaves the identifier
 * undeclared, and `typeof` reads it without throwing.
 */
declare const INJECTED_BUILD_IDENTITY: BuildIdentity | undefined;

/** The delivered fallback version and token for a non-compiled run. */
const FALLBACK_VERSION = "0.0.0";
const FALLBACK_TOKEN = "dev";
const NO_GIT_TOKEN = "unknown";
const COMMIT_TOKEN_LENGTH = 7;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isBuildIdentity = (value: unknown): value is BuildIdentity => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const source = value as Record<string, unknown>;
  return (
    isNonEmptyString(source.version) &&
    isNonEmptyString(source.commit) &&
    isNonEmptyString(source.builtAt) &&
    typeof source.dirty === "boolean" &&
    isNonEmptyString(source.channel)
  );
};

/**
 * The injected identity, or `undefined` when this run carries none.
 *
 * A malformed injection is treated as absent rather than partially trusted, so
 * no half-written identity can reach the version line or the install record.
 */
export const injectedBuildIdentity = (): BuildIdentity | undefined => {
  const candidate: unknown =
    typeof INJECTED_BUILD_IDENTITY === "undefined" ? undefined : INJECTED_BUILD_IDENTITY;
  return isBuildIdentity(candidate) ? candidate : undefined;
};

/** The short commit token: the first seven characters of the full commit. */
export const shortCommitOf = (commit: string): string =>
  commit.length > COMMIT_TOKEN_LENGTH ? commit.slice(0, COMMIT_TOKEN_LENGTH) : commit;

/**
 * The `--version` build-slot token (Appendix A): the short commit, the short
 * commit with `-dirty`, `unknown` when the build had no git metadata, or `dev`
 * when the run carries no injected identity.
 */
export const buildTokenOf = (identity: BuildIdentity | undefined): string => {
  if (identity === undefined) return FALLBACK_TOKEN;
  if (identity.commit === NO_GIT_TOKEN) return NO_GIT_TOKEN;
  const short = shortCommitOf(identity.commit);
  return identity.dirty ? `${short}-dirty` : short;
};

/** The delivered fallback version for a run that carries no injected identity. */
export const fallbackVersion = (): string => FALLBACK_VERSION;
