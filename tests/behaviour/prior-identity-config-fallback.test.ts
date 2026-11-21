/**
 * GH-320 TC-BIN-020..026 and TC-BIN-013 (configuration half) — the prior-identity
 * project-configuration read.
 *
 * The read is per eligible repository-owned layer, current-wins, read-only, and
 * exercised through the delivered composition-time acquisition on the ticket's
 * literal `status --json` surface; machine-global layers and an explicitly
 * selected file never fall back. Origin truth is asserted through the in-process
 * configuration inspection resolution, never through a `config` CLI surface.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createConfigProgram } from "../../packages/cli/src/edge";
import {
  countingFs,
  laneYaml,
  runThroughComposition,
  SHAPES,
  scratchCheckout,
  scratchHome,
} from "../fixtures/entrypoint/prior-identity/harness";
import { goldenNotice } from "../fixtures/namespace/golden/notices";

const PRIOR_DIR = ".delivery-os";
const CURRENT_DIR = ".jaiship";

type ConfigRun = {
  readonly exitCode?: number;
  readonly data?: unknown;
  readonly warnings?: readonly string[];
  readonly error?: { readonly code?: string };
};

/** Run the in-process configuration inspection resolution. */
const resolveConfig = async (input: {
  readonly checkout: string;
  readonly home: string;
  readonly files: Readonly<Record<string, string>>;
  readonly selected?: string;
  readonly strict?: boolean;
  readonly positionals?: readonly string[];
  readonly flags?: Readonly<Record<string, string | true>>;
  readonly workingName?: string;
  readonly priorDirectory?: string | undefined;
}): Promise<ConfigRun & { readonly fs: ReturnType<typeof countingFs> }> => {
  const fs = countingFs();
  const program = createConfigProgram({
    workingName: input.workingName ?? "jaiship",
    environment: { HOME: input.home },
    cwd: input.checkout,
    homeDirectory: input.home,
    ...(input.priorDirectory === undefined
      ? {}
      : { priorConfigurationDirectoryName: input.priorDirectory }),
    fs,
  });
  if (!program.ok) throw new Error("the config program did not compose");
  const definition = program.program.commands.config;
  if (definition === undefined) throw new Error("the config command is not composed");
  const flags: Record<string, string | true> = {
    ...(input.selected === undefined ? {} : { "--config": input.selected }),
    ...(input.strict === true ? { "--strict": true } : {}),
    ...input.flags,
  };
  const result = (await definition.handler({
    command: "config",
    flags,
    argv: [],
    positionals: input.positionals ?? [],
    brand: program.brand,
  } as never)) as ConfigRun;
  return { ...result, fs };
};

/** A recursive snapshot of one tree: path, size, mode, mtime, digest. */
const snapshot = (root: string): readonly string[] => {
  const entries: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = statSync(path);
      entries.push(
        `${relative(root, path)}|${stat.size}|${stat.mode}|${stat.mtimeMs}|` +
          createHash("sha256").update(readFileSync(path)).digest("hex"),
      );
    }
  };
  walk(root);
  return entries.sort();
};

const withTrees = async <T>(
  body: (trees: {
    readonly checkout: ReturnType<typeof scratchCheckout>;
    readonly home: ReturnType<typeof scratchHome>;
  }) => Promise<T>,
  files: Readonly<Record<string, string>>,
  homeFiles: Readonly<Record<string, string>> = {},
): Promise<T> => {
  const checkout = scratchCheckout("config", files);
  const home = scratchHome("config-home", homeFiles);
  try {
    return await body({ checkout, home });
  } finally {
    checkout.dispose();
    home.dispose();
  }
};

