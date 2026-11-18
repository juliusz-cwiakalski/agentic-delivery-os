/**
 * `@delivery-os/adapters/file` — the install destination and its file port.
 *
 * The adapter owns every I/O the install lifecycle performs on the artifact
 * paths: the destination classification, staging in the destination directory
 * on the same file system, the two renames, the slot read, and the staged-file
 * verification. The domain never reads the filesystem directly.
 */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import type {
  InstallFilePort,
  InstallFileStat,
  InstallStagedWrite,
} from "@delivery-os/core/contracts";

/** The execute bit every staged artifact must carry. */
export const INSTALL_ARTIFACT_MODE = 0o755;

let stagedCounter = 0;

const stagedPathFor = (path: string): string => {
  stagedCounter += 1;
  return join(
    dirname(path),
    `.${basename(path)}.staged-${String(process.pid)}-${String(stagedCounter)}.tmp`,
  );
};

/** The node file port the install handlers consume. */
export const createNodeInstallFilePort = (): InstallFilePort => ({
  stat: (path) => {
    try {
      const link = lstatSync(path);
      if (link.isSymbolicLink()) {
        return { kind: "symlink", size: 0, executable: false, mtimeMs: link.mtimeMs };
      }
      if (link.isDirectory()) {
        return { kind: "directory", size: 0, executable: false, mtimeMs: link.mtimeMs };
      }
      const stats = statSync(path);
      return {
        kind: "file",
        size: stats.size,
        executable: (stats.mode & 0o111) !== 0,
        mtimeMs: stats.mtimeMs,
      };
    } catch {
      try {
        const stats = statSync(path);
        return {
          kind: stats.isDirectory() ? "directory" : "other",
          size: stats.size,
          executable: (stats.mode & 0o111) !== 0,
          mtimeMs: stats.mtimeMs,
        };
      } catch {
        return undefined;
      }
    }
  },
  readText: (path) => {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return undefined;
    }
  },
  readBytes: (path) => {
    try {
      return readFileSync(path);
    } catch {
      return undefined;
    }
  },
  writeStaged: (path, bytes, mode) => {
    const staged = stagedPathFor(path);
    try {
      writeFileSync(staged, bytes, { mode });
      return { ok: true, stagedPath: staged };
    } catch {
      try {
        rmSync(staged, { force: true });
      } catch {
        // A staging failure leaves no path to clean; the caller reports it.
      }
      return { ok: false, reason: "the staged file could not be written" };
    }
  },
  copyStaged: (path, sourcePath, mode) => {
    const staged = stagedPathFor(path);
    try {
      copyFileSync(sourcePath, staged);
      const stats = statSync(staged);
      if ((stats.mode & 0o111) === 0) {
        // `copyFileSync` preserves content but the mode can arrive read-only on
        // some umasks; the staged copy must be executable before the rename.
        writeFileSync(staged, readFileSync(staged), { mode });
      }
      return { ok: true, stagedPath: staged };
    } catch {
      try {
        rmSync(staged, { force: true });
      } catch {
        // See above: nothing to clean.
      }
      return { ok: false, reason: "the staged copy could not be written" };
    }
  },
  digest: (path) => {
    try {
      return createHash("sha256").update(readFileSync(path)).digest("hex");
    } catch {
      return undefined;
    }
  },
  rename: (from, to) => {
    try {
      renameSync(from, to);
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
  list: (path) => {
    try {
      return [...readdirSync(path)].sort();
    } catch {
      return [];
    }
  },
  exists: (path) => existsSync(path),
  mkdirp: (path) => {
    try {
      mkdirSync(path, { recursive: true });
      return true;
    } catch {
      return false;
    }
  },
  chmod: (path, mode) => {
    try {
      writeFileSync(path, readFileSync(path), { mode });
      return true;
    } catch {
      return false;
    }
  },
  removeTree: (path) => {
    try {
      rmSync(path, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  },
});

/** The declared destination classes (Appendix C.2). */
export const INSTALL_DESTINATION_CLASSES = [
  "absent",
  "compiled-artifact",
  "launcher",
  "symlink",
  "directory",
  "other",
] as const;
export type InstallDestinationClass = (typeof INSTALL_DESTINATION_CLASSES)[number];

/** The launcher marker the delivered installer writes and the guard reads. */
export const LAUNCHER_TARGET_MARKER = "TARGET=" as const;

/**
 * Whether a path holds the delivered bash launcher.
 *
 * The delivered launcher is a script: it starts with a shebang and records its
 * checkout target in a `TARGET=` line. Detection is by content, never by the
 * install record.
 */
export const isLauncherAtPath = (fs: InstallFilePort, path: string): boolean => {
  const stat = fs.stat(path);
  if (stat === undefined || stat.kind !== "file") return false;
  if (stat.size > 1024 * 1024) return false;
  const text = fs.readText(path);
  if (text === undefined) return false;
  return text.startsWith("#!") && text.includes(LAUNCHER_TARGET_MARKER);
};

/** The launcher's recorded target, when one is readable. */
export const launcherTargetOf = (fs: InstallFilePort, path: string): string | undefined => {
  const text = fs.readText(path);
  if (text === undefined) return undefined;
  const line = text.split("\n").find((entry) => entry.includes(LAUNCHER_TARGET_MARKER));
  if (line === undefined) return undefined;
  const value = line.slice(line.indexOf(LAUNCHER_TARGET_MARKER) + LAUNCHER_TARGET_MARKER.length);
  const trimmed = value
    .trim()
    .replace(/^["']/u, "")
    .replace(/["']$/u, "")
    .replace(/^readonly\s+/u, "");
  return trimmed.length === 0 ? undefined : trimmed;
};

/**
 * Whether a path holds a compiled artifact this lifecycle may treat as one: a
 * regular file, non-empty, executable, and not a script. An artifact's injected
 * identity is a compile-time constant no process can read out of a file, so the
 * artifact class is decided by shape — the launcher form is the only script the
 * disposition table names.
 */
export const isCompiledArtifactAtPath = (fs: InstallFilePort, path: string): boolean => {
  const stat = fs.stat(path);
  if (stat === undefined || stat.kind !== "file") return false;
  if (stat.size === 0 || !stat.executable) return false;
  const prefix = fs.readBytes(path);
  if (prefix === undefined) return false;
  return !(prefix[0] === 0x23 && prefix[1] === 0x21);
};

/** Classify what sits at the destination (Appendix C.2). */
export const classifyInstallDestination = (
  fs: InstallFilePort,
  path: string,
): InstallDestinationClass => {
  const stat = fs.stat(path);
  if (stat === undefined) return "absent";
  if (stat.kind === "symlink") return "symlink";
  if (stat.kind === "directory") return "directory";
  if (stat.kind !== "file") return "other";
  if (isLauncherAtPath(fs, path)) return "launcher";
  if (isCompiledArtifactAtPath(fs, path)) return "compiled-artifact";
  return "other";
};

/** The symlink's recorded target, when the path is a symlink. */
export const symlinkTargetOf = (path: string): string | undefined => {
  try {
    const stats = lstatSync(path);
    return stats.isSymbolicLink() ? readlinkSync(path) : undefined;
  } catch {
    return undefined;
  }
};

export type { InstallFilePort, InstallFileStat, InstallStagedWrite };
