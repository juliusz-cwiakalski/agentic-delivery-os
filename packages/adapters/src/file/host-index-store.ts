/**
 * The host-index file seam (GH-288 F-2, DEC-4, DEC-14).
 *
 * One bounded read, one atomic replace, and one evidence-preserving write for a
 * corrupt document. The index is untrusted input by contract: this seam only
 * reports absent / present / unreadable and writes bytes it is given. The pure
 * fold decides what those bytes are.
 *
 * The access fact is observability only: it counts reads, writes, and listings
 * and accepts no root, key, or path, so no test can use it to inject state.
 */
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { HOST_INDEX_ARTIFACT_NAME } from "@delivery-os/core/contracts";

/** The index document path inside one host root (declared once). */
export const hostIndexDocumentPath = (hostRoot: string): string =>
  join(hostRoot, HOST_INDEX_ARTIFACT_NAME);

/** The bounded read result: absent, present bytes, or an unreadable path. */
export type HostIndexRead =
  | { readonly state: "absent" }
  | { readonly state: "present"; readonly text: string }
  | { readonly state: "unreadable" };

/** Read the index document once; never throws. */
export const readHostIndexFile = (hostRoot: string): HostIndexRead => {
  const path = hostIndexDocumentPath(hostRoot);
  try {
    if (!existsSync(path)) return { state: "absent" };
    return { state: "present", text: readFileSync(path, "utf8") };
  } catch (error) {
    return (error as { readonly code?: unknown }).code === "ENOENT"
      ? { state: "absent" }
      : { state: "unreadable" };
  }
};

/** Write one payload to a synced sibling file; undefined on failure. */
const writeSibling = (path: string, content: string): string | undefined => {
  const temporary = `${path}.${process.pid.toString(36)}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  rmSync(temporary, { force: true });
  try {
    const descriptor = openSync(temporary, "wx", 0o600);
    try {
      writeFileSync(descriptor, content, "utf8");
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    return temporary;
  } catch {
    rmSync(temporary, { force: true });
    return undefined;
  }
};

/**
 * Replace the index document atomically: a fully written, synced sibling is
 * renamed over the final path, so no reader observes a torn index.
 */
export const replaceHostIndexFile = (hostRoot: string, content: string): boolean => {
  const path = hostIndexDocumentPath(hostRoot);
  const temporary = writeSibling(path, content);
  if (temporary === undefined) return false;
  try {
    renameSync(temporary, path);
    return true;
  } catch {
    return false;
  } finally {
    rmSync(temporary, { force: true });
  }
};

/**
 * Preserve a corrupt index as a timestamped sibling, exactly once: the sibling
 * is created exclusively, so a second maintenance pass never overwrites the
 * preserved evidence (DEC-14).
 */
export const preserveCorruptHostIndex = (
  hostRoot: string,
  siblingName: string,
  content: string,
): boolean => {
  const path = join(hostRoot, siblingName);
  mkdirSync(dirname(path), { recursive: true });
  try {
    const descriptor = openSync(path, "wx", 0o600);
    try {
      writeFileSync(descriptor, content, "utf8");
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    return true;
  } catch {
    return false;
  }
};

/** Whether the index document exists at all (the list path never writes). */
export const hostIndexExists = (hostRoot: string): boolean => {
  try {
    return statSync(hostIndexDocumentPath(hostRoot)).isFile();
  } catch {
    return false;
  }
};

/**
 * The observability-only index-access fact: three counters and no capability.
 * Production reads it to make "one read, at most one write" observable.
 */
export type HostIndexAccess = {
  readonly reads: number;
  readonly writes: number;
  readonly lists: number;
  readonly countRead: () => void;
  readonly countWrite: () => void;
  readonly countList: () => void;
};

/** Create one fresh counter set (one per composition, never ambient). */
export const createHostIndexAccess = (): HostIndexAccess => {
  const counters = { reads: 0, writes: 0, lists: 0 };
  return {
    get reads() {
      return counters.reads;
    },
    get writes() {
      return counters.writes;
    },
    get lists() {
      return counters.lists;
    },
    countRead: () => {
      counters.reads += 1;
    },
    countWrite: () => {
      counters.writes += 1;
    },
    countList: () => {
      counters.lists += 1;
    },
  };
};
