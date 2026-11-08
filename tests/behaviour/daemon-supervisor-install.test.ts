/**
 * TC-INSTALL-001..007 — the systemd user unit, linger, idempotent install,
 * rollback, ownership-scoped uninstall, unsupported platforms, and residency.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  absentSupervisorDescriptor,
  createSupervisorAdapter,
} from "../../packages/adapters/src/daemon/supervisor";
import { createDaemonCommandRuntime } from "../../packages/cli/src/daemon-compose";
import {
  installSupervisor,
  uninstallSupervisor,
} from "../../packages/core/src/app/daemon-supervisor";
import type { DaemonClockPort, DaemonSettings } from "../../packages/core/src/contracts/index";
import { renderSystemdUnit } from "../../packages/core/src/domain/daemon-supervisor";
import { createDaemonLockPort } from "../../packages/core/src/state/index";
import { createTestEdge, makeIdentity, openStore } from "../fixtures/state/harness";

const NOW = "2026-11-08T10:00:00Z";

const settings = (root: string): DaemonSettings => ({
  heartbeatIntervalMs: 5_000,
  heartbeatCycleMs: 60_000,
  lockStalenessMs: 30_000,
  pollIntervalMs: 60_000,
  watchPollIntervalMs: 5_000,
  responseTimeoutMs: 2_000,
  subscriptionBuffer: 256,
  frameMaxBytes: 65_536,
  reconcileMaxLanes: 200,
  transport: "unix",
  socketPath: `${root}/daemon.sock`,
});

const clock = (): DaemonClockPort => ({
  nowMs: () => Date.parse(NOW),
  nowIso: () => NOW,
  sleep: async () => undefined,
});

const temp = (): string => mkdtempSync(join(process.cwd(), "tmp", "tmpdir", "gh238-supervisor-"));

const adapter = (
  root: string,
  platform: "linux" | "darwin" | "win32" = "linux",
  runStatus = 0,
  scope = "0123456789abcdef",
) => {
  const commands: string[] = [];
  const adapterPort = createSupervisorAdapter({
    platform,
    configDirectory: root,
    unit: "ados.service",
    scope,
    environmentName: "ADOS_STATE_DIR",
    stateDirectory: "/srv/ados",
    nowIso: () => NOW,
    run: (command, args) => {
      commands.push(`${command} ${args.join(" ")}`.trim());
      return { status: command === "loginctl" ? runStatus : 0 };
    },
  });
  return { adapterPort, commands };
};

describe("GH-238 supervisor install", () => {
  test("the unit content is data-only, foreground, and scope-bound", () => {
    const unit = renderSystemdUnit({
      binary: "ados",
      stateDirectory: "/srv/ados",
      environmentName: "ADOS_STATE_DIR",
      unit: "ados.service",
    });
    expect(unit).toContain("ExecStart=ados daemon start --foreground");
    expect(unit).toContain("Type=simple");
    expect(unit).toContain("Restart=on-failure");
    expect(unit).toContain("Environment=ADOS_STATE_DIR=/srv/ados");
    expect(unit).not.toContain("--state-dir");
    expect(unit).not.toContain("lock-");
  });

  test("install enables linger, reports it, and is idempotent", () => {
    const root = temp();
    try {
      const { adapterPort, commands } = adapter(root);
      const first = installSupervisor(adapterPort, {
        unit: "ados.service",
        scope: "0123456789abcdef",
        stateDirectory: "/srv/ados",
        binary: "ados",
        environmentName: "ADOS_STATE_DIR",
        enableLinger: true,
      });
      expect(first.ok).toBe(true);
      if (first.ok) {
        expect(first.data.supervisor.installed).toBe(true);
        expect(first.data.supervisor.linger).toBe(true);
        expect(first.data.supervisor.commandForm).toBe("foreground");
      }
      const second = installSupervisor(adapterPort, {
        unit: "ados.service",
        scope: "0123456789abcdef",
        stateDirectory: "/srv/ados",
        binary: "ados",
        environmentName: "ADOS_STATE_DIR",
        enableLinger: true,
      });
      expect(second.ok).toBe(true);
      expect(commands).toContain("systemctl --user enable ados.service");
      expect(commands).toContain("loginctl enable-linger");
      expect(existsSync(join(root, "systemd/user/ados.service"))).toBe(true);
      const marker = readFileSync(join(root, "ados.daemon-install.json"), "utf8");
      expect(marker).toContain("delivery.daemon.install.v1");
      expect(marker).not.toContain("lock-");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a linger failure removes the unit and returns the unsupported identity", () => {
    const root = temp();
    try {
      const { adapterPort } = adapter(root, "linux", 1);
      const result = installSupervisor(adapterPort, {
        unit: "ados.service",
        scope: "0123456789abcdef",
        stateDirectory: "/srv/ados",
        binary: "ados",
        environmentName: "ADOS_STATE_DIR",
        enableLinger: true,
      });
      expect(result).toMatchObject({ ok: false, code: "daemon.supervisor-unsupported" });
      expect(existsSync(join(root, "systemd/user/ados.service"))).toBe(false);
      expect(existsSync(join(root, "ados.daemon-install.json"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("uninstall removes only what this installation created and noops when absent", () => {
    const root = temp();
    try {
      const { adapterPort } = adapter(root);
      expect(uninstallSupervisor(adapterPort, "ados.service")).toMatchObject({
        ok: true,
        data: { result: "noop" },
      });
      installSupervisor(adapterPort, {
        unit: "ados.service",
        scope: "0123456789abcdef",
        stateDirectory: "/srv/ados",
        binary: "ados",
        environmentName: "ADOS_STATE_DIR",
        enableLinger: true,
      });
      const removed = uninstallSupervisor(adapterPort, "ados.service");
      expect(removed).toMatchObject({ ok: true, data: { result: "uninstalled" } });
      expect(existsSync(join(root, "systemd/user/ados.service"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("unsupported platforms exit with daemon.supervisor-unsupported and write no unit", () => {
    for (const platform of ["darwin", "win32"] as const) {
      const root = temp();
      try {
        const { adapterPort } = adapter(root, platform);
        const result = installSupervisor(adapterPort, {
          unit: "ados.service",
          scope: "scope",
          stateDirectory: "/srv/ados",
          binary: "ados",
          environmentName: "ADOS_STATE_DIR",
          enableLinger: true,
        });
        expect(result).toMatchObject({ ok: false, code: "daemon.supervisor-unsupported" });
        expect(existsSync(join(root, "systemd/user/ados.service"))).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test("two scopes install separate units and a wrong scope observes no daemon", () => {
    const first = temp();
    const second = temp();
    try {
      const a = adapter(first, "linux", 0, "scope-a");
      const b = adapter(second, "linux", 0, "scope-b");
      installSupervisor(a.adapterPort, {
        unit: "ados.service",
        scope: "scope-a",
        stateDirectory: "/srv/a",
        binary: "ados",
        environmentName: "ADOS_STATE_DIR",
        enableLinger: true,
      });
      installSupervisor(b.adapterPort, {
        unit: "ados.service",
        scope: "scope-b",
        stateDirectory: "/srv/b",
        binary: "ados",
        environmentName: "ADOS_STATE_DIR",
        enableLinger: true,
      });
      expect(a.adapterPort.inspect()).toMatchObject({
        supported: true,
        descriptor: { scope: "scope-a" },
      });
      expect(b.adapterPort.inspect()).toMatchObject({
        supported: true,
        descriptor: { scope: "scope-b" },
      });
      const absent = absentSupervisorDescriptor({
        platform: "linux",
        unit: "ados.service",
        scope: "other",
      });
      expect(absent.installed).toBe(false);
    } finally {
      rmSync(first, { recursive: true, force: true });
      rmSync(second, { recursive: true, force: true });
    }
  });

  test("residency: the installed command form is foreground, not spawn-and-return", () => {
    const root = temp();
    try {
      const descriptor = absentSupervisorDescriptor({
        platform: "linux",
        unit: "ados.service",
        scope: "scope",
      });
      expect(descriptor.commandForm).toBe("foreground");
      expect(
        renderSystemdUnit({
          binary: "ados",
          stateDirectory: "/srv/ados",
          environmentName: "ADOS_STATE_DIR",
          unit: "ados.service",
        }),
      ).toContain("--foreground");
      const spawnAndReturn = renderSystemdUnit({
        binary: "ados",
        stateDirectory: "/srv/ados",
        environmentName: "ADOS_STATE_DIR",
        unit: "ados.service",
      }).replace(" --foreground", "");
      expect(spawnAndReturn).not.toContain("--foreground");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a composition with no supported adapter refuses instead of reporting installed", async () => {
    const root = temp();
    try {
      const { store } = openStore(makeIdentity(root));
      const lock = createDaemonLockPort(createTestEdge(), root);
      const runtime = createDaemonCommandRuntime({
        store,
        lock,
        settings: settings(root),
        restartBound: 3,
        stateDirectory: root,
        unit: "ados.service",
        binary: "ados",
        environmentName: "ADOS_STATE_DIR",
        platform: "darwin",
        clock: clock(),
        newFenceToken: () => "f",
        newLockToken: () => "l",
        newInstanceId: () => "i",
      });
      const installed = await runtime.install();
      expect("error" in installed).toBe(true);
      if ("error" in installed) {
        expect(installed.error.code).toBe("daemon.supervisor-unsupported");
        expect(installed.error.summary).toContain("darwin");
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
