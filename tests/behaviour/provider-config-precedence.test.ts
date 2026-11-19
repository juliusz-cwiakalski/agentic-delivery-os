/**
 * GH-350 TC-CFG-001..TC-CFG-011, TC-INDEP-001 (behaviour arm), TC-INDEP-004 —
 * per-repository provider policy is behaviour the delivered layers already have.
 *
 * Every case materialises a scratch checkout, a scratch home and a scratch
 * system directory under `tmp/tmpdir`, writes real YAML, and drives the
 * delivered `config` program in process. Origins are asserted against an
 * independent parse of the same documents, never against the resolver's own
 * output. No case reads the ambient environment, a live home, a network, or the
 * repository's own configuration.
 *
 * TC-INDEP-001 names four provider members; `provider simulate` is the fifth
 * phase's member and does not exist yet, so this suite proves the three policy
 * members that do (`resolve`, `quota`, `watch status`) and the checks suite
 * owns the absent/present-but-inert matrix. The simulate arm lands with the
 * member.
 */

import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { FileSystemFacts } from "../../packages/adapters/src/file/config-source";
import { parseConfigYaml } from "../../packages/adapters/src/file/yaml-parser";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { type CatalogField, PRODUCTION_CATALOG } from "../../packages/core/src/config/catalog";
import { resolveConfig } from "../../packages/core/src/config/index";
import { ERROR_TABLE } from "../../packages/core/src/contracts/error-table";
import type {
  ProviderSpendTotalsRead,
  StateStorePort,
} from "../../packages/core/src/contracts/index";
import { PROVIDER_RECORD_KINDS } from "../../packages/core/src/contracts/provider";
import { fileFacts } from "../fixtures/config/facts";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const TMP_ROOT = join(process.cwd(), "tmp/tmpdir");
const CONFIG_DIR = ".jaiship";
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const DEFAULTS_FILE = "core/src/config/defaults.ts";
const PROVIDER_KEYS = ["defaultChain", "credentials", "entries", "chains", "profiles", "budgets"];

/* ------------------------------- fixtures -------------------------------- */

type Scratch = {
  readonly root: string;
  readonly repo: string;
  readonly home: string;
  readonly systemBase: string;
  readonly selected: string;
  readonly committed: string;
  readonly local: string;
  readonly systemFile: string;
  readonly userFile: string;
  write(path: string, text: string): void;
  remove(path: string): void;
  dispose(): void;
};

const scratch = (label: string): Scratch => {
  mkdirSync(TMP_ROOT, { recursive: true });
  const root = mkdtempSync(join(TMP_ROOT, `gh350-cfg-${label}-`));
  const repo = join(root, "repo");
  const home = join(root, "home");
  const systemBase = join(root, "etc");
  mkdirSync(join(repo, ".git"), { recursive: true });
  mkdirSync(home, { recursive: true });
  mkdirSync(systemBase, { recursive: true });
  const write = (path: string, text: string): void => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  };
  return {
    root,
    repo,
    home,
    systemBase,
    selected: join(root, "selected.yaml"),
    committed: join(repo, CONFIG_DIR, "config.yaml"),
    local: join(repo, CONFIG_DIR, "config.local.yaml"),
    systemFile: join(systemBase, CONFIG_DIR, "config.yaml"),
    userFile: join(home, ".config", CONFIG_DIR, "config.yaml"),
    write,
    remove: (path) => rmSync(path, { force: true }),
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
};

const lineOf = (text: string, needle: string): number => {
  const index = text.split("\n").findIndex((line) => line.trim() === needle);
  if (index < 0) throw new Error(`fixture line not found: ${needle}`);
  return index + 1;
};

type RecordingFs = FileSystemFacts & {
  readonly existsCalls: readonly string[];
  readonly readCalls: readonly string[];
};

const recordingFs = (): RecordingFs => {
  const existsCalls: string[] = [];
  const readCalls: string[] = [];
  return {
    existsCalls,
    readCalls,
    exists: (path) => {
      existsCalls.push(path);
      return existsSync(path);
    },
    readText: (path) => {
      readCalls.push(path);
      return readFileSync(path, "utf8");
    },
  };
};

const everyAccess = (fs: RecordingFs): readonly string[] => [...fs.existsCalls, ...fs.readCalls];

/* ---------------------------- the config program -------------------------- */

type ConfigFailureView = {
  readonly code?: string;
  readonly layer?: string;
  readonly key?: string;
  readonly file?: string;
  readonly line?: number;
  readonly summary?: string;
};

type ConfigRun = {
  readonly data?: Record<string, unknown>;
  readonly error?: ConfigFailureView;
  readonly warnings?: readonly string[];
};

const configProgram = (
  tree: Scratch,
  options: {
    readonly cwd?: string;
    readonly environment?: Readonly<Record<string, string | undefined>>;
    readonly fs?: RecordingFs;
  } = {},
) => {
  const program = createConfigProgram({
    workingName: "jaiship",
    environment: {
      HOME: tree.home,
      XDG_CONFIG_DIRS: tree.systemBase,
      ...options.environment,
    },
    cwd: options.cwd ?? tree.repo,
    homeDirectory: tree.home,
    platform: "linux",
    fs: options.fs ?? recordingFs(),
  });
  if (!program.ok) throw new Error("the config program did not compose");
  const definition = program.program.commands.config;
  if (definition === undefined) throw new Error("the config command is not composed");
  return { program, definition };
};

