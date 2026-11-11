/**
 * The GH-286 daemon-mount composition harness.
 *
 * Every hermetic seam the mount suites need is built here over one temp root: a
 * deterministic clock whose `sleep` advances time, a recording process port
 * (spawn requests, signals, liveness probes), a recording supervisor port, the
 * delivered daemon lock and state store, and the resolved daemon settings. No
 * case writes outside its temp root and no case opens a real socket or spawns a
 * real child unless it declares itself the one integration witness.
 */
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DaemonComposition } from "../../../packages/cli/src/daemon-compose";
import { resolveDaemonSettings } from "../../../packages/core/src/config/index";
import type { BrandIdentity } from "../../../packages/core/src/contracts/index";
import {
  type DaemonClockPort,
  type DaemonLockPort,
  type DaemonProcessPort,
  type DaemonSettings,
  type DaemonSupervisorDescriptor,
  STATE_SCHEMA_VERSION,
  type StateStorePort,
  type SupervisorInspection,
  type SupervisorInstallOutcome,
  type SupervisorInstallRequest,
  type SupervisorPort,
} from "../../../packages/core/src/contracts/index";
import {
  createDaemonLockPort,
  createNodeStateEdge,
  createStateStore,
} from "../../../packages/core/src/state/index";
import { SYNTHETIC_BRAND } from "../../golden/helpers";

export type MountClock = DaemonClockPort & {
  /** Advance the injected now without recording a sleep. */
  readonly advance: (ms: number) => void;
  /** Every recorded sleep interval, in call order. */
  readonly sleeps: () => readonly number[];
};

/**
 * A counting clock whose `sleep` resolves immediately and advances the injected
 * now, so a readiness poll is observable without wall-clock time.
 */
export const createMountClock = (
  options: { readonly startIso?: string; readonly sleepAdvances?: boolean } = {},
): MountClock => {
  let now = Date.parse(options.startIso ?? "2026-11-11T10:00:00Z");
  const sleeps: number[] = [];
  return {
    nowMs: () => now,
    nowIso: () => new Date(now).toISOString(),
    sleep: async (ms: number) => {
      sleeps.push(ms);
      if (options.sleepAdvances === true) now += ms;
    },
    advance: (ms: number) => {
      now += ms;
    },
    sleeps: () => [...sleeps],
  };
};

export type RecordedSpawn = {
  readonly entry: string;
  readonly args: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
};

export type RecordedSignal = { readonly pid: number; readonly signal: string };

export type MountProcessPort = DaemonProcessPort & {
  readonly spawns: RecordedSpawn[];
  readonly signals: RecordedSignal[];
  readonly aliveChecks: number[];
  /** The pid the fake child returns; `undefined` is a classified spawn failure. */
  readonly setSpawn: (pid: number | undefined) => void;
  /** The fake child's side effect at spawn time (it writes durable state). */
  readonly onSpawn: (hook: ((request: RecordedSpawn) => void) | undefined) => void;
  readonly setSignalResult: (ok: boolean, detail?: string) => void;
};

/** A recording process port: no real process is ever created. */
export const createRecordingProcessPort = (
  options: { readonly pid?: number; readonly spawn?: boolean } = {},
): MountProcessPort => {
  let spawnPid: number | undefined = options.spawn === false ? undefined : (options.pid ?? 4321);
  let hook: ((request: RecordedSpawn) => void) | undefined;
  let signalResult: { readonly ok: boolean; readonly detail?: string } = { ok: true };
  const spawns: RecordedSpawn[] = [];
  const signals: RecordedSignal[] = [];
  const aliveChecks: number[] = [];
  return {
    spawnDetached: (request) => {
      spawns.push(request);
      const recorded: RecordedSpawn = {
        entry: request.entry,
        args: [...request.args],
        environment: { ...request.environment },
      };
      hook?.(recorded);
      return spawnPid === undefined ? { code: "daemon.state-recovery-failed" } : { pid: spawnPid };
    },
    signal: (pid, signal) => {
      signals.push({ pid, signal });
      return signalResult;
    },
    isAlive: (pid) => {
      aliveChecks.push(pid);
      return false;
    },
    spawns,
    signals,
    aliveChecks,
    setSpawn: (pid) => {
      spawnPid = pid;
    },
    onSpawn: (next) => {
      hook = next;
    },
    setSignalResult: (ok, detail) => {
      signalResult = detail === undefined ? { ok } : { ok, detail };
    },
  };
};

