/**
 * TC-SCAFFOLD-026 — commitlint is the CI authority.
 *
 * Exactly one root config (no package overrides). When the workflow already has
 * TypeScript jobs (P8 onward), the `ts-commitlint` job is required to run
 * commitlint against both the PR base and the delivery-branch base.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";

const ROOT = process.cwd();
const CONFIG_CANDIDATES = [
  "commitlint.config.js",
  "commitlint.config.cjs",
  "commitlint.config.mjs",
  "commitlint.config.ts",
  ".commitlintrc",
  ".commitlintrc.json",
  ".commitlintrc.yaml",
  ".commitlintrc.yml",
];
const PACKAGE_NAMES = ["core", "adapters", "cli", "mcp", "opencode", "testkit"];

export const validate = (root: string): string[] => {
  const failures: string[] = [];

  const rootConfigs = CONFIG_CANDIDATES.filter((name) => existsSync(join(root, name)));
  if (rootConfigs.length !== 1) {
    failures.push(
      `expected exactly one root commitlint config; found ${JSON.stringify(rootConfigs)}`,
    );
  } else {
    const configText = readFileSync(join(root, rootConfigs[0] as string), "utf8");
    if (!configText.includes("@commitlint/config-conventional")) {
      failures.push(`${rootConfigs[0]} must extend @commitlint/config-conventional`);
    }
  }
  for (const packageName of PACKAGE_NAMES) {
    for (const name of CONFIG_CANDIDATES) {
      if (existsSync(join(root, "packages", packageName, name))) {
        failures.push(`packages/${packageName}/${name}: package-level commitlint override`);
      }
    }
    const manifestPath = join(root, "packages", packageName, "package.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
      if ("commitlint" in manifest) {
        failures.push(`packages/${packageName}/package.json: commitlint field is not permitted`);
      }
    }
  }

  const workflowPath = join(root, ".github/workflows/ci.yml");
  if (existsSync(workflowPath) && readFileSync(workflowPath, "utf8").includes("ts-")) {
    const workflow = parse(readFileSync(workflowPath, "utf8")) as {
      jobs?: Record<string, { steps?: Array<{ run?: string }> }>;
    };
    const job = workflow.jobs?.["ts-commitlint"];
    if (!job) {
      failures.push("ci.yml: missing binding ts-commitlint job");
    } else {
      const runs = (job.steps ?? []).map((step) => step.run ?? "").join("\n");
      if (!/commitlint/.test(runs)) failures.push("ts-commitlint: no commitlint invocation");
      if (!/origin\/main-tools\.\.\.HEAD|main-tools/.test(runs)) {
        failures.push("ts-commitlint: missing the delivery-branch base range");
      }
      if (!/pull_request|GITHUB_BASE_REF|github\.base_ref/.test(runs)) {
        failures.push("ts-commitlint: missing the PR-base range");
      }
    }
  }

  return failures;
};

export const mutationCheck = (root: string): string[] => {
  const failures: string[] = [];
  const directory = mkdtempSync(join(tmpdir(), "commitlint-mutation-"));
  try {
    const commitlint = join(root, "node_modules/.bin/commitlint");
    const malformed = join(directory, "malformed.txt");
    const conventional = join(directory, "conventional.txt");
    writeFileSync(malformed, "bad message without a type\n");
    writeFileSync(conventional, "feat(GH-170): a conventional subject\n");
    const run = (file: string) =>
      spawnSync(commitlint, ["--edit", file], { cwd: root, encoding: "utf8" }).status ?? 1;
    if (run(malformed) === 0) failures.push("malformed message unexpectedly passed commitlint");
    if (run(conventional) !== 0)
      failures.push("conventional message unexpectedly failed commitlint");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  return failures;
};

if (import.meta.main) {
  const failures = [...validate(ROOT), ...mutationCheck(ROOT)];
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL commitlint-authority: ${message}`);
    process.exit(1);
  }
  console.log(
    "OK commitlint-authority: one root config, conventional config, mutation round-trip green",
  );
}
