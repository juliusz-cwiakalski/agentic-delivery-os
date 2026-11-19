/**
 * The install lifecycle's scratch home and runtime harness (GH-346 §6.2).
 *
 * Every lifecycle case builds a scratch `HOME`, a config root, a state root, and
 * an install directory under the repo-local `tmp/tmpdir/`, never the operator's
 * real roots. The snapshot helper proves the zero-write claims (paths, sizes,
 * `mtimeNs`, modes).
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { createNodeInstallFilePort } from "../../../packages/adapters/src/file/index";
import type {
  InstallArtifactIdentity,
  InstallDaemonPort,
  InstallFilePort,
  InstallGitRead,
  InstallRuntime,
} from "../../../packages/core/src/contracts/install";
import { STATE_SCHEMA_VERSION } from "../../../packages/core/src/contracts/state";

const ROOT = process.cwd();

export type InstallScratch = {
  readonly base: string;
  readonly home: string;
  readonly configRoot: string;
  readonly stateRoot: string;
  readonly installDirectory: string;
  readonly destinationPath: string;
  readonly slotPath: string;
  readonly recordPath: string;
  dispose: () => void;
};

/** Build the scratch roots (nothing is written outside them). */
export const createInstallScratch = (label: string): InstallScratch => {
  const base = mkdtempSync(join(ROOT, "tmp/tmpdir/gh346-install-"));
  const home = join(base, "home");
  const configRoot = join(home, ".jaiship");
  const stateRoot = join(base, "state");
  const installDirectory = join(configRoot, "bin");
  for (const directory of [home, stateRoot]) mkdirSync(directory, { recursive: true });
  return {
    base,
    home,
    configRoot,
    stateRoot,
    installDirectory,
    destinationPath: join(installDirectory, "jaiship"),
    slotPath: join(installDirectory, "jaiship.previous"),
    recordPath: join(configRoot, "install.json"),
    dispose: () => rmSync(base, { recursive: true, force: true }),
  };
};

/** The declared identity a compiled fixture run carries. */
export const fixtureIdentity = (
  overrides: Partial<InstallArtifactIdentity> = {},
): InstallArtifactIdentity => ({
  version: "0.0.0",
  commit: "4bc7b61a2c3d4e5f60718293a4b5c6d7e8f90123",
  builtAt: "2026-11-18T12:00:00.000Z",
  dirty: false,
  channel: "dev",
  ...overrides,
});

export type InstallRuntimeOptions = {
  readonly scratch: InstallScratch;
  readonly runningArtifactPath: string;
  readonly identity?: InstallArtifactIdentity;
  readonly git?: InstallGitRead;
  readonly daemon?: InstallDaemonPort;
  readonly ownsInstallation?: boolean;
  readonly invokedIdentity?: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly stateRoots?: readonly string[];
  readonly priorNamespaceArtifacts?: readonly string[];
  readonly fs?: InstallFilePort;
  readonly fault?: InstallRuntime["fault"];
};

/** Compose one runtime over the scratch roots with every seam injected. */
export const createInstallRuntime = (options: InstallRuntimeOptions): InstallRuntime => ({
  homeDirectory: options.scratch.home,
  destinationPath: options.scratch.destinationPath,
  installDirectory: options.scratch.installDirectory,
  slotPath: options.scratch.slotPath,
  recordPath: options.scratch.recordPath,
  configRoot: options.scratch.configRoot,
  stateRoot: options.scratch.stateRoot,
  stateRoots: options.stateRoots ?? [options.scratch.stateRoot],
  acceptedStateSchemaVersion: STATE_SCHEMA_VERSION,
  ...(options.identity === undefined ? {} : { runningIdentity: options.identity }),
  runningArtifactPath: options.runningArtifactPath,
  ownsInstallation: options.ownsInstallation ?? true,
  invokedIdentity: options.invokedIdentity ?? "jaiship",
  environment: options.environment ?? { HOME: options.scratch.home },
  clock: { nowIso: () => "2026-11-18T12:05:00.000Z" },
  fs: options.fs ?? createNodeInstallFilePort(),
  git: { readCheckout: () => options.git ?? { kind: "unbound" } },
  daemon: options.daemon ?? {
    status: async () => ({ running: false }),
    stop: async () => ({ ok: true }),
  },
  priorNamespaceArtifacts: options.priorNamespaceArtifacts ?? [],
  ...(options.fault === undefined ? {} : { fault: options.fault }),
});

/** A sorted `relative-path|size|mtimeNs|mode` snapshot of one tree. */
export const snapshotTree = (path: string): readonly string[] => {
  const lines: string[] = [];
  const walk = (relative: string): void => {
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(join(path, relative), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const next = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
      const absolute = join(path, next);
      if (entry.isDirectory()) {
        lines.push(`${next}|dir`);
        walk(next);
      } else {
        const stats = statSync(absolute, { bigint: true });
        lines.push(`${next}|${String(stats.size)}|${String(stats.mtimeNs)}|${String(stats.mode)}`);
      }
    }
  };
  walk("");
  return lines.sort();
};

/** Read the record text, or `undefined` when it is absent. */
export const readRecordText = (scratch: InstallScratch): string | undefined => {
  try {
    return readFileSync(scratch.recordPath, "utf8");
  } catch {
    return undefined;
  }
};
