/**
 * TC-CONFIG-003/004/005/006/024 — injected platform paths, root bounds, exact
 * DM-2 first-match reasons, zero skipped reads, selection priority and legacy
 * fact composition. No test reads a real home directory.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  acquireFileConfig,
  neutralEnvironmentFacts,
  type FileAcquisitionInput,
  type FileSystemFacts,
} from "@delivery-os/adapters/file";
import { findGitRoot, nodeRepositoryIo } from "@delivery-os/adapters/repo";
import { createLegacyCompat } from "@delivery-os/adapters/legacy";

const ROOT = process.cwd();
const HOME = "/home/synthetic";
const REPO = "/repo";
const DIR = ".synthetic";
const PATHS = {
  system: `/etc/xdg/${DIR}/config.yaml`,
  user: `${HOME}/.config/${DIR}/config.yaml`,
  committed: `${REPO}/${DIR}/config.yaml`,
  local: `${REPO}/${DIR}/config.local.yaml`,
  selected: "/selected/config.yaml",
} as const;

type Layer = Exclude<keyof typeof PATHS, "selected">;
type Outcome = "load" | "missing" | "ci-disabled" | "no-git-root" | "selected" | "selected-config";

const testFs = (
  files: Record<string, string>,
): FileSystemFacts & { reads: Map<string, number> } => {
  const reads = new Map<string, number>();
  return {
    reads,
    exists: (path) => Object.hasOwn(files, path),
    readText: (path) => {
      reads.set(path, (reads.get(path) ?? 0) + 1);
      const content = files[path];
      if (content === undefined) throw new Error("missing");
      return content;
    },
  };
};

const input = (
  overrides: Partial<FileAcquisitionInput> & { fs: FileSystemFacts },
): FileAcquisitionInput => ({
  platform: "linux",
  homeDirectory: HOME,
  environment: {},
  gitRoot: REPO,
  configurationDirectoryName: DIR,
  enableSystemConfig: false,
  enableUserConfig: false,
  enableProjectLocalConfig: false,
  ...overrides,
});

const ok = (result: ReturnType<typeof acquireFileConfig>) => {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("acquisition failed");
  return result;
};

describe("TC-CONFIG-003 injectable platform locations", () => {
  test("Linux uses the first existing XDG system candidate and XDG_CONFIG_HOME", () => {
    const files = {
      [`/one/${DIR}/config.yaml`]: "value: one",
      [`/two/${DIR}/config.yaml`]: "value: two",
      [`/home-custom/${DIR}/config.yaml`]: "value: custom",
    };
    const fs = testFs(files);
    const result = ok(
      acquireFileConfig(
        input({
          environment: { XDG_CONFIG_DIRS: "/absent:/one:/two", XDG_CONFIG_HOME: "/home-custom" },
          fs,
        }),
      ),
    );
    expect(result.sources.map((source) => source.loadedFile?.file)).toEqual([
      `/one/${DIR}/config.yaml`,
      `/home-custom/${DIR}/config.yaml`,
    ]);
    expect(fs.reads.get(`/two/${DIR}/config.yaml`)).toBeUndefined();
  });

  test("Linux falls back to /etc/xdg and ~/.config", () => {
    const fs = testFs({ [PATHS.system]: "value: etc", [PATHS.user]: "value: home" });
    const result = ok(acquireFileConfig(input({ fs })));
    expect(result.sources.map((source) => source.layer)).toEqual(["system", "user-global"]);
  });

  test("macOS uses Application Support and ignores XDG", () => {
    const fs = testFs({
      [`/Library/Application Support/${DIR}/config.yaml`]: "value: mac-system",
      [`${HOME}/Library/Application Support/${DIR}/config.yaml`]: "value: mac-user",
    });
    const result = ok(
      acquireFileConfig(
        input({
          platform: "darwin",
          environment: { XDG_CONFIG_HOME: "/ignored" },
          fs,
          gitRoot: undefined,
        }),
      ),
    );
    expect(result.sources.map((source) => source.loadedFile?.file)).toEqual([
      `/Library/Application Support/${DIR}/config.yaml`,
      `${HOME}/Library/Application Support/${DIR}/config.yaml`,
    ]);
  });

  test("Windows uses PROGRAMDATA and APPDATA; absent variables report missing", () => {
    const fs = testFs({
      [`C:/ProgramData/${DIR}/config.yaml`]: "value: programdata",
      [`C:/Users/synthetic/AppData/Roaming/${DIR}/config.yaml`]: "value: appdata",
    });
    const result = ok(
      acquireFileConfig(
        input({
          platform: "win32",
          environment: {
            PROGRAMDATA: "C:/ProgramData",
            APPDATA: "C:/Users/synthetic/AppData/Roaming",
          },
          fs,
          gitRoot: undefined,
        }),
      ),
    );
    expect(result.sources).toHaveLength(2);
    const missing = ok(
      acquireFileConfig(
        input({ platform: "win32", environment: {}, fs: testFs({}), gitRoot: undefined }),
      ),
    );
    expect(missing.skipped.map((item) => item.reason)).toEqual([
      "missing",
      "missing",
      "no-git-root",
      "no-git-root",
    ]);
  });
});

type Row = {
  readonly name: string;
  readonly ci: boolean;
  readonly root: "git" | "none" | "explicit";
  readonly selected?: boolean;
  readonly flags?: { readonly s?: boolean; readonly u?: boolean; readonly l?: boolean };
  readonly absent?: "all" | "sysuser" | "local";
  readonly expected: Record<Layer, Outcome>;
};

const ROWS: Row[] = [
  {
    name: "baseline",
    ci: false,
    root: "git",
    expected: { system: "load", user: "load", committed: "load", local: "load" },
  },
  {
    name: "all optional absent",
    ci: false,
    root: "git",
    absent: "all",
    expected: { system: "missing", user: "missing", committed: "missing", local: "missing" },
  },
  {
    name: "outside git",
    ci: false,
    root: "none",
    expected: { system: "load", user: "load", committed: "no-git-root", local: "no-git-root" },
  },
  {
    name: "explicit root outside git",
    ci: false,
    root: "explicit",
    expected: { system: "load", user: "load", committed: "load", local: "load" },
  },
  {
    name: "CI in git",
    ci: true,
    root: "git",
    expected: {
      system: "ci-disabled",
      user: "ci-disabled",
      committed: "load",
      local: "ci-disabled",
    },
  },
  {
    name: "CI outside git",
    ci: true,
    root: "none",
    expected: {
      system: "ci-disabled",
      user: "ci-disabled",
      committed: "no-git-root",
      local: "ci-disabled",
    },
  },
  {
    name: "CI outside git local enabled",
    ci: true,
    root: "none",
    flags: { l: true },
    expected: {
      system: "ci-disabled",
      user: "ci-disabled",
      committed: "no-git-root",
      local: "no-git-root",
    },
  },
  {
    name: "CI explicit root",
    ci: true,
    root: "explicit",
    expected: {
      system: "ci-disabled",
      user: "ci-disabled",
      committed: "load",
      local: "ci-disabled",
    },
  },
  {
    name: "CI explicit root local enabled absent",
    ci: true,
    root: "explicit",
    flags: { l: true },
    absent: "local",
    expected: { system: "ci-disabled", user: "ci-disabled", committed: "load", local: "missing" },
  },
  {
    name: "CI system only",
    ci: true,
    root: "git",
    flags: { s: true },
    expected: { system: "load", user: "ci-disabled", committed: "load", local: "ci-disabled" },
  },
  {
    name: "CI user only",
    ci: true,
    root: "git",
    flags: { u: true },
    expected: { system: "ci-disabled", user: "load", committed: "load", local: "ci-disabled" },
  },
  {
    name: "CI local only",
    ci: true,
    root: "git",
    flags: { l: true },
    expected: { system: "ci-disabled", user: "ci-disabled", committed: "load", local: "load" },
  },
  {
    name: "CI all enabled",
    ci: true,
    root: "git",
    flags: { s: true, u: true, l: true },
    expected: { system: "load", user: "load", committed: "load", local: "load" },
  },
  {
    name: "CI all enabled system user absent",
    ci: true,
    root: "git",
    flags: { s: true, u: true, l: true },
    absent: "sysuser",
    expected: { system: "missing", user: "missing", committed: "load", local: "load" },
  },
  {
    name: "selected outside git",
    ci: false,
    root: "none",
    selected: true,
    expected: { system: "load", user: "load", committed: "selected", local: "selected-config" },
  },
  {
    name: "selected CI outside git",
    ci: true,
    root: "none",
    selected: true,
    expected: {
      system: "ci-disabled",
      user: "ci-disabled",
      committed: "selected",
      local: "selected-config",
    },
  },
  {
    name: "selected CI explicit root local enabled",
    ci: true,
    root: "explicit",
    selected: true,
    flags: { l: true },
    expected: {
      system: "ci-disabled",
      user: "ci-disabled",
      committed: "selected",
      local: "selected-config",
    },
  },
  {
    name: "selected CI git system enabled",
    ci: true,
    root: "git",
    selected: true,
    flags: { s: true },
    expected: {
      system: "load",
      user: "ci-disabled",
      committed: "selected",
      local: "selected-config",
    },
  },
  {
    name: "selected CI git user enabled",
    ci: true,
    root: "git",
    selected: true,
    flags: { u: true },
    expected: {
      system: "ci-disabled",
      user: "load",
      committed: "selected",
      local: "selected-config",
    },
  },
];

const buildFiles = (row: Row): Record<string, string> => {
  const files: Record<string, string> = {};
  const present = (layer: Layer): boolean => {
    if (row.absent === "all") return false;
    if (row.absent === "sysuser" && (layer === "system" || layer === "user")) return false;
    if (row.absent === "local" && layer === "local") return false;
    return true;
  };
  const add = (layer: Layer, path: string, outcome: Outcome): void => {
    if (outcome === "load") files[path] = `value: ${layer}`;
    else if (outcome !== "missing" && present(layer)) files[path] = "POISON-CANARY: [";
  };
  if (row.selected) {
    files[PATHS.selected] = "value: selected";
    add("local", PATHS.local, "selected-config");
  }
  add("system", PATHS.system, row.expected.system);
  add("user", PATHS.user, row.expected.user);
  if (!row.selected) add("committed", PATHS.committed, row.expected.committed);
  add("local", PATHS.local, row.expected.local);
  if (row.absent === "local" && row.expected.local === "missing") delete files[PATHS.local];
  return files;
};

const rootFacts = (row: Row): Pick<FileAcquisitionInput, "gitRoot" | "explicitProjectRoot"> => {
  if (row.root === "git") return { gitRoot: REPO, explicitProjectRoot: undefined };
  if (row.root === "explicit") return { gitRoot: undefined, explicitProjectRoot: REPO };
  return { gitRoot: undefined, explicitProjectRoot: undefined };
};

describe("TC-CONFIG-004/005/006 exact DM-2 first-match oracle with zero skipped reads", () => {
  for (const row of ROWS) {
    test(row.name, () => {
      const files = buildFiles(row);
      const fs = testFs(files);
      const result = ok(
        acquireFileConfig(
          input({
            environment: row.ci ? { CI: "true" } : {},
            ...rootFacts(row),
            ...(row.selected ? { selectedConfig: PATHS.selected } : {}),
            enableSystemConfig: row.flags?.s ?? false,
            enableUserConfig: row.flags?.u ?? false,
            enableProjectLocalConfig: row.flags?.l ?? false,
            fs,
          }),
        ),
      );
      const keyFor = (
        layer: "system" | "user-global" | "project-committed" | "project-local",
      ): Layer =>
        layer === "user-global"
          ? "user"
          : layer === "project-committed"
            ? "committed"
            : layer === "project-local"
              ? "local"
              : "system";
      const expectedLoaded = (
        ["system", "user-global", "project-committed", "project-local"] as const
      ).filter((layer) => {
        const outcome = row.expected[keyFor(layer)];
        return outcome === "load" || outcome === "selected";
      });
      expect(result.sources.map((source) => source.layer)).toEqual(expectedLoaded);
      const isSkip = (outcome: Outcome): outcome is Exclude<Outcome, "load" | "selected"> =>
        outcome !== "load" && outcome !== "selected";
      const expectedSkips = (
        ["system", "user-global", "project-committed", "project-local"] as const
      ).flatMap((layer) => {
        const outcome = row.expected[keyFor(layer)];
        return isSkip(outcome) ? [{ layer, reason: outcome }] : [];
      });
      expect(result.skipped).toEqual(expectedSkips);
      if (row.selected) {
        expect(
          result.sources.find((source) => source.layer === "project-committed")?.loadedFile,
        ).toEqual({
          layer: "project-committed",
          file: PATHS.selected,
        });
        expect(fs.reads.get(PATHS.local)).toBeUndefined();
      }
      if (row.expected.system === "ci-disabled") expect(fs.reads.get(PATHS.system)).toBeUndefined();
      if (row.expected.user === "ci-disabled") expect(fs.reads.get(PATHS.user)).toBeUndefined();
      if (row.expected.committed === "no-git-root")
        expect(fs.reads.get(PATHS.committed)).toBeUndefined();
      if (row.expected.local === "ci-disabled" || row.expected.local === "no-git-root") {
        expect(fs.reads.get(PATHS.local)).toBeUndefined();
      }
    });
  }

  test("selected file errors are failures with the actual path and no invented line", () => {
    const missing = acquireFileConfig(
      input({ selectedConfig: "/missing/config.yaml", fs: testFs({}), gitRoot: undefined }),
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error).toMatchObject({
        kind: "config",
        code: "config.value.invalid",
        layer: "project-committed",
        file: "/missing/config.yaml",
      });
      expect(missing.error).not.toHaveProperty("line");
    }
    const unreadable = acquireFileConfig(
      input({
        selectedConfig: "/unreadable/config.yaml",
        fs: {
          exists: () => true,
          readText: () => {
            throw new Error("unreadable");
          },
        },
      }),
    );
    expect(unreadable.ok).toBe(false);
    if (!unreadable.ok) expect(unreadable.error.file).toBe("/unreadable/config.yaml");
  });

  test("selection wins over an existing committed root file", () => {
    const fs = testFs({
      [PATHS.committed]: "value: committed",
      [PATHS.selected]: "value: selected",
    });
    const result = ok(acquireFileConfig(input({ selectedConfig: PATHS.selected, fs })));
    expect(result.sources[0]?.loadedFile?.file).toBe(PATHS.selected);
    expect(fs.reads.get(PATHS.committed)).toBeUndefined();
  });
});

describe("TC-CONFIG-004 root-only git discovery and worktree gitfile", () => {
  test("finds a normal .git directory and a linked-worktree .git file, never above the first marker", () => {
    mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true });
    const directory = mkdtempSync(join(ROOT, "tmp", "tmpdir", "repo-root-"));
    try {
      const root = join(directory, "project");
      const nested = join(root, "nested", "deeper");
      mkdirSync(nested, { recursive: true });
      mkdirSync(join(root, ".git"));
      expect(findGitRoot(nested, nodeRepositoryIo())).toBe(root);
      const worktree = join(directory, "worktree");
      const worktreeNested = join(worktree, "nested");
      mkdirSync(worktreeNested, { recursive: true });
      writeFileSync(join(worktree, ".git"), "gitdir: /elsewhere/.git/worktrees/wt\n");
      expect(findGitRoot(worktreeNested, nodeRepositoryIo())).toBe(worktree);
      const outside = join(directory, "outside");
      mkdirSync(outside, { recursive: true });
      const noRootIo = {
        exists: () => false,
        isFile: () => false,
        readText: () => "",
      };
      expect(findGitRoot(outside, noRootIo)).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("reads only the root files, never intermediate or above-root decoys", () => {
    mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true });
    const directory = mkdtempSync(join(ROOT, "tmp", "tmpdir", "root-bounds-"));
    try {
      const root = join(directory, "repo");
      const nested = join(root, "nested");
      mkdirSync(join(root, DIR), { recursive: true });
      mkdirSync(join(nested, DIR), { recursive: true });
      mkdirSync(join(directory, DIR), { recursive: true });
      writeFileSync(join(root, DIR, "config.yaml"), "value: root");
      writeFileSync(join(nested, DIR, "config.yaml"), "POISON-CANARY: [");
      writeFileSync(join(directory, DIR, "config.yaml"), "POISON-CANARY: [");
      const fs = testFs({ [join(root, DIR, "config.yaml")]: "value: root" });
      const result = ok(acquireFileConfig(input({ gitRoot: root, fs })));
      expect(result.sources[0]?.values).toEqual({ value: "root" });
      expect(fs.reads.size).toBe(1);
      expect(fs.reads.get(join(nested, DIR, "config.yaml"))).toBeUndefined();
      expect(fs.reads.get(join(directory, DIR, "config.yaml"))).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("TC-CONFIG-012/013 neutral environment fact feed", () => {
  test("removes only explicit recognized names, never inferred extension keys", () => {
    const facts = neutralEnvironmentFacts(
      {
        DELIVERY_OS_WORKING_NAME: "neutral",
        SYNTH_CONFIG: "/selected.yaml",
        SYNTH_LEGACY_ALIAS: "old",
        SYNTH_UNMAPPED: "must reach core validation",
        UNRELATED: "ignored by prefix",
      },
      ["DELIVERY_OS_WORKING_NAME", "SYNTH_CONFIG", "SYNTH_LEGACY_ALIAS"],
    );
    expect(facts).toEqual({
      SYNTH_UNMAPPED: "must reach core validation",
      UNRELATED: "ignored by prefix",
    });
  });
});

describe("TC-CONFIG-024 legacy facts: current names win and warn once", () => {
  const current = { environmentPrefix: "SYNTH_", configDirectoryName: ".synthetic" } as const;

  test("maps legacy names but keeps current values and selector on collision", () => {
    mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true });
    const home = mkdtempSync(join(ROOT, "tmp", "tmpdir", "legacy-config-"));
    try {
      const compat = createLegacyCompat({ current, warn: () => undefined });
      const facts = compat.resolveConfigFacts({
        facts: { ADOS_TOKEN: "legacy-token", ADOS_CONFIG: "/legacy/config.yaml" },
        environment: { SYNTH_TOKEN: "current-token", SYNTH_CONFIG: "/current/config.yaml" },
        homeDirectory: home,
      });
      expect(facts.environment.SYNTH_TOKEN).toBe("current-token");
      expect(facts.environment.SYNTH_CONFIG).toBe("/current/config.yaml");
      expect(facts.selectedConfig).toBe("/current/config.yaml");
      expect(facts.configDirectoryPath).toBe(join(home, ".synthetic"));
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("legacy-only selector is mapped to the current name", () => {
    mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true });
    const home = mkdtempSync(join(ROOT, "tmp", "tmpdir", "legacy-selector-"));
    try {
      const compat = createLegacyCompat({ current, warn: () => undefined });
      const facts = compat.resolveConfigFacts({
        facts: { ADOS_CONFIG: "/legacy/config.yaml" },
        environment: {},
        homeDirectory: home,
      });
      expect(facts.environment.SYNTH_CONFIG).toBe("/legacy/config.yaml");
      expect(facts.selectedConfig).toBe("/legacy/config.yaml");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("warns exactly once per instance and never without a legacy source", () => {
    mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true });
    const home = mkdtempSync(join(ROOT, "tmp", "tmpdir", "legacy-warn-"));
    try {
      const messages: string[] = [];
      const compat = createLegacyCompat({ current, warn: (message) => messages.push(message) });
      compat.resolveConfigFacts({
        facts: { ADOS_TOKEN: "x" },
        environment: {},
        homeDirectory: home,
      });
      compat.resolveConfigFacts({
        facts: { ADOS_TOKEN: "x" },
        environment: {},
        homeDirectory: home,
      });
      expect(messages).toHaveLength(1);
      const quiet: string[] = [];
      const clean = createLegacyCompat({ current, warn: (message) => quiet.push(message) });
      clean.resolveConfigFacts({ facts: {}, environment: {}, homeDirectory: home });
      expect(quiet).toEqual([]);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
