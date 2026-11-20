/**
 * GH-350 TC-MIG-014 (golden arm) — the migration's proposal and report are
 * stable, complete disclosures: every source with its byte count, every mapped
 * name, every unmapped name, every absent source, and the written path under
 * `--write`.
 *
 * The scratch root is normalised to `<root>` so the golden is host-independent.
 * Regenerate explicitly:
 *   MIGRATE_GOLDEN_UPDATE=1 bun test tests/golden/provider-migrate-golden.test.ts
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

const ROOT = process.cwd();
const GOLDEN = "tests/fixtures/provider/golden";
const PROPOSAL = "migrate-proposal.txt";
const REPORT = "migrate-report.txt";
const PRIOR_DIR = ".delivery-os";
const TMP_ROOT = join(ROOT, "tmp/tmpdir");

const goldenPath = (name: string): string => join(ROOT, GOLDEN, name);
const readGolden = (name: string): string => readFileSync(goldenPath(name), "utf8");
const writeGolden = (name: string, text: string): void => {
  mkdirSync(dirname(goldenPath(name)), { recursive: true });
  writeFileSync(goldenPath(name), text);
};
const updating = (): boolean => process.env.MIGRATE_GOLDEN_UPDATE === "1";

const migrate = async (): Promise<{
  readonly proposal: string;
  readonly report: string;
  readonly humanStderr: string;
  readonly written: string;
}> => {
  mkdirSync(TMP_ROOT, { recursive: true });
  const root = mkdtempSync(join(TMP_ROOT, "gh350-migrate-golden-"));
  const repo = join(root, "repo");
  const home = join(root, "home");
  const profiles = join(home, PRIOR_DIR, "config", "profiles");
  const target = join(repo, ".jaiship", "config.yaml");
  mkdirSync(join(repo, ".git"), { recursive: true });
  mkdirSync(profiles, { recursive: true });
  writeFileSync(
    join(profiles, "zai.sh"),
    [
      "OC_ADOS_MODEL_PROFILE=balanced",
      "ADOS_ZAI_PEAK_START_UTC=21600",
      "ADOS_ZAI_PEAK_END_UTC=36000",
      "ADOS_HOOK_AGENT=pm",
      "ZAI_API_KEY=sk-live-canary",
    ].join("\n") + "\n",
  );
  const storeRoot = makeTempRoot("gh350-migrate-golden-state");
  try {
    const { store } = openStore(makeIdentity(storeRoot));
    const provider: ProviderComposition = {
      clock: { nowMs: () => 0 },
      credentialPort: { resolve: () => ({ ok: true, material: { value: "" } }) },
      transport: { send: async () => ({ status: 200, bodyText: "{}" }) },
      sleep: { sleep: async () => undefined },
      stateStore: store,
      newFenceToken: () => "fence-migrate-golden",
      migrateFs: {
        exists: (path) => existsSync(path),
        readText: (path) => readFileSync(path, "utf8"),
        readDirectory: (path) => readdirSync(path),
      },
    };
    const program = createConfigProgram({
      workingName: "jaiship",
      environment: { HOME: home },
      cwd: repo,
      homeDirectory: home,
      platform: "linux",
      priorConfigurationDirectoryName: PRIOR_DIR,
      fs: {
        exists: (path) => path === target,
        readText: (path) => readFileSync(path, "utf8"),
      },
      repositoryIo: {
        exists: (path) => path === join(repo, ".git"),
        isFile: () => false,
        readText: () => "",
      },
      provider,
    });
    if (!program.ok) throw new Error("compose");
    const deps: CliDependencies = {
      brand: program.brand,
      clock: { now: () => 0 },
      newRunId: () => "run-gh350-migrate-golden",
      secrets: program.secrets,
      program: program.program,
    };
    const call = async (argv: readonly string[]): Promise<{ stdout: string; stderr: string }> => {
      let stdout = "";
      let stderr = "";
      const exitCode = await runCli(
        ["provider", ...argv],
        {
          stdout: { write: (chunk: string) => (stdout += chunk) },
          stderr: { write: (chunk: string) => (stderr += chunk) },
        },
        deps,
      );
      expect(exitCode).toBe(0);
      return { stdout, stderr };
    };
    const human = await call(["migrate", "legacy"]);
    const machine = await call(["migrate", "legacy", "--json"]);
    const envelope = JSON.parse(machine.stdout) as { data: { report: unknown } };
    const written = await call(["migrate", "legacy", "--write", "--json"]);
    const writtenReport = JSON.parse(written.stdout) as {
      data: { report: { writtenPath: string } };
    };
    const normalize = (text: string): string =>
      text.replaceAll(home, "<home>").replaceAll(root, "<root>");
    return {
      proposal: normalize(human.stdout),
      report: normalize(`${JSON.stringify(envelope.data.report, null, 2)}\n`),
      humanStderr: normalize(human.stderr),
      written: normalize(readFileSync(writtenReport.data.report.writtenPath, "utf8")),
    };
  } finally {
    removeRoot(storeRoot);
    rmSync(root, { recursive: true, force: true });
  }
};

describe("TC-MIG-014 the migration's proposal and report goldens", () => {
  test("the proposal is byte-stable and complete", async () => {
    const result = await migrate();
    if (updating()) writeGolden(PROPOSAL, result.proposal);
    expect(result.proposal).toBe(readGolden(PROPOSAL));
    expect(result.proposal).toContain("# sources read: <home>/.delivery-os/config/profiles");
    expect(result.proposal).toContain("# sources absent: <home>/.delivery-os/hooks/");
    expect(result.proposal).toContain("# unmapped names: ADOS_HOOK_AGENT");
    expect(result.proposal).not.toContain("sk-live-canary");
  });

  test("the machine report names every source, mapped and unmapped name", async () => {
    const result = await migrate();
    if (updating()) writeGolden(REPORT, result.report);
    expect(result.report).toBe(readGolden(REPORT));
    const report = JSON.parse(result.report) as {
      sources: Array<{ kind: string; state: string; bytes?: number }>;
      mapped: Array<{ name: string; target: string }>;
      unmapped: string[];
    };
    expect(report.sources.map((source) => `${source.kind}:${source.state}`)).toEqual([
      "profiles:read",
      "hook:absent",
    ]);
    expect(report.mapped.map((entry) => entry.name)).toEqual([
      "OC_ADOS_MODEL_PROFILE",
      "ADOS_ZAI_PEAK_START_UTC",
      "ADOS_ZAI_PEAK_END_UTC",
      "ZAI_API_KEY",
    ]);
    expect(report.unmapped).toEqual(["ADOS_HOOK_AGENT"]);
    // The human diagnostic stream carries the same facts as the machine report.
    for (const source of report.sources) {
      expect(result.humanStderr).toContain(source.kind);
    }
    for (const entry of report.mapped) {
      expect(result.humanStderr).toContain(`${entry.name} -> ${entry.target}`);
    }
    expect(result.humanStderr).toContain("migrate unmapped: ADOS_HOOK_AGENT");
    // `--write` writes exactly the proposal bytes.
    expect(result.written).toBe(result.proposal);
  });
});
