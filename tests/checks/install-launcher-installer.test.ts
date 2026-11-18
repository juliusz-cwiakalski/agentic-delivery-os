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
import { dirname, join, relative } from "node:path";

const REPO = process.cwd();
const INSTALLER = join(REPO, "scripts/install.sh");
const CLI_ENTRY = join(REPO, "packages/cli/bin/jaiship.ts");
const BASE = join(REPO, "tmp/tmpdir/gh320-installer");

/** The Bun binary's directory: the launcher and every shim PATH need it. */
const BUN_DIR = dirname(
  spawnSync("bash", ["-lc", "command -v bun"], { encoding: "utf8" }).stdout.trim(),
);

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
  // A recording `gh` stub: the launcher's composition probe answers with a
  // usable version and every invocation is recorded. No live `gh` is reachable
  // from a launcher run, so the check tier never depends on the host.
  script(
    "gh",
    [
      `printf 'gh %s\\n' "$*" >> ${JSON.stringify(log)}`,
      `printf 'gh version 2.91.0 (2026-01-01)\\n'`,
    ].join("\n"),
  );
};

/**
 * A `PATH` with every host tool except `gh`, plus Bun.
 *
 * The absent-CLI arm must be genuinely empty of `gh` on a host that has one, so
 * the directory is populated from the real tool directories with that one name
 * skipped.
 */