const runConfig = async (
  tree: Scratch,
  options: {
    readonly cwd?: string;
    readonly positionals?: readonly string[];
    readonly flags?: Readonly<Record<string, string | true>>;
    readonly environment?: Readonly<Record<string, string | undefined>>;
    readonly fs?: RecordingFs;
  } = {},
): Promise<ConfigRun & { readonly fs: RecordingFs }> => {
  const fs = options.fs ?? recordingFs();
  const built = configProgram(tree, { ...options, fs });
  const result = (await built.definition.handler({
    command: "config",
    flags: options.flags ?? {},
    argv: [],
    positionals: options.positionals ?? ["debug"],
    brand: built.program.brand,
  } as never)) as ConfigRun;
  return { ...result, fs };
};

type DebugPayload = {
  readonly config: Record<string, unknown>;
  readonly origins: Record<string, string>;
  readonly skippedLayers: readonly { readonly layer: string; readonly reason: string }[];
};

const debugOf = (run: ConfigRun): DebugPayload => {
  if (run.data === undefined) throw new Error(`config debug failed: ${JSON.stringify(run.error)}`);
  return run.data as never;
};

const providerOf = (run: ConfigRun): Record<string, unknown> =>
  debugOf(run).config.provider as Record<string, unknown>;

const providerOrigins = (run: ConfigRun): Record<string, string> =>
  Object.fromEntries(
    Object.entries(debugOf(run).origins).filter(
      ([path]) => path === "provider" || path.startsWith("provider."),
    ),
  );

const skipOf = (run: ConfigRun, layer: string): string | undefined =>
  debugOf(run).skippedLayers.find((entry) => entry.layer === layer)?.reason;

/* --------------------------- independent origins -------------------------- */

type FileLayer = "system" | "user-global" | "project-committed" | "project-local";

const layerOrigins = (text: string, layer: FileLayer, file: string): Map<string, string> => {
  const parsed = parseConfigYaml(text, layer, file);
  if (!parsed.ok) throw new Error(`fixture ${layer} is unparseable`);
  return new Map(
    Object.entries(parsed.facts.origins).map(([path, origin]) => [
      path,
      `layer=${origin.layer} file=${origin.file} line=${origin.line}`,
    ]),
  );
};

/** The highest-priority declaring layer for every declared path, read from the documents. */
const expectedOrigins = (
  layers: readonly { readonly text: string; readonly layer: FileLayer; readonly file: string }[],
): Map<string, string> => {
  const expected = new Map<string, string>();
  for (const entry of layers) {
    for (const [path, origin] of layerOrigins(entry.text, entry.layer, entry.file)) {
      expected.set(path, origin);
    }
  }
  return expected;
};

/** Every scalar and array-element leaf of one resolved subtree, as dotted paths. */
const leafPaths = (value: unknown, prefix = "provider"): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => leafPaths(child, `${prefix}[${index}]`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => leafPaths(child, `${prefix}.${key}`));
  }
  return [prefix];
};

/* ------------------------------ the provider ------------------------------ */

const providerComposition = (store: StateStorePort) => ({
  clock: { nowMs: () => NOW },
  credentialPort: { resolve: () => ({ ok: true as const, material: { value: "CANARY-VALUE" } }) },
  transport: {
    send: async () => ({
      status: 200,
      bodyText: JSON.stringify({ code: 200, success: true, data: { limits: [] } }),
    }),
  },
  sleep: { sleep: async () => undefined },
  stateStore: store,
  newFenceToken: () => "fence-gh350",
  spendTotals: {
    read: async (): Promise<ProviderSpendTotalsRead> => ({ status: "empty" }),
  },
});

type ProviderRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly fs: RecordingFs;
};

const runProvider = async (
  tree: Scratch,
  args: readonly string[],
  options: {
    readonly environment?: Readonly<Record<string, string | undefined>>;
    readonly fs?: RecordingFs;
  } = {},
): Promise<ProviderRun> => {
  const fs = options.fs ?? recordingFs();
  const stateRoot = makeTempRoot("gh350-cfg-provider");
  try {
    const store = openStore(makeIdentity(stateRoot)).store;
    const program = createConfigProgram({
      workingName: "jaiship",
      environment: {
        HOME: tree.home,
        XDG_CONFIG_DIRS: tree.systemBase,
        ...options.environment,
      },
      cwd: tree.repo,
      homeDirectory: tree.home,
      platform: "linux",
      fs,
      provider: providerComposition(store),
    });
    if (!program.ok) throw new Error("the provider program did not compose");
    let stdout = "";
    let stderr = "";
    const deps: CliDependencies = {
      brand: program.brand,
      clock: { now: () => NOW },
      newRunId: () => "run-gh350-cfg",
      secrets: program.secrets,
      program: program.program,
    };
    const exitCode = await runCli(
      ["provider", ...args],
      {
        stdout: {
          write: (chunk: string) => {
            stdout += chunk;
          },
        },
        stderr: {
          write: (chunk: string) => {
            stderr += chunk;
          },
        },
      },
      deps,
    );
    return { exitCode, stdout, stderr, fs };
  } finally {
    removeRoot(stateRoot);
  }
};

const envelopeOf = (run: ProviderRun): Record<string, unknown> =>
  JSON.parse(run.stdout) as Record<string, unknown>;

const errorOf = (run: ProviderRun): { code?: string; summary?: string; kind?: string } =>
  (envelopeOf(run).error ?? {}) as { code?: string; summary?: string; kind?: string };

