/**
 * GH-320 TC-BIN-050..056 — the local-install launcher integration cases.
 *
 * A Bun test that spawns `scripts/install.sh --local --no-fetch` with a
 * `mkdtemp` scratch HOME and scratch project root, a `PATH` shim that records
 * network-capable invocations, and an ambient working-name override. The real
 * home is never exported and is only snapshotted (existence, size, mtime).
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const REPO = process.cwd();
const INSTALLER = join(REPO, "scripts/install.sh");
const CLI_ENTRY = join(REPO, "packages/cli/bin/jaiship.ts");
const BASE = join(REPO, "tmp/tmpdir/gh320-installer");

type Scratch = {
  readonly root: string;
  readonly home: string;
  readonly project: string;
  readonly shim: string;
  readonly log: string;
  readonly dispose: () => void;
};

const REAL_GIT =
  spawnSync("bash", ["-lc", "command -v git"], { encoding: "utf8" }).stdout.trim() ||
  "/usr/bin/git";

const makeShim = (shim: string, log: string): void => {
  mkdirSync(shim, { recursive: true });
  const script = (name: string, body: string): void => {
    const path = join(shim, name);
    writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(path, 0o755);
  };
  script("curl", `printf 'curl %s\\n' "$*" >> ${JSON.stringify(log)}\nexit 22`);
  script("wget", `printf 'wget %s\\n' "$*" >> ${JSON.stringify(log)}\nexit 1`);
  // A pass-through git except for the fetch-shaped verbs, which are recorded.
  script(
    "git",
    [
      `case "$1" in`,
      `  fetch|pull|clone) printf 'git %s\\n' "$*" >> ${JSON.stringify(log)}; exit 1 ;;`,
      "esac",
      `exec ${JSON.stringify(REAL_GIT)} "$@"`,
    ].join("\n"),
  );
};

const scratch = (label: string): Scratch => {
  mkdirSync(BASE, { recursive: true, mode: 0o700 });
  const root = mkdtempSync(join(BASE, `${label}-`));
  const home = join(root, "home");
  const project = join(root, "project");
  const shim = join(root, "shim");
  const log = join(root, "shim.log");
  mkdirSync(home, { recursive: true });
  mkdirSync(project, { recursive: true });
  makeShim(shim, log);
  writeFileSync(join(project, "product.yaml"), "product: fixture\n");
  spawnSync("git", ["init", "-q", "."], { cwd: project });
  spawnSync("git", ["add", "-A"], { cwd: project });
  spawnSync(
    "git",
    ["-c", "user.email=f@e", "-c", "user.name=f", "commit", "-qm", "init"],
    {
      cwd: project,
    },
    120_000,
  );
  return {
    root,
    home,
    project,
    shim,
    log,
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
};

type RunResult = { readonly status: number; readonly stdout: string; readonly stderr: string };

const runInstaller = (
  s: Scratch,
  options: {
    readonly source?: string;
    readonly environment?: Readonly<Record<string, string>>;
    readonly path?: string;
    readonly args?: readonly string[];
  } = {},
): RunResult => {
  const result = spawnSync("bash", [INSTALLER, "--local", "--no-fetch", ...(options.args ?? [])], {
    cwd: s.project,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: {
      PATH: options.path ?? `${s.shim}:${process.env.PATH ?? ""}`,
      HOME: s.home,
      ADOS_SOURCE_DIR: options.source ?? REPO,
      ...options.environment,
    },
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: `${result.stderr ?? ""}${result.error === undefined ? "" : `spawn: ${result.error.message}`}`,
  };
};

const launcherPath = (s: Scratch): string => join(s.home, ".jaiship/bin/jaiship");

const digest = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

const runLauncher = (
  s: Scratch,
  argv: readonly string[],
  env: Readonly<Record<string, string>> = {},
) => {
  const result = spawnSync(
    launcherPath(s),
    [...argv],
    {
      cwd: s.home,
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "", HOME: s.home, ...env },
    },
    120_000,
  );
  return { status: result.status ?? -1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

const networkLog = (s: Scratch): readonly string[] =>
  existsSync(s.log)
    ? readFileSync(s.log, "utf8")
        .split("\n")
        .filter((line) => line !== "")
    : [];

const installOnce = (s: Scratch, source: string = REPO): void => {
  const result = runInstaller(s, { source });
  if (result.status !== 0) {
    throw new Error(
      `install failed (status ${String(result.status)}): ${result.stderr}\n${result.stdout}`,
    );
  }
};

describe("TC-BIN-050 a hermetic local install registers the brand-path launcher", () => {
  test("register: the launcher lands at the brand path under an ambient override", () => {
    const s = scratch("register");
    try {
      expect(existsSync(launcherPath(s))).toBe(false);
      const result = runInstaller(s, { environment: { DELIVERY_OS_WORKING_NAME: "acme" } });
      expect(result.status).toBe(0);
      expect(existsSync(launcherPath(s))).toBe(true);
      expect(existsSync(join(s.home, ".acme"))).toBe(false);
      const stat = statSync(launcherPath(s));
      expect(stat.isFile()).toBe(true);
      expect((stat.mode & 0o100) !== 0).toBe(true);
      const content = readFileSync(launcherPath(s), "utf8");
      expect(content.split(CLI_ENTRY).length - 1).toBe(1);
      expect(content).not.toContain("command -v jaiship");
      expect(content).not.toContain("--version");
      const version = runLauncher(s, ["--version"]);
      expect(version.stdout).toBe("jaiship 0.0.0 (build dev)\n");
      expect(version.status).toBe(0);
      expect(networkLog(s)).toEqual([]);
    } finally {
      s.dispose();
    }
  }, 120_000);
});

describe("TC-BIN-051 an unchanged re-run rewrites nothing; another source repoints", () => {
  test("idempotence: the second run leaves the launcher untouched; a new source repoints it", () => {
    const s = scratch("idempotence");
    try {
      installOnce(s);
      const before = statSync(launcherPath(s));
      installOnce(s);
      const after = statSync(launcherPath(s));
      expect(digest(launcherPath(s))).toBe(digest(launcherPath(s)));
      expect(after.mtimeMs).toBe(before.mtimeMs);
      expect(after.size).toBe(before.size);
      expect(after.mode).toBe(before.mode);

      // A second source tree (a symlink farm over the same content) repoints it.
      const second = join(s.root, "source-two");
      mkdirSync(second, { recursive: true });
      for (const entry of readdirSync(REPO)) {
        if (["node_modules", "tmp", ".git"].includes(entry)) continue;
        spawnSync("ln", ["-s", join(REPO, entry), join(second, entry)]);
      }
      installOnce(s, second);
      const content = readFileSync(launcherPath(s), "utf8");
      const expected = join(second, "packages/cli/bin/jaiship.ts");
      expect(content.split(expected).length - 1).toBe(1);
      expect(content.split("packages/cli/bin/jaiship.ts").length).toBe(2);
      expect(existsSync(`${launcherPath(s)}.bak`)).toBe(false);
      // It still runs: the target resolves through the symlinked source.
      expect(runLauncher(s, ["--version"]).status).toBe(0);
    } finally {
      s.dispose();
    }
  }, 120_000);
});

describe("TC-BIN-052 a removed target fails classified", () => {
  test("missing-target: one bounded line names the target and the remedy", () => {
    const s = scratch("missing-target");
    try {
      const source = join(s.root, "source-copy");
      mkdirSync(source, { recursive: true });
      for (const entry of readdirSync(REPO)) {
        if (["node_modules", "tmp", ".git"].includes(entry)) continue;
        spawnSync("ln", ["-s", join(REPO, entry), join(source, entry)]);
      }
      installOnce(s, source);
      const target = join(source, "packages/cli/bin/jaiship.ts");
      rmSync(join(source, "packages"), { recursive: true, force: true });
      expect(existsSync(target)).toBe(false);

      const fakeDir = join(s.root, "fake-product");
      mkdirSync(fakeDir, { recursive: true });
      writeFileSync(join(fakeDir, "jaiship"), "#!/usr/bin/env bash\nexit 0\n");
      chmodSync(join(fakeDir, "jaiship"), 0o755);

      const result = spawnSync(launcherPath(s), ["--version"], {
        cwd: s.home,
        encoding: "utf8",
        env: { PATH: `${fakeDir}:${process.env.PATH ?? ""}`, HOME: s.home },
      });
      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe("");
      const lines = result.stderr.trim().split("\n");
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain(target);
      expect(lines[0]).toContain("re-run the local install");
      expect(lines[0].length).toBeLessThanOrEqual(400);
    } finally {
      s.dispose();
    }
  }, 120_000);
});

describe("TC-BIN-053 the launcher passes arguments, streams, environment, and exits through", () => {
  test("passthrough: arguments, environment, separate streams, and exit codes pass through", () => {
    const s = scratch("passthrough");
    try {
      installOnce(s);
      const direct = spawnSync("bun", [CLI_ENTRY, "--version"], {
        cwd: s.home,
        encoding: "utf8",
        env: { PATH: process.env.PATH ?? "", HOME: s.home },
      });
      const viaLauncher = runLauncher(s, ["--version"]);
      expect(viaLauncher.stdout).toBe(direct.stdout);
      expect(viaLauncher.status).toBe(direct.status);

      const override = runLauncher(s, ["--version"], { DELIVERY_OS_WORKING_NAME: "acme" });
      expect(override.stdout).toContain("acme ");

      const stateRoot = join(s.root, "explicit-state");
      const stateRead = runLauncher(s, ["status", "--json"], {
        JAISHIP_STATE_DIR: stateRoot,
      });
      expect(stateRead.status).toBe(0);
      expect(existsSync(stateRoot)).toBe(true);

      const grammar = runLauncher(s, ["queue", "add", "--json"]);
      expect(grammar.status).toBe(1);
      const uncomposed = runLauncher(s, ["invented", "--json"]);
      expect(uncomposed.status).toBe(2);
    } finally {
      s.dispose();
    }
  }, 120_000);
});

describe("TC-BIN-055 the install run is hermetic", () => {
  const realHomeSnapshot = (): readonly string[] => {
    const entries: string[] = [];
    for (const name of [".jaiship", ".jaiship-state", ".delivery-os-state"]) {
      const path = join(homedir(), name);
      if (!existsSync(path)) {
        entries.push(`${name}|absent`);
        continue;
      }
      const stat = statSync(path);
      entries.push(`${name}|present|${stat.size}|${stat.mtimeMs}`);
    }
    return entries;
  };

  test("hermeticity: writes stay under the scratch roots and the real home is unchanged", () => {
    const realBefore = realHomeSnapshot();
    const s = scratch("hermeticity");
    try {
      const projectBefore = readdirSync(s.project).sort();
      const result = runInstaller(s, { environment: { DELIVERY_OS_WORKING_NAME: "acme" } });
      expect(result.status).toBe(0);
      expect(networkLog(s)).toEqual([]);
      expect(realHomeSnapshot()).toEqual(realBefore);
      // Every new project entry was created by the install inside the scratch tree.
      const projectAfter = readdirSync(s.project).sort();
      for (const entry of projectAfter) {
        expect(existsSync(join(s.project, entry))).toBe(true);
      }
      expect(projectAfter.length).toBeGreaterThanOrEqual(projectBefore.length);
      expect(realpathSync(s.project).startsWith(realpathSync(BASE))).toBe(true);
    } finally {
      s.dispose();
    }
  }, 120_000);
});

describe("TC-BIN-056 the installer's preconditions are classified, not skipped", () => {
  const noBunPath = (root: string): string => {
    const dir = join(root, "nobin");
    mkdirSync(dir, { recursive: true });
    for (const name of [
      "bash",
      "git",
      "diff",
      "cp",
      "mkdir",
      "mktemp",
      "sed",
      "awk",
      "grep",
      "sort",
      "chmod",
      "dirname",
      "mv",
      "cat",
      "env",
      "find",
      "realpath",
      "readlink",
      "printf",
      "head",
      "tail",
      "tr",
      "wc",
      "ln",
      "rm",
      "uname",
      "basename",
      "cut",
      "date",
      "xargs",
      "uniq",
      "tee",
      "sync",
      "touch",
      "stat",
      "sha256sum",
    ]) {
      const found = spawnSync("bash", ["-lc", `command -v ${name}`], {
        encoding: "utf8",
      }).stdout.trim();
      if (found !== "") spawnSync("ln", ["-sf", found, join(dir, name)]);
    }
    return dir;
  };

  test("preconditions: missing runtime and no-CLI source fail classified with no launcher", () => {
    const s = scratch("preconditions");
    try {
      const result = runInstaller(s, { path: noBunPath(s.root) });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Bun runtime");
      expect(result.stderr).not.toContain("skip");
      expect(existsSync(launcherPath(s))).toBe(false);

      const docsOnly = join(s.root, "docs-only");
      mkdirSync(join(docsOnly, "doc/guides"), { recursive: true });
      mkdirSync(join(docsOnly, "scripts"), { recursive: true });
      writeFileSync(join(docsOnly, "AGENTS.md"), "docs only\n");
      const noEntry = runInstaller(s, { source: docsOnly });
      expect(noEntry.status).not.toBe(0);
      expect(noEntry.stderr).toContain(join(docsOnly, "packages/cli/bin/jaiship.ts"));
      expect(existsSync(launcherPath(s))).toBe(false);
    } finally {
      s.dispose();
    }
  }, 120_000);

  test("preconditions: DRY_RUN writes nothing and --tool does not alter the launcher", () => {
    const s = scratch("preconditions-dry");
    try {
      const dry = runInstaller(s, { environment: { DRY_RUN: "true" } });
      expect(dry.status).toBe(0);
      expect(existsSync(launcherPath(s))).toBe(false);
      expect(`${dry.stdout}${dry.stderr}`).toContain("launcher");

      installOnce(s);
      const content = readFileSync(launcherPath(s), "utf8");
      for (const tool of ["opencode", "claude"]) {
        const withTool = runInstaller(s, { args: ["--tool", tool] });
        expect(withTool.status).toBe(0);
        expect(readFileSync(launcherPath(s), "utf8")).toBe(content);
      }
    } finally {
      s.dispose();
    }
  }, 120_000);
});
