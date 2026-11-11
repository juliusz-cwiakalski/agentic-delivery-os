/**
 * GH-288 TC-PROJ-017, TC-PROJ-018 and TC-PROJ-019 — daemon reachability.
 *
 * The shipped composition mounts nothing, so it must declare the unmounted
 * reason without constructing a probe. A mounted composition probes a real
 * unix socket with a bounded connect that writes nothing and sends no frame.
 * The socket path is always the delivered settings derivation, never a path the
 * test invented.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { probeDaemonSocket } from "../../packages/adapters/src/daemon/unix";
import {
  type DaemonComposition,
  selectDaemonReachability,
} from "../../packages/core/src/app/projects";
import { resolveDaemonSettings } from "../../packages/core/src/config/index";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
  type ProductionRun,
} from "../fixtures/projects/production";
import { createHostFixture } from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";

type Envelope = {
  readonly data?: { readonly projects?: readonly Record<string, unknown>[] };
  readonly error?: { readonly code?: string };
};

const projectsOf = (run: ProductionRun): readonly Record<string, unknown>[] => {
  const data = (run.envelope as Envelope | undefined)?.data;
  if (data?.projects === undefined) throw new Error(`no data envelope: ${run.stdout}${run.stderr}`);
  return data.projects;
};

const daemonOf = (run: ProductionRun, projectKey: string): Record<string, unknown> => {
  const entry = projectsOf(run).find((candidate) => candidate.projectKey === projectKey);
  const daemon = entry?.daemonReachable;
  if (typeof daemon !== "object" || daemon === null) throw new Error("no daemon fact");
  return daemon as Record<string, unknown>;
};

const register = async (harness: ProductionProjectsHarness): Promise<void> => {
  const run = await harness.run(["queue", "list", "--json"]);
  if (run.exitCode !== 0) throw new Error(`registration failed: ${run.stderr}`);
};

const socketSettings = (stateRoot: string) => {
  const settings = resolveDaemonSettings({}, {}, { stateDirectory: stateRoot });
  if (!settings.ok) throw new Error(`daemon settings failed: ${settings.error.code}`);
  return settings.value;
};

/** The mounted capability the delivered probe provides, with per-connect counts. */
const mountedProbe = (): {
  readonly composition: DaemonComposition;
  readonly probes: () => number;
} => {
  let probes = 0;
  return {
    probes: () => probes,
    composition: {
      mounted: true,
      capability: () => ({
        probe: async (input) => {
          probes += 1;
          const result = await probeDaemonSocket(input);
          return result.reachable ? "reachable" : result.reason;
        },
      }),
    },
  };
};

type BoundServer = {
  readonly server: Server;
  readonly connections: () => number;
  readonly frames: () => number;
  readonly close: () => Promise<void>;
};

