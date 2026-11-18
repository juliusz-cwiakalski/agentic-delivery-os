/**
 * The pure supervisor descriptor and unit rendering (GH-238 F-15; DEC-3,
 * DEC-17, DEC-18; DM-12; AC-F15-1, AC-F15-2).
 *
 * The unit content is data only: `ExecStart=<binary> daemon start --foreground`,
 * `Type=simple`, an optional `WorkingDirectory=<checkout root>`,
 * `Restart=on-failure`, and the explicit
 * `Environment=<PREFIX>_STATE_DIR=<canonical absolute state directory>` binding.
 * It carries no secret, no shell-evaluated content, and no hardcoded product
 * token. The default interactive `daemon start` remains spawn-and-return.
 */
import type {
  DaemonSupervisorDescriptor,
  DaemonSupervisorKind,
  DaemonSupervisorCommandForm,
} from "#contracts";

export type SupervisorPlatform = "linux" | "darwin" | "win32";

export const supervisorKindFor = (platform: SupervisorPlatform): DaemonSupervisorKind =>
  platform === "linux" ? "systemd-user" : platform === "darwin" ? "launchd" : "windows-service";

export const supervisorSupported = (platform: SupervisorPlatform): boolean => platform === "linux";

export type SystemdUnitInput = {
  readonly binary: string;
  readonly stateDirectory: string;
  readonly environmentName: string;
  readonly unit: string;
  /**
   * The unit's working directory. Absent keeps the delivered shape; a
   * repository-scoped state root supplies the checkout root so the unit process
   * resolves the same project scope (GH-288 F-1, GH-286 F-3).
   */
  readonly workingDirectory?: string;
};

/** Render the one Linux user unit; argument vectors stay data, never shell. */
export const renderSystemdUnit = (input: SystemdUnitInput): string =>
  [
    "[Unit]",
    `Description=${input.unit}`,
    "After=default.target",
    "",
    "[Service]",
    `Type=simple`,
    `ExecStart=${input.binary} daemon start --foreground`,
    ...(input.workingDirectory === undefined ? [] : [`WorkingDirectory=${input.workingDirectory}`]),
    `Environment=${input.environmentName}=${input.stateDirectory}`,
    `Restart=on-failure`,
    "",
    "[Install]",
    "WantedBy=default.target",
    "",
  ].join("\n");

export type SupervisorDescriptorInput = {
  readonly kind: DaemonSupervisorKind;
  readonly unit: string;
  readonly scope: string;
  readonly installed: boolean;
  readonly linger: boolean;
  readonly commandForm?: DaemonSupervisorCommandForm;
  readonly environmentName?: string;
  readonly stateDirectory?: string;
};

export const describeSupervisor = (
  input: SupervisorDescriptorInput,
): DaemonSupervisorDescriptor => ({
  kind: input.kind,
  installed: input.installed,
  unit: input.unit,
  scope: input.scope,
  linger: input.linger,
  commandForm: input.commandForm ?? "foreground",
  serviceType: "simple",
  restartPolicy: "on-failure",
  ...(input.environmentName === undefined || input.stateDirectory === undefined
    ? {}
    : {
        environment: { name: input.environmentName, value: input.stateDirectory },
      }),
});

/** The ownership marker is secret-free data. */
export type SupervisorOwnershipMarker = {
  readonly schema: "delivery.daemon.install.v1";
  readonly unit: string;
  readonly scope: string;
  readonly lingerEnabled: boolean;
  readonly installedAt: string;
};

export const renderOwnershipMarker = (marker: SupervisorOwnershipMarker): string =>
  `${JSON.stringify(marker)}\n`;
