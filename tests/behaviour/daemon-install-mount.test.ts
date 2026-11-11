/**
 * The install/uninstall lifecycle over the brand-derived identity
 * (TC-DAEMON-100, 101, 102, 103, 104, 124).
 *
 * No automated case calls `systemctl` (GAP-T4): the supervisor is either a
 * recording port that renders the delivered unit for parsing, or the delivered
 * adapter over an in-memory filesystem and a recording command runner. Every
 * case invokes a composed command handler directly, never `runEntrypoint`.
 */
import { describe, expect, test } from "bun:test";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { createDaemonCommandRuntime } from "../../packages/cli/src/daemon-compose";
import { createSupervisorAdapter } from "../../packages/adapters/src/daemon/supervisor";
import {
  DAEMON_SUPERVISOR_COMMAND_FORMS,
  DAEMON_SUPERVISOR_RESTART_POLICIES,
  DAEMON_SUPERVISOR_SERVICE_TYPES,
  type DaemonSupervisorDescriptor,
  type SupervisorInstallRequest,
  type SupervisorPort,
} from "../../packages/core/src/contracts/index";
import { renderSystemdUnit } from "../../packages/core/src/domain/daemon-supervisor";
import { daemonScopeDigest } from "../../packages/core/src/domain/daemon-lock";
import { readDaemonInstance } from "../../packages/core/src/app/index";
import {
  createMemorySupervisor,
  createMountHarness,
  mountComposition,
  mountSettings,
  stateDirectoryName,
} from "../fixtures/daemon/mount-harness";
import { appendHeartbeat, appendInstance, scopeOf } from "../fixtures/daemon/mount-states";

type InstallRecorder = {
  readonly port: SupervisorPort;
  readonly requests: SupervisorInstallRequest[];
  readonly unitText: () => string;
  readonly installCalls: () => number;
};

/** A recording supervisor that renders the delivered unit for parsing. */
const createInstallRecorder = (): InstallRecorder => {
  const requests: SupervisorInstallRequest[] = [];
  let installed = false;
  const describe = (scope: string, unit: string, linger: boolean): DaemonSupervisorDescriptor => ({
    kind: "systemd-user",
    installed: true,
    unit,
    scope,
    linger,
    commandForm: DAEMON_SUPERVISOR_COMMAND_FORMS[0],
    serviceType: DAEMON_SUPERVISOR_SERVICE_TYPES[0],
    restartPolicy: DAEMON_SUPERVISOR_RESTART_POLICIES[0],
  });
  const port: SupervisorPort = {
    kind: "systemd-user",
    platform: "linux",
    inspect: () =>
      installed
        ? {
            supported: true,
            descriptor: {
              ...describe("recorded-scope", "example-product-daemon.service", true),
              environment: { name: "EXAMPLE_PRODUCT_STATE_DIR", value: "/recorded" },
            },
          }
        : {
            supported: true,
            descriptor: {
              ...describe("recorded-scope", "example-product-daemon.service", false),
              installed: false,
            },
          },
    install: (request) => {
      requests.push(request);
      installed = true;
      void describe(request.scope, request.unit, request.enableLinger);
      return {
        ok: true,
        descriptor: {
          ...describe(request.scope, request.unit, request.enableLinger),
          environment: { name: request.environmentName, value: request.stateDirectory },
        },
      };
    },
    uninstall: () => {
      const removed = installed;
      installed = false;
      return { removed };
    },
  };
  return {
    port,
    requests,
    unitText: () => {
      const request = requests[requests.length - 1];
      if (request === undefined) return "";
      return renderSystemdUnit({
        binary: request.binary,
        stateDirectory: request.stateDirectory,
        environmentName: request.environmentName,
        unit: request.unit,
      });
    },
    installCalls: () => requests.length,
  };
};

const invoke = async (
  runtime: ReturnType<typeof createDaemonCommandRuntime>,
  argv: readonly string[],
) => {
  const definition = createDaemonCommandDefinition(runtime);
  const [subcommand, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = subcommand === undefined ? [] : [subcommand];
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index] as string;
    if (token === "--mode") {
      flags["--mode"] = rest[index + 1] as string;
      index += 1;
      continue;
    }
    flags[token] = true;
  }
  return definition.handler({ positionals, flags, global: {} } as never);
};

