/**
 * GH-350 TC-MIG-009/010/014 (checks arms) — the migration through the composed
 * CLI: the report carries the same facts in both modes, `--write` creates one
 * document or refuses `target-exists`, and the invocation grammar refuses before
 * any read.
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
import type { ProviderComposition } from "@delivery-os/core/contracts";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const TMP_ROOT = join(process.cwd(), "tmp/tmpdir");
const PRIOR_DIR = ".delivery-os";
const CONFIG_DIR = ".jaiship";

type Tree = {
  readonly root: string;
  readonly repo: string;
  readonly home: string;
  readonly profilesDir: string;
  readonly hookPath: string;
  readonly target: string;
  write(path: string, text: string): void;
  dispose(): void;
};

const tree = (label: string): Tree => {
  mkdirSync(TMP_ROOT, { recursive: true });
  const root = mkdtempSync(join(TMP_ROOT, `gh350-migrate-cli-${label}-`));
  const repo = join(root, "repo");
  const home = join(root, "home");
  mkdirSync(join(repo, ".git"), { recursive: true });
  return {
    root,
    repo,
    home,
    profilesDir: join(home, PRIOR_DIR, "config", "profiles"),
    hookPath: join(home, PRIOR_DIR, "hooks", "pre-opencode-iteration"),
    target: join(repo, CONFIG_DIR, "config.yaml"),
    write: (path, text) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    },
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
};

type Run = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
  readonly reads: readonly string[];
};

const run = async (
  scratch: Tree,
  argv: readonly string[],
  options: { readonly readText?: (path: string) => string; readonly cwd?: string } = {},
): Promise<Run> => {
  const reads: string[] = [];
  const storeRoot = makeTempRoot("gh350-migrate-cli-state");
  try {
    const { store } = openStore(makeIdentity(storeRoot));
    const provider: ProviderComposition = {
      clock: { nowMs: () => 0 },
      credentialPort: { resolve: () => ({ ok: true, material: { value: "" } }) },
      transport: { send: async () => ({ status: 200, bodyText: "{}" }) },
      sleep: { sleep: async () => undefined },
      stateStore: store,
      newFenceToken: () => "fence-migrate-cli",
      migrateFs: {
        exists: (path) => existsSync(path),
        readText: (path) => {
          reads.push(path);
          return (options.readText ?? ((value) => readFileSync(value, "utf8")))(path);
        },
        readDirectory: (path) => readdirSync(path),
      },
    };
    const program = createConfigProgram({
      workingName: "jaiship",
      environment: { HOME: scratch.home },
      cwd: options.cwd ?? scratch.repo,
      homeDirectory: scratch.home,
      platform: "linux",
      priorConfigurationDirectoryName: PRIOR_DIR,
      fs: {
        exists: (path) => path === scratch.target,
        readText: (path) => readFileSync(path, "utf8"),
      },
      repositoryIo: {
        exists: (path) => path === join(scratch.repo, ".git"),
        isFile: () => false,
        readText: () => "",
      },
      provider,
    });
    if (!program.ok) throw new Error("compose");
    let stdout = "";
    let stderr = "";
    const deps: CliDependencies = {
      brand: program.brand,
      clock: { now: () => 0 },
      newRunId: () => "run-gh350-migrate-cli",
      secrets: program.secrets,
      program: program.program,
    };
    const exitCode = await runCli(
      ["provider", ...argv],
      {
        stdout: { write: (chunk: string) => (stdout += chunk) },
        stderr: { write: (chunk: string) => (stderr += chunk) },
      },
      deps,
    );
    const parsed = stdout.trim().startsWith("{")
      ? (JSON.parse(stdout) as Record<string, unknown>)
      : undefined;
    return {
      exitCode,
      stdout,
      stderr,
      ...(parsed === undefined
        ? {}
        : {
            ...(parsed.data === undefined ? {} : { data: parsed.data as Record<string, unknown> }),
            ...(parsed.error === undefined ? {} : { error: parsed.error as Run["error"] }),
          }),
      reads,
    };
  } finally {
    removeRoot(storeRoot);
  }
};

const SOURCE = (): string =>
  `${[
    "ADOS_ZAI_PEAK_START_UTC=21600",
    "ADOS_ZAI_PEAK_END_UTC=36000",
    "OC_ADOS_AGENT_RAVEN_MODEL=anthropic/claude",
    "ADOS_HOOK_AGENT=pm",
    "ZAI_API_KEY=sk-live-canary",
  ].join("\n")}\n`;

describe("TC-MIG-014 the report discloses the whole effect in both modes", () => {
  test("human and machine modes carry the same facts, and --write names the path", async () => {
    const scratch = tree("report");
    try {
      scratch.write(join(scratch.profilesDir, "zai.sh"), SOURCE());
      const human = await run(scratch, ["migrate", "legacy"]);
      expect(human.exitCode).toBe(0);
      expect(human.stdout).toContain('$schema: "delivery.config.v1"');
      expect(human.stdout).toContain("startSecondsOfDay: 21600");
      expect(human.stderr).toContain("migrate sources:");
      expect(human.stderr).toContain("profiles");
      expect(human.stderr).toContain("hook");
      expect(human.stderr).toContain("read ");

      const machine = await run(scratch, ["migrate", "legacy", "--json"]);
      expect(machine.exitCode).toBe(0);
      const report = machine.data?.report as {
        sources: Array<{ kind: string; state: string; bytes?: number }>;
        mapped: Array<{ name: string }>;
        unmapped: string[];
      };
      expect(report.sources.map((source) => `${source.kind}:${source.state}`)).toEqual([
        "profiles:read",
        "hook:absent",
      ]);
      expect(report.sources[0]?.bytes).toBeGreaterThan(0);
      expect(report.mapped.map((entry) => entry.name)).toEqual([
        "ADOS_ZAI_PEAK_START_UTC",
        "ADOS_ZAI_PEAK_END_UTC",
        "ZAI_API_KEY",
      ]);
      // The per-agent model needs the profile literal; without it the name is
      // disclosed and omitted rather than guessed (TC-MIG-007).
      expect(report.unmapped).toEqual(["OC_ADOS_AGENT_RAVEN_MODEL", "ADOS_HOOK_AGENT"]);

      const written = await run(scratch, ["migrate", "legacy", "--write", "--json"]);
      expect(written.exitCode).toBe(0);
      const writtenData = written.data;
      if (writtenData === undefined) throw new Error("no written data");
      expect((writtenData.report as { writtenPath: string }).writtenPath).toBe(scratch.target);
      expect(readFileSync(scratch.target, "utf8")).toBe(writtenData.proposal as string);
    } finally {
      scratch.dispose();
    }
  });
});

describe("TC-MIG-010 --write never merges and never touches a legacy file", () => {
  test("an existing project-committed document refuses target-exists without being read", async () => {
    const scratch = tree("target-exists");
    try {
      scratch.write(join(scratch.profilesDir, "zai.sh"), SOURCE());
      scratch.write(scratch.target, "provider:\n  defaultChain: keep\n");
      const before = readFileSync(scratch.target, "utf8");
      const result = await run(scratch, ["migrate", "legacy", "--write", "--json"]);
      expect(result.exitCode).toBe(1);
      expect(result.error?.code).toBe("provider.migrate.refused");
      expect(result.error?.summary).toContain("target-exists");
      expect(result.reads).not.toContain(scratch.target);
      expect(readFileSync(scratch.target, "utf8")).toBe(before);
      expect(result.stdout).not.toContain("provider:");
    } finally {
      scratch.dispose();
    }
  });
});

describe("the migration invocation grammar refuses before any read", () => {
  test("a missing subcommand, an undeclared positional and an undeclared flag each refuse", async () => {
    const scratch = tree("grammar");
    try {
      scratch.write(join(scratch.profilesDir, "zai.sh"), SOURCE());
      const missing = await run(scratch, ["migrate", "--json"]);
      expect(missing.exitCode).toBe(1);
      expect(missing.error?.code).toBe("input.value.rejected");
      const positional = await run(scratch, ["migrate", "legacy", "extra", "--json"]);
      expect(positional.exitCode).toBe(1);
      expect(positional.error?.code).toBe("input.value.rejected");
      const flag = await run(scratch, ["migrate", "legacy", "--chain", "x", "--json"]);
      expect(flag.exitCode).toBe(1);
      expect(flag.error?.code).toBe("input.value.rejected");
      const unknown = await run(scratch, ["migrate", "legacy", "--bogus", "--json"]);
      expect(unknown.exitCode).toBe(1);
      expect(unknown.error?.code).toBe("fallback.invocation");
    } finally {
      scratch.dispose();
    }
  });
});

/**
 * GH-350 B1/NB1/NB2 (review remediation) — the migration target is the
 * effective checkout root, never the process cwd, and only the write path needs
 * a checkout.
 *
 * A write from a subdirectory used to create `<cwd>/.jaiship/config.yaml`, a
 * document no configuration layer reads, while reporting success; the
 * `target-exists` check looked at the same wrong path. The root now resolves
 * from `findGitRoot(cwd)` inside the write branch only, `--project-root` is not
 * a provider flag (this change adds none), and a read-only run outside a
 * checkout still prints its proposal.
 */