/* ------------------------------- fixtures -------------------------------- */

const SYSTEM_MATRIX = `provider:
  entries:
    sys:
      class: subscription
`;

const USER_MATRIX = `provider:
  credentials:
    c-user:
      sourceKey:
        style: literal
        name: USER_KEY
  chains:
    ch-user:
      entries:
        - sys
  budgets:
    b-user:
      scope: ticket
      basis: cost
      ceiling: 25
`;

const COMMITTED_MATRIX = `provider:
  profiles:
    tiers:
      t-committed:
        description: committed tier
    profiles:
      p-committed:
        tier: t-committed
        providers:
          - sys
        seats:
          seat:
            model: committed-model
            pacingClass: judgment
            capability: text-only
`;

const LOCAL_MATRIX = `provider:
  profiles:
    watch:
      w-local:
        mapping: coding-plan-windows
        endpoint: https://local.test/quota
        credentialRef: c-user
`;

const LOCAL_FIVE_KINDS = `provider:
  credentials:
    c:
      sourceKey:
        style: literal
        name: LOCAL_KEY
  entries:
    p:
      class: subscription
  chains:
    ch:
      entries:
        - p
  profiles:
    tiers:
      t:
        description: local tier
    profiles:
      prof:
        tier: t
        providers:
          - p
        seats:
          seat:
            model: local-model
            pacingClass: judgment
            capability: text-only
    watch:
      w:
        mapping: coding-plan-windows
        endpoint: https://local.test/quota
        credentialRef: c
  budgets:
    cap:
      scope: ticket
      basis: cost
      ceiling: 40
`;

const COMMITTED_FIVE_KINDS = `provider:
  credentials:
    c:
      sourceKey:
        style: literal
        name: COMMITTED_KEY
  entries:
    p:
      class: subscription
  chains:
    ch:
      entries:
        - p
  profiles:
    tiers:
      t:
        description: committed tier
    profiles:
      prof:
        tier: t
        providers:
          - p
        seats:
          seat:
            model: committed-model
            pacingClass: judgment
            capability: text-only
    watch:
      w:
        mapping: coding-plan-windows
        endpoint: https://committed.test/quota
        credentialRef: c
  budgets:
    cap:
      scope: ticket
      basis: cost
      ceiling: 60
`;

const MERGE_COMMITTED = `provider:
  entries:
    a:
      class: subscription
      enabled: true
    x:
      class: subscription
    y:
      class: subscription
  chains:
    c:
      entries:
        - x
        - y
  budgets:
    cap:
      scope: ticket
      basis: cost
      ceiling: 40
`;

const MERGE_LOCAL = `provider:
  entries:
    a:
      class: pay-per-token
    b:
      class: subscription
  chains:
    c:
      entries:
        - x
  budgets:
    cap:
      ceiling: 90
`;

const RESET_COMMITTED = `provider:
  entries:
    a:
      class: subscription
    b:
      class: subscription
`;

const RESET_LOCAL = `reset:
  - provider.entries.a
provider:
  entries:
    b:
      class: pay-per-token
`;

const VALID_COMMITTED = `provider:
  defaultChain: ch
  entries:
    p:
      class: subscription
  chains:
    ch:
      entries:
        - p
  budgets:
    cap:
      enabled: false
      scope: ticket
      basis: cost
      ceiling: 40
`;

const BUDGET_INVALID = `provider:
  entries:
    p:
      class: subscription
  budgets:
    cap:
      scope: weekly
      basis: cost
      ceiling: 40
`;

const CHAIN_INVALID = `provider:
  entries:
    p:
      class: subscription
  chains:
    ch:
      entries:
        - ""
`;

const USER_GLOBAL_VALID = `provider:
  entries:
    p:
      class: subscription
  chains:
    ch:
      entries:
        - p
  budgets:
    cap:
      scope: ticket
      basis: cost
      ceiling: 500
`;

const POLICY_CONFIG = `provider:
  defaultChain: ch
  credentials:
    c:
      sourceKey:
        style: literal
        name: POLICY_KEY
  entries:
    p:
      class: subscription
  chains:
    ch:
      entries:
        - p
  profiles:
    tiers:
      t:
        description: policy tier
    profiles:
      prof:
        tier: t
        providers:
          - p
        seats:
          seat:
            model: policy-model
            pacingClass: judgment
            capability: text-only
    preferenceChain:
      base: prof
    watch:
      p:
        mapping: coding-plan-windows
        endpoint: https://policy.test/quota
        credentialRef: c
  budgets:
    cap:
      enabled: false
      scope: ticket
      basis: cost
      ceiling: 40
`;

/* ------------------------------ TC-CFG-001 ------------------------------- */

