/**
 * GH-365 P5 migration filesystem facts: a write/creation recorder over the
 * delivered node install file port, plus the record recorder the audit-suppression
 * assertions drive.
 */
import { createNodeInstallFilePort } from "../../../packages/adapters/src/file";
import type { InstallFilePort } from "../../../packages/core/src/contracts/install";

export type RecordingFs = InstallFilePort & {
  readonly writes: string[];
  readonly directories: string[];
};

/** Wrap the production port; every mutating call is recorded. */
export const createRecordingFs = (
  base: InstallFilePort = createNodeInstallFilePort(),
): RecordingFs => {
  const writes: string[] = [];
  const directories: string[] = [];
  return {
    ...base,
    writes,
    directories,
    mkdirp: (path) => {
      const ok = base.mkdirp(path);
      if (ok) directories.push(path);
      return ok;
    },
    writeStaged: (path, bytes, mode) => {
      const result = base.writeStaged(path, bytes, mode);
      if (result.ok) writes.push(path);
      return result;
    },
    copyStaged: (path, sourcePath, mode) => {
      const result = base.copyStaged(path, sourcePath, mode);
      if (result.ok) writes.push(path);
      return result;
    },
    rename: (from, to) => {
      const ok = base.rename(from, to);
      if (ok) writes.push(to);
      return ok;
    },
    remove: (path) => {
      const ok = base.remove(path);
      if (ok) writes.push(path);
      return ok;
    },
    removeTree: (path) => {
      const ok = base.removeTree(path);
      if (ok) writes.push(path);
      return ok;
    },
  };
};

/** The record recorder: an audit dependency that records every attempted write. */
export type RecordRecorder = {
  readonly records: readonly unknown[];
  readonly audit: {
    readonly scope: string;
    readonly record: (facts: unknown) => { readonly ok: true };
  };
};

export const createRecordRecorder = (): RecordRecorder => {
  const records: unknown[] = [];
  return {
    records,
    audit: {
      scope: "project",
      record: (facts) => {
        records.push(facts);
        return { ok: true };
      },
    },
  };
};
