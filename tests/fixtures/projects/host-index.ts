/**
 * Host-index read helpers (GH-288 TC-PROJ-009).
 *
 * The document is untrusted input by contract, so tests read it through the
 * delivered parser and the artifact name from the contracts module; nothing
 * here spells the file name.
 */
import { readFileSync } from "node:fs";
import { hostIndexDocumentPath } from "../../../packages/adapters/src/file/host-index-store";
import { parseHostIndexDocument } from "../../../packages/core/src/app/host-index";
import {
  HOST_INDEX_INITIAL_REVISION,
  type HostIndexDocument,
  type HostIndexEntry,
} from "../../../packages/core/src/contracts/projects";

/** The raw index bytes, or undefined when absent. */
export const hostIndexTextOf = (hostRoot: string): string | undefined => {
  try {
    return readFileSync(hostIndexDocumentPath(hostRoot), "utf8");
  } catch {
    return undefined;
  }
};

/** The parsed index document, or undefined when absent or corrupt. */
export const hostIndexOf = (hostRoot: string): HostIndexDocument | undefined => {
  const text = hostIndexTextOf(hostRoot);
  return text === undefined ? undefined : parseHostIndexDocument(text);
};

/** The maintained entries, empty when the index is absent. */
export const hostIndexEntriesOf = (hostRoot: string): readonly HostIndexEntry[] =>
  hostIndexOf(hostRoot)?.projects ?? [];

/** The revision the document carries; the initial revision when absent. */
export const hostIndexRevisionOf = (hostRoot: string): number =>
  hostIndexOf(hostRoot)?.revision ?? HOST_INDEX_INITIAL_REVISION;

/** The recorded entry for one key, or undefined. */
export const hostIndexEntryOf = (
  hostRoot: string,
  projectKey: string,
): HostIndexEntry | undefined =>
  hostIndexEntriesOf(hostRoot).find((entry) => entry.projectKey === projectKey);

/** The recorded project keys, sorted. */
export const hostIndexKeysOf = (hostRoot: string): readonly string[] =>
  hostIndexEntriesOf(hostRoot)
    .map((entry) => entry.projectKey)
    .sort();
