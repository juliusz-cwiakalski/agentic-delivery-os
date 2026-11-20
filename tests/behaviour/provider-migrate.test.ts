/**
 * GH-350 TC-MIG-001..TC-MIG-013, TC-MIG-015 — `provider migrate legacy` reads
 * the legacy profile directory and hook as DATA, maps literals under the closed
 * table, refuses the whole run on any construct, keeps credential values out of
 * every surface, and writes only a new project-committed document.
 *
 * Every case materialises a scratch home, checkout, and legacy tree under
 * `tmp/tmpdir`; the migration's file facts are injected over the real node facts
 * with per-path read counters, so "read once" and "never opened" are positive
 * observations. The one shell execution in this file is the TC-MIG-004 positive
 * control, run through `Bun.spawnSync`.
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import type { ProviderComposition } from "@delivery-os/core/contracts";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const TMP_ROOT = join(process.cwd(), "tmp/tmpdir");
const PRIOR_DIR = ".delivery-os";
const CONFIG_DIR = ".jaiship";
const SHIPPED_HOOK = join(process.cwd(), "scripts/hooks/pre-opencode-iteration-zai.sh");

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
  const root = mkdtempSync(join(TMP_ROOT, `gh350-migrate-${label}-`));
  const repo = join(root, "repo");
  const home = join(root, "home");
  mkdirSync(join(repo, ".git"), { recursive: true });
  const profilesDir = join(home, PRIOR_DIR, "config", "profiles");
  const hookPath = join(home, PRIOR_DIR, "hooks", "pre-opencode-iteration");
  const write = (path: string, text: string): void => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  };
  return {
    root,
    repo,
    home,
    profilesDir,
    hookPath,
    target: join(repo, CONFIG_DIR, "config.yaml"),
    write,
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
};

type Counts = {
  readonly reads: readonly string[];
  readonly exists: readonly string[];
  readonly lists: readonly string[];
};

const nodeFacts = () => {
  const reads: string[] = [];
  const exists: string[] = [];
  const lists: string[] = [];
  return {
    facts: {
      exists: (path: string) => {
        exists.push(path);
        return existsSync(path);
      },
      readText: (path: string) => {
        reads.push(path);
        return readFileSync(path, "utf8");
      },
      readDirectory: (path: string) => {
        lists.push(path);
        return readdirSync(path);
      },
    },
    counts: (): Counts => ({ reads: [...reads], exists: [...exists], lists: [...lists] }),
  };
};

type Run = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
  readonly counts: Counts;
};

const run = async (
  scratch: Tree,
  argv: readonly string[],
  options: {
    readonly cwd?: string;
    readonly failRead?: string;
    readonly environment?: Readonly<Record<string, string | undefined>>;
  } = {},
): Promise<Run> => {
  const recorder = nodeFacts();
  const storeRoot = makeTempRoot("gh350-migrate-state");
  try {
    const { store } = openStore(makeIdentity(storeRoot));
    const cwd = options.cwd ?? scratch.repo;
    const provider: ProviderComposition = {
      clock: { nowMs: () => 0 },
      credentialPort: { resolve: () => ({ ok: true, material: { value: "" } }) },
      transport: { send: async () => ({ status: 200, bodyText: "{}" }) },
      sleep: { sleep: async () => undefined },
      stateStore: store,
      newFenceToken: () => "fence-migrate",
      migrateFs: {
        exists: recorder.facts.exists,
        readText: (path) => {
          if (options.failRead !== undefined && path === options.failRead) {
            throw new Error("unreadable");
          }
          return recorder.facts.readText(path);
        },
        readDirectory: recorder.facts.readDirectory,
      },
    };
    const program = createConfigProgram({
      workingName: "jaiship",
      environment: { HOME: scratch.home, ...options.environment },
      cwd,
      homeDirectory: scratch.home,
      platform: "linux",
      priorConfigurationDirectoryName: PRIOR_DIR,
      fs: {
        exists: (path) => path === join(cwd, CONFIG_DIR, "config.yaml"),
        readText: (path) => readFileSync(path, "utf8"),
      },
      repositoryIo: {
        exists: (path) => path === join(cwd, ".git"),
        isFile: () => false,
        readText: () => "",
      },
      provider,
    });
    if (!program.ok) throw new Error("the provider program did not compose");
    let stdout = "";
    let stderr = "";
    const deps: CliDependencies = {
      brand: program.brand,
      clock: { now: () => 0 },
      newRunId: () => "run-gh350-migrate",
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
      counts: recorder.counts(),
    };
  } finally {
    removeRoot(storeRoot);
  }
};

const proposalOf = (result: Run): string => {
  const data = result.data;
  if (data === undefined) throw new Error(`no data: ${result.stdout}${result.stderr}`);
  return data.proposal as string;
};

const reportOf = (result: Run): Record<string, unknown> => {
  const data = result.data;
  if (data === undefined) throw new Error(`no report: ${result.stdout}${result.stderr}`);
  return data.report as Record<string, unknown>;
};

const VALID = "ADOS_ZAI_PEAK_START_UTC=21600\nADOS_ZAI_PEAK_END_UTC=36000\n";

const treeSnapshot = (root: string): readonly string[] => {
  const entries: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      const stat = statSync(path, { bigint: true });
      entries.push(
        `${relative(root, path)}|${stat.mode}|${stat.mtimeNs}|${createHash("sha256")
          .update(readFileSync(path))
          .digest("hex")}`,
      );
    }
  };
  if (existsSync(root)) walk(root);
  return entries.sort();
};

/* -------------------------------- TC-MIG-001 ----------------------------- */