describe("TC-CFG-001 every provider element resolves to its highest declaring layer", () => {
  test("descriptor, chain, profile, watch target and budget each resolve to their highest declarer", async () => {
    const tree = scratch("matrix");
    try {
      tree.write(tree.systemFile, SYSTEM_MATRIX);
      tree.write(tree.userFile, USER_MATRIX);
      tree.write(tree.committed, COMMITTED_MATRIX);
      tree.write(tree.local, LOCAL_MATRIX);
      const run = await runConfig(tree);
      const origins = providerOrigins(run);
      const providers = providerOf(run);

      const expectations: readonly [string, string][] = [
        [
          "provider.entries.sys.class",
          `layer=system file=${tree.systemFile} line=${lineOf(SYSTEM_MATRIX, "class: subscription")}`,
        ],
        [
          "provider.chains.ch-user.entries[0]",
          `layer=user-global file=${tree.userFile} line=${lineOf(USER_MATRIX, "- sys")}`,
        ],
        [
          "provider.profiles.profiles.p-committed.tier",
          `layer=project-committed file=${tree.committed} line=${lineOf(COMMITTED_MATRIX, "tier: t-committed")}`,
        ],
        [
          "provider.profiles.watch.w-local.mapping",
          `layer=project-local file=${tree.local} line=${lineOf(LOCAL_MATRIX, "mapping: coding-plan-windows")}`,
        ],
        [
          "provider.budgets.b-user.ceiling",
          `layer=user-global file=${tree.userFile} line=${lineOf(USER_MATRIX, "ceiling: 25")}`,
        ],
      ];
      for (const [path, origin] of expectations) {
        expect(origins[path], path).toBe(origin);
      }
      // The defaults layer participates too: the shipped descriptor wins where
      // no other layer declares it.
      expect(origins["provider.entries.zai-coding-plan.class"]).toStartWith(
        `layer=defaults file=${DEFAULTS_FILE} line=`,
      );

      const entries = providers.entries as Record<string, Record<string, unknown>>;
      expect(entries.sys?.class).toBe("subscription");
      const budgets = providers.budgets as Record<string, Record<string, unknown>>;
      expect(budgets["b-user"]).toEqual({ scope: "ticket", basis: "cost", ceiling: 25 });
      const profiles = providers.profiles as Record<string, Record<string, unknown>>;
      expect(
        (profiles.profiles as Record<string, Record<string, unknown>>)["p-committed"]?.tier,
      ).toBe("t-committed");
    } finally {
      tree.dispose();
    }
  });

  test("a provider-shaped environment name is refused, not projected", async () => {
    const tree = scratch("env-shape");
    try {
      tree.write(tree.committed, VALID_COMMITTED);
      const run = await runConfig(tree, {
        environment: { JAISHIP_PROVIDER__ENTRIES__P__CLASS: "subscription" },
      });
      expect(run.error?.code).toBe("config.environment.unmapped");
      expect(run.error?.layer).toBe("environment");
      expect(run.data).toBeUndefined();
    } finally {
      tree.dispose();
    }
  });

  test("an undeclared CLI fact is refused by the resolver, never mapped to a provider node", () => {
    const run = resolveConfig({ flags: { "--provider-entries-p-class": "subscription" } });
    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.error.code).toBe("config.key.unknown");
    expect(run.error.layer).toBe("cli");
  });

  test("zero provider catalog nodes declare an environment or flag source", () => {
    const nodes: Array<[string, CatalogField]> = [];
    const walk = (field: CatalogField, path: string): void => {
      nodes.push([path, field]);
      if (field.type === "object") {
        for (const [name, child] of Object.entries(field.fields)) walk(child, `${path}.${name}`);
      }
      if (field.type === "record") walk(field.value, `${path}.<name>`);
      if (field.type === "array") walk(field.items, `${path}[]`);
    };
    const provider = PRODUCTION_CATALOG.provider;
    if (provider.type !== "object") throw new Error("the provider branch is not an object");
    walk(provider, "provider");

    expect(nodes.length).toBeGreaterThan(10);
    expect(
      nodes.filter(([, field]) => field.env !== undefined || field.flag !== undefined),
    ).toEqual([]);
    expect(Object.keys(provider.fields)).toEqual(PROVIDER_KEYS);
    expect(provider.fields.budgets?.type).toBe("record");
  });
});

/* ------------------------------ TC-CFG-002 ------------------------------- */

describe("TC-CFG-002 project-local beats project-committed for every element kind", () => {
  test("5/5 effective values are local and 5/5 origins name the local file and line", async () => {
    const tree = scratch("local-wins");
    try {
      tree.write(tree.committed, COMMITTED_FIVE_KINDS);
      tree.write(tree.local, LOCAL_FIVE_KINDS);
      const run = await runConfig(tree);
      const origins = providerOrigins(run);
      const providers = providerOf(run);

      const entries = providers.entries as Record<string, Record<string, unknown>>;
      const chains = providers.chains as Record<string, Record<string, unknown>>;
      const profiles = providers.profiles as Record<string, Record<string, unknown>>;
      const budgets = providers.budgets as Record<string, Record<string, unknown>>;

      expect(entries.p?.class).toBe("subscription");
      expect(chains.ch?.entries).toEqual(["p"]);
      expect((profiles.profiles as Record<string, Record<string, unknown>>).prof?.tier).toBe("t");
      expect((profiles.watch as Record<string, Record<string, unknown>>).w?.mapping).toBe(
        "coding-plan-windows",
      );
      expect(budgets.cap?.ceiling).toBe(40);

      const localOrigin = (needle: string): string =>
        `layer=project-local file=${tree.local} line=${lineOf(LOCAL_FIVE_KINDS, needle)}`;
      expect(origins["provider.entries.p.class"]).toBe(localOrigin("class: subscription"));
      expect(origins["provider.chains.ch.entries[0]"]).toBe(localOrigin("- p"));
      expect(origins["provider.profiles.profiles.prof.tier"]).toBe(localOrigin("tier: t"));
      expect(origins["provider.profiles.watch.w.mapping"]).toBe(
        localOrigin("mapping: coding-plan-windows"),
      );
      expect(origins["provider.budgets.cap.ceiling"]).toBe(localOrigin("ceiling: 40"));
    } finally {
      tree.dispose();
    }
  });
});

