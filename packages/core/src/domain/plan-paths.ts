/**
 * Pure plan path semantics (GH-226 F-2, DM-2).
 *
 * `files` are concrete paths, `folders` are boundary-aware directory prefixes,
 * and `packages` are package-granularity globs. No I/O, clock, or environment
 * access: the comparison contract is documented on the plan contract types.
 */
import type { PlanScope } from "#contracts";

/** Normalize a repository-relative path without touching the filesystem. */
export const normalizeRepoPath = (value: string): string => {
  let path = value.trim().replaceAll("\\", "/");
  while (path.startsWith("./")) path = path.slice(2);
  path = path.replace(/\/+/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
};

const escapeSegment = (segment: string): string =>
  segment.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");

/** Compile a package glob; `**` crosses path segments, `*` stays inside one. */
export const globToRegExp = (pattern: string): RegExp => {
  const source = pattern
    .split("/")
    .map((segment) => (segment === "**" ? "(?:.*)" : escapeSegment(segment)))
    .join("/");
  return new RegExp(`^${source}$`);
};

const folderCovers = (folder: string, target: string): boolean =>
  target === folder || target.startsWith(`${folder}/`);

/** True when a package entry (glob or folder prefix) covers a concrete path. */
export const packageCovers = (entry: string, target: string): boolean => {
  const pattern = normalizeRepoPath(entry);
  if (pattern.includes("*")) return globToRegExp(pattern).test(normalizeRepoPath(target));
  return folderCovers(pattern, normalizeRepoPath(target));
};

/** True when a declared scope covers a concrete repository path. */
export const scopeCoversPath = (scope: PlanScope, target: string): boolean => {
  const path = normalizeRepoPath(target);
  for (const file of scope.files ?? []) {
    if (normalizeRepoPath(file) === path) return true;
  }
  for (const folder of scope.folders ?? []) {
    if (folderCovers(normalizeRepoPath(folder), path)) return true;
  }
  for (const entry of scope.packages ?? []) {
    if (packageCovers(entry, path)) return true;
  }
  return false;
};

/** The static prefix of a glob, used for pattern-versus-pattern comparison. */
export const staticPrefix = (value: string): string => {
  const pattern = normalizeRepoPath(value);
  const wildcard = pattern.search(/[*?]/);
  if (wildcard === -1) return pattern;
  const slash = pattern.lastIndexOf("/", wildcard);
  return slash === -1 ? "" : pattern.slice(0, slash);
};