describe("TC-MIG-001 source discovery, overrides, and the absent/no-source split", () => {
  test("both present: both sources read once and one proposal is emitted", async () => {
    const scratch = tree("both");
    try {
      scratch.write(join(scratch.profilesDir, "zai.sh"), VALID);
      scratch.write(scratch.hookPath, "ADOS_ZAI_BUFFER_SECONDS=1800\n");
      const result = await run(scratch, ["migrate", "legacy", "--json"]);
      expect(result.exitCode).toBe(0);
      expect(result.counts.reads.filter((path) => path.endsWith("zai.sh"))).toHaveLength(1);
      expect(result.counts.reads.filter((path) => path === scratch.hookPath)).toHaveLength(1);
      expect(proposalOf(result)).toContain("bufferSeconds: 1800");
    } finally {
      scratch.dispose();
    }
  });

  test("profiles-only reports the hook absent and still migrates", async () => {
    const scratch = tree("profiles-only");
    try {
      scratch.write(join(scratch.profilesDir, "zai.sh"), VALID);
      const result = await run(scratch, ["migrate", "legacy", "--json"]);
      expect(result.exitCode).toBe(0);
      const report = reportOf(result) as { sources: Array<{ kind: string; state: string }> };
      expect(report.sources.find((source) => source.kind === "hook")?.state).toBe("absent");
      expect(proposalOf(result)).toContain("startSecondsOfDay: 21600");
    } finally {
      scratch.dispose();
    }
  });

  test("hook-only reports the profiles absent and still migrates", async () => {
    const scratch = tree("hook-only");
    try {
      scratch.write(scratch.hookPath, "ADOS_ZAI_MAX_SLEEP_LOOPS=12\n");
      const result = await run(scratch, ["migrate", "legacy", "--json"]);
      expect(result.exitCode).toBe(0);
      const report = reportOf(result) as { sources: Array<{ kind: string; state: string }> };
      expect(report.sources.find((source) => source.kind === "profiles")?.state).toBe("absent");
      expect(proposalOf(result)).toContain("maxSleepLoops: 12");
    } finally {
      scratch.dispose();
    }
  });

  test("both absent refuses no-source at exit 1", async () => {
    const scratch = tree("absent");
    try {
      const result = await run(scratch, ["migrate", "legacy", "--json"]);
      expect(result.exitCode).toBe(1);
      expect(result.error?.code).toBe("provider.migrate.refused");
      expect(result.error?.summary).toContain("no-source");
      expect(result.stdout).not.toContain("provider:");
    } finally {
      scratch.dispose();
    }
  });

  test("the overrides win and the default paths are never opened", async () => {
    const scratch = tree("override");
    try {
      const alt = join(scratch.root, "alt");
      scratch.write(join(scratch.profilesDir, "default.sh"), "ADOS_ZAI_PEAK_START_UTC=1\n");
      scratch.write(scratch.hookPath, "ADOS_ZAI_PEAK_END_UTC=2\n");
      scratch.write(join(alt, "profiles", "chosen.sh"), "ADOS_ZAI_PEAK_START_UTC=32400\n");
      scratch.write(join(alt, "hook"), "ADOS_ZAI_PEAK_END_UTC=46800\n");
      const result = await run(scratch, [
        "migrate",
        "legacy",
        "--profiles-dir",
        join(alt, "profiles"),
        "--hook",
        join(alt, "hook"),
        "--json",
      ]);
      expect(result.exitCode).toBe(0);
      expect(result.counts.reads).not.toContain(join(scratch.profilesDir, "default.sh"));
      expect(result.counts.reads).not.toContain(scratch.hookPath);
      expect(result.counts.lists).not.toContain(scratch.profilesDir);
      const proposal = proposalOf(result);
      expect(proposal).toContain("startSecondsOfDay: 32400");
      expect(proposal).toContain("endSecondsOfDay: 46800");
    } finally {
      scratch.dispose();
    }
  });
});

/* -------------------------------- TC-MIG-002 ----------------------------- */