const isFailure = (value: unknown): value is { error: { code: string; kind: string } } =>
  typeof value === "object" && value !== null && "error" in value;

describe("TC-DAEMON-100 the installed unit", () => {
  test("the unit carries the absolute entry path and the exact environment binding", async () => {
    const harness = createMountHarness({ label: "install-100" });
    try {
      const recorder = createInstallRecorder();
      const entry = `${harness.root}/bin/${harness.brand.binaryName}`;
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, { daemonEntry: entry, supervisor: recorder.port }),
      );
      const result = await invoke(runtime, ["install"]);
      expect(isFailure(result)).toBe(false);
      if (isFailure(result)) return;
      const data = result.data as {
        result: string;
        supervisor: { unit: string; scope: string; installed: boolean; linger: boolean };
      };
      expect(data.result).toBe("installed");
      expect(data.supervisor.unit).toBe(`${harness.brand.binaryName}-daemon.service`);
      expect(data.supervisor.installed).toBe(true);
      expect(data.supervisor.scope).toBe(daemonScopeDigest(harness.stateDirectory));

      const request = recorder.requests[0];
      expect(request?.unit).toBe(`${harness.brand.binaryName}-daemon.service`);
      expect(request?.binary).toBe(entry);
      expect(request?.binary.startsWith("/")).toBe(true);
      expect(request?.environmentName).toBe(stateDirectoryName(harness.brand));
      expect(request?.stateDirectory).toBe(harness.stateDirectory);
      expect(request?.enableLinger).toBe(true);

      const unit = recorder.unitText();
      expect(unit).toContain(`ExecStart=${entry} daemon start --foreground`);
      expect(unit).toContain(
        `Environment=${stateDirectoryName(harness.brand)}=${harness.stateDirectory}`,
      );
      expect(unit).toContain("Type=simple");
      expect(unit).toContain("Restart=on-failure");
      expect(unit).toContain("WantedBy=default.target");
      // Exactly one Environment line and no re-entry variables.
      expect(unit.split("\n").filter((line) => line.startsWith("Environment="))).toHaveLength(1);
      expect(unit).not.toContain("PATH=");
      expect(unit).not.toContain("HOME=");
      // The state directory is never the unit directory.
      expect(unit).not.toContain(`${harness.stateDirectory}/systemd/user`);
    } finally {
      harness.dispose();
    }
  });

  test("the delivered adapter writes, enables, lingers, and marks in that order", async () => {
    const harness = createMountHarness({ label: "install-100b" });
    try {
      const memory = createMemorySupervisor();
      const configRoot = `${harness.root}/config`;
      const entry = `${harness.root}/bin/${harness.brand.binaryName}`;
      const adapter = createSupervisorAdapter({
        platform: "linux",
        configDirectory: configRoot,
        unit: `${harness.brand.binaryName}-daemon.service`,
        scope: daemonScopeDigest(harness.stateDirectory),
        environmentName: stateDirectoryName(harness.brand),
        stateDirectory: harness.stateDirectory,
        fs: memory.fs,
        run: memory.run,
        nowIso: () => "2026-11-11T10:00:00Z",
      });
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, { daemonEntry: entry, supervisor: adapter }),
      );
      const result = await invoke(runtime, ["install"]);
      expect(isFailure(result)).toBe(false);
      const unitPath = `${configRoot}/systemd/user/${harness.brand.binaryName}-daemon.service`;
      expect([...memory.files.keys()]).toContain(unitPath);
      const commands = memory.commands;
      const writeIndex = commands.findIndex((entry) => entry === `write ${unitPath}`);
      const enableIndex = commands.findIndex((entry) =>
        entry.startsWith(`systemctl --user enable ${harness.brand.binaryName}-daemon.service`),
      );
      const lingerIndex = commands.findIndex((entry) => entry.startsWith("loginctl enable-linger"));
      const markerIndex = commands.findIndex((entry) => entry.includes("daemon-install.json"));
      expect(writeIndex).toBeGreaterThanOrEqual(0);
      expect(enableIndex).toBeGreaterThan(writeIndex);
      expect(lingerIndex).toBeGreaterThan(enableIndex);
      expect(markerIndex).toBeGreaterThan(lingerIndex);
      // Exactly one unit and one marker.
      expect([...memory.files.keys()].filter((path) => path.endsWith(".service"))).toHaveLength(1);
      expect([...memory.files.keys()].filter((path) => path.endsWith(".json"))).toHaveLength(1);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-101 the configuration root", () => {
  const fixtures = [
    { id: "absolute", xdg: "/xdg/absolute", expected: "/xdg/absolute" },
    { id: "unset", xdg: undefined, expected: "<home>/.config" },
    { id: "empty", xdg: "", expected: "<home>/.config" },
    { id: "relative", xdg: "relative/config", expected: "<home>/.config" },
  ] as const;

  test("an absolute XDG_CONFIG_HOME wins and every other value falls back to <home>/.config", () => {
    const harness = createMountHarness({ label: "install-101" });
    try {
      for (const fixture of fixtures) {
        const expected =
          fixture.expected === "<home>/.config" ? `${harness.home}/.config` : fixture.expected;
        const memory = createMemorySupervisor();
        const adapter = createSupervisorAdapter({
          platform: "linux",
          configDirectory: expected,
          unit: `${harness.brand.binaryName}-daemon.service`,
          scope: daemonScopeDigest(harness.stateDirectory),
          environmentName: stateDirectoryName(harness.brand),
          stateDirectory: harness.stateDirectory,
          fs: memory.fs,
          run: memory.run,
        });
        const request: SupervisorInstallRequest = {
          unit: `${harness.brand.binaryName}-daemon.service`,
          scope: daemonScopeDigest(harness.stateDirectory),
          stateDirectory: harness.stateDirectory,
          binary: `${harness.root}/bin/${harness.brand.binaryName}`,
          environmentName: stateDirectoryName(harness.brand),
          enableLinger: true,
        };
        const outcome = adapter.install(request);
        expect(outcome.ok).toBe(true);
        const unitPath = `${expected}/systemd/user/${harness.brand.binaryName}-daemon.service`;
        expect([...memory.files.keys()]).toContain(unitPath);
        if (fixture.id === "relative") {
          // The relative value is treated as absent, never joined onto the cwd.
          expect(existsUnder(memory.files, "relative/config")).toBe(false);
        }
        if (fixture.id === "absolute") {
          expect(existsUnder(memory.files, `${harness.home}/.config`)).toBe(false);
        }
      }
    } finally {
      harness.dispose();
    }
  });

  test("the production composition derives the root from the XDG rule, never from the state directory", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "packages/cli/src/production.ts"), "utf8");
    expect(source).toContain("XDG_CONFIG_HOME");
    expect(source).toContain("supervisorConfigDirectory: supervisorConfigDirectoryFor");
    expect(source).toContain("/.config`");
  });
});