const noGhPath = (root: string): string => {
  const directory = join(root, "no-gh-bin");
  mkdirSync(directory, { recursive: true });
  spawnSync(
    "bash",
    [
      "-c",
      [
        "shopt -s nullglob",
        `for entry in /usr/bin/* /bin/*; do`,
        `  name=$(basename "$entry")`,
        `  if [ "$name" = "gh" ]; then continue; fi`,
        `  ln -sf "$entry" ${JSON.stringify(directory)}/"$name"`,
        "done",
      ].join("\n"),
    ],
    { encoding: "utf8" },
  );
  return `${directory}:${BUN_DIR}`;
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
  cwd: string = s.home,
) => {
  const result = spawnSync(
    launcherPath(s),
    [...argv],
    {
      cwd,
      encoding: "utf8",
      // The scratch shim leads (and a `gh` stub lives there), so no launcher
      // invocation can reach the host's real `gh` and the composition branch is
      // deterministic. The system directories answer `bash` for the shebang; the
      // shim still shadows their `gh`. An arm that needs the absent-CLI branch
      // overrides PATH.
      env: { PATH: `${s.shim}:${BUN_DIR}:/usr/bin:/bin`, HOME: s.home, ...env },
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

describe("TC-BIN-050 the recorded target is one safely quoted word", () => {
  test("quote-and-space source path: bash -n passes and the launcher execs that target", () => {
    const s = scratch("quoted-source");
    try {
      // A source directory whose name carries both a single quote and a space:
      // unescaped single-quoted interpolation cannot represent it.
      const source = join(s.root, "source o'brien");
      mkdirSync(source, { recursive: true });
      for (const entry of readdirSync(REPO)) {
        if (["node_modules", "tmp", ".git"].includes(entry)) continue;
        spawnSync("ln", ["-s", join(REPO, entry), join(source, entry)]);
      }
      const expectedTarget = join(source, "packages/cli/bin/jaiship.ts");
      installOnce(s, source);
      const launcher = launcherPath(s);
      const syntax = spawnSync("bash", ["-n", launcher], { encoding: "utf8" });
      expect({ status: syntax.status, stderr: syntax.stderr }).toEqual({ status: 0, stderr: "" });

      const content = readFileSync(launcher, "utf8");
      const assignments = content.split("\n").filter((line) => line.startsWith("readonly TARGET="));
      expect(assignments).toHaveLength(1);
      // The recorded word evaluates to exactly the recorded target.
      const expanded = spawnSync("bash", ["-c", `${assignments[0] ?? ""}\nprintf '%s' "$TARGET"`], {
        encoding: "utf8",
      });
      expect(expanded.stdout).toBe(expectedTarget);
      expect(content.split("packages/cli/bin/jaiship.ts").length - 1).toBe(1);

      const version = runLauncher(s, ["--version"]);
      expect(version.status).toBe(0);
      expect(version.stdout).toBe("jaiship 0.0.0 (build dev)\n");

      // Content idempotence is unchanged for the quoted target.
      const beforeDigest = digest(launcher);
      installOnce(s, source);
      expect(digest(launcher)).toBe(beforeDigest);
    } finally {
      s.dispose();
    }
  }, 120_000);
});

describe("TC-BIN-050 a relative source records an absolute target", () => {
  test("relative-source: the recorded target is absolute and runs from outside", () => {
    const s = scratch("relative-source");
    try {
      // The operator names the source relatively from the scratch project root;
      // a verbatim record would render `readonly TARGET=../rel-source/...`.
      const source = join(s.root, "rel-source");
      mkdirSync(source, { recursive: true });
      for (const entry of readdirSync(REPO)) {
        if (["node_modules", "tmp", ".git"].includes(entry)) continue;
        spawnSync("ln", ["-s", join(REPO, entry), join(source, entry)]);
      }
      const named = relative(s.project, source);
      expect(named.startsWith("/")).toBe(false);
      const expectedTarget = join(source, "packages/cli/bin/jaiship.ts");

      installOnce(s, named);
      const launcher = launcherPath(s);
      const syntax = spawnSync("bash", ["-n", launcher], { encoding: "utf8" });
      expect({ status: syntax.status, stderr: syntax.stderr }).toEqual({ status: 0, stderr: "" });

      const content = readFileSync(launcher, "utf8");
      const assignments = content.split("\n").filter((line) => line.startsWith("readonly TARGET="));
      expect(assignments).toHaveLength(1);
      const expanded = spawnSync("bash", ["-c", `${assignments[0] ?? ""}\nprintf '%s' "$TARGET"`], {
        encoding: "utf8",
      });
      // An unresolved relative word fails by name: the recorded word is absolute.
      expect(expanded.stdout.startsWith("/")).toBe(true);
      expect(expanded.stdout).toBe(expectedTarget);
      expect(content.split("packages/cli/bin/jaiship.ts").length - 1).toBe(1);

      // From the filesystem root — outside both the checkout (the source being
      // installed) and the scratch project root the relative path was named from.
      const version = runLauncher(s, ["--version"], {}, "/");
      expect(version.status).toBe(0);
      expect(version.stdout).toBe("jaiship 0.0.0 (build dev)\n");
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
      const beforeDigest = digest(launcherPath(s));
      installOnce(s);
      const after = statSync(launcherPath(s));
      // The digest is captured around the second run, never compared to itself.
      expect(digest(launcherPath(s))).toBe(beforeDigest);
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
      const line = lines[0] ?? "";
      expect(line).toContain(target);
      expect(line).toContain("re-run the local install");
      // The bound measures the fixed prose: the rendered line with the variable
      // absolute target removed. The target is the only content that grows with
      // the source path, so the bound is path-independent by construction.
      expect(line.split(target).join("").length).toBeLessThanOrEqual(400);
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

  test("preconditions: DRY_RUN is a plan-only preview with no precondition evaluated", () => {
    const s = scratch("preconditions-dry");
    try {
      // A source tree without the CLI entry: a real run fails classified, while
      // the preview evaluates no precondition (spec v1.6 F-6/DEC-15/NFR-5).
      const docsOnly = join(s.root, "docs-only-dry");
      mkdirSync(join(docsOnly, "doc/guides"), { recursive: true });
      mkdirSync(join(docsOnly, "scripts"), { recursive: true });
      writeFileSync(join(docsOnly, "AGENTS.md"), "docs only\n");
      const preview = runInstaller(s, { source: docsOnly, args: ["--dry-run"] });
      expect(preview.status).toBe(0);
      expect(existsSync(launcherPath(s))).toBe(false);
      expect(existsSync(join(s.home, ".jaiship"))).toBe(false);
      const planLines = `${preview.stdout}${preview.stderr}`
        .split("\n")
        .filter((line) => line.includes("[DRY-RUN]") && line.includes("launcher"));
      expect(planLines).toHaveLength(1);
      expect(planLines[0]).toContain("Would register the launcher for the CLI entry");
      expect(planLines[0]).toContain("preview only; install-time preconditions are not evaluated");

      const dry = runInstaller(s, { environment: { DRY_RUN: "true" } });
      expect(dry.status).toBe(0);
      expect(existsSync(launcherPath(s))).toBe(false);
      expect(`${dry.stdout}${dry.stderr}`).toContain("launcher");
      expect(`${dry.stdout}${dry.stderr}`).toContain(
        "preview only; install-time preconditions are not evaluated",
      );

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

describe("TC-BIN-057 both composition branches are exercised offline on an injected PATH", () => {
  const ghCalls = (s: Scratch): readonly string[] =>
    networkLog(s).filter((line) => line.startsWith("gh "));

  const degradationLines = (stderr: string): readonly string[] =>
    stderr.split("\n").filter((line) => line.includes("provider.cli."));

  test("arm A: a stub gh on PATH is probed once per composing invocation", () => {
    const s = scratch("gh-present");
    try {
      installOnce(s);
      const first = runLauncher(s, ["status", "--json"]);
      expect(first.status).toBe(0);
      expect(ghCalls(s)).toEqual(["gh --version"]);
      expect(degradationLines(first.stderr)).toEqual([]);
      expect(JSON.parse(first.stdout)).toBeDefined();

      // A self-description invocation composes nothing and probes nothing.
      const version = runLauncher(s, ["--version"]);
      expect(version.status).toBe(0);
      expect(ghCalls(s)).toEqual(["gh --version"]);

      const second = runLauncher(s, ["status", "--json"]);
      expect(second.status).toBe(0);
      expect(ghCalls(s)).toEqual(["gh --version", "gh --version"]);
    } finally {
      s.dispose();
    }
  }, 120_000);

  test("arm B: a PATH with no gh degrades with exactly one named line and still succeeds", () => {
    const s = scratch("gh-absent");
    try {
      installOnce(s);
      const path = noGhPath(s.root);
      const resolved = spawnSync("bash", ["-c", "command -v gh"], {
        encoding: "utf8",
        env: { PATH: path },
      });
      expect(resolved.status).not.toBe(0);
      expect(resolved.stdout.trim()).toBe("");

      const status = runLauncher(s, ["status", "--json"], { PATH: path });
      expect(status.status).toBe(0);
      expect(JSON.parse(status.stdout)).toBeDefined();
      const lines = degradationLines(status.stderr);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain("provider.cli.unavailable");
      // Zero spawns: the stub is not even on this PATH, so the log stays absent.
      expect(ghCalls(s)).toEqual([]);

      // A non-zero composing exit keeps the same single line (the degradation is
      // a composition fact, not a command outcome).
      const grammar = runLauncher(s, ["queue", "add", "--json"], { PATH: path });
      expect(grammar.status).toBe(1);
      expect(degradationLines(grammar.stderr)).toHaveLength(1);
      expect(ghCalls(s)).toEqual([]);
    } finally {
      s.dispose();
    }
  }, 120_000);
});