describe("TC-MIG-002 the accepted subset is exactly the declared grammar", () => {
  test("comments are ignored entirely and quoted and bare tokens copy verbatim", async () => {
    const scratch = tree("subset");
    try {
      const canary = join(scratch.root, "comment-canary");
      scratch.write(
        join(scratch.profilesDir, "zai.sh"),
        [
          "# a comment with $(touch /tmp/does-not-matter)",
          `# another with ; rm -rf / ${canary}`,
          "",
          "OC_ADOS_MODEL_PROFILE=balanced",
          "OC_ADOS_AGENT_RAVEN_MODEL='anthropic/claude'",
          'ADOS_ZAI_PEAK_START_UTC="21600"',
          "ADOS_ZAI_PEAK_END_UTC=36000",
          "export ADOS_ZAI_BUFFER_SECONDS=7200",
          "ZAI_API_KEY=sk-live-canary",
        ].join("\n"),
      );
      const result = await run(scratch, ["migrate", "legacy", "--json"]);
      expect(result.exitCode).toBe(0);
      const proposal = proposalOf(result);
      expect(proposal).toContain('base: "balanced"');
      expect(proposal).toContain('model: "anthropic/claude"');
      expect(proposal).toContain("startSecondsOfDay: 21600");
      expect(proposal).toContain("bufferSeconds: 7200");
      expect(proposal).not.toContain("does-not-matter");
      expect(result.stdout).not.toContain("rm -rf");
      expect(existsSync(canary)).toBe(false);
      const report = reportOf(result) as { mapped: Array<{ name: string }> };
      expect(report.mapped.map((entry) => entry.name)).toEqual([
        "OC_ADOS_MODEL_PROFILE",
        "OC_ADOS_AGENT_RAVEN_MODEL",
        "ADOS_ZAI_PEAK_START_UTC",
        "ADOS_ZAI_PEAK_END_UTC",
        "ADOS_ZAI_BUFFER_SECONDS",
        "ZAI_API_KEY",
      ]);
    } finally {
      scratch.dispose();
    }
  });
});

/* -------------------------------- TC-MIG-003 ----------------------------- */

const CONSTRUCTS: readonly {
  readonly label: string;
  readonly construct: string;
  readonly reason: "shell-construct" | "dynamic-value";
  readonly line?: number;
}[] = [
  { label: "function definition", construct: "foo() {\n  echo hi\n}", reason: "shell-construct" },
  { label: "compound command", construct: "a=1; b=2", reason: "shell-construct" },
  { label: "source", construct: "source /tmp/policy", reason: "shell-construct" },
  { label: "dot-source", construct: ". /tmp/policy", reason: "shell-construct" },
  { label: "eval", construct: 'eval "echo hi"', reason: "shell-construct" },
  { label: "set", construct: "set -e", reason: "shell-construct" },
  { label: "unset", construct: "unset X", reason: "shell-construct" },
  { label: "readonly", construct: "readonly X=1", reason: "shell-construct" },
  { label: "heredoc", construct: "cat <<EOF", reason: "shell-construct" },
  {
    label: "redirection",
    construct: "ADOS_ZAI_BUFFER_SECONDS=1 > /tmp/out",
    reason: "shell-construct",
  },
  { label: "pipeline", construct: "ADOS_ZAI_BUFFER_SECONDS=1 | cat", reason: "shell-construct" },
  {
    label: "command substitution",
    construct: "ADOS_ZAI_BUFFER_SECONDS=$(touch /tmp/x)",
    reason: "dynamic-value",
  },
  {
    label: "arithmetic expansion",
    construct: "ADOS_ZAI_BUFFER_SECONDS=$((1+1))",
    reason: "dynamic-value",
  },
  { label: "array", construct: "arr=(a b)", reason: "shell-construct" },
  { label: "multi-command line", construct: "true; false", reason: "shell-construct" },
  {
    label: "expansion-bearing value",
    construct: `ADOS_ZAI_BUFFER_SECONDS=\${HOME}`,
    reason: "dynamic-value",
  },
];

describe("TC-MIG-003 anything outside the subset refuses the whole run", () => {
  test("16/16 constructs refuse with one identity, the declared reason, path and line, empty stdout", async () => {
    for (const entry of CONSTRUCTS) {
      const scratch = tree(`construct-${entry.label.replaceAll(" ", "-")}`);
      try {
        const file = join(scratch.profilesDir, "bad.sh");
        scratch.write(file, `${VALID}${entry.construct}\n`);
        const before = treeSnapshot(scratch.root);
        const result = await run(scratch, ["migrate", "legacy", "--json"]);
        expect(result.exitCode, entry.label).toBe(1);
        expect(result.error?.code, entry.label).toBe("provider.migrate.refused");
        expect(result.error?.summary, entry.label).toContain(entry.reason);
        expect(result.error?.summary, entry.label).toContain(file);
        const line = entry.line ?? 3;
        expect(result.error?.summary, entry.label).toContain(`:${line}`);
        expect(result.stdout, entry.label).not.toContain("provider:");
        expect(treeSnapshot(scratch.root), entry.label).toEqual(before);
      } finally {
        scratch.dispose();
      }
    }
  });
});

/* -------------------------------- TC-MIG-004 ----------------------------- */

