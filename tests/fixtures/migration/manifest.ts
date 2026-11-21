/**
 * GH-365 P5 migration manifest reader/validator: the backup document is a
 * distinct shape from the CLI plan payload, and every listed file must exist in
 * the backup with the manifest's size and digest.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { MigrationManifestPayload } from "../../../packages/core/src/contracts/install";

export const readManifest = (backupPath: string): MigrationManifestPayload =>
  JSON.parse(readFileSync(join(backupPath, "manifest.json"), "utf8")) as MigrationManifestPayload;

/** Every manifest file exists in the backup with the recorded size and digest. */
export const verifyManifest = (
  manifest: MigrationManifestPayload,
  backupPath: string,
): readonly string[] => {
  const failures: string[] = [];
  for (const entry of manifest.entries) {
    for (const file of entry.fileEntries) {
      const path = join(backupPath, entry.rootLabel, file.relativePath);
      if (!existsSync(path)) {
        failures.push(`manifest file is missing from the backup: ${path}`);
        continue;
      }
      const stat = statSync(path);
      if (stat.size !== file.size) failures.push(`manifest size mismatch: ${path}`);
      const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
      if (digest !== file.sha256) failures.push(`manifest digest mismatch: ${path}`);
    }
  }
  return failures;
};
