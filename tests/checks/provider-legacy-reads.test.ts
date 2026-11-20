/**
 * GH-350 TC-INDEP-001/TC-INDEP-002 (checks arm) — the provider path resolves
 * policy from configuration with the legacy profile directory and the
 * pre-iteration hook absent, and again with them present but inert.
 *
 * Every case materialises a scratch checkout and a scratch home under
 * `tmp/tmpdir` and drives the delivered provider members through the composed
 * program. One recording filesystem stub records every existence probe and every
 * content read, so "zero reads" is a positive observation rather than an
 * absence of evidence: the same stub is proven to record a planted read in the
 * control arm. The legacy artifacts' digests and mtimes are asserted unchanged.
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { FileSystemFacts } from "../../packages/adapters/src/file/config-source";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import type { ProviderSpendTotalsRead } from "../../packages/core/src/contracts/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const TMP_ROOT = join(process.cwd(), "tmp/tmpdir");
const CONFIG_DIR = ".jaiship";
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

/** The prior identity's two provider-policy paths, named once. */
const LEGACY_PROFILE_DIR = ".delivery-os/config/profiles";
const LEGACY_HOOK = ".delivery-os/hooks/pre-opencode-iteration";

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

const LEGACY_PROFILE_TEXT = `export OC_ADOS_MODEL_PROFILE=legacy-profile
export ZAI_API_KEY=legacy-key
`;

const LEGACY_HOOK_TEXT = `#!/usr/bin/env bash
export OC_ADOS_MODEL_PROFILE=legacy-hook-profile
export ADOS_ZAI_ANTHROPIC_BASE_URL=https://legacy.test
`;

type Scratch = {
  readonly root: string;
  readonly repo: string;
  readonly home: string;
  readonly systemBase: string;
  dispose(): void;
};