describe("TC-MIG-004 nothing is executed, sourced, word-split, or shelled out", () => {
  test("hostile sources create no canary, and the control arm's shell does", async () => {
    const scratch = tree("noexec");
    try {
      const canary = join(scratch.root, "executed-canary");
      scratch.write(
        join(scratch.profilesDir, "hostile.sh"),
        [
          `ADOS_ZAI_BUFFER_SECONDS=$(touch ${canary}-substitution)`,
          `ADOS_ZAI_BUFFER_SECONDS=\`touch ${canary}-backtick\``,
          `eval "touch ${canary}-eval"`,
          `source ${canary}-source`,
          `exec 3>${canary}-redirect`,
        ].join("\n"),
      );
      const result = await run(scratch, ["migrate", "legacy", "--json"]);
      expect(result.exitCode).toBe(1);
      expect(existsSync(canary)).toBe(false);
      for (const suffix of ["-substitution", "-backtick", "-eval", "-source", "-redirect"]) {
        expect(existsSync(`${canary}${suffix}`), suffix).toBe(false);
      }
      // Positive control: the same text executed by a real shell does create it,
      // so the absence above is "not executed", not "not looked for".
      const control = `${canary}-control`;
      Bun.spawnSync(["bash", "-c", `touch ${control}`]);
      expect(existsSync(control)).toBe(true);
    } finally {
      scratch.dispose();
    }
  });
});

/* -------------------------------- TC-MIG-005 ----------------------------- */

describe("TC-MIG-005 the credential firewall classifies the name first", () => {
  const CREDENTIALS: readonly [string, string][] = [
    ["OPENAI_API_KEY", "CANARY-API-KEY-1"],
    ["OPENAI_API_TOKEN", "CANARY-API-TOKEN-2"],
    ["GITHUB_ACCESS_TOKEN", "CANARY-ACCESS-TOKEN-3"],
    ["SERVICE_SECRET", "CANARY-SECRET-4"],
    ["DB_PASSWORD", "CANARY-PASSWORD-5"],
    ["DEPLOY_PRIVATE_KEY", "CANARY-PRIVATE-KEY-6"],
    ["APP_CLIENT_SECRET", "CANARY-CLIENT-SECRET-7"],
  ];

  test("7/7 produce only a reference and no canary reaches any output", async () => {
    const scratch = tree("firewall");
    try {
      const lines = CREDENTIALS.map(([name, value]) => `${name}='${value}'`);
      scratch.write(join(scratch.profilesDir, "creds.sh"), `${lines.join("\n")}\n`);
      const result = await run(scratch, ["migrate", "legacy", "--json"]);
      expect(result.exitCode).toBe(0);
      const proposal = proposalOf(result);
      for (const [, value] of CREDENTIALS) {
        expect(result.stdout).not.toContain(value);
        expect(result.stderr).not.toContain(value);
      }
      expect(proposal).not.toContain("CANARY-");
      const report = reportOf(result) as { mapped: Array<{ name: string; target: string }> };
      expect(report.mapped.map((entry) => entry.name)).toEqual(CREDENTIALS.map(([name]) => name));
      expect(report.mapped.map((entry) => entry.target)).toEqual([
        "provider.credentials.openai.sourceKey",
        "provider.credentials.openai.sourceKey",
        "provider.credentials.github.sourceKey",
        "provider.credentials.service.sourceKey",
        "provider.credentials.db.sourceKey",
        "provider.credentials.deploy.sourceKey",
        "provider.credentials.app-client.sourceKey",
      ]);
    } finally {
      scratch.dispose();
    }
  });

  test("a non-credential value is not blanket-redacted", async () => {
    const scratch = tree("firewall-control");
    try {
      scratch.write(
        join(scratch.profilesDir, "zai.sh"),
        "OC_ADOS_MODEL_PROFILE=visible-value\nZAI_API_KEY=CANARY-HIDDEN\n",
      );
      const result = await run(scratch, ["migrate", "legacy", "--json"]);
      expect(result.exitCode).toBe(0);
      expect(proposalOf(result)).toContain("visible-value");
      expect(result.stdout).not.toContain("CANARY-HIDDEN");
    } finally {
      scratch.dispose();
    }
  });
});

/* -------------------------------- TC-MIG-006 ----------------------------- */

