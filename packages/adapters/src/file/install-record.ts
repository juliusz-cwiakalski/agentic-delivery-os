/**
 * `@delivery-os/adapters/file` — the install record's one atomic writer.
 *
 * The step-7 write, the rollback update, and the step-4 reconciliation all go
 * through this one staged-and-renamed write, so there is no second record format
 * and no partial write. Nothing here ever writes in place.
 */
import { dirname } from "node:path";
import type { InstallFilePort } from "@delivery-os/core/contracts";

/** The record file mode: an operator-owned, non-secret metadata file. */
export const INSTALL_RECORD_MODE = 0o644;

/**
 * Write one record text atomically: stage beside the record path, then rename.
 *
 * A failed stage or rename leaves the previous record untouched and answers
 * `false`; the caller reports the stale record rather than a half-written one.
 */
export const writeInstallRecordText = (input: {
  readonly fs: InstallFilePort;
  readonly path: string;
  readonly text: string;
}): boolean => {
  if (!input.fs.mkdirp(dirname(input.path))) return false;
  const bytes = new TextEncoder().encode(input.text);
  const staged = input.fs.writeStaged(input.path, bytes, INSTALL_RECORD_MODE);
  if (!staged.ok) return false;
  if (!input.fs.rename(staged.stagedPath, input.path)) {
    input.fs.remove(staged.stagedPath);
    return false;
  }
  return true;
};

/** Remove the record; an absent record is a successful removal. */
export const removeInstallRecord = (input: {
  readonly fs: InstallFilePort;
  readonly path: string;
}): boolean => (input.fs.exists(input.path) ? input.fs.remove(input.path) : true);
