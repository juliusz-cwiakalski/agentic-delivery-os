/**
 * TC-DAEMON-010, 014, 015 — the mount is prompt-required, the production
 * composer registers it unconditionally, and selection completes through the
 * entrypoint without opening state.
 *
 * TC-DAEMON-015 is the only case in the change that asserts the selection
 * surface: `runEntrypoint` is invoked here and nowhere earlier, and it
 * supersedes the selection half the handler-level gates deliberately omit.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  PROMPT_REQUIRED_COMMANDS,
  runEntrypoint,
  selectPromptRequiredProgram,
} from "../../packages/cli/src/entrypoint";
import { createProductionComposer } from "../../packages/cli/src/production";
import type { CommandProgram } from "../../packages/cli/src/index";
import {
  createMountHarness,
  createRecordingSupervisor,
  openMountStore,
} from "../fixtures/daemon/mount-harness";
import { appendHeartbeat, appendInstance, scopeOf } from "../fixtures/daemon/mount-states";
import * as conditionalRegistration from "../fixtures/daemon/mount-mutants/conditional-registration";
import { bufferSink } from "../golden/helpers";

const invoke = async (options: {
  readonly argv: readonly string[];
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly home: string;
  readonly cwd: string;
  readonly compose?: (brand: never) => CommandProgram;
}) => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const composer = createProductionComposer({
    environment: options.environment,
    cwd: options.cwd,
    homeDirectory: options.home,
    workingName: "example-product",
    processId: 4242,
    signalHost: { once: () => undefined, removeListener: () => undefined },
    daemonEntry: "/abs/example-product",
  });
  let calls = 0;
  const composeProgram =
    options.compose ??
    ((brand: never) => {
      calls += 1;
      return composer(brand);
    });
  const exitCode = await runEntrypoint(options.argv, {
    streams: { stdout, stderr },
    environment: options.environment,
    configuredWorkingName: "example-product",
    composeProgram: composeProgram as never,
    clock: { now: () => 1 },
    newRunId: () => "run-daemon-mount",
  });
  return { exitCode, stdout: stdout.value, stderr: stderr.value, composerCalls: calls };
};

describe("TC-DAEMON-010 the family is prompt-required and composed unconditionally", () => {
  test("daemon is a member exactly once and the set grew by one", () => {
    expect(PROMPT_REQUIRED_COMMANDS.filter((command) => command === "daemon")).toHaveLength(1);
    expect([...PROMPT_REQUIRED_COMMANDS]).toHaveLength(17);
  });

  test("the composed program registers the declared grammar unchanged", () => {
    const harness = createMountHarness({ label: "prod-010" });
    try {
      const program = createProductionComposer({
        environment: { HOME: harness.home, PATH: "/usr/bin" },
        cwd: harness.root,
        homeDirectory: harness.home,
        workingName: harness.brand.binaryName,
      })(harness.brand);
      const daemon = program.commands.daemon;
      expect(daemon).toBeDefined();
      expect(daemon?.flags).toEqual(["--foreground", "--live", "--mode"]);
      expect(daemon?.requiresValue).toEqual(["--mode"]);
    } finally {
      harness.dispose();
    }
  });

  test("selection completes without the containment throw", () => {
    const harness = createMountHarness({ label: "prod-010b" });
    try {
      const program = createProductionComposer({
        environment: { HOME: harness.home, PATH: "/usr/bin" },
        cwd: harness.root,
        homeDirectory: harness.home,
        workingName: harness.brand.binaryName,
      })(harness.brand);
      const selected = selectPromptRequiredProgram(program);
      expect(Object.keys(selected.commands).sort()).toEqual([...PROMPT_REQUIRED_COMMANDS].sort());
      expect(Object.keys(selected.commands).filter((name) => name === "daemon")).toHaveLength(1);
    } finally {
      harness.dispose();
    }
  });

  test("a case-local mutation omitting daemon from the declarative set names it", async () => {
    const source = await Bun.file(
      join(process.cwd(), "packages/cli/src/help/prompt-required-commands.ts"),
    ).text();
    const directory = join(process.cwd(), "tmp", "tmpdir", "mutants", "omit-daemon");
    mkdirSync(directory, { recursive: true });
    const file = join(directory, "prompt-required-commands.ts");
    writeFileSync(file, source.replace('  "daemon",\n', ""));
    const mutated = (await import(`${file}?mutant=${Date.now()}`)) as {
      PROMPT_REQUIRED_COMMANDS: readonly string[];
    };
    expect(mutated.PROMPT_REQUIRED_COMMANDS).not.toContain("daemon");
    expect(mutated.PROMPT_REQUIRED_COMMANDS).toHaveLength(16);
  });
});

describe("TC-DAEMON-014 a composition with every optional input absent", () => {
  test("registers and selects the family with no entry path, supervisor, or signal host", () => {
    const harness = createMountHarness({ label: "prod-014" });
    try {
      const program = createProductionComposer({
        environment: { HOME: harness.home, PATH: "/usr/bin" },
        cwd: harness.root,
        homeDirectory: harness.home,
        workingName: harness.brand.binaryName,
      })(harness.brand);
      expect(program.commands.daemon).toBeDefined();
      const selected = selectPromptRequiredProgram(program);
      expect(selected.commands.daemon).toBeDefined();
      expect([...PROMPT_REQUIRED_COMMANDS]).toHaveLength(17);
    } finally {
      harness.dispose();
    }
  });

  test("three fact sets compose the same registered family", () => {
    const harness = createMountHarness({ label: "prod-014b" });
    try {
      const supervisor = createRecordingSupervisor();
      const factSets: readonly Record<string, unknown>[] = [
        {
          environment: { HOME: harness.home, PATH: "/usr/bin" },
          daemonEntry: "/abs/entry",
          supervisor: supervisor.port,
          processId: 4242,
          signalHost: { once: () => undefined, removeListener: () => undefined },
        },
        { environment: { HOME: harness.home, PATH: "/usr/bin" }, daemonEntry: "/abs/entry" },
        { environment: { HOME: harness.home, PATH: "/usr/bin" } },
      ];
      for (const facts of factSets) {
        const program = createProductionComposer({
          cwd: harness.root,
          homeDirectory: harness.home,
          workingName: harness.brand.binaryName,
          ...(facts as object),
        } as never)(harness.brand);
        expect(program.commands.daemon?.flags).toEqual(["--foreground", "--live", "--mode"]);
      }
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-015 selection and containment through the entrypoint", () => {
  test("`daemon status` is never the containment identity", async () => {
    const harness = createMountHarness({ label: "prod-015a" });
    try {
      const run = await invoke({
        argv: ["--json", "daemon", "status"],
        environment: { HOME: harness.home, PATH: "/usr/bin" },
        home: harness.home,
        cwd: harness.root,
      });
      expect([0, 1, 2]).toContain(run.exitCode);
      const envelope = JSON.parse(run.stdout) as {
        data?: unknown;
        error?: { code?: string; category?: string; summary?: string };
      };
      expect(envelope.error?.code).not.toBe("fallback.internal");
      expect(envelope.error?.category).not.toBe("platform");
      expect(envelope.error?.summary ?? "").not.toContain("not part of the composed");
      const daemonEnvelope =
        envelope.data !== undefined ||
        (envelope.error?.code ?? "").startsWith("daemon.") ||
        envelope.error?.code === "config.value.invalid";
      expect(daemonEnvelope).toBe(true);
      expect(run.stderr).not.toContain("unknown flag");
      expect(run.stderr).not.toContain("unknown argument");
    } finally {
      harness.dispose();
    }
  });

  test("the nine unresolvable-outcome invocations refuse as config.value.invalid at exit 1", async () => {
    const root = join(process.cwd(), "tmp", `gh286-015-${Date.now()}`);
    mkdirSync(root, { recursive: true });
    const invocations = [
      ["daemon", "start"],
      ["daemon", "start", "--foreground"],
      ["daemon", "stop"],
      ["daemon", "stop", "--mode", "drain"],
      ["daemon", "stop", "--mode", "immediate"],
      ["daemon", "status"],
      ["daemon", "status", "--live"],
      ["daemon", "install"],
      ["daemon", "uninstall"],
    ] as const;
    try {
      for (const argv of invocations) {
        const run = await invoke({
          argv: ["--json", ...argv],
          environment: {},
          home: "",
          cwd: root,
        });
        expect(run.exitCode).toBe(1);
        const envelope = JSON.parse(run.stdout) as {
          data?: unknown;
          error?: { code?: string; category?: string };
        };
        expect(envelope.data).toBeUndefined();
        expect(envelope.error?.code).toBe("config.value.invalid");
        expect(envelope.error?.category).toBe("user");
      }
    } finally {
      const { rmSync } = await import("node:fs");
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("help and version stay pure through the entrypoint", async () => {
    const harness = createMountHarness({ label: "prod-015b" });
    try {
      const purityComposer = (): CommandProgram => {
        throw new Error("the daemon composition must not be invoked for help or version");
      };
      const invocations = [
        ["--help"],
        ["daemon", "--help"],
        ["daemon", "start", "--help"],
        ["daemon", "stop", "--help"],
        ["daemon", "status", "--help"],
        ["daemon", "install", "--help"],
        ["daemon", "uninstall", "--help"],
        ["--version"],
      ] as const;
      for (const argv of invocations) {
        const run = await invoke({
          argv,
          environment: { HOME: harness.home },
          home: harness.home,
          cwd: harness.root,
          compose: purityComposer,
        });
        expect(run.exitCode).toBe(0);
        expect(run.stdout.length).toBeGreaterThan(0);
      }
      // Nothing was created by any of the pure invocations.
      expect(existsSync(`${harness.home}/${harness.brand.stateDirectoryName}`)).toBe(false);
    } finally {
      harness.dispose();
    }
  });

  test("the control: a non-daemon prompt-required command still resolves", async () => {
    const harness = createMountHarness({ label: "prod-015c" });
    try {
      const run = await invoke({
        argv: ["--json", "status"],
        environment: { HOME: harness.home },
        home: harness.home,
        cwd: harness.root,
      });
      // A delivered prompt-required command still resolves, so the equality in
      // step 1 is the delivered 17-family set and not a daemon-only set.
      expect(run.exitCode).toBe(0);
      const envelope = JSON.parse(run.stdout) as { data?: unknown; error?: unknown };
      expect(envelope.error).toBeUndefined();
      expect(envelope.data).toBeDefined();
    } finally {
      harness.dispose();
    }
  });

  test("the conditional-registration mutant is caught by the composition claim", () => {
    const text = readFileSync(join(process.cwd(), "packages/cli/src/production.ts"), "utf8");
    expect(conditionalRegistration.violates(text)).toBe(false);
    const mutated = conditionalRegistration.apply(text);
    expect(conditionalRegistration.violates(mutated)).toBe(true);
  });
});

describe("TC-DAEMON-063/070 the production configuration-acquisition path", () => {
  const writeUserConfig = (
    harness: ReturnType<typeof createMountHarness>,
    body: string,
  ): string => {
    const directory = join(harness.home, ".config", harness.brand.configDirectoryName);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "config.yaml"), body);
    return directory;
  };

  const compose = (harness: ReturnType<typeof createMountHarness>) =>
    createProductionComposer({
      environment: {
        HOME: harness.home,
        PATH: "/usr/bin",
        [`${harness.brand.environmentPrefix.toUpperCase().replace(/_+$/u, "")}_STATE_DIR`]:
          harness.stateDirectory,
      },
      cwd: harness.root,
      homeDirectory: harness.home,
      workingName: harness.brand.binaryName,
      daemonEntry: `${harness.root}/bin/${harness.brand.binaryName}`,
    })(harness.brand);

  const queueDegraded = async (program: ReturnType<typeof compose>) => {
    const result = await program.commands.queue?.handler({
      positionals: ["list"],
      flags: {},
      global: {},
    } as never);
    if (result === undefined || "error" in result) throw new Error("queue list did not answer");
    return (result.data as { readonly degraded: readonly string[] }).degraded;
  };

  test("(a) a configured socket path, heartbeat interval, and lock staleness reach the runtime", async () => {
    const harness = createMountHarness({ label: "prod-config-a" });
    try {
      const configuredSocket = `${harness.stateDirectory}/configured.sock`;
      writeUserConfig(
        harness,
        [
          "daemon:",
          `  socket-path: ${configuredSocket}`,
          "  heartbeat-interval: 1234",
          "  lock-staleness: 60000",
          "",
        ].join("\n"),
      );
      // A 40 s old beat is inside the configured bound and outside the default.
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      appendHeartbeat(harness.store, {
        instanceId: "instance-live",
        beatAt: new Date(Date.now() - 40_000).toISOString(),
      });
      const program = compose(harness);
      const status = await program.commands.daemon?.handler({
        positionals: ["status"],
        flags: {},
        global: {},
      } as never);
      expect(status !== undefined && "data" in status).toBe(true);
      if (status !== undefined && "data" in status) {
        const data = status.data as {
          socket: { path: string };
          heartbeat: { intervalMs: number };
        };
        expect(data.socket.path).toBe(configuredSocket);
        expect(data.heartbeat.intervalMs).toBe(1234);
      }
      // The configured staleness reaches the queue projection: the same 40 s
      // beat would be `daemon-unreachable` under the shipped 30 s default.
      expect(await queueDegraded(program)).toEqual([]);
    } finally {
      harness.dispose();
    }
  });

  test("(b) an absent configuration resolves the shipped defaults, never a re-derived literal", async () => {
    const harness = createMountHarness({ label: "prod-config-b" });
    try {
      const program = compose(harness);
      const status = await program.commands.daemon?.handler({
        positionals: ["status"],
        flags: {},
        global: {},
      } as never);
      expect(status !== undefined && "data" in status).toBe(true);
      if (status !== undefined && "data" in status) {
        const data = status.data as {
          socket: { path: string };
          heartbeat: { intervalMs: number };
        };
        expect(data.socket.path).toBe(`${harness.stateDirectory}/daemon.sock`);
        expect(data.heartbeat.intervalMs).toBe(5_000);
      }
      const source = readFileSync(join(process.cwd(), "packages/cli/src/production.ts"), "utf8");
      expect(source).toContain("resolveDaemonSettings");
      expect(source).not.toContain("daemon.sock");
      expect(source).not.toContain("5_000");
    } finally {
      harness.dispose();
    }
  });

  test("(c) an acquired invalid daemon branch composes the refusing runtime while queue and lanes degrade", async () => {
    const harness = createMountHarness({ label: "prod-config-c" });
    try {
      writeUserConfig(harness, ["daemon:", "  heartbeat-interval: 1.5", ""].join("\n"));
      const program = compose(harness);
      for (const invocation of [
        { positionals: ["start"], flags: {} },
        { positionals: ["start"], flags: { "--foreground": true } },
        { positionals: ["stop"], flags: {} },
        { positionals: ["status"], flags: {} },
        { positionals: ["install"], flags: {} },
        { positionals: ["uninstall"], flags: {} },
      ] as const) {
        const result = await program.commands.daemon?.handler({
          positionals: [...invocation.positionals],
          flags: { ...invocation.flags },
          global: {},
        } as never);
        expect(result !== undefined && "error" in result).toBe(true);
        if (result !== undefined && "error" in result) {
          expect(result.error.code).toBe("config.value.invalid");
          expect(result.error.kind).toBe("config");
        }
      }
      // No lock, transport, socket, entry path, or supervisor scope is composed.
      expect(existsSync(`${harness.stateDirectory}/daemon.sock`)).toBe(false);
      expect(existsSync(`${harness.stateDirectory}/daemon.lock`)).toBe(false);
      // In that same cell the read side keeps reporting `daemon-unreachable`.
      expect(await queueDegraded(program)).toEqual(["daemon-unreachable"]);
      const lanes = await program.commands.lanes?.handler({
        positionals: ["list"],
        flags: {},
        global: {},
      } as never);
      expect(lanes !== undefined && "data" in lanes).toBe(true);
      if (lanes !== undefined && "data" in lanes) {
        expect((lanes.data as { degraded: readonly string[] }).degraded).toEqual([
          "daemon-unreachable",
        ]);
      }
    } finally {
      harness.dispose();
    }
  });
});
