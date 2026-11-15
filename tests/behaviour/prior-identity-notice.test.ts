/**
 * GH-320 TC-BIN-040..045 — the prior-identity fallback notice.
 *
 * One classification token, four closed reasons, at most one line per source kind
 * per composed program (once per process in production, where one composed
 * program exists per process), on stderr in every mode including `--json`, never
 * in a payload, never an exit-code change, and distinct from both delivered
 * warnings.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { createProductionComposer } from "../../packages/cli/src/production";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
import {
  laneYaml,
  runThroughComposition,
  SHAPES,
  scratchCheckout,
  scratchHome,
} from "../fixtures/entrypoint/prior-identity";
import { bufferSink } from "../golden/helpers";

const PRIOR_ROOT = ".delivery-os-state";
const CURRENT_ROOT = ".jaiship-state";
const CURRENT_CONFIG_DIR = ".jaiship";
const CONFIG_ONLY = SHAPES.configOnly;
const NO_CONFIG = SHAPES.noConfig;

const withTrees = async <T>(
  body: (trees: {
    readonly checkout: ReturnType<typeof scratchCheckout>;
    readonly home: ReturnType<typeof scratchHome>;
  }) => Promise<T>,
  homeFiles: Readonly<Record<string, string>> = {},
  checkoutFiles: Readonly<Record<string, string>> = CONFIG_ONLY,
): Promise<T> => {
  const checkout = scratchCheckout("notice", checkoutFiles);
  const home = scratchHome("notice-home", homeFiles);
  try {
    return await body({ checkout, home });
  } finally {
    checkout.dispose();
    home.dispose();
  }
};

// A populated prior root with no legacy store artifact at its top level: the
// pre-GH-288 warning and the host-index maintenance stay out of these cells.
const priorRootFiles = {
  [`${PRIOR_ROOT}/projects/seed/edge.log`]: '{"kind":"delivery.seed"}\n',
} as const;

const brandOf = (workingName: string) => {
  const resolved = resolveBrandIdentity({ workingName });
  if (!resolved.ok) throw new Error(`the resolver rejected ${workingName}`);
  return resolved.value;
};

describe("TC-BIN-040 exactly one notice per source kind per composed program", () => {
  test("once-per-source: --json emits two stderr notices and one clean payload", async () => {
    await withTrees(async ({ checkout, home }) => {
      const run = await runThroughComposition({
        bin: "jaiship",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(run.exitCode).toBe(0);
      expect(run.notices).toHaveLength(2);
      expect(run.notices.filter((line) => line.includes("config-read"))).toHaveLength(1);
      expect(run.notices.filter((line) => line.includes("state-read"))).toHaveLength(1);
      const payload = JSON.parse(run.stdout) as { readonly data?: unknown };
      expect(payload.data).toBeDefined();
      expect(run.stdout).not.toContain("prior-identity-fallback");
      expect(run.stderr).toBe("");
    }, priorRootFiles);
  });

  test("once-per-source: the human mode carries the same notices and no payload text", async () => {
    await withTrees(async ({ checkout, home }) => {
      const run = await runThroughComposition({
        bin: "jaiship",
        argv: ["status"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(run.exitCode).toBe(0);
      expect(run.notices).toHaveLength(2);
      expect(run.stdout).not.toContain("prior-identity-fallback");
    }, priorRootFiles);
  });

  test("once-per-source: the control fixture emits nothing", async () => {
    await withTrees(
      async ({ checkout, home }) => {
        const run = await runThroughComposition({
          bin: "jaiship",
          argv: ["status", "--json"],
          checkout: checkout.root,
          home: home.root,
        });
        expect(run.exitCode).toBe(0);
        expect(run.notices).toEqual([]);
      },
      {},
      NO_CONFIG,
    );
  });

  test("once-per-source: the real subprocess stderr is the channel", () => {
    const checkout = scratchCheckout("notice-subprocess", CONFIG_ONLY);
    const home = scratchHome("notice-subprocess-home", { ...priorRootFiles });
    try {
      const result = spawnSync(
        "bun",
        [join(process.cwd(), "packages/cli/bin/jaiship.ts"), "status", "--json"],
        {
          cwd: checkout.root,
          encoding: "utf8",
          env: { PATH: process.env.PATH ?? "", HOME: home.root },
        },
      );
      expect(result.status).toBe(0);
      expect(result.stderr).toContain("prior-identity-fallback: config-read");
      expect(result.stderr).toContain("prior-identity-fallback: state-read");
      expect(result.stdout).not.toContain("prior-identity-fallback");
    } finally {
      checkout.dispose();
      home.dispose();
    }
  });
});

describe("TC-BIN-041 repeat resolutions add nothing; a second program emits its own", () => {
  test("repeat-resolution: two handler runs on one composed program emit once per kind", async () => {
    const checkout = scratchCheckout("notice-repeat", CONFIG_ONLY);
    const home = scratchHome("notice-repeat-home", { ...priorRootFiles });
    try {
      const notices: string[] = [];
      const environment = { PATH: process.env.PATH, HOME: home.root };
      const composer = createProductionComposer({
        environment,
        cwd: checkout.root,
        homeDirectory: home.root,
        workingName: "jaiship",
        noticeSink: { write: (chunk) => notices.push(chunk) },
      });
      const program = composer(brandOf("jaiship"), {
        command: "status",
        groupScoped: false,
        priorWorkingName: "delivery-os",
      });
      const status = program.commands.status;
      expect(status).toBeDefined();
      const invocation = {
        command: "status",
        flags: {},
        argv: [],
        positionals: [],
        brand: brandOf("jaiship"),
      } as never;
      await status?.handler(invocation);
      expect(notices).toHaveLength(2);
      await status?.handler(invocation);
      expect(notices).toHaveLength(2);

      // A second composed program over the same fixture emits its own once.
      composer(brandOf("jaiship"), {
        command: "status",
        groupScoped: false,
        priorWorkingName: "delivery-os",
      });
      expect(notices).toHaveLength(4);
    } finally {
      checkout.dispose();
      home.dispose();
    }
  });

  test("repeat-resolution: a fresh process emits again", async () => {
    const checkout = scratchCheckout("notice-process", CONFIG_ONLY);
    const home = scratchHome("notice-process-home", { ...priorRootFiles });
    try {
      const env = { PATH: process.env.PATH ?? "", HOME: home.root };
      for (let run = 0; run < 2; run += 1) {
        const result = spawnSync(
          "bun",
          [join(process.cwd(), "packages/cli/bin/jaiship.ts"), "status", "--json"],
          { cwd: checkout.root, encoding: "utf8", env },
        );
        expect(result.status).toBe(0);
        expect(result.stderr).toContain("prior-identity-fallback: state-read");
      }
    } finally {
      checkout.dispose();
      home.dispose();
    }
  });
});

describe("TC-BIN-042 no notice appears when no fallback applies", () => {
  test("no-fallback: a current-only fixture, self-description, and the alias are silent", async () => {
    const currentOnly = { [`${CURRENT_CONFIG_DIR}/config.yaml`]: laneYaml(3) } as const;
    await withTrees(
      async ({ checkout, home }) => {
        const composed = await runThroughComposition({
          bin: "jaiship",
          argv: ["status", "--json"],
          checkout: checkout.root,
          home: home.root,
        });
        expect(composed.notices).toEqual([]);
        for (const read of ["--version", "--help", "--print-install-path"]) {
          const run = await runThroughComposition({
            bin: "jaiship",
            argv: [read],
            checkout: checkout.root,
            home: home.root,
          });
          expect({ read, notices: run.notices }).toEqual({ read, notices: [] });
        }
        const alias = await runThroughComposition({
          bin: "delivery-os",
          argv: ["status", "--json"],
          checkout: checkout.root,
          home: home.root,
        });
        expect(alias.notices).toEqual([]);
      },
      {},
      currentOnly,
    );
  });

  test("no-fallback: the positive control in this suite still emits", async () => {
    await withTrees(async ({ checkout, home }) => {
      const run = await runThroughComposition({
        bin: "jaiship",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(run.notices.length).toBeGreaterThan(0);
    }, priorRootFiles);
  });
});

describe("TC-BIN-043 the notice text is bounded, classified, and redaction-safe", () => {
  const PATTERN =
    /^prior-identity-fallback: (config-read|config-skipped|state-read|state-skipped) /u;

  const assertContract = (line: string, prior: string, current: string): void => {
    const body = line.endsWith("\n") ? line.slice(0, -1) : line;
    expect(body).toMatch(PATTERN);
    expect(body).toContain(prior);
    expect(body).toContain(current);
    expect(body.toLowerCase()).toContain("nothing was moved, copied, or deleted");
    expect(body).not.toContain("\n");
    expect(body.length).toBeLessThanOrEqual(400);
  };

  test("text-contract: all four reasons carry the token, both locations, and the no-move statement", async () => {
    // config-read + state-read.
    await withTrees(
      async ({ checkout, home }) => {
        const run = await runThroughComposition({
          bin: "jaiship",
          argv: ["status", "--json"],
          checkout: checkout.root,
          home: home.root,
        });
        const read = run.notices.find((line) => line.includes("config-read"));
        const state = run.notices.find((line) => line.includes("state-read"));
        expect(read).toBeDefined();
        expect(state).toBeDefined();
        assertContract(
          read ?? "",
          join(checkout.root, ".delivery-os", "config.yaml"),
          join(checkout.root, ".jaiship", "config.yaml"),
        );
        assertContract(state ?? "", join(home.root, PRIOR_ROOT), join(home.root, CURRENT_ROOT));
        expect(read).not.toContain("canary-secret-value");
      },
      {
        ...priorRootFiles,
        [`${PRIOR_ROOT}/projects/seed/payload.json`]: '{"canary":"canary-secret-value"}\n',
      },
    );

    // config-skipped + state-skipped.
    const both = {
      [`${CURRENT_CONFIG_DIR}/config.yaml`]: laneYaml(3),
      ".delivery-os/config.yaml": laneYaml(4),
    } as const;
    await withTrees(
      async ({ checkout, home }) => {
        const run = await runThroughComposition({
          bin: "jaiship",
          argv: ["status", "--json"],
          checkout: checkout.root,
          home: home.root,
        });
        const config = run.notices.find((line) => line.includes("config-skipped"));
        const state = run.notices.find((line) => line.includes("state-skipped"));
        expect(config).toBeDefined();
        expect(state).toBeDefined();
        assertContract(
          config ?? "",
          join(checkout.root, ".delivery-os", "config.yaml"),
          join(checkout.root, ".jaiship", "config.yaml"),
        );
        assertContract(state ?? "", join(home.root, PRIOR_ROOT), join(home.root, CURRENT_ROOT));
      },
      { ...priorRootFiles, [`${CURRENT_ROOT}/host-index.json`]: "{}\n" },
      both,
    );
  });

  test("text-contract: the reason vocabulary is closed", async () => {
    const seen = new Set<string>();
    await withTrees(async ({ checkout, home }) => {
      const run = await runThroughComposition({
        bin: "jaiship",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      for (const line of run.notices) {
        const match = PATTERN.exec(line);
        if (match?.[1] !== undefined) seen.add(match[1]);
      }
    }, priorRootFiles);
    expect([...seen].sort()).toEqual(["config-read", "state-read"]);
  });
});

describe("TC-BIN-044 the new notice is distinct from both delivered warnings", () => {
  test("distinctness: prior notice, store warning, and legacy notice are separate lines", async () => {
    const legacyHome = {
      // A pre-GH-288 store artifact at the prior root while no project root exists.
      [`${PRIOR_ROOT}/edge.log`]: '{"kind":"delivery.seed"}\n',
      // The legacy compatibility trigger.
      ".ados/marker": "pre-freeze\n",
    } as const;
    await withTrees(async ({ checkout, home }) => {
      const run = await runThroughComposition({
        bin: "jaiship",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
        extra: { ADOS_TRACKER_TOKEN: "legacy-token" },
      });
      expect(run.exitCode).toBe(0);
      const prior = run.notices.filter((line) => line.includes("prior-identity-fallback:"));
      expect(prior.length).toBeGreaterThan(0);
      // The two delivered notices are their own concepts and never reuse the
      // new token; the suite asserts the token is not borrowed by them by
      // checking every prior line carries one of the four reasons.
      for (const line of prior) {
        expect(line).toMatch(
          /^prior-identity-fallback: (config-read|config-skipped|state-read|state-skipped) /u,
        );
      }
      const payload = JSON.parse(run.stdout) as { readonly warnings?: readonly string[] };
      for (const warning of payload.warnings ?? []) {
        expect(warning).not.toContain("prior-identity-fallback");
      }
    }, legacyHome);
  });
});

describe("TC-BIN-045 the notice changes no payload and no exit projection", () => {
  const stable = (text: string, replacements: readonly (readonly [string, string])[]): string => {
    let value = text;
    for (const [from, to] of replacements) value = value.split(from).join(to);
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const { runId: _runId, timing: _timing, ...rest } = parsed;
    // The two scratch checkouts are distinct repositories: the clock and the
    // commit identity are normalised, nothing else is.
    return JSON.stringify(rest)
      .replace(/"generatedAt":"[^"]*"/gu, '"generatedAt":"<time>"')
      .replace(/"sha":"[0-9a-f]+"/gu, '"sha":"<sha>"');
  };

  test("invariance: paired checkouts produce equal payloads after path normalisation", async () => {
    const currentOnly = { [`${CURRENT_CONFIG_DIR}/config.yaml`]: laneYaml(3) } as const;
    const priorOnly = { ".delivery-os/config.yaml": laneYaml(3) } as const;
    const runs: { text: string; exit: number; notices: readonly string[] }[] = [];
    for (const [files, homeFiles, bin] of [
      [priorOnly, priorRootFiles, "jaiship"],
      [currentOnly, {}, "jaiship"],
    ] as const) {
      await withTrees(
        async ({ checkout, home }) => {
          const run = await runThroughComposition({
            bin,
            argv: ["status", "--json"],
            checkout: checkout.root,
            home: home.root,
          });
          runs.push({
            text: stable(run.stdout, [
              [join(home.root, CURRENT_ROOT), "<root>"],
              [join(home.root, PRIOR_ROOT), "<root>"],
              [checkout.root, "<repo>"],
              [home.root, "<home>"],
            ]),
            exit: run.exitCode,
            notices: run.notices,
          });
        },
        { ...homeFiles },
        files,
      );
    }
    expect(runs[0]?.exit).toBe(runs[1]?.exit);
    expect(runs[0]?.text).toBe(runs[1]?.text);
    expect(runs[1]?.notices).toEqual([]);
  });

  test("invariance: failing commands keep their delivered exit projections", async () => {
    await withTrees(async ({ checkout, home }) => {
      const uncomposed = await runThroughComposition({
        bin: "jaiship",
        argv: ["invented", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(uncomposed.exitCode).toBe(2);
      expect(uncomposed.stdout).not.toContain("prior-identity-fallback");
      const grammar = await runThroughComposition({
        bin: "jaiship",
        argv: ["queue", "add", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(grammar.exitCode).toBe(1);
      expect(grammar.stdout).not.toContain("prior-identity-fallback");
    }, priorRootFiles);
  });
});
