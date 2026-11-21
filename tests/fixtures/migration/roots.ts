/**
 * GH-365 P5 migration scratch world: the three prior root classes, the current
 * destination roots, byte digests, and the managed-PATH profile fixture. Every
 * path lives under the repo-local `tmp/tmpdir` root; no operator home is read.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();

export type MigrationWorld = {
  readonly base: string;
  readonly home: string;
  readonly project: string;
  readonly priorConfig: string;
  readonly priorState: string;
  readonly priorProject: string;
  readonly currentConfig: string;
  readonly currentState: string;
  readonly currentProject: string;
  readonly backupRoot: string;
  readonly profile: string;
  dispose: () => void;
};

export const createMigrationWorld = (label: string): MigrationWorld => {
  const base = mkdtempSync(join(ROOT, `tmp/tmpdir/migration-${label}-`));
  const home = join(base, "home");
  const project = join(base, "checkout");
  for (const directory of [home, project]) mkdirSync(directory, { recursive: true });
  return {
    base,
    home,
    project,
    priorConfig: join(home, ".delivery-os"),
    priorState: join(home, ".delivery-os-state"),
    priorProject: join(project, ".delivery-os"),
    currentConfig: join(home, ".jaiship"),
    currentState: join(home, ".jaiship-state"),
    currentProject: join(project, ".jaiship"),
    backupRoot: join(home, ".jaiship", "migration-backups"),
    profile: join(home, ".zshrc"),
    dispose: () => rmSync(base, { recursive: true, force: true }),
  };
};

export const writeFileAt = (path: string, content: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

/** The standard clean world: every root populated, no destination entries. */
export const seedCleanWorld = (world: MigrationWorld): void => {
  writeFileAt(join(world.priorConfig, "config.yaml"), "verify:\n  suite-map: {}\n");
  writeFileAt(join(world.priorConfig, "install.json"), '{"schemaVersion":"install.record.v1"}\n');
  writeFileAt(join(world.priorConfig, "bin", "jaiship"), "#!/bin/sh\necho legacy\n");
  writeFileAt(join(world.priorState, "host-index.json"), '{"stale":true}\n');
  writeFileAt(join(world.priorState, "projects", "p1", "header.p1.json"), '{"v":1}\n');
  writeFileAt(join(world.priorState, "projects", "p1", "records.jsonl"), '{"n":1}\n');
  writeFileAt(join(world.priorProject, "config.yaml"), "lane:\n  restart-budget: 3\n");
};

/** A world with a single entry under one root class. */
export const seedSingleEntry = (
  world: MigrationWorld,
  root: "config" | "state" | "project",
  name: string,
  content: string,
): string => {
  const base =
    root === "config"
      ? world.priorConfig
      : root === "state"
        ? world.priorState
        : world.priorProject;
  const path = join(base, name);
  writeFileAt(path, content);
  return path;
};

/** Seed the delivered managed PATH block record and its profile line. */
export const seedManagedPathRecord = (world: MigrationWorld): void => {
  const marker = "# >>> jaiship >>>";
  // The current record is the managed block's owner; the prior record is not a
  // second copy, so it does not create a differing duplicate in the clean world.
  rmSync(join(world.priorConfig, "install.json"), { force: true });
  writeFileAt(
    join(world.currentConfig, "install.json"),
    `${JSON.stringify(
      {
        schemaVersion: "install.record.v1",
        version: "0.0.0",
        commit: "fixture",
        builtAt: "2026-11-18T12:00:00.000Z",
        dirty: false,
        channel: "dev",
        stateSchemaVersion: "state.v1",
        provenance: "verified",
        installedAt: "2026-11-18T12:00:00.000Z",
        launcherDisposition: "none",
        pathBlock: { file: world.profile, marker },
      },
      null,
      2,
    )}\n`,
  );
  writeFileAt(world.profile, `export PATH="${join(world.priorConfig, "bin")}:$PATH" ${marker}\n`);
};

/** A stable digest map for one tree: relative path -> sha256. */
export const digestsOf = (tree: string): Record<string, string> => {
  const digests: Record<string, string> = {};
  const walk = (relative: string): void => {
    const absolute = relative.length === 0 ? tree : join(tree, relative);
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(absolute, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const next = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
      const path = join(tree, next);
      if (entry.isDirectory()) {
        walk(next);
      } else if (entry.isFile()) {
        digests[next] = createHash("sha256").update(readFileSync(path)).digest("hex");
      }
    }
  };
  walk("");
  return digests;
};

/** Whether a path exists (the fixture's read-only existence check). */
export const exists = (path: string): boolean => existsSync(path);

/** The byte size of one file, or 0. */
export const sizeOf = (path: string): number => {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
};