describe("TC-MIG-006 the mapping table is literal-to-literal and closed", () => {
  test("every recognised name maps to its declared target with the literal copied", async () => {
    const scratch = tree("mapping");
    try {
      scratch.write(
        join(scratch.profilesDir, "all.sh"),
        `${[
          "OC_ADOS_MODEL_PROFILE=balanced",
          "OC_ADOS_AGENT_RAVEN_MODEL=anthropic/claude",
          "ADOS_ZAI_PEAK_START_UTC=21600",
          "ADOS_ZAI_PEAK_END_UTC=36000",
          "ADOS_ZAI_BUFFER_SECONDS=7200",
          "ADOS_ZAI_MAX_SLEEP_LOOPS=24",
          "ADOS_ZAI_QUOTA_DISABLED=1",
          "ZAI_API_KEY=sk-live-canary",
        ].join("\n")}\n`,
      );
      const result = await run(scratch, ["migrate", "legacy", "--json"]);
      expect(result.exitCode).toBe(0);
      const proposal = proposalOf(result);
      expect(proposal).toContain('base: "balanced"');
      expect(proposal).toContain("startSecondsOfDay: 21600");
      expect(proposal).toContain("endSecondsOfDay: 36000");
      expect(proposal).toContain("bufferSeconds: 7200");
      expect(proposal).toContain("maxSleepLoops: 24");
      expect(proposal).toContain("enabled: false");
      expect(proposal).toContain('name: "ZAI_API_KEY"');
      const report = reportOf(result) as { mapped: Array<{ name: string; target: string }> };
      expect(report.mapped).toHaveLength(8);
      expect(report.mapped.map((entry) => entry.target)).toContain(
        "provider.profiles.profiles.balanced.seats.raven.model",
      );
    } finally {
      scratch.dispose();
    }
  });

  test("ADOS_ZAI_QUOTA_DISABLED translates only 1 and 0; absent is no mapping; anything else refuses", async () => {
    const translate = async (line: string) => {
      const scratch = tree("quota-disabled");
      try {
        scratch.write(
          join(scratch.profilesDir, "zai.sh"),
          `ADOS_ZAI_PEAK_START_UTC=21600\n${line}`,
        );
        return { result: await run(scratch, ["migrate", "legacy", "--json"]), scratch };
      } finally {
        scratch.dispose();
      }
    };
    const one = await translate("ADOS_ZAI_QUOTA_DISABLED=1");
    expect(proposalOf(one.result)).toContain("enabled: false");
    const zero = await translate("ADOS_ZAI_QUOTA_DISABLED=0");
    expect(proposalOf(zero.result)).toContain("enabled: true");
    const absent = await translate("");
    expect(proposalOf(absent.result)).not.toContain("enabled:");
    const yes = await translate("ADOS_ZAI_QUOTA_DISABLED=yes");
    expect(yes.result.exitCode).toBe(1);
    expect(yes.result.error?.summary).toContain("dynamic-value");
  });
});

/* -------------------------------- TC-MIG-007 ----------------------------- */

describe("TC-MIG-007 unaddressable and unrecognised names are disclosed and omitted", () => {
  test("five names appear in declared order, by name only, in no target", async () => {
    const scratch = tree("unmapped");
    try {
      scratch.write(
        join(scratch.profilesDir, "zai.sh"),
        `${[
          "SOMETHING_UNKNOWN=1",
          "ADOS_ZAI_CONDITIONS=busy",
          "ADOS_HOOK_AGENT=pm",
          "ADOS_HOOK_ENV_V1=1",
          "OC_ADOS_AGENT_X_MODEL=some/model",
        ].join("\n")}\n`,
      );
      const result = await run(scratch, ["migrate", "legacy", "--json"]);
      expect(result.exitCode).toBe(0);
      const report = reportOf(result) as { unmapped: string[]; mapped: unknown[] };
      expect(report.unmapped).toEqual([
        "SOMETHING_UNKNOWN",
        "ADOS_ZAI_CONDITIONS",
        "ADOS_HOOK_AGENT",
        "ADOS_HOOK_ENV_V1",
        "OC_ADOS_AGENT_X_MODEL",
      ]);
      expect(report.mapped).toEqual([]);
      const proposal = proposalOf(result);
      expect(proposal).toContain("provider: {}");
      expect(proposal).not.toContain("some/model");
      expect(proposal).not.toContain("busy");
    } finally {
      scratch.dispose();
    }
  });
});

/* -------------------------------- TC-MIG-008 ----------------------------- */

describe("TC-MIG-008 the proposal is deterministic and validated before output", () => {
  test("two builds are byte-identical, carry only the provider branch, and pass the delivered schema", async () => {
    const scratch = tree("deterministic");
    try {
      scratch.write(join(scratch.profilesDir, "zai.sh"), `${VALID}ADOS_HOOK_AGENT=pm\n`);
      const first = await run(scratch, ["migrate", "legacy", "--json"]);
      const second = await run(scratch, ["migrate", "legacy", "--json"]);
      expect(first.exitCode).toBe(0);
      expect(proposalOf(second)).toBe(proposalOf(first));
      const proposal = proposalOf(first);
      const keys = proposal
        .split("\n")
        .filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith(" "))
        .map((line) => line.split(":")[0]);
      expect(keys).toEqual(["$schema", "provider"]);
      expect(proposal).not.toContain("generator");
      expect(proposal).toContain("# unmapped names: ADOS_HOOK_AGENT");
      expect(proposal).toContain("startSecondsOfDay: 21600");
    } finally {
      scratch.dispose();
    }
  });
});

/* -------------------------------- TC-MIG-009 ----------------------------- */

