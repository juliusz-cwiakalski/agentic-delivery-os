/**
 * The single state-directory scope family (TC-DAEMON-050, 051, 052, 053, 054).
 *
 * The composition scope is the one state-scope policy: the host root
 * (`<PREFIX>_STATE_DIR` when absolute, otherwise `<home>/<brand.stateDirectoryName>`)
 * and the per-project root beneath it (GH-288 F-1). The daemon family consumes
 * the policy-derived project state root for its store, lock, settings, socket,
 * and supervisor scope, and the `<PREFIX>_STATE_DIR` binding it writes names the
 * host root, so a re-entered or installed process derives the same project root.
 *
 * The production composer is exercised through the composed program's handlers;
 * the observer detail a production fact cannot expose is proved by a directly
 * composed runtime over the same facts, and the two are compared character for
 * character. No case goes through `runEntrypoint`: the selection surface is
 * TC-DAEMON-015's at the Phase-6 gate.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveHostStateRoot } from "../../packages/core/src/app/state-scope";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { createDaemonCommandRuntime } from "../../packages/cli/src/daemon-compose";
import { createProductionComposer } from "../../packages/cli/src/production";
import { ERROR_TABLE } from "../../packages/core/src/contracts/index";
import { daemonScopeDigest } from "../../packages/core/src/domain/daemon-lock";
import {
  createMountHarness,
  createMountRoot,
  listDirectory,
  mountBrand,
  mountComposition,
  mountSettings,
  reentryEnvironmentFrom,
  removeMountRoot,
  stateDirectoryName,
} from "../fixtures/daemon/mount-harness";
import {
  forbiddenConstructions,
  refusingRuntimeSpan,
} from "../fixtures/daemon/mount-mutants/source-scan";

type FlagRecord = Record<string, string | boolean>;

const call = async (
  definition: ReturnType<typeof createDaemonCommandDefinition>,
  argv: readonly string[],
) => {
  const [subcommand, ...rest] = argv;
  const flags: FlagRecord = {};
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

const exitOf = (code: string): number => {
  const row = ERROR_TABLE.find((entry) => entry.code === code);
  if (row === undefined) throw new Error(`no delivered row for ${code}`);
  return row.projectionClass === "user-validation"
    ? 1
    : row.projectionClass === "platform-provider"
      ? 2
      : row.projectionClass === "attention"
        ? 1
        : 0;
};

const productionProgram = (options: {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly home: string;
  readonly cwd: string;
  readonly daemonEntry?: string;
  readonly brand?: ReturnType<typeof mountBrand>;
}) => {
  const brand = options.brand ?? mountBrand();
  const composer = createProductionComposer({
    environment: options.environment,
    cwd: options.cwd,
    homeDirectory: options.home,
    workingName: brand.binaryName,
    ...(options.daemonEntry === undefined ? {} : { daemonEntry: options.daemonEntry }),
  });
  return { brand, program: composer(brand) };
};

/**
 * The project state root the daemon reports: the directory holding the derived
 * socket path is the one scope its store, lock, settings, and supervisor use.
 */
const projectRootOf = (socketPath: string): string => dirname(socketPath);

