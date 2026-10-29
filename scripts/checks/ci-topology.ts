/**
 * TC-SCAFFOLD-023 — CI topology: binding TypeScript jobs beside byte-unchanged
 * bash jobs, on PRs to main-tools and pushes to delivery branches.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export const BASH_JOBS = [
  "verify-claude-build",
  "doc-distribution-guard",
  "inception-doc-consistency",
  "result-tuple-guard",
  "mutation-sandbox",
  "bash-tests",
  "shellcheck",
];

export const TS_JOBS = [
  "ts-fresh-clone",
  "ts-invariants",
  "ts-typecheck",
  "ts-lint",
  "ts-format",
  "ts-test",
  "ts-boundaries",
  "ts-build",
  "ts-exports",
  "ts-pins",
  "ts-publish-guard",
  "ts-license-audit",
  "ts-vuln",
  "ts-aggregate",
  "ts-commitlint",
];

type Workflow = {
  on?: {
    push?: { branches?: string[] };
    pull_request?: { branches?: string[] };
  };
  jobs?: Record<string, unknown>;
};

const includesDeliveryBranch = (patterns: string[]): boolean =>
  patterns.some(
    (pattern) =>
      pattern === "feat/**" ||
      pattern === "feat/*" ||
      pattern === "feat/GH-170/**" ||
      pattern === "**",
  );

export const validate = (root: string): string[] => {
  const failures: string[] = [];
  const path = join(root, ".github/workflows/ci.yml");
  const text = readFileSync(path, "utf8");
  const workflow = parse(text) as Workflow;
  const jobs = workflow.jobs ?? {};

  for (const job of BASH_JOBS) {
    if (!(job in jobs)) failures.push(`ci.yml: existing bash job ${job} is missing`);
  }
  for (const job of TS_JOBS) {
    if (!(job in jobs)) failures.push(`ci.yml: required TypeScript job ${job} is missing`);
  }

  const branches = workflow.on?.pull_request?.branches ?? [];
  if (!branches.includes("main-tools")) {
    failures.push("ci.yml: pull_request must target main-tools");
  }
  const pushBranches = workflow.on?.push?.branches ?? [];
  if (!includesDeliveryBranch(pushBranches)) {
    failures.push("ci.yml: push trigger must cover the delivery branch");
  }

  const base = spawnSync("git", ["rev-parse", "--verify", "origin/main-tools"], {
    cwd: root,
    encoding: "utf8",
  });
  if (base.status !== 0) {
    failures.push("origin/main-tools is unavailable; fetch the base branch before this check");
  } else {
    const diff = spawnSync(
      "git",
      ["diff", "--unified=0", "origin/main-tools...HEAD", "--", ".github/workflows/ci.yml"],
      { cwd: root, encoding: "utf8" },
    );
    const removed = (diff.stdout ?? "")
      .split("\n")
      .filter((line) => line.startsWith("-") && !line.startsWith("---"));
    for (const line of removed) {
      failures.push(`ci.yml removes a base line (additions only): ${line}`);
    }
  }

  const checkDirectory = join(root, "scripts/checks");
  const wiring = text + readFileSync(join(root, "package.json"), "utf8");
  for (const entry of readdirSync(checkDirectory)) {
    if (!entry.endsWith(".ts")) continue;
    const name = entry.slice(0, -3);
    if (!wiring.includes(name)) {
      failures.push(
        `scripts/checks/${entry} is not invoked by the aggregate check or a named CI job`,
      );
    }
  }

  return failures;
};

if (import.meta.main) {
  const failures = validate(process.cwd());
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL ci-topology: ${message}`);
    process.exit(1);
  }
  console.log(
    `OK ci-topology: ${BASH_JOBS.length} bash jobs intact, ${TS_JOBS.length} TS jobs present, triggers cover delivery`,
  );
}