describe("TC-MIG-009 every emitted proposal is accepted by the configuration path", () => {
  test("10/10 proposals resolve through a composed config read", async () => {
    const variants = [
      "ADOS_ZAI_PEAK_START_UTC=21600",
      "ADOS_ZAI_PEAK_START_UTC=21601",
      "ADOS_ZAI_PEAK_END_UTC=36000",
      "ADOS_ZAI_PEAK_END_UTC=36001",
      "ADOS_ZAI_BUFFER_SECONDS=7200",
      "ADOS_ZAI_BUFFER_SECONDS=1800",
      "ADOS_ZAI_MAX_SLEEP_LOOPS=24",
      "ADOS_ZAI_MAX_SLEEP_LOOPS=12",
      "ADOS_ZAI_QUOTA_DISABLED=1",
      "ADOS_ZAI_QUOTA_DISABLED=0",
    ];
    for (const [index, line] of variants.entries()) {
      const scratch = tree(`config-read-${index}`);
      try {
        scratch.write(join(scratch.profilesDir, "zai.sh"), `${line}\nZAI_API_KEY=sk-live-canary\n`);
        const migrated = await run(scratch, ["migrate", "legacy", "--json"]);
        expect(migrated.exitCode, line).toBe(0);
        scratch.write(scratch.target, proposalOf(migrated));
        const program = createConfigProgram({
          workingName: "jaiship",
          environment: { HOME: scratch.home },
          cwd: scratch.repo,
          homeDirectory: scratch.home,
          platform: "linux",
          fs: {
            exists: (path) => path === scratch.target,
            readText: (path) => readFileSync(path, "utf8"),
          },
          repositoryIo: {
            exists: (path) => path === join(scratch.repo, ".git"),
            isFile: () => false,
            readText: () => "",
          },
        });
        if (!program.ok) throw new Error("compose");
        const definition = program.program.commands.config;
        if (definition === undefined) throw new Error("config command absent");
        const config = (await definition.handler({
          command: "config",
          flags: {},
          argv: [],
          positionals: ["debug"],
          brand: program.brand,
        } as never)) as { data?: { config?: Record<string, unknown> }; error?: unknown };
        expect(config.error, line).toBeUndefined();
        expect(config.data?.config?.provider, line).toBeDefined();
      } finally {
        scratch.dispose();
      }
    }
  });

  test("a mapped value that cannot satisfy the schema refuses proposal-invalid with empty stdout", async () => {
    const scratch = tree("proposal-invalid");
    try {
      scratch.write(join(scratch.profilesDir, "zai.sh"), "ADOS_ZAI_PEAK_START_UTC=not-a-number\n");
      const result = await run(scratch, ["migrate", "legacy", "--json"]);
      expect(result.exitCode).toBe(1);
      expect(result.error?.code).toBe("provider.migrate.refused");
      expect(result.error?.summary).toContain("proposal-invalid");
      expect(result.stdout).not.toContain("provider:");
    } finally {
      scratch.dispose();
    }
  });
});

/* -------------------------------- TC-MIG-010 ----------------------------- */

describe("TC-MIG-010 --write creates at most one document and never merges", () => {
  test("absent: exactly one new file whose bytes equal the proposal; nothing else changes", async () => {
    const scratch = tree("write-absent");
    try {
      scratch.write(join(scratch.profilesDir, "zai.sh"), VALID);
      const legacyBefore = treeSnapshot(join(scratch.home, PRIOR_DIR));
      const result = await run(scratch, ["migrate", "legacy", "--write", "--json"]);
      expect(result.exitCode).toBe(0);
      expect(readFileSync(scratch.target, "utf8")).toBe(proposalOf(result));
      const report = reportOf(result) as { writtenPath: string };
      expect(report.writtenPath).toBe(scratch.target);
      expect(treeSnapshot(join(scratch.home, PRIOR_DIR))).toEqual(legacyBefore);
      expect(readdirSync(join(scratch.repo, CONFIG_DIR))).toEqual(["config.yaml"]);
    } finally {
      scratch.dispose();
    }
  });

  test("present: target-exists, the document is never read or modified, legacy unchanged", async () => {
    const scratch = tree("write-present");
    try {
      scratch.write(join(scratch.profilesDir, "zai.sh"), VALID);
      scratch.write(scratch.target, "provider:\n  defaultChain: keep-me\n");
      const before = treeSnapshot(scratch.root);
      const result = await run(scratch, ["migrate", "legacy", "--write", "--json"]);
      expect(result.exitCode).toBe(1);
      expect(result.error?.summary).toContain("target-exists");
      expect(result.counts.reads).not.toContain(scratch.target);
      expect(treeSnapshot(scratch.root)).toEqual(before);
    } finally {
      scratch.dispose();
    }
  });
});

/* -------------------------------- TC-MIG-011 ----------------------------- */