/* ------------------------------ TC-CFG-003 ------------------------------- */

describe("TC-CFG-003 records merge by name, lists replace whole, reset removes inherited values", () => {
  test("a merged record keeps both layers' fields with per-field origins and gains a sibling", async () => {
    const tree = scratch("merge");
    try {
      tree.write(tree.committed, MERGE_COMMITTED);
      tree.write(tree.local, MERGE_LOCAL);
      const run = await runConfig(tree);
      const origins = providerOrigins(run);
      const entries = providerOf(run).entries as Record<string, Record<string, unknown>>;

      expect(entries.a).toEqual({ class: "pay-per-token", enabled: true });
      expect(entries.b).toEqual({ class: "subscription" });
      expect(origins["provider.entries.a.class"]).toBe(
        `layer=project-local file=${tree.local} line=${lineOf(MERGE_LOCAL, "class: pay-per-token")}`,
      );
      expect(origins["provider.entries.a.enabled"]).toBe(
        `layer=project-committed file=${tree.committed} line=${lineOf(MERGE_COMMITTED, "enabled: true")}`,
      );
      const chains = providerOf(run).chains as Record<string, Record<string, unknown>>;
      expect(chains.c?.entries).toEqual(["x"]);
      expect(origins["provider.chains.c.entries[1]"]).toBeUndefined();
    } finally {
      tree.dispose();
    }
  });

  test("reset removes the inherited value and its descendants while a sibling survives", async () => {
    const tree = scratch("reset");
    try {
      tree.write(tree.committed, RESET_COMMITTED);
      tree.write(tree.local, RESET_LOCAL);
      const run = await runConfig(tree);
      const entries = providerOf(run).entries as Record<string, Record<string, unknown>>;
      expect(entries.a).toBeUndefined();
      expect(entries.b).toEqual({ class: "pay-per-token" });
      expect(providerOrigins(run)["provider.entries.a.class"]).toBeUndefined();
      expect(providerOrigins(run)["provider.entries.b.class"]).toBe(
        `layer=project-local file=${tree.local} line=${lineOf(RESET_LOCAL, "class: pay-per-token")}`,
      );
    } finally {
      tree.dispose();
    }
  });
});

/* ------------------------------ TC-CFG-004 ------------------------------- */

describe("TC-CFG-004 every effective provider leaf reports its winning origin", () => {
  test("the leaf table is complete, exact, and carries zero non-winning layers", async () => {
    const tree = scratch("origins");
    try {
      tree.write(tree.committed, MERGE_COMMITTED);
      tree.write(tree.local, MERGE_LOCAL);
      const run = await runConfig(tree);
      const origins = providerOrigins(run);
      const leaves = leafPaths(providerOf(run));
      const expected = expectedOrigins([
        { text: MERGE_COMMITTED, layer: "project-committed", file: tree.committed },
        { text: MERGE_LOCAL, layer: "project-local", file: tree.local },
      ]);

      expect(leaves.length).toBeGreaterThan(0);
      expect(leaves.filter((path) => origins[path] === undefined)).toEqual([]);
      for (const path of leaves) {
        const declared = expected.get(path);
        if (declared === undefined) {
          expect(origins[path], path).toStartWith(`layer=defaults file=${DEFAULTS_FILE} line=`);
        } else {
          expect(origins[path], path).toBe(declared);
        }
      }
      const declaredLeaves = leaves.filter((path) => expected.has(path)).sort();
      expect(declaredLeaves).toEqual([
        "provider.budgets.cap.basis",
        "provider.budgets.cap.ceiling",
        "provider.budgets.cap.scope",
        "provider.chains.c.entries[0]",
        "provider.entries.a.class",
        "provider.entries.a.enabled",
        "provider.entries.b.class",
        "provider.entries.x.class",
        "provider.entries.y.class",
      ]);
      // Zero leaves report a layer that is not the winning declarer.
      const layers = new Set(
        leaves.map((path) => origins[path]?.split(" ")[0]?.replace("layer=", "") ?? ""),
      );
      expect([...layers].sort()).toEqual(["defaults", "project-committed", "project-local"]);
    } finally {
      tree.dispose();
    }
  });
});

/* ------------------------------ TC-CFG-005 ------------------------------- */

describe("TC-CFG-005 an invalid repository declaration refuses and never falls back", () => {
  test("an invalid committed budget refuses provider.chain.invalid naming the field", async () => {
    const tree = scratch("invalid-budget");
    try {
      tree.write(tree.userFile, USER_GLOBAL_VALID);
      tree.write(tree.committed, BUDGET_INVALID);
      const run = await runProvider(tree, ["resolve", "--json"]);
      expect(run.exitCode).toBe(1);
      const error = errorOf(run);
      expect(error.code).toBe("provider.chain.invalid");
      expect(error.summary).toBe("provider.budgets.cap.scope");
      expect(envelopeOf(run).data).toBeUndefined();
      expect(run.stdout).not.toContain("500");
    } finally {
      tree.dispose();
    }
  });

  test("an invalid committed chain refuses provider.chain.invalid naming the field", async () => {
    const tree = scratch("invalid-chain");
    try {
      tree.write(tree.userFile, USER_GLOBAL_VALID);
      tree.write(tree.committed, CHAIN_INVALID);
      const run = await runProvider(tree, ["resolve", "--json"]);
      expect(run.exitCode).toBe(1);
      const error = errorOf(run);
      expect(error.code).toBe("provider.chain.invalid");
      expect(error.summary).toBe("chains.ch.entries");
      expect(envelopeOf(run).data).toBeUndefined();
    } finally {
      tree.dispose();
    }
  });
});