export type RecordingSupervisor = {
  readonly port: SupervisorPort;
  readonly counters: {
    readonly writes: number;
    readonly enables: number;
    readonly lingers: number;
    readonly inspects: number;
    readonly uninstalls: number;
  };
  readonly installed: () => boolean;
};

/**
 * A recording supervisor fact. It records every call and never touches the host:
 * `install` reports the requested descriptor without writing a unit.
 */
export const createRecordingSupervisor = (
  options: { readonly installed?: boolean; readonly supported?: boolean } = {},
): RecordingSupervisor => {
  let installed = options.installed ?? false;
  const counters = { writes: 0, enables: 0, lingers: 0, inspects: 0, uninstalls: 0 };
  const supported = options.supported ?? true;
  const descriptor = (): DaemonSupervisorDescriptor => ({
    kind: "systemd-user",
    installed,
    unit: "example-product-daemon.service",
    scope: "recorded-scope",
    linger: installed,
    commandForm: "foreground",
    serviceType: "simple",
    restartPolicy: "on-failure",
  });
  const port: SupervisorPort = {
    kind: "systemd-user",
    platform: "linux",
    inspect: (): SupervisorInspection => {
      counters.inspects += 1;
      return supported
        ? { supported: true, descriptor: descriptor() }
        : { supported: false, kind: "systemd-user", platform: "linux" };
    },
    install: (_request: SupervisorInstallRequest): SupervisorInstallOutcome => {
      counters.writes += 1;
      if (!supported) {
        return {
          ok: false,
          code: "daemon.supervisor-unsupported",
          platform: "linux",
          detail: "no systemd-user adapter",
        };
      }
      counters.enables += 1;
      counters.lingers += 1;
      installed = true;
      return { ok: true, descriptor: descriptor() };
    },
    uninstall: () => {
      counters.uninstalls += 1;
      const removed = installed;
      installed = false;
      return { removed };
    },
  };
  return { port, counters, installed: () => installed };
};

/** A random suffix so two fixtures in one run never share a state-directory name. */
export const mountSuffix = (): string => globalThis.crypto.randomUUID().slice(0, 8);

/**
 * The synthetic brand with a state-directory name unique to this fixture, so a
 * root-level `/<stateDirectoryName>` candidate can never collide with an
 * existing path (TC-DAEMON-041/054).
 */
export const mountBrand = (suffix: string = mountSuffix()): BrandIdentity => ({
  ...SYNTHETIC_BRAND,
  stateDirectoryName: `.example-product-state-${suffix}`,
});

/** The exact `<PREFIX>_STATE_DIR` name the delivered resolution reads. */
export const stateDirectoryName = (brand: BrandIdentity): string =>
  `${brand.environmentPrefix.toUpperCase().replace(/_+$/u, "")}_STATE_DIR`;

/** Create a private temp root for one fixture. */
export const createMountRoot = (label = "gh286"): string => {
  const root = mkdtempSync(join(tmpdir(), `gh286-${label}-`));
  chmodSync(root, 0o700);
  return root;
};

export const removeMountRoot = (root: string): void =>
  rmSync(root, { recursive: true, force: true });

/** A listed directory's entries; a missing directory lists as empty. */
export const listDirectory = (path: string): readonly string[] =>
  existsSync(path) ? readdirSync(path).sort() : [];

export const ensureDirectory = (path: string): void => {
  mkdirSync(path, { recursive: true, mode: 0o700 });
};

/** Resolve the delivered default daemon settings for one directory. */
export const mountSettings = (
  directory: string,
  values: Record<string, unknown> = {},
): DaemonSettings => {
  const resolved = resolveDaemonSettings(
    values as Parameters<typeof resolveDaemonSettings>[0],
    {},
    { stateDirectory: directory },
  );
  if (!resolved.ok) throw new Error(`daemon settings did not resolve: ${resolved.error.code}`);
  return resolved.value;
};

export type MountHarness = {
  readonly root: string;
  readonly home: string;
  readonly stateDirectory: string;
  readonly brand: BrandIdentity;
  readonly environment: Record<string, string | undefined>;
  readonly clock: MountClock;
  readonly processPort: MountProcessPort;
  readonly store: StateStorePort;
  readonly lock: DaemonLockPort;
  readonly settings: DaemonSettings;
  readonly dispose: () => void;
};

export type MountHarnessOptions = {
  readonly label?: string;
  readonly override?: "none" | "absolute" | "relative";
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly values?: Record<string, unknown>;
};