describe("TC-MIG-011 every read is bounded, read once, and refuses rather than degrades", () => {
  const padded = (bytes: number): string => {
    const base = `${VALID}#`;
    const newline = 1;
    const padding = bytes - Buffer.byteLength(base, "utf8") - newline;
    return `${base}${"a".repeat(padding)}\n`;
  };

  test("bytes: cap-1 and cap are accepted, cap+1 refuses naming the constant", async () => {
    for (const bytes of [65535, 65536, 65537]) {
      const scratch = tree(`bytes-${bytes}`);
      try {
        const text = padded(bytes);
        expect(Buffer.byteLength(text, "utf8")).toBe(bytes);
        scratch.write(join(scratch.profilesDir, "zai.sh"), text);
        const result = await run(scratch, ["migrate", "legacy", "--json"]);
        if (bytes <= 65536) {
          expect(result.exitCode, String(bytes)).toBe(0);
        } else {
          expect(result.exitCode).toBe(1);
          expect(result.error?.summary).toContain("oversized-source");
          expect(result.error?.summary).toContain("PROVIDER_MIGRATE_SOURCE_MAX_BYTES = 65536");
          expect(result.counts.reads.filter((path) => path.endsWith("zai.sh"))).toHaveLength(1);
        }
      } finally {
        scratch.dispose();
      }
    }
  });

  test("lines: 1999 and 2000 are accepted, 2001 refuses naming the constant", async () => {
    for (const lines of [1999, 2000, 2001]) {
      const scratch = tree(`lines-${lines}`);
      try {
        const text = `${Array.from({ length: lines }, () => "ADOS_HOOK_AGENT=pm").join("\n")}\n`;
        scratch.write(join(scratch.profilesDir, "zai.sh"), text);
        const result = await run(scratch, ["migrate", "legacy", "--json"]);
        if (lines <= 2000) {
          expect(result.exitCode, String(lines)).toBe(0);
        } else {
          expect(result.exitCode).toBe(1);
          expect(result.error?.summary).toContain("PROVIDER_MIGRATE_SOURCE_MAX_LINES = 2000");
        }
      } finally {
        scratch.dispose();
      }
    }
  });

  test("sources: 64 are read, the 65th refuses naming the constant", async () => {
    for (const count of [64, 65]) {
      const scratch = tree(`sources-${count}`);
      try {
        for (let index = 0; index < count; index += 1) {
          scratch.write(
            join(scratch.profilesDir, `p${String(index).padStart(3, "0")}.sh`),
            "ADOS_HOOK_AGENT=pm\n",
          );
        }
        const result = await run(scratch, ["migrate", "legacy", "--json"]);
        if (count === 64) {
          expect(result.exitCode).toBe(0);
        } else {
          expect(result.exitCode).toBe(1);
          expect(result.error?.summary).toContain("PROVIDER_MIGRATE_MAX_SOURCES = 64");
        }
      } finally {
        scratch.dispose();
      }
    }
  });

  test("a directory where a file is expected and an unreadable file refuse unreadable-source", async () => {
    const directoryArm = tree("unreadable-dir");
    try {
      const result = await run(directoryArm, [
        "migrate",
        "legacy",
        "--hook",
        directoryArm.root,
        "--json",
      ]);
      expect(result.exitCode).toBe(1);
      expect(result.error?.summary).toContain("unreadable-source");
    } finally {
      directoryArm.dispose();
    }
    const unreadableArm = tree("unreadable-file");
    try {
      unreadableArm.write(join(unreadableArm.profilesDir, "zai.sh"), VALID);
      const result = await run(unreadableArm, ["migrate", "legacy", "--json"], {
        failRead: join(unreadableArm.profilesDir, "zai.sh"),
      });
      expect(result.exitCode).toBe(1);
      expect(result.error?.summary).toContain("unreadable-source");
      expect(result.counts.reads).toEqual([]);
    } finally {
      unreadableArm.dispose();
    }
  });
});

/* -------------------------------- TC-MIG-012 ----------------------------- */

describe("TC-MIG-012 identical source bytes produce byte-identical output", () => {
  test("three runs over two trees built in different orders agree byte for byte", async () => {
    const first = tree("order-a");
    const second = tree("order-b");
    try {
      const files: readonly [string, string][] = [
        ["a.sh", "ADOS_ZAI_PEAK_START_UTC=21600\n"],
        ["b.sh", "OC_ADOS_MODEL_PROFILE=balanced\n"],
      ];
      for (const [name, text] of files) first.write(join(first.profilesDir, name), text);
      for (const [name, text] of [...files].reverse())
        second.write(join(second.profilesDir, name), text);
      first.write(first.hookPath, "ADOS_ZAI_BUFFER_SECONDS=1800\n");
      second.write(second.hookPath, "ADOS_ZAI_BUFFER_SECONDS=1800\n");
      const runs = [first, first, second].map((scratch, index) => ({
        index,
        scratch,
      }));
      const outputs: string[] = [];
      for (const { scratch, index } of runs) {
        const result = await run(scratch, ["migrate", "legacy", "--json"]);
        expect(result.exitCode, String(index)).toBe(0);
        outputs.push(proposalOf(result).replaceAll(scratch.root, "<root>"));
      }
      // The same tree replayed twice is byte-identical; a second tree with the
      // same relative layout built in the opposite order differs only by its
      // absolute root, so directory iteration order is not an input.
      expect(outputs[1]).toBe(outputs[0].replaceAll(first.root, "<root>"));
      const normalizedSecond = outputs[2] ?? "";
      expect(normalizedSecond).toBe((outputs[0] ?? "").replaceAll(first.root, "<root>"));
    } finally {
      first.dispose();
      second.dispose();
    }
  });
});