/* ------------------------------ TC-CFG-006 ------------------------------- */

describe("TC-CFG-006 no project-keyed provider surface exists", () => {
  test("a planted provider.projects child refuses in every file layer as an unknown key", async () => {
    const planted = `provider:
  projects:
    demo:
      policy: unscoped
`;
    const cases: readonly [string, (tree: Scratch) => string][] = [
      ["system", (tree) => tree.systemFile],
      ["user-global", (tree) => tree.userFile],
      ["project-committed", (tree) => tree.committed],
      ["project-local", (tree) => tree.local],
    ];
    for (const [layer, pathOf] of cases) {
      const tree = scratch(`projects-${layer}`);
      try {
        tree.write(pathOf(tree), planted);
        const run = await runConfig(tree);
        expect(run.error?.code, layer).toBe("config.key.unknown");
        expect(run.error?.layer, layer).toBe(layer);
        expect(run.data, layer).toBeUndefined();
      } finally {
        tree.dispose();
      }
    }
  });

  test("the catalog, the error table, the record kinds and the production source hold no such name", () => {
    const provider = PRODUCTION_CATALOG.provider;
    if (provider.type !== "object") throw new Error("the provider branch is not an object");
    expect(Object.hasOwn(provider.fields, "projects")).toBe(false);
    expect(ERROR_TABLE.filter((row) => row.code.includes("provider.projects"))).toEqual([]);
    expect(PROVIDER_RECORD_KINDS.filter((kind) => kind.includes("projects"))).toEqual([]);

    const offenders: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (
          entry.name.endsWith(".ts") &&
          readFileSync(path, "utf8").includes("provider.projects")
        )
          offenders.push(path);
      }
    };
    for (const pkg of ["core", "adapters", "cli", "mcp", "opencode"]) {
      walk(join(process.cwd(), "packages", pkg, "src"));
    }
    expect(offenders).toEqual([]);
  });
});

/* ------------------------------ TC-CFG-007 ------------------------------- */

const CI_COMMITTED = `provider:
  defaultChain: chA
  entries:
    p:
      class: subscription
  chains:
    chA:
      entries:
        - p
  budgets:
    cap:
      scope: ticket
      basis: cost
      ceiling: 40
`;

const CI_LOCAL = `provider:
  defaultChain: chB
  chains:
    chB:
      entries:
        - p
  budgets:
    cap:
      ceiling: 90
`;

describe("TC-CFG-007 under CI=true the committed policy wins and local is skipped unread", () => {
  test("chain A and ceiling 40 win, project-local is ci-disabled, and the file is never opened", async () => {
    const tree = scratch("ci");
    try {
      tree.write(tree.committed, CI_COMMITTED);
      tree.write(tree.local, CI_LOCAL);
      const fs = recordingFs();
      const run = await runConfig(tree, { environment: { CI: "true" }, fs });
      const providers = providerOf(run);
      expect(providers.defaultChain).toBe("chA");
      expect((providers.budgets as Record<string, Record<string, unknown>>).cap?.ceiling).toBe(40);
      expect(skipOf(run, "project-local")).toBe("ci-disabled");
      expect(everyAccess(fs)).not.toContain(tree.local);
      expect(providerOrigins(run)["provider.budgets.cap.ceiling"]).toBe(
        `layer=project-committed file=${tree.committed} line=${lineOf(CI_COMMITTED, "ceiling: 40")}`,
      );
    } finally {
      tree.dispose();
    }
  });
});

/* ------------------------------ TC-CFG-008 ------------------------------- */

describe("TC-CFG-008 --enable-project-local-config restores local participation under CI", () => {
  test("the local chain B and ceiling 90 win and the report is no longer ci-disabled", async () => {
    const tree = scratch("ci-enable");
    try {
      tree.write(tree.committed, CI_COMMITTED);
      tree.write(tree.local, CI_LOCAL);
      const run = await runConfig(tree, {
        environment: { CI: "true" },
        flags: { "--enable-project-local-config": true },
      });
      const providers = providerOf(run);
      expect(providers.defaultChain).toBe("chB");
      expect((providers.budgets as Record<string, Record<string, unknown>>).cap?.ceiling).toBe(90);
      expect(skipOf(run, "project-local")).not.toBe("ci-disabled");
      expect(providerOrigins(run)["provider.budgets.cap.ceiling"]).toBe(
        `layer=project-local file=${tree.local} line=${lineOf(CI_LOCAL, "ceiling: 90")}`,
      );
    } finally {
      tree.dispose();
    }
  });
});

/* ------------------------------ TC-CFG-009 ------------------------------- */

const SELECTED_TEXT = `provider:
  defaultChain: chC
  entries:
    p:
      class: subscription
  chains:
    chC:
      entries:
        - p
`;

const SELECTED_LOCAL = `provider:
  defaultChain: chD
  entries:
    p:
      class: pay-per-token
`;