/**
 * Build one hermetic mount fixture: a private root, a home inside it, the
 * resolved store and daemon lock, a deterministic clock, a recording process
 * port, and the injected environment record.
 */ export const createMountHarness = (
  options: {
    readonly label?: string;
    readonly override?: "none" | "absolute" | "relative";
    readonly environment?: Readonly<Record<string, string | undefined>>;
    readonly values?: Record<string, unknown>;
  } = {},
): MountHarness => {
  const root = createMountRoot(options.label ?? "mount");
  const home = join(root, "home");
  ensureDirectory(home);
  const brand = mountBrand();
  const override = options.override ?? "none";
  const overrideDirectory = join(root, "override-state");
  const environment: Record<string, string | undefined> = {
    PATH: "/usr/local/bin:/usr/bin:/bin",
    HOME: home,
    ...options.environment,
  };
  if (override === "absolute") {
    ensureDirectory(overrideDirectory);
    environment[stateDirectoryName(brand)] = overrideDirectory;
  } else if (override === "relative") {
    environment[stateDirectoryName(brand)] = "relative/state";
  }
  const stateDirectory =
    override === "absolute" ? overrideDirectory : `${home}/${brand.stateDirectoryName}`;
  const store = createStateStore(
    {
      level: "local",
      workspaceId: "default",
      fenceNamespace: "cli",
      schemaVersion: STATE_SCHEMA_VERSION,
      stateDirectory,
    },
    { driver: "jsonl", edge: createNodeStateEdge() },
  );
  const lock = createDaemonLockPort(createNodeStateEdge(), stateDirectory);
  const clock = createMountClock({ sleepAdvances: true });
  const processPort = createRecordingProcessPort();
  let disposed = false;
  return {
    root,
    home,
    stateDirectory,
    brand,
    environment,
    clock,
    processPort,
    store,
    lock,
    settings: mountSettings(stateDirectory, options.values ?? {}),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      removeMountRoot(root);
    },
  };
};

/**
 * A composed daemon command runtime over the harness seams. Every seam the
 * composition accepts is injected: the clock, the process port, the store, the
 * lock, and the resolved settings. Nothing reads the ambient process.
 */
export const mountComposition = (
  harness: MountHarness,
  overrides: Record<string, unknown> = {},
): DaemonComposition => {
  let ordinal = 0;
  const next = (prefix: string): string => {
    ordinal += 1;
    return `${prefix}-${ordinal}`;
  };
  return {
    store: harness.store,
    lock: harness.lock,
    settings: harness.settings,
    restartBound: 3,
    stateDirectory: harness.stateDirectory,
    unit: `${harness.brand.binaryName}-daemon.service`,
    binary: `${harness.root}/bin/${harness.brand.binaryName}`,
    environmentName: stateDirectoryName(harness.brand),
    clock: harness.clock,
    processPort: harness.processPort,
    newFenceToken: () => next("fence"),
    newLockToken: () => next("lock"),
    newInstanceId: () => next("instance"),
    nowIso: () => harness.clock.nowIso(),
    ...overrides,
  } as DaemonComposition;
};

/**
 * The re-entry variables the production composer derives from its own injected
 * facts: the composing `PATH`, its home under the name it was read from, and the
 * working-name override only when set and non-empty. No value is invented.
 */
export const reentryEnvironmentFrom = (
  environment: Readonly<Record<string, string | undefined>>,
): Record<string, string> => {
  const path = environment.PATH;
  const homeVariable =
    environment.HOME !== undefined && environment.HOME.length > 0
      ? "HOME"
      : environment.USERPROFILE !== undefined && environment.USERPROFILE.length > 0
        ? "USERPROFILE"
        : undefined;
  const workingName = environment.DELIVERY_OS_WORKING_NAME;
  return {
    ...(path === undefined ? {} : { PATH: path }),
    ...(homeVariable === undefined ? {} : { [homeVariable]: environment[homeVariable] as string }),
    ...(workingName === undefined || workingName.length === 0
      ? {}
      : { DELIVERY_OS_WORKING_NAME: workingName }),
  };
};

/** A fresh store handle over an existing state directory (a new process). */
export const openMountStore = (stateDirectory: string): StateStorePort =>
  createStateStore(
    {
      level: "local",
      workspaceId: "default",
      fenceNamespace: "cli",
      schemaVersion: STATE_SCHEMA_VERSION,
      stateDirectory,
    },
    { driver: "jsonl", edge: createNodeStateEdge() },
  );
