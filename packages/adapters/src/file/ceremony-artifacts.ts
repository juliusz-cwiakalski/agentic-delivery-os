/**
 * The ceremony artifact family adapter (GH-296 F-4, DM-6).
 *
 * One byte-level artifact per run in the state directory, named by run id,
 * `0600`, forever retention, outside the ledger and outside the derived-document
 * set. A write that cannot be read back fails its step's verification; this
 * adapter never repairs, compacts, or indexes an artifact. The runtime filesystem
 * lives here, never in the contracts or domain tiers.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CeremonyArtifactPort,
  CeremonyArtifactRead,
  CeremonyArtifactWrite,
  CeremonyOutputSlot,
} from "@delivery-os/core/contracts";

/** The artifact directory name for one workspace (outside the ledger family). */
export const ceremonyArtifactsDirectoryName = (workspaceId: string): string =>
  `ceremony-artifacts.${encodeURIComponent(workspaceId)}`;

/** The artifact directory path for one workspace. */
export const ceremonyArtifactsDirectory = (stateDirectory: string, workspaceId: string): string =>
  join(stateDirectory, ceremonyArtifactsDirectoryName(workspaceId));

const RUN_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

const digest = (value: string): string => {
  let hash = 0xcbf29ce484222325n;
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
};

const artifactName = (input: {
  readonly runId: string;
  readonly slot: CeremonyOutputSlot;
  readonly content: string;
}): string =>
  input.slot === "ceremony-artifact"
    ? `${input.runId}.json`
    : `${input.runId}.${input.slot}.${digest(input.content)}.json`;

const safeName = (name: string): boolean =>
  name.length > 0 && !name.includes("/") && !name.includes("\\") && !name.includes("..");

/** Create the byte-level artifact port over one state directory. */
export const createCeremonyArtifactStore = (options: {
  readonly stateDirectory: string;
  readonly workspaceId: string;
}): CeremonyArtifactPort => {
  const directory = ceremonyArtifactsDirectory(options.stateDirectory, options.workspaceId);
  return {
    write(input): CeremonyArtifactWrite {
      if (!RUN_ID_PATTERN.test(input.runId)) {
        return { ok: false, detail: "invalid run id" };
      }
      const name = artifactName(input);
      try {
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        const path = join(directory, name);
        writeFileSync(path, input.content, { encoding: "utf8", mode: 0o600 });
        chmodSync(path, 0o600);
        return { ok: true, ref: `${input.slot}:${name}` };
      } catch (error) {
        return { ok: false, detail: error instanceof Error ? error.message : "write failed" };
      }
    },
    read(input): CeremonyArtifactRead {
      const prefix = `${input.slot}:`;
      if (!input.ref.startsWith(prefix)) return { ok: false, detail: "slot mismatch" };
      const name = input.ref.slice(prefix.length);
      if (!safeName(name) || !RUN_ID_PATTERN.test(name.split(".")[0] ?? "")) {
        return { ok: false, detail: "invalid artifact reference" };
      }
      const path = join(directory, name);
      if (!existsSync(path)) return { ok: false, detail: "artifact absent" };
      try {
        const mode = statSync(path).mode & 0o777;
        if (mode !== 0o600) return { ok: false, detail: "artifact permission mismatch" };
        return { ok: true, content: readFileSync(path, "utf8") };
      } catch (error) {
        return { ok: false, detail: error instanceof Error ? error.message : "read failed" };
      }
    },
  };
};
