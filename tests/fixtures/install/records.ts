/**
 * Record fixtures (GH-346 DM-2).
 *
 * The three damaged conditions — absent, damaged/unreadable, and a readable
 * `current` record whose pair is inverted (the post-crash shape) — plus a
 * `current` record that names no `previous` and a readable record naming a
 * WRONG `previous` (the declared-limit arm).
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { InstallArtifactIdentity } from "../../../packages/core/src/contracts/install";

export type RecordState =
  | "absent"
  | "damaged"
  | "current"
  | "inverted"
  | "no-previous"
  | "wrong-previous";

export type RecordFixture = {
  readonly state: RecordState;
  readonly previous?: InstallArtifactIdentity;
};

const identityText = (identity: InstallArtifactIdentity): string =>
  JSON.stringify({
    version: identity.version,
    commit: identity.commit,
    builtAt: identity.builtAt,
    dirty: identity.dirty,
    channel: identity.channel,
  });

/** Write the record fixture at `path`; answer the `previous` it carries. */
export const writeRecordFixture = (input: {
  readonly state: RecordState;
  readonly path: string;
  readonly identity: InstallArtifactIdentity;
  readonly previous?: InstallArtifactIdentity;
  readonly wrongPrevious?: InstallArtifactIdentity;
}): RecordFixture => {
  mkdirSync(dirname(input.path), { recursive: true });
  rmSync(input.path, { force: true });
  if (input.state === "absent") return { state: "absent" };
  if (input.state === "damaged") {
    writeFileSync(input.path, "{ this is not a record\n");
    return { state: "damaged" };
  }
  const previous =
    input.state === "no-previous"
      ? undefined
      : input.state === "wrong-previous"
        ? input.wrongPrevious
        : input.state === "inverted"
          ? input.previous
          : input.previous;
  const record = {
    schemaVersion: "install.record.v1",
    ...JSON.parse(identityText(input.identity)),
    stateSchemaVersion: "delivery.state.v1",
    provenance: "verified",
    installedAt: "2026-11-18T11:00:00.000Z",
    launcherDisposition: "none",
    ...(previous === undefined ? {} : { previous: JSON.parse(identityText(previous)) }),
  };
  writeFileSync(input.path, `${JSON.stringify(record, null, 2)}\n`);
  return previous === undefined ? { state: input.state } : { state: input.state, previous };
};