describe("TC-CFG-009 a selected file occupies the committed slot and suppresses the local read", () => {
  test("the selected chain C wins, project-local is selected-config, and local is never read", async () => {
    const tree = scratch("selected");
    try {
      tree.write(tree.selected, SELECTED_TEXT);
      tree.write(tree.local, SELECTED_LOCAL);
      const fs = recordingFs();
      const run = await runConfig(tree, { flags: { "--config": tree.selected }, fs });
      const providers = providerOf(run);
      expect(providers.defaultChain).toBe("chC");
      expect((providers.entries as Record<string, Record<string, unknown>>).p?.class).toBe(
        "subscription",
      );
      expect(skipOf(run, "project-local")).toBe("selected-config");
      expect(everyAccess(fs)).not.toContain(tree.local);
      expect(providerOrigins(run)["provider.defaultChain"]).toBe(
        `layer=project-committed file=${tree.selected} line=${lineOf(SELECTED_TEXT, "defaultChain: chC")}`,
      );
    } finally {
      tree.dispose();
    }
  });
});

/* ------------------------------ TC-CFG-010 ------------------------------- */

describe("TC-CFG-010 every element kind is validated before merge; CI and workstation differ only by the skip", () => {
  const committed = `provider:
  entries:
    p:
      class: subscription
  chains:
    ch:
      entries:
        - p
`;
  const local = `provider:
  entries:
    p:
      class: pay-per-token
    local:
      class: subscription
`;

  const invalidArms: readonly {
    readonly label: string;
    readonly text: string;
    readonly code: string;
    readonly field?: string;
  }[] = [
    {
      label: "descriptor",
      text: `provider:\n  entries:\n    p:\n      class: 42\n`,
      code: "config.value.invalid",
    },
    {
      label: "chain",
      text: `provider:\n  chains:\n    ch:\n      entries: 42\n`,
      code: "config.value.invalid",
    },
    {
      label: "profile",
      text: `provider:\n  profiles:\n    profiles:\n      prof:\n        tier: 42\n`,
      code: "config.value.invalid",
    },
    {
      label: "watch target",
      text: `provider:\n  profiles:\n    watch:\n      w:\n        mapping: 42\n`,
      code: "config.value.invalid",
    },
    {
      label: "budget",
      text: `provider:\n  entries:\n    p:\n      class: subscription\n  budgets:\n    cap:\n      scope: weekly\n      basis: cost\n      ceiling: 40\n`,
      code: "provider.chain.invalid",
      field: "provider.budgets.cap.scope",
    },
  ];

  test("5/5 invalid repository declarations refuse with the declared identity", async () => {
    for (const arm of invalidArms) {
      const tree = scratch(`invalid-${arm.label.replace(" ", "-")}`);
      try {
        tree.write(tree.committed, arm.text);
        // A valid local declaration of the same element must not rescue the
        // invalid committed one: the layer is validated before the merge.
        tree.write(tree.local, local);
        if (arm.code.startsWith("provider.")) {
          const run = await runProvider(tree, ["resolve", "--json"]);
          expect(run.exitCode, arm.label).toBe(1);
          const error = errorOf(run);
          expect(error.code, arm.label).toBe(arm.code);
          expect(error.summary, arm.label).toBe(arm.field);
          expect(envelopeOf(run).data, arm.label).toBeUndefined();
        } else {
          const run = await runConfig(tree);
          expect(run.error?.code, arm.label).toBe(arm.code);
          expect(run.error?.layer, arm.label).toBe("project-committed");
          expect(run.data, arm.label).toBeUndefined();
        }
      } finally {
        tree.dispose();
      }
    }
  });

  test("the resolved CI and workstation trees differ by exactly the declared local leaves", async () => {
    const tree = scratch("ci-diff");
    try {
      tree.write(tree.committed, committed);
      tree.write(tree.local, local);
      const ci = await runConfig(tree, { environment: { CI: "true" } });
      const workstation = await runConfig(tree);
      tree.remove(tree.local);
      const localAbsent = await runConfig(tree);

      expect(providerOf(ci)).toEqual(providerOf(localAbsent));
      expect(providerOrigins(ci)).toEqual(providerOrigins(localAbsent));

      const localLeaves = new Set(
        leafPaths(providerOf(workstation)).filter((path) =>
          providerOrigins(workstation)[path]?.startsWith("layer=project-local "),
        ),
      );
      expect([...localLeaves].sort()).toEqual([
        "provider.entries.local.class",
        "provider.entries.p.class",
      ]);
      expect(skipOf(ci, "project-local")).toBe("ci-disabled");
      expect(skipOf(localAbsent, "project-local")).toBe("missing");
    } finally {
      tree.dispose();
    }
  });
});

/* ------------------------------ TC-CFG-011 ------------------------------- */

describe("TC-CFG-011 two checkouts of one identity each resolve their own document", () => {
  test("no key resolves a value across the checkout boundary", async () => {
    const tree = scratch("checkouts");
    const sibling = join(tree.root, "second");
    try {
      const firstText = `provider:\n  entries:\n    first:\n      class: subscription\n  chains:\n    ch-first:\n      entries:\n        - first\n`;
      const secondText = `provider:\n  entries:\n    second:\n      class: subscription\n  chains:\n    ch-second:\n      entries:\n        - second\n`;
      tree.write(tree.committed, firstText);
      mkdirSync(join(sibling, ".git"), { recursive: true });
      const secondFile = join(sibling, CONFIG_DIR, "config.yaml");
      tree.write(secondFile, secondText);

      const first = await runConfig(tree);
      const firstProviders = providerOf(first);
      expect(Object.keys(firstProviders.entries as Record<string, unknown>)).toContain("first");
      expect(Object.keys(firstProviders.entries as Record<string, unknown>)).not.toContain(
        "second",
      );
      expect(providerOrigins(first)["provider.entries.first.class"]).toContain(
        `file=${tree.committed}`,
      );

      const second = await runConfig(tree, { cwd: sibling });
      const secondProviders = providerOf(second);
      expect(Object.keys(secondProviders.entries as Record<string, unknown>)).toContain("second");
      expect(Object.keys(secondProviders.entries as Record<string, unknown>)).not.toContain(
        "first",
      );
      expect(providerOrigins(second)["provider.entries.second.class"]).toContain(
        `file=${secondFile}`,
      );
      // Only the declared provider keys exist: no host-store, per-queue or
      // inheritance key can span two checkouts.
      expect(Object.keys(secondProviders).filter((key) => !PROVIDER_KEYS.includes(key))).toEqual(
        [],
      );
    } finally {
      tree.dispose();
    }
  });
});