describe("GH-350 B1/NB1/NB2 provider migrate legacy writes the effective checkout root", () => {
  const written = (run: Run): string => {
    const report = run.data?.report as { writtenPath?: string } | undefined;
    if (report?.writtenPath === undefined) throw new Error("no writtenPath in the report");
    return report.writtenPath;
  };

  test("from a subdirectory the document lands at the checkout root, not the cwd", async () => {
    const scratch = tree("b1-subdir");
    try {
      scratch.write(join(scratch.profilesDir, "zai.sh"), SOURCE());
      const nested = join(scratch.repo, "nested", "deep");
      mkdirSync(nested, { recursive: true });
      const result = await run(scratch, ["migrate", "legacy", "--write", "--json"], {
        cwd: nested,
      });
      expect(result.exitCode).toBe(0);
      expect(written(result)).toBe(scratch.target);
      expect(existsSync(scratch.target)).toBe(true);
      expect(existsSync(join(nested, CONFIG_DIR, "config.yaml"))).toBe(false);
    } finally {
      scratch.dispose();
    }
  });

  test("a read-only run outside a checkout still produces the proposal", async () => {
    const scratch = tree("nb1-read-only-outside");
    try {
      scratch.write(join(scratch.profilesDir, "zai.sh"), SOURCE());
      const outside = join(scratch.root, "outside");
      mkdirSync(outside, { recursive: true });
      const result = await run(scratch, ["migrate", "legacy", "--json"], { cwd: outside });
      expect(result.exitCode).toBe(0);
      expect(result.error).toBeUndefined();
      const proposal = result.data?.proposal as string | undefined;
      expect(proposal).toContain('$schema: "delivery.config.v1"');
      expect(proposal).toContain("startSecondsOfDay: 21600");
      expect(existsSync(join(outside, CONFIG_DIR, "config.yaml"))).toBe(false);
      expect(existsSync(scratch.target)).toBe(false);
    } finally {
      scratch.dispose();
    }
  });

  test("a write outside a checkout refuses with the typed no-checkout reason", async () => {
    const scratch = tree("b1-no-checkout");
    try {
      scratch.write(join(scratch.profilesDir, "zai.sh"), SOURCE());
      const outside = join(scratch.root, "outside");
      mkdirSync(outside, { recursive: true });
      const result = await run(scratch, ["migrate", "legacy", "--write", "--json"], {
        cwd: outside,
      });
      expect(result.exitCode).toBe(1);
      expect(result.error?.code).toBe("provider.migrate.refused");
      expect(result.error?.summary).toContain("(no-checkout)");
      expect(result.error?.summary).toContain("run the write inside a checkout");
      expect(result.error?.summary).not.toContain("--project-root");
      expect(existsSync(join(outside, CONFIG_DIR, "config.yaml"))).toBe(false);
      expect(existsSync(scratch.target)).toBe(false);
    } finally {
      scratch.dispose();
    }
  });

  test("--project-root is not a provider flag (this change adds none)", async () => {
    const scratch = tree("nb2-no-flag");
    try {
      scratch.write(join(scratch.profilesDir, "zai.sh"), SOURCE());
      const result = await run(
        scratch,
        ["migrate", "legacy", "--project-root", scratch.repo, "--json"],
        { cwd: scratch.repo },
      );
      expect(result.exitCode).toBe(1);
      expect(result.error?.code).toBe("fallback.invocation");
    } finally {
      scratch.dispose();
    }
  });
});