/* -------------------------------- TC-MIG-013 ----------------------------- */

describe("TC-MIG-013 the shipped hook refuses as a construct with the documented remedy", () => {
  test("the hook copy refuses shell-construct naming the file and line; a declarative twin is accepted", async () => {
    const scratch = tree("shipped-hook");
    try {
      const digest = (): string =>
        createHash("sha256").update(readFileSync(SHIPPED_HOOK)).digest("hex");
      const before = digest();
      const copy = join(scratch.root, "hook-copy.sh");
      writeFileSync(copy, readFileSync(SHIPPED_HOOK));
      const result = await run(scratch, ["migrate", "legacy", "--hook", copy, "--json"]);
      expect(result.exitCode).toBe(1);
      expect(result.error?.summary).toContain("shell-construct");
      expect(result.error?.summary).toContain(copy);
      const offending = readFileSync(copy, "utf8")
        .split("\n")
        .findIndex((line) => {
          const trimmed = line.trim();
          if (trimmed.length === 0 || trimmed.startsWith("#")) return false;
          return !/^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*=[^\s$`;&|()<>[\]{}~\\*?]*$/u.test(trimmed);
        });
      expect(result.error?.summary).toContain(`:${offending + 1}`);
      expect(digest()).toBe(before);

      const twin = join(scratch.root, "declarative-twin.sh");
      writeFileSync(
        twin,
        `${[
          "ADOS_ZAI_PEAK_START_UTC=21600",
          "ADOS_ZAI_PEAK_END_UTC=36000",
          "ADOS_ZAI_BUFFER_SECONDS=7200",
          "ADOS_ZAI_MAX_SLEEP_LOOPS=24",
          "ADOS_ZAI_QUOTA_DISABLED=1",
          "ZAI_API_KEY=sk-live-canary",
        ].join("\n")}\n`,
      );
      const accepted = await run(scratch, ["migrate", "legacy", "--hook", twin, "--json"]);
      expect(accepted.exitCode).toBe(0);
      expect(proposalOf(accepted)).toContain("startSecondsOfDay: 21600");
      expect(digest()).toBe(before);
    } finally {
      scratch.dispose();
    }
  });
});

/* -------------------------------- TC-MIG-015 ----------------------------- */

describe("TC-MIG-015 no legacy file is written, moved, or deleted", () => {
  test("every arm leaves every legacy path's mode, mtime and digest unchanged", async () => {
    const scratch = tree("legacy-untouched");
    try {
      scratch.write(join(scratch.profilesDir, "zai.sh"), VALID);
      scratch.write(scratch.hookPath, "ADOS_ZAI_BUFFER_SECONDS=1800\n");
      scratch.write(join(scratch.profilesDir, "bad.sh"), "foo() {\n  echo hi\n}\n");
      chmodSync(scratch.hookPath, 0o640);
      const before = treeSnapshot(join(scratch.home, PRIOR_DIR));
      for (const argv of [
        ["migrate", "legacy", "--json"],
        ["migrate", "legacy", "--write", "--json"],
        ["migrate", "legacy", "--profiles-dir", scratch.profilesDir, "--json"],
      ]) {
        await run(scratch, argv);
        expect(treeSnapshot(join(scratch.home, PRIOR_DIR)), argv.join(" ")).toEqual(before);
      }
    } finally {
      scratch.dispose();
    }
  });
});

/**
 * GH-350 NB2 (review remediation) — the closed refusal set carries the typed
 * `no-checkout` reason, and the write-path helper builds it through the same
 * `refusal` shape as every other reason.
 */
describe("GH-350 NB2 the migration refusal set is closed and eight-strong", () => {
  test("the declared reasons are exactly the eight the specification carries", async () => {
    const { PROVIDER_MIGRATE_REFUSAL_REASONS } = await import(
      "../../packages/core/src/provider/migrate"
    );
    expect([...PROVIDER_MIGRATE_REFUSAL_REASONS]).toEqual([
      "no-source",
      "unreadable-source",
      "oversized-source",
      "shell-construct",
      "dynamic-value",
      "target-exists",
      "proposal-invalid",
      "no-checkout",
    ]);
    expect(new Set(PROVIDER_MIGRATE_REFUSAL_REASONS).size).toBe(8);
  });

  test("the write-path helper names the reason, the cwd, and the remedy", async () => {
    const { providerMigrateNoCheckoutRefusal, providerMigrateRefusalSummary } = await import(
      "../../packages/core/src/provider/migrate"
    );
    const refusal = providerMigrateNoCheckoutRefusal("/scratch/outside");
    expect(refusal.reason).toBe("no-checkout");
    expect(refusal.source).toBe("/scratch/outside");
    const summary = providerMigrateRefusalSummary(refusal);
    expect(summary).toContain("(no-checkout)");
    expect(summary).toContain("/scratch/outside");
    expect(summary).toContain("run the write inside a checkout");
    expect(summary).not.toContain("--project-root");
  });
});
