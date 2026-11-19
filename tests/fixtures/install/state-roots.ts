/**
 * State-root fixtures (GH-346 F-7, AC-F7-2/AC-F7-3).
 *
 * One header per root carrying an opaque format identifier, a root with no
 * header, an absent root, and a planted foreign-version record BELOW a project
 * directory that would flip the verdict if it were read.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Write one ledger header at `root` with `schemaVersion`. */
export const writeHeader = (root: string, schemaVersion: string): void => {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "header.fixture.json"), `${JSON.stringify({ schemaVersion })}\n`);
};

/** Plant a payload below a project directory that must never be opened. */
export const plantForeignRecord = (root: string): string => {
  const directory = join(root, "documents.fixture");
  mkdirSync(directory, { recursive: true });
  const path = join(directory, "foreign.json");
  writeFileSync(
    path,
    `${JSON.stringify({ schemaVersion: "delivery.state.v99", ledger: ["canary"] })}\n`,
  );
  return path;
};