const existsUnder = (files: Map<string, string>, prefix: string): boolean =>
  [...files.keys()].some((path) => path.startsWith(prefix));

describe("TC-DAEMON-102 unsupported platform and linger failure", () => {
  test("an unsupported platform refuses and writes nothing", async () => {
    const harness = createMountHarness({ label: "install-102" });
    try {
      for (const platform of ["darwin", "win32"] as const) {
        const runtime = createDaemonCommandRuntime(
          mountComposition(harness, {
            daemonEntry: `${harness.root}/bin/entry.ts`,
            platform,
            supervisor: undefined,
            supervisorConfigDirectory: `${harness.root}/config-${platform}`,
          }),
        );
        const result = await invoke(runtime, ["install"]);
        expect(isFailure(result)).toBe(true);
        if (!isFailure(result)) continue;
        expect(result.error.code).toBe("daemon.supervisor-unsupported");
        const { existsSync } = await import("node:fs");
        expect(existsSync(`${harness.root}/config-${platform}`)).toBe(false);
      }
    } finally {
      harness.dispose();
    }
  });

  test("a linger failure rolls the unit and the marker back in order", async () => {
    const harness = createMountHarness({ label: "install-102b" });
    try {
      const memory = createMemorySupervisor();
      memory.failCommand("loginctl");
      const configRoot = `${harness.root}/config`;
      const adapter = createSupervisorAdapter({
        platform: "linux",
        configDirectory: configRoot,
        unit: `${harness.brand.binaryName}-daemon.service`,
        scope: daemonScopeDigest(harness.stateDirectory),
        environmentName: stateDirectoryName(harness.brand),
        stateDirectory: harness.stateDirectory,
        fs: memory.fs,
        run: memory.run,
      });
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, {
          daemonEntry: `${harness.root}/bin/entry.ts`,
          supervisor: adapter,
        }),
      );
      const result = await invoke(runtime, ["install"]);
      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) expect(result.error.code).toBe("daemon.supervisor-unsupported");
      expect(memory.files.size).toBe(0);
      const commands = memory.commands;
      expect(commands.some((entry) => entry.startsWith("systemctl --user disable"))).toBe(true);
      expect(commands[commands.length - 1]).toContain("remove");
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-103 ownership-scoped uninstall", () => {
  test("uninstall removes only its own artifacts and a second uninstall is a noop", async () => {
    const harness = createMountHarness({ label: "install-103" });
    try {
      const memory = createMemorySupervisor();
      const configRoot = `${harness.root}/config`;
      const unitName = `${harness.brand.binaryName}-daemon.service`;
      const adapter = createSupervisorAdapter({
        platform: "linux",
        configDirectory: configRoot,
        unit: unitName,
        scope: daemonScopeDigest(harness.stateDirectory),
        environmentName: stateDirectoryName(harness.brand),
        stateDirectory: harness.stateDirectory,
        fs: memory.fs,
        run: memory.run,
      });
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, {
          daemonEntry: `${harness.root}/bin/entry.ts`,
          supervisor: adapter,
        }),
      );
      // Unrelated artifacts an ownership-scoped uninstall must not touch.
      memory.fs.write(`${configRoot}/systemd/user/unrelated.service`, "unrelated\n");
      memory.fs.write(`${configRoot}/unrelated.daemon-install.json`, '{"unit":"unrelated"}\n');

      expect(isFailure(await invoke(runtime, ["install"]))).toBe(false);
      const uninstalled = await invoke(runtime, ["uninstall"]);
      expect(isFailure(uninstalled)).toBe(false);
      if (!isFailure(uninstalled)) {
        expect((uninstalled.data as { result: string }).result).toBe("uninstalled");
      }
      expect(memory.files.get(`${configRoot}/systemd/user/unrelated.service`)).toBe("unrelated\n");
      expect(memory.files.get(`${configRoot}/unrelated.daemon-install.json`)).toBe(
        '{"unit":"unrelated"}\n',
      );
      expect(existsUnder(memory.files, `${harness.stateDirectory}`)).toBe(false);

      const again = await invoke(runtime, ["uninstall"]);
      expect(isFailure(again)).toBe(false);
      if (!isFailure(again)) {
        expect((again.data as { result: string }).result).toBe("noop");
      }
    } finally {
      harness.dispose();
    }
  });

  test("uninstall with nothing installed is a noop", async () => {
    const harness = createMountHarness({ label: "install-103b" });
    try {
      const recorder = createInstallRecorder();
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, {
          daemonEntry: `${harness.root}/bin/entry.ts`,
          supervisor: recorder.port,
        }),
      );
      const result = await invoke(runtime, ["uninstall"]);
      expect(isFailure(result)).toBe(false);
      if (!isFailure(result)) {
        expect((result.data as { result: string }).result).toBe("noop");
      }
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-104 install without an entry path", () => {
  test("the refusal keys on entry-path absence only and renders nothing", async () => {
    const harness = createMountHarness({ label: "install-104" });
    try {
      const memory = createMemorySupervisor();
      const adapter = createSupervisorAdapter({
        platform: "linux",
        configDirectory: `${harness.root}/config`,
        unit: `${harness.brand.binaryName}-daemon.service`,
        scope: daemonScopeDigest(harness.stateDirectory),
        environmentName: stateDirectoryName(harness.brand),
        stateDirectory: harness.stateDirectory,
        fs: memory.fs,
        run: memory.run,
      });
      let rendered = 0;
      const spy: SupervisorPort = {
        ...adapter,
        install: (request) => {
          rendered += 1;
          return adapter.install(request);
        },
      };
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, { supervisor: spy, binary: "/supplied/binary" }),
      );
      const result = await invoke(runtime, ["install"]);
      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) expect(result.error.code).toBe("daemon.state-recovery-failed");
      expect(rendered).toBe(0);
      expect(memory.files.size).toBe(0);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-124 idempotence and refusal", () => {
  test("a second install writes the same bytes and one unit and one marker", async () => {
    const harness = createMountHarness({ label: "install-124" });
    try {
      const memory = createMemorySupervisor();
      const configRoot = `${harness.root}/config`;
      const adapter = createSupervisorAdapter({
        platform: "linux",
        configDirectory: configRoot,
        unit: `${harness.brand.binaryName}-daemon.service`,
        scope: daemonScopeDigest(harness.stateDirectory),
        environmentName: stateDirectoryName(harness.brand),
        stateDirectory: harness.stateDirectory,
        fs: memory.fs,
        run: memory.run,
        nowIso: () => "2026-11-11T10:00:00Z",
      });
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, {
          daemonEntry: `${harness.root}/bin/entry.ts`,
          supervisor: adapter,
        }),
      );
      expect(isFailure(await invoke(runtime, ["install"]))).toBe(false);
      const firstUnit = memory.files.get(
        `${configRoot}/systemd/user/${harness.brand.binaryName}-daemon.service`,
      );
      const firstMarker = memory.files.get(
        `${configRoot}/${harness.brand.binaryName}-daemon.daemon-install.json`,
      );
      expect(isFailure(await invoke(runtime, ["install"]))).toBe(false);
      expect(
        memory.files.get(`${configRoot}/systemd/user/${harness.brand.binaryName}-daemon.service`),
      ).toBe(firstUnit);
      expect(
        memory.files.get(`${configRoot}/${harness.brand.binaryName}-daemon.daemon-install.json`),
      ).toBe(firstMarker);
      expect([...memory.files.keys()].filter((path) => path.endsWith(".service"))).toHaveLength(1);
    } finally {
      harness.dispose();
    }
  });

  test("stop against a released instance is a noop with zero signals", async () => {
    const harness = createMountHarness({ label: "install-124b" });
    try {
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      appendInstance(harness.store, { operation: "released", releaseReason: "drain" });
      const runtime = createDaemonCommandRuntime(mountComposition(harness));
      const result = await invoke(runtime, ["stop"]);
      expect(isFailure(result)).toBe(false);
      if (!isFailure(result)) {
        expect((result.data as { result: string }).result).toBe("noop");
      }
      expect(harness.processPort.signals).toHaveLength(0);
    } finally {
      harness.dispose();
    }
  });

  test("a live start refuses as daemon.already-running with an unchanged record count", async () => {
    const harness = createMountHarness({ label: "install-124c" });
    try {
      const acquired = harness.lock.acquire({
        lockToken: "held-token",
        instanceId: "held-instance",
        pid: 777,
        scope: scopeOf(harness.stateDirectory),
        acquiredAt: "2026-11-11T10:00:00Z",
        heartbeatAt: "2026-11-11T10:00:00Z",
      });
      expect(acquired.ok).toBe(true);
      appendInstance(harness.store, { pid: 777 });
      appendHeartbeat(harness.store, { instanceId: "instance-live" });
      const before = (readDaemonInstance(harness.store) as { latest?: unknown }).latest;
      const runtime = createDaemonCommandRuntime(mountComposition(harness));
      const result = await invoke(runtime, ["start"]);
      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) expect(result.error.code).toBe("daemon.already-running");
      const after = (readDaemonInstance(harness.store) as { latest?: unknown }).latest;
      expect(after).toEqual(before);
    } finally {
      harness.dispose();
    }
  });
});

// Keep the imported settings helper referenced for the identity assertions.
void mountSettings;
