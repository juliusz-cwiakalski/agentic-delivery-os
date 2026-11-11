/**
 * The delivered state-root inventory (GH-288 F-8, AC-F8-2, A4).
 *
 * The legacy detector must tell "the host root still holds a store" from "it
 * does not" without opening a store there, and the predicate is defined over
 * **store artifacts only**: the host index, the host-wide owner-hold marker, the
 * project container and the declared `unbound` scope are excluded by name, so a
 * migrated host whose host root holds only those never warns.
 *
 * Read-only and non-recursive: exactly one directory listing at the given root,
 * with no descent into `documents.<workspace>/` or `quarantine.<workspace>/`.
 */
import { readdirSync } from "node:fs";
import { HOST_INDEX_ARTIFACT_NAME } from "@delivery-os/core/contracts";
import { OWNER_HOLD_MARKER_NAME } from "@delivery-os/core/contracts";
import { PROJECTS_CONTAINER_SEGMENT, PROJECT_UNBOUND_SEGMENT } from "@delivery-os/core/contracts";

/** The delivered store artifact shapes, under one workspace id. */
const STORE_FILE_PATTERNS: readonly RegExp[] = [
  /^ledger\.[^.]+\.jsonl$/u,
  /^header\.[^.]+\.json$/u,
  /^index\.[^.]+\.sqlite$/u,
  /^fence\.[^.]+\.lock$/u,
  /^chain-key\.[^.]+\.json$/u,
  /^chain-key\.retro\.[^.]+\.json$/u,
  /^retro-evidence\.[^.]+\.jsonl$/u,
  /^retro-evidence\.lock$/u,
];

/** The delivered store directory shapes, under one workspace id. */
const STORE_DIRECTORY_PATTERNS: readonly RegExp[] = [/^documents\.[^.]+$/u, /^quarantine\.[^.]+$/u];

/** Names that live at the host root by contract and are never store artifacts. */
const EXCLUDED_NAMES: readonly string[] = [
  HOST_INDEX_ARTIFACT_NAME,
  OWNER_HOLD_MARKER_NAME,
  PROJECTS_CONTAINER_SEGMENT,
  PROJECT_UNBOUND_SEGMENT,
];

/** Whether one entry name is a delivered store artifact of the given kind. */
export const isStoreArtifactName = (name: string, directory: boolean): boolean => {
  if (EXCLUDED_NAMES.includes(name)) return false;
  // A corrupt-index sibling is host-index evidence, not a store artifact.
  if (name.startsWith(`${HOST_INDEX_ARTIFACT_NAME}.`)) return false;
  return directory
    ? STORE_DIRECTORY_PATTERNS.some((pattern) => pattern.test(name))
    : STORE_FILE_PATTERNS.some((pattern) => pattern.test(name));
};

/**
 * The delivered store artifacts present directly at one state root, sorted.
 * An absent or unreadable root has none (`[]`), which is the honest answer for
 * a first run and never throws.
 */
export const readStateRootArtifacts = (stateRoot: string): readonly string[] => {
  try {
    return readdirSync(stateRoot, { withFileTypes: true })
      .filter((entry) => isStoreArtifactName(entry.name, entry.isDirectory()))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
};
