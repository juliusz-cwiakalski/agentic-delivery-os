/**
 * TC-SCAFFOLD-023 — CI topology: binding TypeScript jobs beside byte-unchanged
 * bash jobs, on PRs to main-tools and pushes to delivery branches.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
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
  "ts-forbidden-literals",
];

export const SCAN_JOB_ID = "ts-forbidden-literals";
export const SCAN_COMMAND = "bun run scripts/checks/forbidden-literals.ts";

type WorkflowStep = {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
};

type WorkflowJob = {
  permissions?: Record<string, unknown>;
  steps?: WorkflowStep[];
  "continue-on-error"?: unknown;
};

export const scanJobFailures = (
  root: string,
  workflow: { jobs?: Record<string, unknown> },
): string[] => {
  const jobs = (workflow.jobs ?? {}) as Record<string, WorkflowJob>;
  const job = jobs[SCAN_JOB_ID];
  if (job === undefined) return [];

  const failures: string[] = [];
  if (job["continue-on-error"] !== undefined) {
    failures.push(`ci.yml: ${SCAN_JOB_ID} must not be advisory (continue-on-error)`);
  }
  if (job.permissions?.contents !== "read") {
    failures.push(`ci.yml: ${SCAN_JOB_ID} must declare permissions.contents: read`);
  }
  const steps = job.steps ?? [];
  const checkout = steps.find((step) => step.uses?.startsWith("actions/checkout@"));
  if (checkout === undefined || String(checkout.with?.["fetch-depth"]) !== "0") {
    failures.push(`ci.yml: ${SCAN_JOB_ID} must check out full history (fetch-depth: 0)`);
  }

  let baseline = "";
  try {
    baseline =
      (
        JSON.parse(
          readFileSync(join(root, "scripts/checks/forbidden-literals.registry.json"), "utf8"),
        ) as { corpusBaseline?: string }
      ).corpusBaseline ?? "";
  } catch {
    failures.push(`ci.yml: ${SCAN_JOB_ID} cannot resolve the registry corpusBaseline`);
  }
  if (!/^[0-9a-f]{40}$/.test(baseline)) {
    failures.push(`ci.yml: ${SCAN_JOB_ID} registry corpusBaseline is not a full commit SHA`);
  } else {
    const fetchStep = steps.find((step) => (step.run ?? "").includes("git fetch"));
    if (fetchStep === undefined || !(fetchStep.run ?? "").includes(baseline)) {
      failures.push(
        `ci.yml: ${SCAN_JOB_ID} must fetch the recorded corpusBaseline commit (missing baseline fetch)`,
      );
    }
  }

  if (!steps.some((step) => (step.run ?? "").includes(SCAN_COMMAND))) {
    failures.push(`ci.yml: ${SCAN_JOB_ID} must run ${SCAN_COMMAND}`);
  }
  return failures;
};

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

  failures.push(...scanJobFailures(root, workflow));

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