const bindSocket = async (socketPath: string): Promise<BoundServer> => {
  let connections = 0;
  let frames = 0;
  const server = createServer((socket) => {
    connections += 1;
    socket.on("data", (chunk) => {
      frames += chunk.length;
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => resolve());
  });
  return {
    server,
    connections: () => connections,
    frames: () => frames,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
};

describe("TC-PROJ-017 the unmounted ship declares the reason and never probes", () => {
  test("every entry reports daemon-not-mounted, and a throwing factory is never constructed", async () => {
    const host = createHostFixture("daemon-unmounted");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const withState = createRepository(base, "with-state");
      const withoutState = createRepository(base, "without-state");
      const a = createProductionProjectsHarness({
        label: "with-state",
        host,
        workingDirectory: withState,
        originUrl: "https://github.com/owner/with-state.git",
      });
      const b = createProductionProjectsHarness({
        label: "without-state",
        host,
        workingDirectory: withoutState,
        originUrl: "https://github.com/owner/without-state.git",
      });
      harnesses.push(a, b);
      await register(a);
      await register(b);
      await a.run(["queue", "add", "GH-241", "--priority", "1", "--json"]);

      const shipped = await a.run(["projects", "list", "--json"]);
      expect(shipped.exitCode).toBe(0);
      for (const harness of [a, b]) {
        expect(daemonOf(shipped, harness.projectKey)).toEqual({
          reachable: false,
          reason: "daemon-not-mounted",
        });
      }

      let constructions = 0;
      const throwing = createProductionProjectsHarness({
        label: "with-state",
        host,
        workingDirectory: withState,
        originUrl: "https://github.com/owner/with-state.git",
        daemon: {
          mounted: false,
          capability: () => {
            constructions += 1;
            throw new Error("the unmounted build must never construct a probe");
          },
        },
      });
      harnesses.push(throwing);
      const unprobed = await throwing.run(["projects", "list", "--json"]);
      expect(unprobed.exitCode).toBe(0);
      expect((unprobed.envelope as Envelope | undefined)?.error).toBeUndefined();
      expect(daemonOf(unprobed, throwing.projectKey)).toEqual({
        reachable: false,
        reason: "daemon-not-mounted",
      });
      expect(constructions).toBe(0);
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});

describe("TC-PROJ-018 and TC-PROJ-019 the mounted probe", () => {
  test("a bound socket is reachable, an absent socket is declared, and no write happens", async () => {
    const host = createHostFixture("daemon-mounted");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    let server: BoundServer | undefined;
    try {
      const checkout = createRepository(base, "mounted-repo");
      const probe = mountedProbe();
      const harness = createProductionProjectsHarness({
        label: "mounted",
        host,
        workingDirectory: checkout,
        originUrl: "https://github.com/owner/mounted.git",
        daemon: probe.composition,
      });
      harnesses.push(harness);
      await register(harness);
      await harness.run(["queue", "add", "GH-241", "--priority", "1", "--json"]);
      chmodSync(harness.stateLocation, 0o700);

      // Step 1: bind the delivered socket path and list.
      const settings = socketSettings(harness.stateLocation);
      server = await bindSocket(settings.socketPath);
      const reachable = await harness.run(["projects", "list", "--json"]);
      expect(reachable.exitCode).toBe(0);
      expect(daemonOf(reachable, harness.projectKey)).toEqual({ reachable: true });
      expect(server.connections()).toBe(1);
      expect(server.frames()).toBe(0);

      // Step 2: close the server and remove the socket file.
      await server.close();
      rmSync(settings.socketPath, { force: true });
      const absent = await harness.run(["projects", "list", "--json"]);
      expect(absent.exitCode).toBe(0);
      expect(daemonOf(absent, harness.projectKey)).toEqual({
        reachable: false,
        reason: "socket-absent",
      });

      // Step 3: remove the project's state root entirely; no probe is attempted.
      const probesBefore = probe.probes();
      removeDirectory(harness.stateLocation);
      const stateAbsent = await harness.run(["projects", "list", "--json"]);
      expect(stateAbsent.exitCode).toBe(0);
      expect(daemonOf(stateAbsent, harness.projectKey)).toEqual({
        reachable: false,
        reason: "state-absent",
      });
      expect(probe.probes()).toBe(probesBefore);
    } finally {
      if (server !== undefined) await server.close();
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });

  test("a stale socket file is socket-unreachable within the declared timeout", async () => {
    const host = createHostFixture("daemon-unreachable");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "stale-repo");
      const probe = mountedProbe();
      const harness = createProductionProjectsHarness({
        label: "stale",
        host,
        workingDirectory: checkout,
        originUrl: "https://github.com/owner/stale.git",
        daemon: probe.composition,
      });
      harnesses.push(harness);
      await register(harness);
      await harness.run(["queue", "add", "GH-241", "--priority", "1", "--json"]);
      chmodSync(harness.stateLocation, 0o700);

      const settings = socketSettings(harness.stateLocation);
      const bound = await bindSocket(settings.socketPath);
      await bound.close();
      // A stale path is either the left-behind socket node or a regular file;
      // both yield a refused connect deterministically.
      writeFileSync(settings.socketPath, "");

      const startedAt = Date.now();
      const run = await harness.run(["projects", "list", "--json"]);
      const elapsed = Date.now() - startedAt;
      expect(run.exitCode).toBe(0);
      expect(daemonOf(run, harness.projectKey)).toEqual({
        reachable: false,
        reason: "socket-unreachable",
      });
      expect(elapsed).toBeLessThanOrEqual(settings.responseTimeoutMs * 8);
      expect(probe.probes()).toBe(1);

      // The unit selector returns the same tokens for the same inputs.
      expect(selectDaemonReachability({ mount: { mounted: false } })).toEqual({
        reachable: false,
        reason: "daemon-not-mounted",
      });
      expect(
        selectDaemonReachability({ mount: { mounted: true }, probe: { stateRoot: "absent" } }),
      ).toEqual({ reachable: false, reason: "state-absent" });
      expect(
        selectDaemonReachability({
          mount: { mounted: true },
          probe: { stateRoot: "present", socket: "socket-absent" },
        }),
      ).toEqual({ reachable: false, reason: "socket-absent" });
      expect(
        selectDaemonReachability({
          mount: { mounted: true },
          probe: { stateRoot: "present", socket: "socket-unreachable" },
        }),
      ).toEqual({ reachable: false, reason: "socket-unreachable" });
      expect(
        selectDaemonReachability({
          mount: { mounted: true },
          probe: { stateRoot: "present", socket: "reachable" },
        }),
      ).toEqual({ reachable: true });
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});
