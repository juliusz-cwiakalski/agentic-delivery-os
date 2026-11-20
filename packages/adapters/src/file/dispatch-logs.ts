/**
 * The artifact-family filesystem edge (GH-354 F-7, F-2; API-7, API-8; DM-2).
 *
 * The runtime filesystem lives here, never in the contracts, domain, or app
 * tiers. The writer half creates `0600` files, appends without ever modifying a
 * written byte, and removes only for retention; the read half lists one
 * addressed directory and reads the files inside it.
 */
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { DispatchLogFileEntry, DispatchLogFileSystem } from "@delivery-os/core/contracts";

/** The mode every artifact file is created with. */
export const DISPATCH_LOG_FILE_MODE = 0o600;

/** The real filesystem edge over one project state root. */
export const createNodeDispatchLogFileSystem = (): DispatchLogFileSystem => ({
  ensureDirectory: (directory) => {
    try {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      return true;
    } catch {
      return false;
    }
  },
  create: (path) => {
    try {
      if (existsSync(path)) return false;
      writeFileSync(path, "", { mode: DISPATCH_LOG_FILE_MODE, flag: "wx" });
      // `mode` is subject to the umask; the declared mode is asserted, not the
      // process default.
      chmodSync(path, DISPATCH_LOG_FILE_MODE);
      return true;
    } catch {
      return false;
    }
  },
  append: (path, text) => {
    try {
      appendFileSync(path, text, { encoding: "utf8", flag: "a" });
      return true;
    } catch {
      return false;
    }
  },
  remove: (path) => {
    try {
      rmSync(path, { force: true });
      return true;
    } catch {
      return false;
    }
  },
  size: (path) => {
    try {
      return statSync(path).size;
    } catch {
      return undefined;
    }
  },
  mode: (path) => {
    try {
      return statSync(path).mode & 0o777;
    } catch {
      return undefined;
    }
  },
  exists: (path) => existsSync(path),
  list: (directory) => {
    try {
      const entries: DispatchLogFileEntry[] = [];
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const path = join(directory, entry.name);
        entries.push({ name: entry.name, sizeBytes: statSync(path).size });
      }
      return entries;
    } catch {
      return undefined;
    }
  },
  read: (path) => {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return undefined;
    }
  },
});
