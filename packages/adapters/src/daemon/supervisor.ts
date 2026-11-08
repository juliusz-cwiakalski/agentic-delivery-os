/**
 * The platform supervisor adapters (GH-238 F-15; DEC-3, DEC-17, DEC-18; NFR-7,
 * NFR-12, NFR-18).
 *
 * The Linux systemd user adapter writes the unit and the secret-free ownership
 * marker, enables the unit and linger, rolls back on linger failure, and removes
 * only what this installation created. launchd and Windows return the classified
 * unsupported outcome. Every filesystem and process call is injected.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import type {
  DaemonSupervisorDescriptor,
  SupervisorInspection,
  SupervisorInstallOutcome,
  SupervisorInstallRequest,
  SupervisorPort,
} from "@delivery-os/core/contracts";

// The adapters tier imports core ./contracts only (ADR-0003 DEC-2). The pure
// rendering lives in core ./domain and the composition passes the same shape;
// this local renderer keeps the subpath boundary intact.
type SupervisorPlatform = "linux" | "darwin" | "win32";
type SupervisorOwnershipMarker = {
  readonly schema: "delivery.daemon.install.v1";
  readonly unit: string;
  readonly scope: string;
  readonly lingerEnabled: boolean;
  readonly installedAt: string;
};

const supervisorKindFor = (platform: SupervisorPlatform) =>
  platform === "linux" ? "systemd-user" : platform === "darwin" ? "launchd" : "windows-service";
const supervisorSupported = (platform: SupervisorPlatform): boolean => platform === "linux";

const renderSystemdUnit = (input: {
  readonly binary: string;
  readonly stateDirectory: string;
  readonly environmentName: string;
  readonly unit: string;
}): string =>
  [
    "[Unit]",
    `Description=${input.unit}`,
    "After=default.target",
    "",
    "[Service]",
    "Type=simple",
    `ExecStart=${input.binary} daemon start --foreground`,
    `Environment=${input.environmentName}=${input.stateDirectory}`,
    "Restart=on-failure",
    "",
    "[Install]",
    "WantedBy=default.target",
    "",
  ].join("\n");

const renderOwnershipMarker = (marker: SupervisorOwnershipMarker): string =>
  `${JSON.stringify(marker)}\n`;

const describeSupervisor = (input: {
  readonly kind: "systemd-user" | "launchd" | "windows-service";
  readonly unit: string;
  readonly scope: string;
  readonly installed: boolean;
  readonly linger: boolean;
  readonly environmentName?: string;
  readonly stateDirectory?: string;
}) => ({
  kind: input.kind,
  installed: input.installed,
  unit: input.unit,
  scope: input.scope,
  linger: input.linger,
  commandForm: "foreground" as const,
  serviceType: "simple" as const,
  restartPolicy: "on-failure" as const,
  ...(input.environmentName === undefined || input.stateDirectory === undefined
    ? {}
    : { environment: { name: input.environmentName, value: input.stateDirectory } }),
});

export type SupervisorFileSystem = {
  readonly exists: (path: string) => boolean;
  readonly read: (path: string) => string;
  readonly write: (path: string, text: string) => void;
  readonly remove: (path: string) => void;
  readonly ensureDirectory: (path: string) => void;
};

export type SupervisorCommandRunner = (
  command: string,
  args: readonly string[],
) => { readonly status: number; readonly stdout?: string; readonly stderr?: string };

export type SupervisorAdapterOptions = {
  readonly platform: SupervisorPlatform;
  readonly configDirectory: string;
  readonly unit: string;
  readonly scope: string;
  readonly environmentName: string;
  readonly stateDirectory: string;
  readonly fs?: SupervisorFileSystem;
  readonly run?: SupervisorCommandRunner;
  readonly nowIso?: () => string;
};

const nodeFs: SupervisorFileSystem = {
  exists: (path) => existsSync(path),
  read: (path) => readFileSync(path, "utf8"),
  write: (path, text) => writeFileSync(path, text),
  remove: (path) => rmSync(path, { force: true }),
  ensureDirectory: (path) => mkdirSync(path, { recursive: true }),
};

const nodeRun: SupervisorCommandRunner = (command, args) => {
  const result = spawnSync(command, [...args], { encoding: "utf8" });
  return {
    status: result.status ?? 1,
    ...(result.stdout === null ? {} : { stdout: result.stdout }),
    ...(result.stderr === null ? {} : { stderr: result.stderr }),
  };
};

const markerPath = (options: SupervisorAdapterOptions): string =>
  `${options.configDirectory}/${basename(options.unit).replace(/\.service$/u, "")}.daemon-install.json`;

const unitPath = (options: SupervisorAdapterOptions): string =>
  `${options.configDirectory}/systemd/user/${options.unit}`;

const readMarker = (options: SupervisorAdapterOptions): SupervisorOwnershipMarker | undefined => {
  const fs = options.fs ?? nodeFs;
  const path = markerPath(options);
  if (!fs.exists(path)) return undefined;
  try {
    const parsed: unknown = JSON.parse(fs.read(path));
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const record = parsed as Record<string, unknown>;
    if (record.schema !== "delivery.daemon.install.v1") return undefined;
    if (typeof record.unit !== "string" || typeof record.scope !== "string") return undefined;
    if (typeof record.lingerEnabled !== "boolean" || typeof record.installedAt !== "string") {
      return undefined;
    }
    return {
      schema: "delivery.daemon.install.v1",
      unit: record.unit,
      scope: record.scope,
      lingerEnabled: record.lingerEnabled,
      installedAt: record.installedAt,
    };
  } catch {
    return undefined;
  }
};

export const createSupervisorAdapter = (options: SupervisorAdapterOptions): SupervisorPort => {
  const fs = options.fs ?? nodeFs;
  const run = options.run ?? nodeRun;
  const kind = supervisorKindFor(options.platform);
  return {
    kind,
    platform: options.platform,
    inspect: (): SupervisorInspection => {
      if (!supervisorSupported(options.platform)) {
        return { supported: false, kind, platform: options.platform };
      }
      const marker = readMarker(options);
      return {
        supported: true,
        descriptor: describeSupervisor({
          kind,
          unit: options.unit,
          scope: options.scope,
          installed: fs.exists(unitPath(options)),
          linger: marker?.lingerEnabled === true,
          environmentName: options.environmentName,
          stateDirectory: options.stateDirectory,
        }),
      };
    },
    install: (request: SupervisorInstallRequest): SupervisorInstallOutcome => {
      if (!supervisorSupported(options.platform)) {
        return {
          ok: false,
          code: "daemon.supervisor-unsupported",
          platform: options.platform,
          detail: `no ${kind} adapter`,
        };
      }
      const unitFile = unitPath(options);
      const markerFile = markerPath(options);
      fs.ensureDirectory(dirname(unitFile));
      fs.write(
        unitFile,
        renderSystemdUnit({
          binary: request.binary,
          stateDirectory: request.stateDirectory,
          environmentName: request.environmentName,
          unit: options.unit,
        }),
      );
      const enabled = run("systemctl", ["--user", "enable", options.unit]);
      if (enabled.status !== 0) {
        fs.remove(unitFile);
        fs.remove(markerFile);
        return {
          ok: false,
          code: "daemon.supervisor-unsupported",
          platform: options.platform,
          detail: "systemctl-enable-failed",
        };
      }
      if (request.enableLinger) {
        const lingered = run("loginctl", ["enable-linger"]);
        if (lingered.status !== 0) {
          run("systemctl", ["--user", "disable", options.unit]);
          fs.remove(unitFile);
          fs.remove(markerFile);
          return {
            ok: false,
            code: "daemon.supervisor-unsupported",
            platform: options.platform,
            detail: "linger-enable-failed",
          };
        }
      }
      const marker: SupervisorOwnershipMarker = {
        schema: "delivery.daemon.install.v1",
        unit: options.unit,
        scope: request.scope,
        lingerEnabled: request.enableLinger,
        installedAt: (options.nowIso ?? (() => new Date(0).toISOString()))(),
      };
      fs.write(markerFile, renderOwnershipMarker(marker));
      return {
        ok: true,
        descriptor: describeSupervisor({
          kind,
          unit: options.unit,
          scope: request.scope,
          installed: true,
          linger: request.enableLinger,
          environmentName: options.environmentName,
          stateDirectory: options.stateDirectory,
        }),
      };
    },
    uninstall: ({ unit }) => {
      const unitFile = unitPath(options);
      const marker = readMarker(options);
      if (marker === undefined || marker.unit !== unit) {
        return { removed: false };
      }
      run("systemctl", ["--user", "disable", options.unit]);
      if (marker.lingerEnabled) run("loginctl", ["disable-linger"]);
      fs.remove(unitFile);
      fs.remove(markerPath(options));
      return { removed: true };
    },
  };
};

/** A descriptor helper the CLI composition uses for an absent unit. */
export const absentSupervisorDescriptor = (input: {
  readonly platform: SupervisorPlatform;
  readonly unit: string;
  readonly scope: string;
}): DaemonSupervisorDescriptor =>
  describeSupervisor({
    kind: supervisorKindFor(input.platform),
    unit: input.unit,
    scope: input.scope,
    installed: false,
    linger: false,
  });