const scratch = (label: string): Scratch => {
  mkdirSync(TMP_ROOT, { recursive: true });
  const root = mkdtempSync(join(TMP_ROOT, `gh350-legacy-${label}-`));
  const repo = join(root, "repo");
  const home = join(root, "home");
  const systemBase = join(root, "etc");
  mkdirSync(join(repo, ".git"), { recursive: true });
  mkdirSync(home, { recursive: true });
  mkdirSync(systemBase, { recursive: true });
  return {
    root,
    repo,
    home,
    systemBase,
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
};

const write = (path: string, text: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
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

const legacyAccesses = (fs: RecordingFs, tree: Scratch): readonly string[] => {
  const profileDirectory = join(tree.home, LEGACY_PROFILE_DIR);
  const hook = join(tree.home, LEGACY_HOOK);
  return everyAccess(fs).filter(
    (path) => path === hook || path === profileDirectory || path.startsWith(`${profileDirectory}/`),
  );
};

type LegacySnapshot = { readonly path: string; readonly digest: string; readonly mtimeNs: bigint };

const snapshotOf = (paths: readonly string[]): readonly LegacySnapshot[] =>
  paths.map((path) => ({
    path,
    digest: createHash("sha256").update(readFileSync(path)).digest("hex"),
    mtimeNs: statSync(path, { bigint: true }).mtimeNs,
  }));

type ProviderRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly fs: RecordingFs;
};

const runProvider = async (
  tree: Scratch,
  argv: readonly string[],
  fs: RecordingFs,
): Promise<ProviderRun> => {
  const stateRoot = makeTempRoot("gh350-legacy-state");
  try {
    const store = openStore(makeIdentity(stateRoot)).store;
    const program = createConfigProgram({
      workingName: "jaiship",
      environment: { HOME: tree.home, XDG_CONFIG_DIRS: tree.systemBase },
      cwd: tree.repo,
      homeDirectory: tree.home,
      platform: "linux",
      fs,
      provider: {
        clock: { nowMs: () => NOW },
        credentialPort: {
          resolve: () => ({ ok: true as const, material: { value: "CANARY-VALUE" } }),
        },
        transport: {
          send: async () => ({
            status: 200,
            bodyText: JSON.stringify({ code: 200, success: true, data: { limits: [] } }),
          }),
        },
        sleep: { sleep: async () => undefined },
        stateStore: store,
        newFenceToken: () => "fence-gh350-legacy",
        spendTotals: {
          read: async (): Promise<ProviderSpendTotalsRead> => ({ status: "empty" }),
        },
      },
    });
    if (!program.ok) throw new Error("the provider program did not compose");
    let stdout = "";
    let stderr = "";
    const deps: CliDependencies = {
      brand: program.brand,
      clock: { now: () => NOW },
      newRunId: () => "run-gh350-indep",
      secrets: program.secrets,
      program: program.program,
    };
    const exitCode = await runCli(
      ["provider", ...argv],
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

const COMMANDS: readonly (readonly string[])[] = [
  ["resolve", "--json"],
  ["quota", "--json"],
  ["watch", "status", "--json"],
];

describe("TC-INDEP-001 both legacy paths absent: policy resolves with zero reads", () => {
  test("three members resolve normally and the recording stub sees no legacy access", async () => {
    const tree = scratch("absent");
    try {
      write(join(tree.repo, CONFIG_DIR, "config.yaml"), POLICY_CONFIG);
      const fs = recordingFs();
      for (const argv of COMMANDS) {
        const run = await runProvider(tree, argv, fs);
        expect(run.exitCode, argv.join(" ")).toBe(0);
        expect(run.stdout, argv.join(" ")).toContain('"schemaVersion"');
        expect(legacyAccesses(fs, tree), argv.join(" ")).toEqual([]);
      }
      // The stub is not vacuous: a planted read is recorded by the same stub.
      const probes = recordingFs();
      const profiles = join(tree.home, LEGACY_PROFILE_DIR);
      write(join(profiles, "zai.sh"), LEGACY_PROFILE_TEXT);
      probes.readText(join(profiles, "zai.sh"));
      probes.exists(profiles);
      expect([...legacyAccesses(probes, tree)].sort()).toEqual(
        [profiles, join(profiles, "zai.sh")].sort(),
      );
    } finally {
      tree.dispose();
    }
  });
});

describe("TC-INDEP-002 present-but-inert legacy artifacts are ignored exactly as absent ones", () => {
  test("the decisions are byte-identical, nothing is read, and the files are unchanged", async () => {
    const absent = scratch("inert-absent");
    const inert = scratch("inert-present");
    try {
      for (const tree of [absent, inert]) {
        write(join(tree.repo, CONFIG_DIR, "config.yaml"), POLICY_CONFIG);
      }
      const profilePath = join(inert.home, LEGACY_PROFILE_DIR, "zai.sh");
      const hookPath = join(inert.home, LEGACY_HOOK);
      write(profilePath, LEGACY_PROFILE_TEXT);
      write(hookPath, LEGACY_HOOK_TEXT);
      const before = snapshotOf([profilePath, hookPath]);

      const absentFs = recordingFs();
      const inertFs = recordingFs();
      for (const argv of COMMANDS) {
        const baseline = await runProvider(absent, argv, absentFs);
        const withLegacy = await runProvider(inert, argv, inertFs);
        expect(baseline.exitCode, argv.join(" ")).toBe(0);
        expect(withLegacy.exitCode, argv.join(" ")).toBe(0);
        // Byte-identical decisions: a legacy value never participates.
        expect(withLegacy.stdout, argv.join(" ")).toBe(baseline.stdout);
        expect(withLegacy.stderr, argv.join(" ")).toBe(baseline.stderr);
        for (const value of [
          "legacy-profile",
          "legacy-hook-profile",
          "legacy-key",
          "legacy.test",
        ]) {
          expect(withLegacy.stdout, argv.join(" ")).not.toContain(value);
        }
        expect(legacyAccesses(inertFs, inert), argv.join(" ")).toEqual([]);
      }
      // The legacy files' digests and mtimes are unchanged: nothing rewrites them.
      expect(snapshotOf([profilePath, hookPath])).toEqual(before);
    } finally {
      absent.dispose();
      inert.dispose();
    }
  });
});