/* ------------------------------ TC-INDEP-001 ----------------------------- */

describe("TC-INDEP-001 policy resolves from configuration with the legacy paths absent", () => {
  test("resolve, quota and watch status resolve policy with zero legacy-path reads", async () => {
    const tree = scratch("indep");
    try {
      tree.write(tree.committed, POLICY_CONFIG);
      const fs = recordingFs();
      const legacyProfiles = join(tree.home, ".delivery-os", "config", "profiles");
      const legacyHook = join(tree.home, ".delivery-os", "hooks", "pre-opencode-iteration");
      const accesses = (): readonly string[] => everyAccess(fs);
      const touchesLegacy = (): boolean =>
        accesses().some((path) => path === legacyHook || path.startsWith(`${legacyProfiles}/`));

      const commands: readonly (readonly string[])[] = [
        ["resolve", "--json"],
        ["quota", "--json"],
        ["watch", "status", "--json"],
      ];
      for (const argv of commands) {
        const run = await runProvider(tree, argv, { fs });
        expect(run.exitCode, argv.join(" ")).toBe(0);
        expect(touchesLegacy(), argv.join(" ")).toBe(false);
      }
      // Non-vacuity: the recording stub does record a read when one happens.
      fs.readText(tree.committed);
      expect(fs.readCalls).toContain(tree.committed);
      expect(touchesLegacy()).toBe(false);
    } finally {
      tree.dispose();
    }
  });
});

/* ------------------------------ TC-INDEP-004 ----------------------------- */

describe("TC-INDEP-004 every policy input is a typed configuration value holding names only", () => {
  const POISONED = {
    OC_ADOS_MODEL_PROFILE: "poisoned-profile",
    OC_ADOS_AGENT_PM_MODEL: "poisoned-model",
    ZAI_API_KEY: "POISONED-KEY",
    ZAI_ANTHROPIC_AUTH_TOKEN: "POISONED-TOKEN",
  } as const;

  test("a poisoned legacy environment changes no byte of the decision", async () => {
    const tree = scratch("poisoned");
    try {
      tree.write(tree.committed, POLICY_CONFIG);
      const clean = await runProvider(tree, ["resolve", "--json"]);
      const poisoned = await runProvider(tree, ["resolve", "--json"], {
        environment: POISONED,
      });
      expect(clean.exitCode).toBe(0);
      expect(poisoned.exitCode).toBe(0);
      expect(poisoned.stdout).toBe(clean.stdout);
      expect(poisoned.stderr).toBe(clean.stderr);
      expect(poisoned.stdout).not.toContain("POISONED");
    } finally {
      tree.dispose();
    }
  });

  test("a legacy-prefixed provider-shaped variable cannot participate", async () => {
    const tree = scratch("legacy-prefix");
    try {
      tree.write(tree.committed, POLICY_CONFIG);
      const run = await runConfig(tree, {
        environment: { ADOS_PROVIDER__ENTRIES__P__CLASS: "pay-per-token" },
      });
      expect(run.error?.code).toBe("config.environment.unmapped");
      expect(run.error?.layer).toBe("environment");
      expect(run.data).toBeUndefined();
    } finally {
      tree.dispose();
    }
  });

  test("every enumerated policy input is a configuration leaf with an origin and a name only", async () => {
    const tree = scratch("names-only");
    try {
      tree.write(tree.committed, POLICY_CONFIG);
      const run = await runConfig(tree);
      const origins = providerOrigins(run);
      const providers = providerOf(run);
      for (const path of leafPaths(providers)) {
        expect(origins[path], path).toBeDefined();
      }
      const credentials = providers.credentials as Record<string, Record<string, unknown>>;
      const sourceKey = credentials.c?.sourceKey as Record<string, unknown>;
      expect(Object.keys(sourceKey).sort()).toEqual(["name", "style"]);
      expect(sourceKey.name).toBe("POLICY_KEY");
      const text = JSON.stringify(providers).toLowerCase();
      for (const forbidden of ['"value"', '"token"', '"secret"', '"password"']) {
        expect(text, forbidden).not.toContain(forbidden);
      }

      // A credential value is not representable: the source-key shape is closed.
      const rejected = resolveConfig({
        sources: [
          fileFacts(
            "project-committed",
            {
              provider: {
                credentials: {
                  c: { sourceKey: { style: "literal", name: "K", value: "CANARY" } },
                },
              },
            },
            6,
          ),
        ],
      });
      expect(rejected.ok).toBe(false);
      if (rejected.ok) return;
      expect(rejected.error.code).toBe("config.key.unknown");
      expect(JSON.stringify(rejected)).not.toContain("CANARY");
    } finally {
      tree.dispose();
    }
  });
});