describe("TC-DAEMON-050 one resolved directory", () => {
  test("an absolute override is the one scope for the store, lock, socket, and supervisor", async () => {
    const root = createMountRoot("scope-050");
    try {
      const home = join(root, "home");
      const override = join(root, "override-state");
      const brand = mountBrand();
      const { ensureDirectory } = await import("../fixtures/daemon/mount-harness");
      ensureDirectory(home);
      ensureDirectory(override);
      const environment = { HOME: home, PATH: "/usr/bin", [stateDirectoryName(brand)]: override };
      const { program } = productionProgram({ environment, home, cwd: root, brand });
      const definition = program.commands.daemon;
      if (definition === undefined) throw new Error("daemon is not registered");

      const started = await call(definition, ["start"]);
      expect(isFailure(started)).toBe(false);
      if (isFailure(started)) return;
      const receipt = started.data as {
        instance: { scope: string };
        socket: { path: string };
      };
      // The host root is the override; the project root is derived beneath it,
      // and the daemon's store, lock, socket, and supervisor scope are that one
      // project directory.
      const projectRoot = projectRootOf(receipt.socket.path);
      const digest = daemonScopeDigest(projectRoot);
      expect(projectRoot.startsWith(`${override}/projects/`)).toBe(true);
      expect(receipt.instance.scope).toBe(digest);
      expect(receipt.socket.path.startsWith(`${projectRoot}/`)).toBe(true);

      // The store landed under the project root and nowhere under the home
      // template or directly at the host root.
      expect(listDirectory(projectRoot)).toContain("ledger.default.jsonl");
      expect(listDirectory(override)).not.toContain("ledger.default.jsonl");
      expect(existsSync(`${home}/${brand.stateDirectoryName}`)).toBe(false);

      const status = await call(definition, ["status"]);
      expect(isFailure(status)).toBe(false);
      if (isFailure(status)) return;
      const data = status.data as {
        socket: { path: string };
        supervisor: { scope: string };
        instance: { scope: string } | null;
      };
      expect(data.socket.path).toBe(receipt.socket.path);
      expect(data.supervisor.scope).toBe(digest);
      expect(data.instance?.scope).toBe(digest);

      // The delivered resolvers over the same project directory agree exactly:
      // the settings socket path and the scope digest the composition reports.
      const delivered = mountSettings(projectRoot);
      expect(delivered.socketPath).toBe(receipt.socket.path);
      expect(daemonScopeDigest(projectRoot)).toBe(data.supervisor.scope);
    } finally {
      removeMountRoot(root);
    }
  });

  test("with no override every observer records the home template", async () => {
    const harness = createMountHarness({ label: "scope-050b" });
    try {
      const runtime = createDaemonCommandRuntime(mountComposition(harness));
      const definition = createDaemonCommandDefinition(runtime);
      const started = await call(definition, ["start"]);
      expect(isFailure(started)).toBe(false);
      if (isFailure(started)) return;
      const data = started.data as { instance: { scope: string }; socket: { path: string } };
      expect(data.instance.scope).toBe(daemonScopeDigest(harness.stateDirectory));
      expect(harness.stateDirectory).toBe(`${harness.home}/${harness.brand.stateDirectoryName}`);
      expect(data.socket.path).toBe(`${harness.stateDirectory}/daemon.sock`);
      expect(harness.settings.socketPath).toBe(data.socket.path);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-051 the child resolves the same directory", () => {
  test("the authoritative binding is last and a forwarded look-alike cannot displace it", async () => {
    const harness = createMountHarness({ label: "scope-051", override: "absolute" });
    try {
      const binding = stateDirectoryName(harness.brand);
      harness.processPort.setSpawn(9001);
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, {
          daemonEntry: `${harness.root}/bin/entry.ts`,
          reentryEnvironment: {
            ...reentryEnvironmentFrom(harness.environment),
            [binding]: "/forwarded/other",
          },
        }),
      );
      const definition = createDaemonCommandDefinition(runtime);
      await call(definition, ["start"]);
      const spawn = harness.processPort.spawns[0];
      const environment = spawn?.environment ?? {};
      const keys = Object.keys(environment);
      expect(keys[keys.length - 1]).toBe(binding);
      expect(keys.filter((key) => key === binding)).toHaveLength(1);
      expect(environment[binding]).toBe(harness.stateDirectory);

      // The child re-resolves the same host root from the authoritative binding.
      const childView = resolveHostStateRoot({
        environment,
        environmentPrefix: harness.brand.environmentPrefix,
        stateDirectoryName: harness.brand.stateDirectoryName,
      });
      expect(childView.ok && childView.value).toBe(harness.stateDirectory);

      // A forwarded look-alike merged before the binding cannot win.
      const merged = { ...{ [binding]: "/forwarded/other" }, ...environment };
      const mergedView = resolveHostStateRoot({
        environment: merged,
        environmentPrefix: harness.brand.environmentPrefix,
        stateDirectoryName: harness.brand.stateDirectoryName,
      });
      expect(mergedView.ok && mergedView.value).toBe(harness.stateDirectory);

      // The child's scope digest matches the parent's.
      const childScope = daemonScopeDigest(childView.ok ? childView.value : "");
      expect(childScope).toBe(daemonScopeDigest(harness.stateDirectory));
      // The child's settings-derived socket path matches the parent's.
      expect(mountSettings(harness.stateDirectory).socketPath).toBe(harness.settings.socketPath);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-052 the no-override default is byte-identical", () => {
  test("the resolved host root is the delivered home template", () => {
    const root = createMountRoot("scope-052");
    try {
      const brand = mountBrand();
      const resolved = resolveHostStateRoot({
        environment: {},
        environmentPrefix: brand.environmentPrefix,
        stateDirectoryName: brand.stateDirectoryName,
        homeDirectory: root,
      });
      expect(resolved.ok && resolved.value).toBe(`${root}/${brand.stateDirectoryName}`);

      const trailing = resolveHostStateRoot({
        environment: {},
        environmentPrefix: brand.environmentPrefix,
        stateDirectoryName: brand.stateDirectoryName,
        homeDirectory: `${root}/`,
      });
      expect(trailing.ok && trailing.value).toBe(`${root}/${brand.stateDirectoryName}`);
      expect((trailing.ok ? trailing.value : "").endsWith("/")).toBe(false);
    } finally {
      removeMountRoot(root);
    }
  });

  test("the production composition agrees with the delivered host-root resolution", async () => {
    const root = createMountRoot("scope-052b");
    try {
      const brand = mountBrand();
      const environment = { HOME: root, PATH: "/usr/bin" };
      const { program } = productionProgram({ environment, home: root, cwd: root, brand });
      const definition = program.commands.daemon;
      if (definition === undefined) throw new Error("daemon is not registered");
      const started = await call(definition, ["start"]);
      expect(isFailure(started)).toBe(false);
      const hostRoot = resolveHostStateRoot({
        environment,
        environmentPrefix: brand.environmentPrefix,
        stateDirectoryName: brand.stateDirectoryName,
        homeDirectory: root,
      });
      expect(hostRoot.ok && hostRoot.value).toBe(`${root}/${brand.stateDirectoryName}`);
      const receipt = started.data as { socket: { path: string } };
      const projectRoot = projectRootOf(receipt.socket.path);
      expect(projectRoot.startsWith(`${root}/${brand.stateDirectoryName}/projects/`)).toBe(true);
      expect(existsSync(`${projectRoot}/ledger.default.jsonl`)).toBe(true);
    } finally {
      removeMountRoot(root);
    }
  });
});

describe("TC-DAEMON-053 a non-absolute override keeps the command mounted", () => {
  test("the composition does not throw, the family stays mounted, and the edge reports invalid", async () => {
    const root = createMountRoot("scope-053");
    try {
      const home = join(root, "home");
      const brand = mountBrand();
      const environment = {
        HOME: home,
        PATH: "/usr/bin",
        [stateDirectoryName(brand)]: "relative/state",
      };
      const { program } = productionProgram({ environment, home, cwd: root, brand });
      const definition = program.commands.daemon;
      // The family stays registered in every outcome: a non-absolute override is
      // a classified refusal, never a missing prompt-required command.
      expect(definition).toBeDefined();
      if (definition === undefined) return;

      // The delivered resolution edge is unchanged: the invalid override is
      // reported with the variable name, and yields no store.
      const edge = resolveHostStateRoot({
        environment,
        environmentPrefix: brand.environmentPrefix,
        stateDirectoryName: brand.stateDirectoryName,
        homeDirectory: home,
      });
      expect(edge.ok).toBe(false);
      if (!edge.ok) {
        expect(edge.error.code).toBe("config.value.invalid");
        expect(edge.error.key).toBe(stateDirectoryName(brand));
      }

      // The mounted family answers the same classified identity as every other
      // command in that scope, and writes nothing anywhere.
      const started = await call(definition, ["start"]);
      expect(isFailure(started)).toBe(true);
      if (isFailure(started)) {
        expect(started.error.code).toBe("config.value.invalid");
        expect(exitOf(started.error.code)).toBe(1);
      }
      expect(existsSync(`${home}/${brand.stateDirectoryName}`)).toBe(false);
      expect(existsSync(join(root, "relative"))).toBe(false);
      expect(existsSync(join(process.cwd(), "relative"))).toBe(false);

      // A normal command still runs at a delivered exit digit.
      const status = await call(definition, ["status"]);
      expect(isFailure(status) ? exitOf(status.error.code) : 0).toBeOneOf([0, 1, 2]);
    } finally {
      removeMountRoot(root);
    }
  });
});

describe("TC-DAEMON-054 an unresolvable state directory keeps the family mounted", () => {
  const nine = [
    ["start"],
    ["start", "--foreground"],
    ["stop"],
    ["stop", "--mode", "drain"],
    ["stop", "--mode", "immediate"],
    ["status"],
    ["status", "--live"],
    ["install"],
    ["uninstall"],
  ] as const;

  test("all nine invocations refuse as config.value.invalid at exit 1 and open nothing", async () => {
    const brand = mountBrand();
    const root = createMountRoot("scope-054");
    // The fixture root is a real checkout, so "wrote nothing" is the fixture's
    // own baseline rather than an empty directory.
    const fixtureEntries = listDirectory(root);
    const rootLevel = `/${brand.stateDirectoryName}`;
    const existedBefore = existsSync(rootLevel);
    try {
      const { program } = productionProgram({
        environment: {},
        home: "",
        cwd: root,
        brand,
      });
      const definition = program.commands.daemon;
      expect(definition).toBeDefined();
      if (definition === undefined) return;

      // Every other prompt-required command is still registered in the program.
      const { PROMPT_REQUIRED_COMMANDS } = await import(
        "../../packages/cli/src/help/prompt-required-commands"
      );
      for (const name of PROMPT_REQUIRED_COMMANDS) {
        expect(program.commands[name]).toBeDefined();
      }

      for (const argv of nine) {
        const result = await call(definition, argv);
        expect(isFailure(result)).toBe(true);
        if (!isFailure(result)) continue;
        expect(result.error.code).toBe("config.value.invalid");
        expect(exitOf(result.error.code)).toBe(1);
        expect("data" in (result as object)).toBe(false);
      }

      // The refusal is the state-directory identity, never a daemon row.
      const status = await call(definition, ["status"]);
      expect(isFailure(status) && status.error.code.startsWith("daemon.")).toBe(false);

      // The source boundary composes none of the runtime's inputs.
      const source = readFileSync(join(process.cwd(), "packages/cli/src/production.ts"), "utf8");
      const span = refusingRuntimeSpan(source);
      expect(span).toBeDefined();
      expect(forbiddenConstructions(span as string)).toEqual([]);

      // An unresolvable host root is one classified refusal for every
      // prompt-required command, so no family silently derives a root-level
      // path while the daemon family refuses (GH-288 F-1, AC-F1-3).
      const companion = program.commands.status;
      expect(companion).toBeDefined();
      if (companion !== undefined) {
        const companionOutcome = await companion.handler({
          positionals: [],
          flags: {},
          global: {},
        } as never);
        expect(isFailure(companionOutcome)).toBe(true);
        if (isFailure(companionOutcome)) {
          expect(companionOutcome.error.code).toBe("config.value.invalid");
        }
      }

      // Filesystem and socket absence.
      expect(existsSync(rootLevel)).toBe(existedBefore);
      expect(existsSync(`${rootLevel}/daemon.sock`)).toBe(false);
      expect(listDirectory(root)).toEqual(fixtureEntries);
    } finally {
      removeMountRoot(root);
    }
  });

  test("the control composition reaches five handlers over the project state root", async () => {
    const root = createMountRoot("scope-054b");
    try {
      const home = join(root, "home");
      const brand = mountBrand();
      const environment = { HOME: home, PATH: "/usr/bin" };
      const { program } = productionProgram({
        environment,
        home,
        cwd: root,
        brand,
      });
      const definition = program.commands.daemon;
      if (definition === undefined) throw new Error("daemon is not registered");
      for (const argv of [["status"], ["status", "--live"], ["stop"], ["install"], ["uninstall"]]) {
        const result = await call(definition, argv as readonly string[]);
        const code = isFailure(result) ? result.error.code : undefined;
        expect(code).not.toBe("config.value.invalid");
      }
      // A non-daemon command still resolves the same host root from the policy.
      const status = program.commands.status;
      expect(status).toBeDefined();
      if (status !== undefined) {
        await status.handler({ positionals: [], flags: {}, global: {} } as never);
      }
      const edge = resolveHostStateRoot({
        environment,
        environmentPrefix: brand.environmentPrefix,
        stateDirectoryName: brand.stateDirectoryName,
        homeDirectory: home,
      });
      expect(edge.ok && edge.value).toBe(`${home}/${brand.stateDirectoryName}`);
    } finally {
      removeMountRoot(root);
    }
  });
});
