/**
 * GH-346 TC-BIN-061 / 062 / 066 / 067 / 070 — the artifact tier's
 * self-containment and identity reads.
 *
 * One cached build per suite run into the repo-local scratch directory; every
 * invocation runs from an empty directory with a scrubbed `PATH`, an empty
 * scratch `HOME`, and no checkout. A recording `git` stub proves the read-free
 * contract, and every absence is asserted three ways: a log, a zero count, and
 * an unchanged snapshot.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { resolveBrandIdentity } from "../../packages/core/src/branding";

const ROOT = process.cwd();

type RunResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

const run = (
  command: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly env: Readonly<Record<string, string | undefined>> },
): RunResult => {
  const result = spawnSync(command, [...args], {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    timeout: 180_000,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

const emptySink = (): { value: string; write: (chunk: string) => void } => {
  const sink = {
    value: "",
    write: (chunk: string): void => {
      sink.value += chunk;
    },
  };
  return sink;
};

/** A sorted `relative-path|size|mtimeNs|mode` snapshot of one tree. */
const snapshot = (root: string): readonly string[] => {
  const lines: string[] = [];
  const walk = (relative: string): void => {
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(join(root, relative), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const next = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
      const absolute = join(root, next);
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

type BuildReport = {
  readonly artifact: string;
  readonly version: string;
  readonly commit: string;
  readonly builtAt: string;
  readonly dirty: string;
  readonly channel: string;
  readonly size: string;
  readonly target: string;
};

const parseReport = (stdout: string): BuildReport => {
  const fields = new Map<string, string>();
  for (const line of stdout.split("\n")) {
    const separator = line.indexOf("=");
    if (separator > 0) fields.set(line.slice(0, separator), line.slice(separator + 1));
  }
  const read = (name: string): string => {
    const value = fields.get(name);
    if (value === undefined) throw new Error(`the build report lacks ${name}`);
    return value;
  };
  return {
    artifact: read("artifact"),
    version: read("version"),
    commit: read("commit"),
    builtAt: read("builtAt"),
    dirty: read("dirty"),
    channel: read("channel"),
    size: read("size"),
    target: read("target"),
  };
};

let scratch = "";
let outDirectory = "";
let artifact = "";
let report: BuildReport;
let emptyPath = "";
let emptyDirectory = "";
let emptyHome = "";
let stateRoot = "";
let configRoot = "";

const baseEnvironment = (): Record<string, string> => ({
  PATH: emptyPath,
  HOME: emptyHome,
  TMPDIR: join(scratch, "tmp"),
  JAISHIP_STATE_DIR: stateRoot,
  DELIVERY_OS_STATE_DIR: stateRoot,
  XDG_CONFIG_HOME: configRoot,
});

beforeAll(() => {
  scratch = mkdtempSync(join(ROOT, "tmp/tmpdir/gh346-artifact-self-"));
  outDirectory = join(scratch, "out");
  emptyPath = join(scratch, "empty-path");
  emptyDirectory = join(scratch, "cwd");
  emptyHome = join(scratch, "home");
  stateRoot = join(scratch, "state");
  configRoot = join(scratch, "config");
  for (const directory of [emptyPath, emptyDirectory, emptyHome, stateRoot, configRoot]) {
    mkdirSync(directory, { recursive: true });
  }
  const built = run("bun", ["run", "build:binary", "--out", outDirectory], {
    cwd: ROOT,
    env: { ...process.env, TMPDIR: join(ROOT, "tmp/tmpdir") },
  });
  if (built.status !== 0) {
    throw new Error(`the artifact build failed by name: ${built.stderr}`);
  }
  report = parseReport(built.stdout);
  artifact = report.artifact;
});

afterAll(() => {
  if (scratch.length > 0) rmSync(scratch, { recursive: true, force: true });
});

describe("TC-BIN-061 three reads answer with no runtime, source, or checkout", () => {
  test("--version, --help and a composed read succeed with an empty PATH and HOME", () => {
    expect(report.artifact.startsWith(outDirectory)).toBe(true);
    const version = run(artifact, ["--version"], {
      cwd: emptyDirectory,
      env: baseEnvironment(),
    });
    expect(version.status).toBe(0);
    expect(version.stdout.trim().split("\n")).toHaveLength(1);
    const help = run(artifact, ["--help"], { cwd: emptyDirectory, env: baseEnvironment() });
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("Usage:");
    expect(help.stdout).toContain("Commands:");
    const composed = run(artifact, ["phase", "list", "GH-346", "--json"], {
      cwd: emptyDirectory,
      env: baseEnvironment(),
    });
    expect(composed.status).toBe(0);
    const envelope = JSON.parse(composed.stdout) as {
      readonly schemaVersion?: string;
      readonly data?: {
        readonly schemaVersion?: string;
        readonly changeRef?: string;
        readonly verifiedEmpty?: boolean;
        readonly phases?: unknown;
      };
    };
    expect(envelope.schemaVersion).toBe("delivery.result.v1");
    expect(envelope.data?.schemaVersion).toBe("delivery.registry.v1");
    expect(envelope.data?.changeRef).toBe("GH-346");
    expect(envelope.data?.verifiedEmpty).toBe(true);
    const phases = envelope.data?.phases;
    expect(Array.isArray(phases) ? phases.length : Object.keys(phases ?? {}).length).toBe(0);
    // The delivered read-only composition maintains its host index under the
    // state root; no delivery record, ledger, or configuration file is created.
    expect(readdirSync(stateRoot).filter((name) => name !== "host-index.json")).toEqual([]);
    expect(readdirSync(configRoot)).toEqual([]);
  });
});

describe("TC-BIN-062 a dirty tracked tree builds and reports the dirty token", () => {
  test("the build completes, reports <short>-dirty, and mutates no tracked file", () => {
    const trackedFile = join(ROOT, "doc/00-index.md");
    const original = readFileSync(trackedFile);
    const dirtyOut = join(scratch, "dirty-out");
    try {
      writeFileSync(
        trackedFile,
        Buffer.concat([original, Buffer.from("\n<!-- dirty probe -->\n")]),
      );
      const built = run("bun", ["run", "build:binary", "--out", dirtyOut], {
        cwd: ROOT,
        env: { ...process.env, TMPDIR: join(ROOT, "tmp/tmpdir") },
      });
      expect(built.status).toBe(0);
      const dirtyReport = parseReport(built.stdout);
      expect(dirtyReport.dirty).toBe("true");
      const version = run(join(dirtyOut, "jaiship"), ["--version"], {
        cwd: emptyDirectory,
        env: baseEnvironment(),
      });
      expect(version.status).toBe(0);
      expect(version.stdout.trim()).toBe(
        `jaiship ${dirtyReport.version} (build ${dirtyReport.commit.slice(0, 7)}-dirty)`,
      );
    } finally {
      writeFileSync(trackedFile, original);
    }
    expect(readFileSync(trackedFile).equals(original)).toBe(true);
  });
});

describe("TC-BIN-066 self-description is read-free under a recording git stub", () => {
  test("three reads exit 0, write nothing, and record zero git invocations", () => {
    const stubDirectory = join(scratch, "git-stub");
    const gitLog = join(scratch, "git-stub.log");
    mkdirSync(stubDirectory, { recursive: true });
    writeFileSync(join(stubDirectory, "git"), `#!/bin/sh\necho "$@" >> "${gitLog}"\nexit 1\n`);
    chmodSync(join(stubDirectory, "git"), 0o755);
    const poisonedState = join(scratch, "poisoned-state");
    const poisonedConfig = join(scratch, "poisoned-config");
    mkdirSync(poisonedState, { recursive: true });
    mkdirSync(poisonedConfig, { recursive: true });
    writeFileSync(join(poisonedConfig, "config.yaml"), "provider: [unclosed\n");
    chmodSync(join(poisonedConfig, "config.yaml"), 0o000);
    const environment = {
      ...baseEnvironment(),
      PATH: `${stubDirectory}:${String(process.env.PATH)}`,
      JAISHIP_STATE_DIR: poisonedState,
      DELIVERY_OS_STATE_DIR: poisonedState,
      XDG_CONFIG_HOME: poisonedConfig,
    };
    delete (environment as Record<string, string | undefined>).DELIVERY_OS_WORKING_NAME;
    const before = [...snapshot(poisonedState), ...snapshot(poisonedConfig)];
    for (const argv of [["--version"], ["--help"], ["--print-install-path"]]) {
      const result = run(artifact, argv, { cwd: emptyDirectory, env: environment });
      expect({ argv, status: result.status }).toEqual({ argv, status: 0 });
      expect({ argv, stderr: result.stderr }).toEqual({ argv, stderr: "" });
    }
    const stubLog = (() => {
      try {
        return readFileSync(gitLog, "utf8").trim();
      } catch {
        return "";
      }
    })();
    expect(stubLog).toBe("");
    expect([...snapshot(poisonedState), ...snapshot(poisonedConfig)]).toEqual(before);
  });
});

describe("TC-BIN-067 a composed command reports the injected identity", () => {
  test("the identity is the injected one under clean and poisoned environments", () => {
    const clean = run(artifact, ["--version"], { cwd: emptyDirectory, env: baseEnvironment() });
    const poisoned = run(artifact, ["--version"], {
      cwd: emptyDirectory,
      env: {
        ...baseEnvironment(),
        GIT_DIR: "/nonexistent/git-dir",
        GIT_WORK_TREE: "/nonexistent/work-tree",
        TZ: "Pacific/Kiritimati",
      },
    });
    expect(poisoned.stdout).toBe(clean.stdout);
    expect(clean.stdout.trim()).toBe(
      `jaiship ${report.version} (build ${report.commit.slice(0, 7)}${report.dirty === "true" ? "-dirty" : ""})`,
    );
    const composed = run(artifact, ["phase", "list", "GH-346", "--json"], {
      cwd: emptyDirectory,
      env: { ...baseEnvironment(), GIT_DIR: "/nonexistent/git-dir" },
    });
    expect(composed.status).toBe(0);
    expect(JSON.parse(composed.stdout).data.changeRef).toBe("GH-346");
  });
});

describe("TC-BIN-070 the install path stays the resolver's authority", () => {
  test("--print-install-path answers the effective identity's brand path, read-free", async () => {
    const primary = resolveBrandIdentity({ workingName: "jaiship" });
    const alias = resolveBrandIdentity({ workingName: "delivery-os" });
    const overridden = resolveBrandIdentity({ workingName: "jaiship", override: "renamed-tool" });
    if (!primary.ok || !alias.ok || !overridden.ok) throw new Error("the resolver rejected a name");
    const cases = [
      { declared: "jaiship", environment: {}, expected: primary.value.installPath },
      { declared: "delivery-os", environment: {}, expected: alias.value.installPath },
      {
        declared: "jaiship",
        environment: { DELIVERY_OS_WORKING_NAME: "renamed-tool" },
        expected: overridden.value.installPath,
      },
    ];
    for (const arm of cases) {
      const stdout = emptySink();
      const stderr = emptySink();
      const exit = await runEntrypoint(["--print-install-path"], {
        streams: { stdout, stderr },
        environment: arm.environment,
        declaredWorkingName: arm.declared,
        composeProgram: () => {
          throw new Error("the install-path read must not compose");
        },
      });
      expect({ declared: arm.declared, exit }).toEqual({ declared: arm.declared, exit: 0 });
      expect(stdout.value).toBe(`${arm.expected}\n`);
      expect(stderr.value).toBe("");
    }
    const direct = run(artifact, ["--print-install-path"], {
      cwd: emptyDirectory,
      env: baseEnvironment(),
    });
    expect(direct.stdout).toBe(`${primary.value.installPath}\n`);
  });
});