describe("TC-BIN-020 status --json reads the prior file as project-committed", () => {
  test("prior-read: the delivered acquisition reads the prior file and notices once", async () => {
    await withTrees(async ({ checkout, home }) => {
      const priorRoot = join(checkout.root, PRIOR_DIR);
      const before = snapshot(priorRoot);
      const run = await runThroughComposition({
        bin: "jaiship",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(run.exitCode).toBe(0);
      const payload = JSON.parse(run.stdout) as { readonly data?: unknown };
      expect(payload.data).toBeDefined();
      expect(snapshot(priorRoot)).toEqual(before);
      const priorFile = join(checkout.root, PRIOR_DIR, "config.yaml");
      expect(run.fs.readCalls).toContain(priorFile);
      const currentFile = join(checkout.root, CURRENT_DIR, "config.yaml");
      const notices = run.notices.filter((line) => line.includes("config-read"));
      expect(notices).toHaveLength(1);
      expect(notices[0]?.trimEnd()).toBe(goldenNotice("config-read", priorFile, currentFile));
      expect(run.stdout).not.toContain("prior-identity-fallback");
    }, SHAPES.configOnly);
  });

  test("prior-read: the acquisition count equals the alias control, so no read is added", async () => {
    await withTrees(async ({ checkout, home }) => {
      const next = await runThroughComposition({
        bin: "jaiship",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      const control = await runThroughComposition({
        bin: "delivery-os",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      const configReads = (paths: readonly string[]): number =>
        paths.filter((path) => path.endsWith("config.yaml") || path.endsWith("config.local.yaml"))
          .length;
      expect(configReads(next.fs.readCalls)).toBe(configReads(control.fs.readCalls));
    }, SHAPES.configOnly);
  });

  test("prior-read: the recorded origin is the prior absolute path, never a laundered one", async () => {
    await withTrees(async ({ checkout, home }) => {
      const priorFile = join(checkout.root, PRIOR_DIR, "config.yaml");
      const run = await resolveConfig({
        checkout: checkout.root,
        home: home.root,
        files: SHAPES.configOnly,
        priorDirectory: PRIOR_DIR,
        positionals: ["debug"],
      });
      expect(run.error).toBeUndefined();
      const data = run.data as {
        readonly origins: Readonly<Record<string, string>>;
        readonly loadedFiles: readonly string[];
      };
      expect(data.loadedFiles).toContain(priorFile);
      const laneOrigin = Object.entries(data.origins).find(([key]) =>
        key.startsWith("lane.restart-budget"),
      );
      expect(laneOrigin?.[1]).toContain(priorFile);
      expect(run.fs.readCalls).toContain(priorFile);
    }, SHAPES.configOnly);
  });

  test("prior-read: `config --json` remains unreachable through the executable", async () => {
    await withTrees(async ({ checkout, home }) => {
      const run = await runThroughComposition({
        bin: "jaiship",
        argv: ["config", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(run.exitCode).toBe(2);
      const payload = JSON.parse(run.stdout) as { readonly error?: { readonly code?: string } };
      expect(payload.error?.code).toBe("fallback.internal");
    }, SHAPES.configOnly);
  });
});

describe("TC-BIN-021 the current file wins and the prior file is reported not used", () => {
  test("current-wins: the current value wins, the prior file is never opened", async () => {
    const files = {
      [`${CURRENT_DIR}/config.yaml`]: laneYaml(3),
      [`${PRIOR_DIR}/config.yaml`]: laneYaml(9),
    } as const;
    await withTrees(async ({ checkout, home }) => {
      const run = await resolveConfig({
        checkout: checkout.root,
        home: home.root,
        files,
        priorDirectory: PRIOR_DIR,
        positionals: ["get", "lane.restart-budget"],
        flags: { "--show-origin": true },
      });
      expect(run.error).toBeUndefined();
      const data = run.data as { readonly value?: unknown; readonly origin?: string };
      expect(data.value).toBe(3);
      expect(data.origin).toContain(join(checkout.root, CURRENT_DIR, "config.yaml"));
      expect(run.fs.readCalls).not.toContain(join(checkout.root, PRIOR_DIR, "config.yaml"));
    }, files);
  });

  test("current-wins: a composed run reports the prior presence once as config-skipped", async () => {
    const files = {
      [`${CURRENT_DIR}/config.yaml`]: laneYaml(3),
      [`${PRIOR_DIR}/config.yaml`]: laneYaml(9),
    } as const;
    await withTrees(async ({ checkout, home }) => {
      const run = await runThroughComposition({
        bin: "jaiship",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(run.exitCode).toBe(0);
      const skipped = run.notices.filter((line) => line.includes("config-skipped"));
      expect(skipped).toHaveLength(1);
      expect(skipped[0]?.trimEnd()).toBe(
        goldenNotice(
          "config-skipped",
          join(checkout.root, PRIOR_DIR, "config.yaml"),
          join(checkout.root, CURRENT_DIR, "config.yaml"),
        ),
      );
      expect(run.notices.some((line) => line.includes("config-read"))).toBe(false);
    }, files);
  });
});

describe("TC-BIN-022 repository-owned layers fall back independently", () => {
  test("per-layer: the prior local file is read while the current committed file wins", async () => {
    await withTrees(async ({ checkout, home }) => {
      const run = await resolveConfig({
        checkout: checkout.root,
        home: home.root,
        files: SHAPES.mixedLayers,
        priorDirectory: PRIOR_DIR,
        positionals: ["debug"],
      });
      const data = run.data as {
        readonly origins: Readonly<Record<string, string>>;
        readonly loadedFiles: readonly string[];
      };
      const priorLocal = join(checkout.root, PRIOR_DIR, "config.local.yaml");
      const currentCommitted = join(checkout.root, CURRENT_DIR, "config.yaml");
      expect(data.loadedFiles).toContain(priorLocal);
      expect(data.loadedFiles).toContain(currentCommitted);
      const lane = Object.entries(data.origins).find(([key]) =>
        key.startsWith("lane.restart-budget"),
      );
      expect(lane?.[1]).toContain(priorLocal);
      expect(run.fs.readCalls).toContain(priorLocal);
    }, SHAPES.mixedLayers);
  });

  test("per-layer: a local-only prior file is read as project-local", async () => {
    await withTrees(async ({ checkout, home }) => {
      const run = await resolveConfig({
        checkout: checkout.root,
        home: home.root,
        files: SHAPES.localOnly,
        priorDirectory: PRIOR_DIR,
        positionals: ["debug"],
      });
      const data = run.data as {
        readonly origins: Readonly<Record<string, string>>;
        readonly skippedLayers: readonly { readonly layer: string; readonly reason: string }[];
      };
      expect(data.skippedLayers).toContainEqual({ layer: "project-committed", reason: "missing" });
      const lane = Object.entries(data.origins).find(([key]) =>
        key.startsWith("lane.restart-budget"),
      );
      expect(lane?.[1]).toContain(join(checkout.root, PRIOR_DIR, "config.local.yaml"));
    }, SHAPES.localOnly);
  });
});

describe("TC-BIN-023 an explicitly selected file disables every fallback", () => {
  test("selected-config: the selected file wins and no layer falls back", async () => {
    const files = {
      "selected.yaml": laneYaml(2),
      ...SHAPES.bothLayers,
    } as const;
    await withTrees(async ({ checkout, home }) => {
      const selected = join(checkout.root, "selected.yaml");
      const run = await resolveConfig({
        checkout: checkout.root,
        home: home.root,
        files,
        priorDirectory: PRIOR_DIR,
        selected,
        positionals: ["debug"],
      });
      expect(run.error).toBeUndefined();
      const data = run.data as {
        readonly loadedFiles: readonly string[];
        readonly skippedLayers: readonly { readonly layer: string; readonly reason: string }[];
      };
      expect(data.loadedFiles).toEqual([selected]);
      expect(data.skippedLayers).toContainEqual({
        layer: "project-local",
        reason: "selected-config",
      });
      expect(run.fs.readCalls).not.toContain(join(checkout.root, PRIOR_DIR, "config.yaml"));
    }, files);
  });

  test("selected-config: a missing selected file fails naming the selected path", async () => {
    await withTrees(async ({ checkout, home }) => {
      const missing = join(checkout.root, "absent.yaml");
      const run = await resolveConfig({
        checkout: checkout.root,
        home: home.root,
        files: SHAPES.bothLayers,
        priorDirectory: PRIOR_DIR,
        selected: missing,
      });
      expect(run.error?.code).toBe("config.value.invalid");
    }, SHAPES.bothLayers);
  });
});

describe("TC-BIN-024 machine-global layers never fall back", () => {
  test("global-layers: the user-global layer reads only the current identity", async () => {
    const homeFiles = {
      ".config/.jaiship/config.yaml": laneYaml(13),
      ".config/.delivery-os/config.yaml": laneYaml(17),
    } as const;
    await withTrees(
      async ({ checkout, home }) => {
        const run = await resolveConfig({
          checkout: checkout.root,
          home: home.root,
          files: SHAPES.noConfig,
          priorDirectory: PRIOR_DIR,
          flags: { "--enable-user-config": true },
          positionals: ["debug"],
        });
        const data = run.data as { readonly loadedFiles: readonly string[] };
        expect(data.loadedFiles).toContain(join(home.root, ".config", CURRENT_DIR, "config.yaml"));
        expect(data.loadedFiles).not.toContain(
          join(home.root, ".config", PRIOR_DIR, "config.yaml"),
        );
        expect(run.fs.readCalls).not.toContain(
          join(home.root, ".config", PRIOR_DIR, "config.yaml"),
        );
      },
      SHAPES.noConfig,
      homeFiles,
    );
  });

  test("global-layers: with only the prior global file the layer records missing", async () => {
    const homeFiles = { ".config/.delivery-os/config.yaml": laneYaml(17) } as const;
    await withTrees(
      async ({ checkout, home }) => {
        const run = await resolveConfig({
          checkout: checkout.root,
          home: home.root,
          files: SHAPES.noConfig,
          priorDirectory: PRIOR_DIR,
          flags: { "--enable-user-config": true },
          positionals: ["debug"],
        });
        const data = run.data as {
          readonly skippedLayers: readonly { readonly layer: string; readonly reason: string }[];
        };
        expect(data.skippedLayers).toContainEqual({ layer: "user-global", reason: "missing" });
        expect(run.fs.readCalls).not.toContain(
          join(home.root, ".config", PRIOR_DIR, "config.yaml"),
        );
      },
      SHAPES.noConfig,
      homeFiles,
    );
  });
});

describe("TC-BIN-025 the prior directory is untouched and no path is laundered", () => {
  test("read-only: the prior directory is byte-identical after a fallback read", async () => {
    await withTrees(
      async ({ checkout, home }) => {
        const before = snapshot(join(checkout.root, PRIOR_DIR));
        const sentinelBefore = snapshot(checkout.root).filter((entry) =>
          entry.startsWith("sentinel.txt|"),
        );
        const run = await runThroughComposition({
          bin: "jaiship",
          argv: ["status", "--json"],
          checkout: checkout.root,
          home: home.root,
        });
        expect(run.exitCode).toBe(0);
        expect(snapshot(join(checkout.root, PRIOR_DIR))).toEqual(before);
        expect(
          snapshot(checkout.root).filter((entry) => entry.startsWith("sentinel.txt|")),
        ).toEqual(sentinelBefore);
        expect(existsSync(join(checkout.root, CURRENT_DIR))).toBe(false);
      },
      {
        ...SHAPES.bothLayers,
        "sentinel.txt": "sentinel\n",
      },
    );
  });

  test("read-only: every prior-supplied origin is the prior path", async () => {
    await withTrees(async ({ checkout, home }) => {
      const run = await resolveConfig({
        checkout: checkout.root,
        home: home.root,
        files: SHAPES.configOnly,
        priorDirectory: PRIOR_DIR,
        positionals: ["debug"],
      });
      const data = run.data as { readonly origins: Readonly<Record<string, string>> };
      const laundered = Object.values(data.origins).filter(
        (origin) => origin.includes(CURRENT_DIR) && !origin.includes(PRIOR_DIR),
      );
      expect(laundered).toEqual([]);
    }, SHAPES.configOnly);
  });
});

describe("TC-BIN-026 --strict semantics are unchanged by a fallback read", () => {
  test("strict: a prior read behaves exactly like a current read under --strict", async () => {
    // The strict outcome is delivered behaviour for the same bytes; the fallback
    // adds no strictness of its own. The equivalence is the assertion.
    const priorRead = await (async () => {
      let outcome: ConfigRun = {};
      await withTrees(async ({ checkout, home }) => {
        outcome = await resolveConfig({
          checkout: checkout.root,
          home: home.root,
          files: SHAPES.configOnly,
          priorDirectory: PRIOR_DIR,
          strict: true,
          positionals: ["debug"],
        });
      }, SHAPES.configOnly);
      return outcome;
    })();
    const currentRead = await (async () => {
      let outcome: ConfigRun = {};
      const files = { [`${CURRENT_DIR}/config.yaml`]: laneYaml(4) } as const;
      await withTrees(async ({ checkout, home }) => {
        outcome = await resolveConfig({
          checkout: checkout.root,
          home: home.root,
          files,
          priorDirectory: PRIOR_DIR,
          strict: true,
          positionals: ["debug"],
        });
      }, files);
      return outcome;
    })();
    expect(priorRead.error?.code).toBe(currentRead.error?.code);
    expect(priorRead.error?.code).not.toBeUndefined();
    expect(priorRead.warnings ?? []).toEqual(
      (currentRead.warnings ?? []).map((warning) => warning.replace(CURRENT_DIR, PRIOR_DIR)),
    );
  });

  test("strict: the composed notice is separate from the warning channel", async () => {
    await withTrees(async ({ checkout, home }) => {
      const run = await runThroughComposition({
        bin: "jaiship",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(run.exitCode).toBe(0);
      const payload = JSON.parse(run.stdout) as { readonly warnings?: readonly string[] };
      expect(payload.warnings ?? []).toEqual([]);
      expect(run.notices.some((line) => line.includes("config-read"))).toBe(true);
    }, SHAPES.configOnly);
  });
});

describe("TC-BIN-013 the alias never reads forward", () => {
  test("alias: the alias declares no prior identity and performs no fallback", async () => {
    await withTrees(async ({ checkout, home }) => {
      const run = await runThroughComposition({
        bin: "delivery-os",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(run.exitCode).toBe(0);
      expect(run.notices).toEqual([]);
      expect(run.fs.readCalls).toContain(join(checkout.root, PRIOR_DIR, "config.yaml"));
    }, SHAPES.configOnly);
  });

  test("alias: a .jaiship file is not read forward", async () => {
    const files = { [`${CURRENT_DIR}/config.yaml`]: laneYaml(3) } as const;
    await withTrees(async ({ checkout, home }) => {
      const run = await runThroughComposition({
        bin: "delivery-os",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(run.exitCode).toBe(0);
      expect(run.fs.readCalls).not.toContain(join(checkout.root, CURRENT_DIR, "config.yaml"));
      expect(run.notices).toEqual([]);
    }, files);
  });
});
