/**
 * GH-365 P5 — the `install migrate` verb and the migration domain.
 *
 * TC-MIGRATE-001..010 + TC-SHIM-004. Every case runs offline over a scratch
 * home/checkout under `tmp/tmpdir`; the audit dependency is composed and
 * recording, so the zero-record claim proves suppression rather than seam
 * absence.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInstallCommandDefinition } from "../../packages/cli/src/commands/install";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import type { InstallGitRead } from "../../packages/core/src/contracts/install";
import { STATE_SCHEMA_VERSION } from "../../packages/core/src/contracts/state";
import { migrationRoots } from "../../packages/core/src/domain/install-migration";
import {
  validateMigrationManifestPayload,
  validateMigrationPlanPayload,
} from "../../packages/core/src/domain/install-migration-manifest";
import { createInstallRuntime, fixtureIdentity } from "../fixtures/install/home";
import {
  createRecordingFs,
  createRecordRecorder,
  type RecordingFs,
} from "../fixtures/migration/filesystem";
import {
  createOrderingRecorder,
  createRecordingDaemon,
  linkedWorktreeGit,
  type RecordingDaemon,
} from "../fixtures/migration/guards";
import { readManifest, verifyManifest } from "../fixtures/migration/manifest";
import { canonicalize, hasAnsi, lineCount, maxLineBytes } from "../fixtures/migration/plan";
import {
  createMigrationWorld,
  digestsOf,
  exists,
  type MigrationWorld,
  seedCleanWorld,
  seedManagedPathRecord,
  seedSingleEntry,
  writeFileAt,
} from "../fixtures/migration/roots";
import { bufferSink } from "../golden/helpers";

const FIXED_ISO = "2026-11-18T12:05:00.000Z";

type RunResult = {
  readonly exit: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
  readonly fs: RecordingFs;
  readonly daemon: RecordingDaemon;
  readonly records: readonly unknown[];
};

const worldScratch = (world: MigrationWorld) => ({
  base: world.base,
  home: world.home,
  configRoot: world.currentConfig,
  stateRoot: world.currentState,
  installDirectory: join(world.currentConfig, "bin"),
  destinationPath: join(world.currentConfig, "bin", "jaiship"),
  slotPath: join(world.currentConfig, "bin", "jaiship.previous"),
  recordPath: join(world.currentConfig, "install.json"),
  dispose: () => undefined,
});

const artifactPath = (world: MigrationWorld): string => {
  const path = join(world.base, "artifact", "jaiship");
  writeFileAt(path, "#!/bin/sh\necho jaiship\n");
  return path;
};

const runMigration = async (
  world: MigrationWorld,
  argv: readonly string[],
  options: {
    readonly fs?: RecordingFs;
    readonly daemon?: RecordingDaemon;
    readonly git?: InstallGitRead;
    readonly unscoped?: boolean;
    readonly ownsInstallation?: boolean;
    readonly identity?: ReturnType<typeof fixtureIdentity> | undefined;
    readonly failAtOrdinal?: (ordinal: number) => boolean;
    readonly ordering?: ReturnType<typeof createOrderingRecorder>;
    readonly managedPathBlock?: { readonly file: string; readonly marker: string };
    readonly backupRoot?: string;
    readonly stateRoots?: readonly string[];
  } = {},
): Promise<RunResult> => {
  const fs = options.fs ?? createRecordingFs();
  const daemon =
    options.daemon ??
    createRecordingDaemon(options.ordering === undefined ? {} : { ordering: options.ordering });
  const recorder = createRecordRecorder();
  const git: InstallGitRead =
    options.git ??
    ({
      kind: "resolved",
      checkoutRoot: world.project,
      gitDir: `${world.project}/.git`,
      commonDir: `${world.project}/.git`,
    } satisfies InstallGitRead);
  const migration = {
    roots: migrationRoots({
      homeDirectory: world.home,
      ...(options.unscoped === true ? {} : { projectRoot: world.project }),
      currentConfigDirectoryName: ".jaiship",
      currentStateDirectoryName: ".jaiship-state",
    }),
    backupRoot: options.backupRoot ?? world.backupRoot,
    runId: () => "run-migration-fixture",
    clock: { nowIso: () => FIXED_ISO },
    artifactIdentity: fixtureIdentity(),
    ...(options.failAtOrdinal === undefined ? {} : { failAtOrdinal: options.failAtOrdinal }),
    ...(options.ordering === undefined ? {} : { onMove: options.ordering.onMove }),
    ...(options.managedPathBlock === undefined
      ? {}
      : { managedPathBlock: options.managedPathBlock }),
    priorPrefixes: [world.priorConfig, world.priorState],
  };
  const runtime = createInstallRuntime({
    scratch: worldScratch(world),
    runningArtifactPath: artifactPath(world),
    ...(Object.hasOwn(options, "identity")
      ? options.identity === undefined
        ? {}
        : { identity: options.identity }
      : { identity: fixtureIdentity() }),
    ownsInstallation: options.ownsInstallation ?? true,
    fs,
    daemon,
    git,
    migration,
    ...(options.stateRoots === undefined ? {} : { stateRoots: options.stateRoots }),
  });
  const install = createInstallCommandDefinition(runtime);
  const stdout = bufferSink();
  const stderr = bufferSink();
  const composeProgram = () => ({
    commands: Object.fromEntries(
      PROMPT_REQUIRED_COMMANDS.map((name) => [
        name,
        name === "install" ? install : { handler: () => ({ data: {} }) },
      ]),
    ),
  });
  const exit = await runEntrypoint(argv, {
    streams: { stdout, stderr },
    environment: { HOME: world.home },
    declaredWorkingName: "jaiship",
    composeProgram,
    clock: { now: () => 0 },
    newRunId: () => "run-migration-fixture",
    audit: recorder.audit,
  });
  let data: Record<string, unknown> | undefined;
  let error: RunResult["error"];
  try {
    const envelope = JSON.parse(stdout.value) as {
      readonly data?: Record<string, unknown>;
      readonly error?: { readonly code?: string; readonly summary?: string };
    };
    data = envelope.data;
    error = envelope.error;
  } catch {
    // Human form.
  }
  return {
    exit,
    stdout: stdout.value,
    stderr: stderr.value,
    data,
    error,
    fs,
    daemon,
    records: recorder.records,
  };
};

const WORLD = (label: string): MigrationWorld => createMigrationWorld(label);

describe("TC-MIGRATE-001 grammar, admission and the unscoped project scope", () => {
  test("a dry run is green; an undeclared flag is fallback.invocation with zero writes and zero records", async () => {
    const world = WORLD("grammar");
    try {
      seedCleanWorld(world);
      const green = await runMigration(world, ["install", "migrate", "--dry-run", "--json"]);
      expect(green.exit).toBe(0);
      expect(green.error).toBeUndefined();
      expect(green.records).toEqual([]);

      const refused = await runMigration(world, ["install", "migrate", "--force", "--json"]);
      expect(refused.error?.code).toBe("fallback.invocation");
      expect(refused.exit).toBe(1);
      expect(refused.records).toEqual([]);
    } finally {
      world.dispose();
    }
  });

  test("relative, in-source, `..`-normalised and symlinked --backup-dir values are input.value.rejected", async () => {
    const world = WORLD("backup-dir");
    try {
      seedCleanWorld(world);
      const { symlinkSync } = await import("node:fs");
      const link = join(world.home, "source-link");
      symlinkSync(world.priorConfig, link);
      for (const value of [
        "relative/backups",
        join(world.priorConfig, "backups"),
        join(world.priorConfig, "..", ".delivery-os", "backups"),
        join(link, "backups"),
      ]) {
        const run = await runMigration(world, [
          "install",
          "migrate",
          "--backup-dir",
          value,
          "--json",
        ]);
        expect(run.error?.code, value).toBe("input.value.rejected");
        expect(run.exit).toBe(1);
        expect(run.records).toEqual([]);
      }
    } finally {
      world.dispose();
    }
  });

  test("the alias refuses, a dev build refuses, and a linked worktree refuses", async () => {
    const alias = WORLD("alias");
    try {
      seedCleanWorld(alias);
      const run = await runMigration(alias, ["install", "migrate", "--dry-run", "--json"], {
        ownsInstallation: false,
      });
      expect(run.error?.code).toBe("install.identity.not-owning");
      expect(run.exit).toBe(1);
      expect(run.records).toEqual([]);
    } finally {
      alias.dispose();
    }

    const dev = WORLD("dev");
    try {
      seedCleanWorld(dev);
      const run = await runMigration(dev, ["install", "migrate", "--dry-run", "--json"], {
        identity: undefined,
      });
      expect(run.error?.code).toBe("install.dev-build");
      expect(run.records).toEqual([]);
    } finally {
      dev.dispose();
    }

    const worktree = WORLD("worktree");
    try {
      seedCleanWorld(worktree);
      const run = await runMigration(worktree, ["install", "migrate", "--dry-run", "--json"], {
        git: linkedWorktreeGit(worktree.project),
      });
      expect(run.error?.code).toBe("install.target.worktree");
      expect(run.records).toEqual([]);
    } finally {
      worktree.dispose();
    }
  });

  test("a source symlink is blocked, a destination symlink is conflict, both retained with path and remedy", async () => {
    const source = WORLD("source-symlink");
    try {
      seedCleanWorld(source);
      const link = join(source.priorConfig, "linked");
      const target = join(source.base, "target");
      writeFileAt(target, "target\n");
      // A real symlink in the source root.
      const { symlinkSync } = await import("node:fs");
      symlinkSync(target, link);
      const run = await runMigration(source, ["install", "migrate", "--json"]);
      const sourceRoots = run.data?.roots;
      if (!Array.isArray(sourceRoots)) throw new Error("no roots");
      const root = (
        sourceRoots as {
          label: string;
          entries: { disposition: string; path?: string; relativePath: string }[];
        }[]
      ).find((entry) => entry.label === "host-configuration");
      if (root === undefined) throw new Error("no host-configuration root");
      const blocked = root.entries.find((entry) => entry.disposition === "blocked");
      expect(blocked?.path).toBe(link);
      expect(exists(link)).toBe(true);
      expect(run.records).toEqual([]);
      const sourceData = run.data as { conflicts?: string[]; residuals?: string[] };
      expect(
        (sourceData.conflicts ?? []).some(
          (line) => line.includes(link) && line.includes("re-run install migrate"),
        ),
      ).toBe(true);
      expect(
        (sourceData.residuals ?? []).some(
          (line) => line.includes(link) && line.includes("re-run install migrate"),
        ),
      ).toBe(true);
      const human = await runMigration(source, ["install", "migrate"]);
      expect(human.stdout).toContain(link);
      expect(human.stdout).toContain("re-run install migrate");
    } finally {
      source.dispose();
    }

    const destination = WORLD("dest-symlink");
    try {
      seedCleanWorld(destination);
      const { symlinkSync } = await import("node:fs");
      writeFileAt(join(destination.base, "dest-target"), "dest\n");
      writeFileAt(join(destination.currentConfig, ".keep"), "keep\n");
      const destinationLink = join(destination.currentConfig, "config.yaml");
      symlinkSync(join(destination.base, "dest-target"), destinationLink);
      const run = await runMigration(destination, ["install", "migrate", "--json"]);
      const sourceRoots = run.data?.roots;
      if (!Array.isArray(sourceRoots)) throw new Error("no roots");
      const root = (
        sourceRoots as {
          label: string;
          entries: { disposition: string; path?: string; relativePath: string }[];
        }[]
      ).find((entry) => entry.label === "host-configuration");
      if (root === undefined) throw new Error("no host-configuration root");
      const conflict = root.entries.find((entry) => entry.disposition === "conflict");
      expect(conflict?.path).toBe(destinationLink);
      expect(exists(destinationLink)).toBe(true);
      const destinationData = run.data as { conflicts?: string[]; residuals?: string[] };
      expect(
        (destinationData.conflicts ?? []).some(
          (line) => line.includes(destinationLink) && line.includes("re-run install migrate"),
        ),
      ).toBe(true);
      expect(
        (destinationData.residuals ?? []).some(
          (line) => line.includes(destinationLink) && line.includes("re-run install migrate"),
        ),
      ).toBe(true);
    } finally {
      destination.dispose();
    }
  });

  test("a destination ROOT symlink (including .jaiship -> .delivery-os) is conflict and never followed", async () => {
    const exact = WORLD("root-dest-symlink");
    try {
      seedSingleEntry(exact, "config", "config.yaml", "provider: fixture\n");
      const { symlinkSync } = await import("node:fs");
      symlinkSync(exact.priorConfig, exact.currentConfig);
      const run = await runMigration(exact, ["install", "migrate", "--json"]);
      expect(run.exit).toBe(1);
      expect(run.data?.verdict).toBe("conflict");
      const roots = run.data?.roots as {
        label: string;
        verdict?: string;
        entries: { disposition: string; path?: string }[];
      }[];
      const root = roots.find((entry) => entry.label === "host-configuration");
      expect(root?.verdict).toBe("conflict");
      expect(
        root?.entries.some(
          (entry) => entry.disposition === "conflict" && entry.path === exact.currentConfig,
        ),
      ).toBe(true);
      expect(run.fs.writes).toEqual([]);
      expect(
        ((run.data?.conflicts as string[] | undefined) ?? []).some(
          (line) => line.includes(exact.currentConfig) && line.includes("re-run install migrate"),
        ),
      ).toBe(true);
      expect(readFileSync(join(exact.priorConfig, "config.yaml"), "utf8")).toBe(
        "provider: fixture\n",
      );
    } finally {
      exact.dispose();
    }

    const external = WORLD("root-dest-external");
    try {
      seedSingleEntry(external, "config", "secrets.txt", "secret\n");
      const { symlinkSync } = await import("node:fs");
      const target = join(external.base, "external");
      writeFileAt(join(target, ".keep"), "keep\n");
      symlinkSync(target, external.currentConfig);
      const run = await runMigration(external, ["install", "migrate", "--json"]);
      expect(run.exit).toBe(1);
      expect(exists(join(target, "secrets.txt"))).toBe(false);
      expect(exists(join(external.priorConfig, "secrets.txt"))).toBe(true);
      expect(run.fs.writes.some((path) => path.startsWith(target))).toBe(false);
    } finally {
      external.dispose();
    }
  });

  test("every flag order before the subcommand records zero with the audit dependency composed", async () => {
    const world = WORLD("flag-order");
    try {
      seedCleanWorld(world);
      const override = join(world.base, "explicit-backups");
      for (const argv of [
        ["install", "migrate", "--dry-run", "--json"],
        ["install", "--dry-run", "migrate", "--json"],
        ["install", "--backup-dir", override, "migrate", "--dry-run", "--json"],
        ["install", "--stop-daemon", "migrate", "--dry-run", "--json"],
        ["install", "--migrate", "--json"],
      ]) {
        const run = await runMigration(world, argv);
        expect(run.records, argv.join(" ")).toEqual([]);
      }
    } finally {
      world.dispose();
    }
  });

  test("outside a work tree the project class is unscoped and the host classes migrate", async () => {
    const world = WORLD("unscoped");
    try {
      seedCleanWorld(world);
      const run = await runMigration(world, ["install", "migrate", "--json"], {
        unscoped: true,
      });
      expect(run.exit).toBe(0);
      const roots = run.data?.roots as {
        label: string;
        scope: string;
        source?: string;
        destination?: string;
        entries: unknown[];
        verdict?: string;
      }[];
      const project = roots.find((root) => root.label === "project-configuration");
      expect(project?.scope).toBe("unscoped");
      expect(project?.source).toBeUndefined();
      expect(project?.destination).toBeUndefined();
      expect(project?.entries).toEqual([]);
      expect(project?.verdict).toBeUndefined();
      expect(run.data?.verdict).toBe("migrated");
    } finally {
      world.dispose();
    }
  });
});

describe("TC-MIGRATE-002 the daemon guard and ordering", () => {
  test("a live daemon is refused without --stop-daemon and never touched", async () => {
    const world = WORLD("daemon-refuse");
    try {
      seedCleanWorld(world);
      const run = await runMigration(world, ["install", "migrate", "--json"], {
        daemon: createRecordingDaemon({ running: true }),
      });
      expect(run.error?.code).toBe("install.daemon.running");
      expect(run.exit).toBe(1);
      expect(run.fs.writes).toEqual([]);
      expect(run.daemon.stopCalls()).toBe(0);
      expect(run.records).toEqual([]);
    } finally {
      world.dispose();
    }
  });

  test("a dry run never reads the daemon, with or without --stop-daemon", async () => {
    for (const extra of [[], ["--stop-daemon"]]) {
      const world = WORLD("daemon-dry");
      try {
        seedCleanWorld(world);
        const run = await runMigration(
          world,
          ["install", "migrate", "--dry-run", ...extra, "--json"],
          {
            daemon: createRecordingDaemon({ running: true }),
          },
        );
        expect(run.data?.daemon).toBe("unchecked");
        expect(run.daemon.statusCalls()).toBe(0);
        expect(run.daemon.stopCalls()).toBe(0);
      } finally {
        world.dispose();
      }
    }
  });

  test("with --stop-daemon the stop precedes move 1 and no restart follows", async () => {
    const world = WORLD("daemon-stop");
    try {
      seedCleanWorld(world);
      const ordering = createOrderingRecorder();
      const run = await runMigration(world, ["install", "migrate", "--stop-daemon", "--json"], {
        daemon: createRecordingDaemon({ running: true, ordering }),
        ordering,
      });
      expect(run.data?.daemon).toBe("stopped");
      expect(ordering.events[0]).toBe("stop");
      expect(ordering.events[1]).toBe("move 1");
      expect(run.daemon.stopCalls()).toBe(1);
    } finally {
      world.dispose();
    }
  });
});

describe("TC-MIGRATE-003 the bounded dry-run plan", () => {
  test("the plan is bounded, ANSI-free, zero-write, zero-directory, zero-record and daemon-free", async () => {
    const world = WORLD("dry-plan");
    try {
      seedCleanWorld(world);
      const run = await runMigration(world, ["install", "migrate", "--dry-run", "--json"], {
        daemon: createRecordingDaemon({ running: true }),
      });
      expect(run.exit).toBe(0);
      expect(run.data?.schemaId).toBe("install.migration.plan.v1");
      expect(validateMigrationPlanPayload(run.data)).toEqual([]);
      expect(run.fs.writes).toEqual([]);
      expect(run.fs.directories.filter((path) => path.includes("migration-backups"))).toEqual([]);
      expect(run.records).toEqual([]);
      expect(run.daemon.statusCalls()).toBe(0);

      const human = await runMigration(world, ["install", "migrate", "--dry-run"]);
      expect(human.exit).toBe(0);
      expect(hasAnsi(human.stdout)).toBe(false);
      expect(lineCount(human.stdout)).toBeLessThanOrEqual(60);
      expect(maxLineBytes(human.stdout)).toBeLessThanOrEqual(512);
      expect(human.stdout).toContain("daemon: unchecked");
      expect(human.stdout).toContain("backup:");
      expect(human.stdout).toContain("moved config.yaml");
    } finally {
      world.dispose();
    }
  });

  test("two runs of identical worlds are byte-identical after canonicalisation", async () => {
    const first = WORLD("dry-a");
    const second = WORLD("dry-b");
    try {
      for (const world of [first, second]) {
        seedCleanWorld(world);
      }
      const a = await runMigration(first, ["install", "migrate", "--dry-run"]);
      const b = await runMigration(second, ["install", "migrate", "--dry-run"]);
      expect(canonicalize(b.stdout, second.base)).toBe(canonicalize(a.stdout, first.base));
    } finally {
      first.dispose();
      second.dispose();
    }
  });

  test("an over-bound plan truncates to one counted line inside the bound", async () => {
    const world = WORLD("over-bound");
    try {
      for (let index = 0; index < 70; index += 1) {
        seedSingleEntry(world, "config", `file-${String(index)}.txt`, "x\n");
      }
      const run = await runMigration(world, ["install", "migrate", "--dry-run"]);
      expect(lineCount(run.stdout)).toBeLessThanOrEqual(60);
      const truncations = run.stdout.split("\n").filter((line) => line.includes(" more"));
      expect(truncations).toHaveLength(1);
    } finally {
      world.dispose();
    }
  });
});

describe("TC-MIGRATE-004 the clean move", () => {
  test("moves every non-derived entry, writes the manifest before the move, and writes zero records", async () => {
    const world = WORLD("clean");
    try {
      seedCleanWorld(world);
      seedManagedPathRecord(world);
      const before = {
        config: digestsOf(world.priorConfig),
        state: digestsOf(world.priorState),
        project: digestsOf(world.priorProject),
      };
      const profileBefore = readFileSync(world.profile);
      const run = await runMigration(world, ["install", "migrate", "--json"], {
        managedPathBlock: { file: world.profile, marker: "# >>> jaiship >>>" },
      });
      expect(run.exit).toBe(0);
      expect(run.data?.verdict).toBe("migrated");
      expect(validateMigrationPlanPayload(run.data)).toEqual([]);
      expect(run.records).toEqual([]);

      const backupPath = run.data?.backupPath;
      if (typeof backupPath !== "string") throw new Error("no backup path");
      const manifest = readManifest(backupPath);
      expect(manifest.schemaId).toBe("install.migration.manifest.v1");
      expect(validateMigrationManifestPayload(manifest)).toEqual([]);
      expect(verifyManifest(manifest, backupPath)).toEqual([]);
      expect(manifest.entries.length).toBeGreaterThan(0);
      expect(manifest.entries.some((entry) => entry.relativePath === "host-index.json")).toBe(
        false,
      );

      const movedDigests = digestsOf(world.currentConfig);
      expect(movedDigests["config.yaml"]).toBe(before.config["config.yaml"] as string);
      expect(exists(join(world.priorConfig, "config.yaml"))).toBe(false);
      expect(exists(world.priorConfig)).toBe(false);
      expect(exists(join(world.currentConfig, "config.yaml"))).toBe(true);

      const residuals = run.data?.residuals as string[];
      expect(residuals.some((line) => line.includes("managed PATH block"))).toBe(true);
      expect(readFileSync(world.profile)).toEqual(profileBefore);
      expect(run.fs.writes).not.toContain(world.profile);

      const retired = run.data?.retiredRoots as string[];
      expect(retired).toContain(world.priorConfig);
      expect(retired).toContain(world.priorState);
      expect(retired).toContain(world.priorProject);
      expect(exists(join(world.currentState, "projects", "p1", "records.jsonl"))).toBe(true);
      expect(exists(join(world.currentProject, "config.yaml"))).toBe(true);
    } finally {
      world.dispose();
    }
  });

  test("an absolute --backup-dir override is honoured", async () => {
    const world = WORLD("override");
    try {
      seedCleanWorld(world);
      const override = join(world.base, "explicit-backups");
      const run = await runMigration(world, [
        "install",
        "migrate",
        "--backup-dir",
        override,
        "--json",
      ]);
      expect(run.exit).toBe(0);
      expect(String(run.data?.backupPath ?? "")).toContain(override);
    } finally {
      world.dispose();
    }
  });
});

describe("TC-MIGRATE-005 idempotence and the never-existent root", () => {
  test("a second run moves nothing, creates no backup, reports already-migrated and writes zero records", async () => {
    const world = WORLD("idempotent");
    try {
      seedCleanWorld(world);
      const first = await runMigration(world, ["install", "migrate", "--json"]);
      expect(first.exit).toBe(0);
      const stateAfter = digestsOf(world.currentState);
      const second = await runMigration(world, ["install", "migrate", "--json"]);
      expect(second.exit).toBe(0);
      expect(second.data?.verdict).toBe("already-migrated");
      expect(second.records).toEqual([]);
      const roots = second.data?.roots as { entries: { disposition: string }[] }[];
      expect(
        roots.flatMap((root) => root.entries).every((entry) => entry.disposition !== "moved"),
      ).toBe(true);
      expect(digestsOf(world.currentState)).toEqual(stateAfter);
    } finally {
      world.dispose();
    }
  });

  test("a root that never existed is neither retired nor reported", async () => {
    const world = WORLD("never");
    try {
      seedCleanWorld(world);
      // The project prior root never existed.
      const { rmSync } = await import("node:fs");
      rmSync(world.priorProject, { recursive: true, force: true });
      const run = await runMigration(world, ["install", "migrate", "--json"]);
      expect(run.exit).toBe(0);
      const retired = run.data?.retiredRoots as string[];
      expect(retired).not.toContain(world.priorProject);
      const residuals = run.data?.residuals as string[];
      expect(residuals.some((line) => line.includes(world.priorProject))).toBe(false);
    } finally {
      world.dispose();
    }
  });
});

describe("TC-MIGRATE-006 the disposition matrix and verdict composition", () => {
  const entryOf = (run: RunResult, rootLabel: string, name: string) => {
    const roots = run.data?.roots as {
      label: string;
      entries: { relativePath: string; disposition: string }[];
    }[];
    return roots
      .find((root) => root.label === rootLabel)
      ?.entries.find((entry) => entry.relativePath === name)?.disposition;
  };

  test("row 2 already-migrated, row 3 moved, row 4 duplicate-identical, row 5 conflict", async () => {
    const duplicate = WORLD("duplicate");
    try {
      seedSingleEntry(duplicate, "config", "config.yaml", "same\n");
      writeFileAt(join(duplicate.currentConfig, "config.yaml"), "same\n");
      const run = await runMigration(duplicate, ["install", "migrate", "--json"]);
      expect(entryOf(run, "host-configuration", "config.yaml")).toBe("duplicate-identical");
      expect(run.exit).toBe(0);
      expect(run.data?.verdict).toBe("migrated");
      expect(exists(join(duplicate.priorConfig, "config.yaml"))).toBe(true);
    } finally {
      duplicate.dispose();
    }

    const conflict = WORLD("conflict");
    try {
      seedSingleEntry(conflict, "config", "config.yaml", "source\n");
      writeFileAt(join(conflict.currentConfig, "config.yaml"), "destination\n");
      const run = await runMigration(conflict, ["install", "migrate", "--json"]);
      expect(entryOf(run, "host-configuration", "config.yaml")).toBe("conflict");
      expect(run.exit).toBe(1);
      expect(run.data?.verdict).toBe("conflict");
      expect(readFileSync(join(conflict.priorConfig, "config.yaml"), "utf8")).toBe("source\n");
      expect(readFileSync(join(conflict.currentConfig, "config.yaml"), "utf8")).toBe(
        "destination\n",
      );
    } finally {
      conflict.dispose();
    }
  });

  test("a mixed world is partial at exit 1 and no differing byte is lost", async () => {
    const world = WORLD("mixed");
    try {
      seedSingleEntry(world, "config", "moved.txt", "move\n");
      seedSingleEntry(world, "config", "same.txt", "same\n");
      writeFileAt(join(world.currentConfig, "same.txt"), "same\n");
      seedSingleEntry(world, "config", "differs.txt", "source\n");
      writeFileAt(join(world.currentConfig, "differs.txt"), "destination\n");
      const configBefore = digestsOf(world.priorConfig);
      const destinationBefore = digestsOf(world.currentConfig);
      const run = await runMigration(world, ["install", "migrate", "--json"]);
      expect(run.exit).toBe(1);
      expect(run.data?.verdict).toBe("partial");
      expect(digestsOf(world.currentConfig)["differs.txt"]).toBe(
        destinationBefore["differs.txt"] as string,
      );
      expect(readFileSync(join(world.priorConfig, "differs.txt"), "utf8")).toBe("source\n");
      expect(exists(join(world.priorConfig, "same.txt"))).toBe(true);
      expect(digestsOf(world.priorConfig)["differs.txt"]).toBe(
        configBefore["differs.txt"] as string,
      );
    } finally {
      world.dispose();
    }
  });

  test("a pre-existing destination container descends instead of blanket-conflicting", async () => {
    const world = WORLD("container-existing");
    try {
      seedCleanWorld(world);
      mkdirSync(join(world.currentState, "projects"), { recursive: true });
      const run = await runMigration(world, ["install", "migrate", "--json"]);
      expect(run.exit).toBe(0);
      expect(run.data?.verdict).toBe("migrated");
      const roots = run.data?.roots as {
        label: string;
        entries: { relativePath: string; disposition: string }[];
      }[];
      const entries = roots.find((root) => root.label === "host-state")?.entries ?? [];
      expect(
        entries.some(
          (entry) => entry.relativePath === "projects" && entry.disposition === "conflict",
        ),
      ).toBe(false);
      expect(
        entries.some(
          (entry) => entry.relativePath === "projects/p1" && entry.disposition === "moved",
        ),
      ).toBe(true);
      expect(exists(join(world.currentState, "projects", "p1", "records.jsonl"))).toBe(true);
    } finally {
      world.dispose();
    }
  });

  test("a disjoint child inside an existing container merges by copy-verify-remove", async () => {
    const world = WORLD("container-merge");
    try {
      seedSingleEntry(world, "state", "projects/p1/records.jsonl", '{"n":1}\n');
      writeFileAt(join(world.currentState, "projects", "p1", "other.jsonl"), '{"other":1}\n');
      const run = await runMigration(world, ["install", "migrate", "--json"]);
      expect(run.exit).toBe(0);
      expect(entryOf(run, "host-state", "projects/p1/records.jsonl")).toBe("moved");
      expect(entryOf(run, "host-state", "projects/p1/other.jsonl")).toBe("already-migrated");
      expect(
        readFileSync(join(world.currentState, "projects", "p1", "records.jsonl"), "utf8"),
      ).toBe('{"n":1}\n');
      expect(readFileSync(join(world.currentState, "projects", "p1", "other.jsonl"), "utf8")).toBe(
        '{"other":1}\n',
      );
      expect(exists(join(world.priorState, "projects", "p1", "records.jsonl"))).toBe(false);
      expect(
        run.fs.writes.includes(join(world.priorState, "projects", "p1", "records.jsonl")),
      ).toBe(true);
    } finally {
      world.dispose();
    }
  });
});

describe("TC-MIGRATE-007 the derived host index", () => {
  test("a destination copy is already-migrated, bytes unchanged, and never moved", async () => {
    const world = WORLD("derived-present");
    try {
      seedSingleEntry(world, "state", "host-index.json", '{"source":true}\n');
      writeFileAt(join(world.currentState, "host-index.json"), '{"destination":true}\n');
      const run = await runMigration(world, ["install", "migrate", "--json"]);
      const roots = run.data?.roots as {
        label: string;
        entries: { relativePath: string; disposition: string; files: number; bytes: number }[];
      }[];
      const entry = roots
        .find((root) => root.label === "host-state")
        ?.entries.find((candidate) => candidate.relativePath === "host-index.json");
      expect(entry?.disposition).toBe("already-migrated");
      expect(entry?.files).toBe(0);
      expect(entry?.bytes).toBe(0);
      expect(readFileSync(join(world.currentState, "host-index.json"), "utf8")).toBe(
        '{"destination":true}\n',
      );
      expect(run.exit).toBe(0);
      expect(run.data?.verdict).toBe("already-migrated");
    } finally {
      world.dispose();
    }
  });

  test("a source copy with no destination is absent and reported as a derived residual", async () => {
    const world = WORLD("derived-absent");
    try {
      seedSingleEntry(world, "state", "host-index.json", '{"source":true}\n');
      seedSingleEntry(world, "state", "projects", "placeholder\n");
      // A retained duplicate keeps the root from retiring, so the derived
      // residual is reported rather than removed with a retired root.
      writeFileAt(join(world.currentState, "projects"), "placeholder\n");
      const run = await runMigration(world, ["install", "migrate", "--json"]);
      const roots = run.data?.roots as {
        label: string;
        entries: { relativePath: string; disposition: string }[];
      }[];
      const stateRoot = roots.find((root) => root.label === "host-state");
      if (stateRoot === undefined) throw new Error("no host-state root");
      const entry = stateRoot.entries.find(
        (candidate) => candidate.relativePath === "host-index.json",
      );
      expect(entry?.disposition).toBe("absent");
      const residuals = run.data?.residuals;
      if (!Array.isArray(residuals)) throw new Error("no residuals");
      expect((residuals as string[]).some((line) => line.includes("derived residual"))).toBe(true);
      expect(exists(join(world.priorState, "host-index.json"))).toBe(true);
    } finally {
      world.dispose();
    }
  });
});

describe("TC-MIGRATE-008 partial failure and recovery", () => {
  test("a failure after the first move leaves the remainder intact and the recovery completes", async () => {
    const world = WORLD("partial");
    try {
      seedCleanWorld(world);
      const run = await runMigration(world, ["install", "migrate", "--json"], {
        failAtOrdinal: (ordinal) => ordinal === 2,
      });
      expect(run.exit).toBe(1);
      expect(run.data?.verdict).toBe("partial");
      expect(run.records).toEqual([]);
      const backupPath = run.data?.backupPath;
      if (typeof backupPath !== "string") throw new Error("no backup path");
      const manifest = readManifest(backupPath);
      expect(verifyManifest(manifest, backupPath)).toEqual([]);
      expect(manifest.entries.length).toBeGreaterThan(1);

      const recovered = await runMigration(world, ["install", "migrate", "--json"]);
      expect(recovered.exit).toBe(0);
      expect(recovered.data?.verdict).toBe("migrated");
      expect(exists(join(world.priorConfig, "config.yaml"))).toBe(false);
    } finally {
      world.dispose();
    }
  });
});

describe("TC-MIGRATE-009 byte preservation and no re-versioning", () => {
  test("every moved file digest, every ledger header and the install status verdict are unchanged", async () => {
    const world = WORLD("bytes");
    try {
      seedCleanWorld(world);
      writeFileAt(
        join(world.priorState, "header.p1.json"),
        `${JSON.stringify({ schemaVersion: STATE_SCHEMA_VERSION, workspace: "p1" })}\n`,
      );
      writeFileAt(
        join(world.priorState, "header.p2.json"),
        `${JSON.stringify({ schemaVersion: STATE_SCHEMA_VERSION, workspace: "p2" })}\n`,
      );
      const foreign = join(world.priorState, "projects", "p1", "records.foreign.jsonl");
      writeFileAt(foreign, '{"unknown":"foreign","schemaVersion":"foreign.v0"}\n');

      const statusBefore = await runMigration(world, ["install", "status", "--json"], {
        stateRoots: [world.priorState],
      });
      const beforeFormat = (statusBefore.data as { stateFormat?: unknown } | undefined)
        ?.stateFormat as
        | { accepted: string; roots: { outcome: string; observed: string | null }[] }
        | undefined;
      expect(beforeFormat?.roots[0]?.outcome).toBe("accepted");
      expect(beforeFormat?.roots[0]?.observed).toBe(STATE_SCHEMA_VERSION);

      const headerBefore = readFileSync(join(world.priorState, "header.p1.json"));
      const headerTwoBefore = readFileSync(join(world.priorState, "header.p2.json"));
      const foreignBefore = readFileSync(foreign);
      const configBefore = digestsOf(world.priorConfig);
      const stateBefore = digestsOf(world.priorState);

      const run = await runMigration(world, ["install", "migrate", "--json"]);
      expect(run.exit).toBe(0);

      const statusAfter = await runMigration(world, ["install", "status", "--json"], {
        stateRoots: [world.currentState],
      });
      const afterFormat = (statusAfter.data as { stateFormat?: unknown } | undefined)
        ?.stateFormat as
        | { accepted: string; roots: { outcome: string; observed: string | null }[] }
        | undefined;
      expect(afterFormat?.accepted).toBe(beforeFormat?.accepted);
      expect(afterFormat?.roots[0]?.outcome).toBe(beforeFormat?.roots[0]?.outcome);
      expect(afterFormat?.roots[0]?.observed).toBe(beforeFormat?.roots[0]?.observed);

      expect(readFileSync(join(world.currentState, "header.p1.json"))).toEqual(headerBefore);
      expect(readFileSync(join(world.currentState, "header.p2.json"))).toEqual(headerTwoBefore);
      expect(
        readFileSync(join(world.currentState, "projects", "p1", "records.foreign.jsonl")),
      ).toEqual(foreignBefore);
      expect(digestsOf(world.currentConfig)["config.yaml"]).toBe(
        configBefore["config.yaml"] as string,
      );
      expect(digestsOf(world.currentState)["projects/p1/records.jsonl"]).toBe(
        stateBefore["projects/p1/records.jsonl"] as string,
      );
      expect(
        Object.keys(digestsOf(world.currentState))
          .filter((key) => key.startsWith("header."))
          .sort(),
      ).toEqual(["header.p1.json", "header.p2.json"]);
    } finally {
      world.dispose();
    }
  });
});

describe("TC-MIGRATE-010 post-move locations", () => {
  test("every moved entry is under the current root and no prior root remains", async () => {
    const world = WORLD("locations");
    try {
      seedCleanWorld(world);
      const run = await runMigration(world, ["install", "migrate", "--json"]);
      expect(run.exit).toBe(0);
      expect(exists(world.priorConfig)).toBe(false);
      expect(exists(world.priorState)).toBe(false);
      expect(exists(world.priorProject)).toBe(false);
      expect(exists(join(world.currentConfig, "config.yaml"))).toBe(true);
      expect(exists(join(world.currentState, "projects", "p1", "header.p1.json"))).toBe(true);
      expect(exists(join(world.currentProject, "config.yaml"))).toBe(true);
    } finally {
      world.dispose();
    }
  });
});

describe("TC-SHIM-004 the compatibility alias", () => {
  test("the alias refuses the verb and its help carries the deprecation sentence", async () => {
    const world = WORLD("shim");
    try {
      seedCleanWorld(world);
      const run = await runMigration(world, ["install", "migrate", "--json"], {
        ownsInstallation: false,
      });
      expect(run.error?.code).toBe("install.identity.not-owning");
      expect(run.exit).toBe(1);
      const help = await runMigration(world, ["install", "--help"], {
        ownsInstallation: false,
      });
      expect(help.stdout).toContain("0.2.0");
      expect(help.stdout.toLowerCase()).toContain("alias");
    } finally {
      world.dispose();
    }
  });
});
