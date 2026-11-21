/**
 * GH-365 F-3 — migration entry digest facts (pure).
 *
 * One entry is a file or a subdirectory of a root; a directory's facts are the
 * recursive file list with each file's size and SHA-256 digest. The facts are
 * recorded before a copy and re-read after it, so a move is digest-verified.
 */
import type { InstallFilePort } from "#contracts";

export type MigrationFileFact = {
  readonly relativePath: string;
  readonly size: number;
  readonly sha256: string;
};

export type MigrationEntryFacts = {
  readonly files: readonly MigrationFileFact[];
  readonly fileCount: number;
  readonly byteCount: number;
};

const EMPTY: MigrationEntryFacts = { files: [], fileCount: 0, byteCount: 0 };

const baseName = (path: string): string => {
  const trimmed = path.replace(/\/+$/u, "");
  const index = trimmed.lastIndexOf("/");
  return index < 0 ? trimmed : trimmed.slice(index + 1);
};

/** Collect one entry's file facts; a symlink or other node yields no facts. */
export const entryFacts = (
  fs: InstallFilePort,
  absolutePath: string,
  relativePath: string,
): MigrationEntryFacts => {
  const stat = fs.stat(absolutePath);
  if (stat === undefined) return EMPTY;
  if (stat.kind === "file") {
    const sha256 = fs.digest(absolutePath) ?? "";
    return {
      files: [
        {
          relativePath: relativePath.length === 0 ? baseName(absolutePath) : relativePath,
          size: stat.size,
          sha256,
        },
      ],
      fileCount: 1,
      byteCount: stat.size,
    };
  }
  if (stat.kind !== "directory") return EMPTY;
  const files: MigrationFileFact[] = [];
  for (const name of [...fs.list(absolutePath)].sort()) {
    const child = entryFacts(
      fs,
      `${absolutePath}/${name}`,
      relativePath.length === 0 ? name : `${relativePath}/${name}`,
    );
    files.push(...child.files);
  }
  return {
    files,
    fileCount: files.length,
    byteCount: files.reduce((total, file) => total + file.size, 0),
  };
};

/** Two entries are byte-identical when every file's path, size and digest agree. */
export const factsEqual = (left: MigrationEntryFacts, right: MigrationEntryFacts): boolean => {
  if (left.files.length !== right.files.length) return false;
  return left.files.every((file, index) => {
    const other = right.files[index];
    return (
      other !== undefined &&
      file.relativePath === other.relativePath &&
      file.size === other.size &&
      file.sha256 === other.sha256 &&
      file.sha256.length > 0
    );
  });
};
