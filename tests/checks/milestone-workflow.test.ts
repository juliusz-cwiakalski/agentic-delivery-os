/**
 * TC-WF-001..003 — the issue-event workflow contract and its mutation proof.
 *
 * The static assertions are pure functions over workflow text so a mutated copy
 * can be scanned. Each mutation must be rejected by name; the unmutated file
 * must pass; the existing `ci.yml` scanners stay unchanged and green.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { validate as validateBindingness } from "../../scripts/checks/ci-bindingness";
import { validate as validateSupplyChain } from "../../scripts/checks/ci-supply-chain";
import { validate as validateTopology } from "../../scripts/checks/ci-topology";
import { MILESTONE_ACTIONS } from "../../scripts/checks/milestone-attachment";

const ROOT = process.cwd();
const WORKFLOW = ".github/workflows/ticket-milestone-check.yml";
const SCANNED_FILES = [WORKFLOW] as const;
const SHA_PINNED = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/;
const FORBIDDEN_BYPASS = [
  /continue-on-error/,
  /\|\|\s*true/,
  /set \+e/,
  /if:\s*always\(\)/,
  /\bexit 0\b/,
];

type RecordValue = Record<string, unknown>;

const asRecord = (value: unknown): RecordValue | undefined =>
  typeof value === "object" && value !== null ? (value as RecordValue) : undefined;

const asArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

export type WorkflowFinding = string;

/** The static workflow audit; each finding names the offending field. */
export const scanWorkflow = (text: string): readonly WorkflowFinding[] => {
  const findings: WorkflowFinding[] = [];
  const workflow = asRecord(parseYaml(text));
  if (workflow === undefined) return ["workflow: not a YAML mapping"];

  const on = workflow.on ?? workflow.true;
  const onRecord = asRecord(on);
  if (onRecord === undefined) {
    findings.push("on: missing event block");
  } else {
    if ("pull_request_target" in onRecord) {
      findings.push("on.pull_request_target: must not be used");
    }
    if ("workflow_run" in onRecord) {
      findings.push("on.workflow_run: must not bypass the fork boundary");
    }
    if ("schedule" in onRecord) {
      findings.push("on.schedule: the sweep is manual-only");
    }
    const issues = asRecord(onRecord.issues);
    const types = asArray(issues?.types).filter((type): type is string => typeof type === "string");
    for (const action of MILESTONE_ACTIONS) {
      if (!types.includes(action)) findings.push(`on.issues.types: missing ${action}`);
    }
    const dispatch = asRecord(onRecord.workflow_dispatch);
    if (dispatch === undefined) {
      findings.push("on.workflow_dispatch: missing manual sweep trigger");
    } else {
      const inputs = asRecord(dispatch.inputs);
      const mode = asRecord(inputs?.mode);
      if (mode === undefined)
        findings.push("on.workflow_dispatch.inputs.mode: missing sweep input");
    }
  }

  const topPermissions = asRecord(workflow.permissions);
  const jobs = asRecord(workflow.jobs);
  if (jobs === undefined || Object.keys(jobs).length === 0) {
    findings.push("jobs: missing enforcement job");
    return findings;
  }
  for (const [jobName, jobValue] of Object.entries(jobs)) {
    const job = asRecord(jobValue);
    const jobSerialized = JSON.stringify(job);
    for (const pattern of FORBIDDEN_BYPASS) {
      if (pattern.test(jobSerialized)) {
        findings.push(`jobs.${jobName}: forbidden bypass construct ${String(pattern)}`);
      }
    }
    const permissions = asRecord(job?.permissions);
    const expected = { contents: "read", issues: "write" };
    if (permissions === undefined) {
      findings.push(`jobs.${jobName}.permissions: missing job-scoped permissions`);
    } else {
      const keys = Object.keys(permissions).sort();
      if (JSON.stringify(keys) !== JSON.stringify(["contents", "issues"])) {
        findings.push(
          `jobs.${jobName}.permissions: must be exactly contents: read and issues: write`,
        );
      }
      for (const [scope, access] of Object.entries(expected)) {
        if (permissions[scope] !== access) {
          findings.push(`jobs.${jobName}.permissions.${scope}: must be ${access}`);
        }
      }
    }
    if (topPermissions !== undefined) {
      const topKeys = Object.keys(topPermissions).sort();
      if (JSON.stringify(topKeys) !== JSON.stringify(["contents", "issues"])) {
        findings.push("permissions: must be exactly contents: read and issues: write");
      }
    } else {
      findings.push("permissions: missing workflow-level least privilege");
    }

    const steps = asArray(job?.steps);
    const evaluateStep = steps.find(
      (step) =>
        typeof asRecord(step)?.run === "string" &&
        String(asRecord(step)?.run).includes("milestone-attachment-github.ts evaluate"),
    );
    const sweepStep = steps.find(
      (step) =>
        typeof asRecord(step)?.run === "string" &&
        String(asRecord(step)?.run).includes("milestone-attachment-github.ts sweep"),
    );
    if (evaluateStep === undefined) findings.push("steps: missing the issue-event evaluation step");
    if (sweepStep === undefined) findings.push("steps: missing the manual sweep step");

    for (const [index, stepValue] of steps.entries()) {
      const step = asRecord(stepValue);
      const uses = step?.uses;
      if (typeof uses === "string" && !SHA_PINNED.test(uses)) {
        findings.push(`steps[${index}].uses: ${uses} is not a full commit SHA pin`);
      }
      const serialized = JSON.stringify(step);
      if (serialized.includes("secrets.")) {
        findings.push(`steps[${index}]: must not reference secrets`);
      }
      for (const pattern of FORBIDDEN_BYPASS) {
        if (pattern.test(serialized)) {
          findings.push(`steps[${index}]: forbidden bypass construct ${String(pattern)}`);
        }
      }
      const run = typeof step?.run === "string" ? step.run : "";
      if (/\b(gh|curl|wget)\b/.test(run)) {
        findings.push(`steps[${index}].run: inline tracker or network command is not allowed`);
      }
      if (run.includes("GITHUB_STEP_SUMMARY") && typeof step?.if === "string") {
        if (/failure\(\)|always\(\)/.test(String(step.if))) {
          findings.push(`steps[${index}].if: job summary must not be failure-only`);
        }
      }
    }
  }

  if (!text.includes("GITHUB_STEP_SUMMARY")) {
    findings.push("GITHUB_STEP_SUMMARY: every evaluated run must write one job summary");
  }
  if (!text.includes("--summary")) {
    findings.push("--summary: the job summary target must be passed to the adapter");
  }
  return findings;
};

const mutate = (text: string, from: string, to: string): string => {
  if (!text.includes(from)) throw new Error(`mutation anchor not found: ${from}`);
  return text.replace(from, to);
};

describe("TC-WF-001 event set, sweep, and job summary", () => {
  test("the seven contract actions and the manual sweep are declared", () => {
    const text = read(WORKFLOW);
    expect(scanWorkflow(text)).toEqual([]);
    const workflow = asRecord(parseYaml(text));
    const on = asRecord(workflow?.on ?? workflow?.true);
    const types = asArray(asRecord(on?.issues)?.types);
    expect(types).toEqual([...MILESTONE_ACTIONS]);
    expect(asRecord(on?.workflow_dispatch)).toBeDefined();
  });

  test("every run reaches one evaluation entry point and writes one summary", () => {
    const text = read(WORKFLOW);
    expect(text).toContain("milestone-attachment-github.ts evaluate");
    expect(text).toContain('--event "$GITHUB_EVENT_PATH"');
    expect(text).toContain('--summary "$GITHUB_STEP_SUMMARY"');
    expect(text).toContain("milestone-attachment-github.ts sweep");
    expect(text).not.toContain("schedule:");
  });

  test("the sweep step does not swallow its exit code", () => {
    const text = read(WORKFLOW);
    const sweepRun = text.split("Run the advisory sweep")[1]?.split("run: >")[1]?.split("\n")[0];
    expect(sweepRun).toBeDefined();
    expect(text).not.toMatch(/\|\|\s*true/);
    expect(text).not.toMatch(/set \+e/);
  });
});

describe("TC-WF-002 least privilege, pins, and absent bypasses", () => {
  test("permissions are exactly contents: read and issues: write", () => {
    const workflow = asRecord(parseYaml(read(WORKFLOW)));
    expect(asRecord(workflow?.permissions)).toEqual({ contents: "read", issues: "write" });
    const jobs = asRecord(workflow?.jobs) ?? {};
    for (const job of Object.values(jobs)) {
      expect(asRecord(asRecord(job)?.permissions)).toEqual({ contents: "read", issues: "write" });
    }
  });

  test("every action is a 40-hex SHA and no privileged trigger or secret exists", () => {
    const text = read(WORKFLOW);
    const workflow = asRecord(parseYaml(text));
    const on = asRecord(workflow?.on ?? workflow?.true) ?? {};
    expect("pull_request_target" in on).toBe(false);
    expect("workflow_run" in on).toBe(false);
    expect(text).not.toContain("secrets.");
    const jobs = asRecord(workflow?.jobs) ?? {};
    for (const job of Object.values(jobs)) {
      for (const step of asArray(asRecord(job)?.steps)) {
        const uses = asRecord(step)?.uses;
        if (typeof uses === "string") expect(uses).toMatch(SHA_PINNED);
      }
    }
  });
});

describe("TC-WF-003 mutation proof and scanner boundary", () => {
  const mutations: readonly {
    readonly id: string;
    readonly mutate: (text: string) => string;
    readonly expected: string;
  }[] = [
    {
      id: "permission widened",
      mutate: (text) =>
        mutate(
          text,
          "    permissions:\n      contents: read\n      issues: write",
          "    permissions:\n      contents: read\n      issues: write\n      pull-requests: write",
        ),
      expected: "permissions",
    },
    {
      id: "action floated",
      mutate: (text) =>
        mutate(
          text,
          "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
          "actions/checkout@v4",
        ),
      expected: "not a full commit SHA pin",
    },
    {
      id: "pull_request_target added",
      mutate: (text) => mutate(text, "on:\n  issues:", "on:\n  pull_request_target:\n  issues:"),
      expected: "pull_request_target",
    },
    {
      id: "secret referenced",
      mutate: (text) =>
        mutate(
          text,
          "GITHUB_TOKEN: $" + "{{ github.token }}",
          "GITHUB_TOKEN: $" + "{{ secrets.GITHUB_TOKEN }}",
        ),
      expected: "must not reference secrets",
    },
    {
      id: "continue-on-error added",
      mutate: (text) => mutate(text, "    steps:", "    continue-on-error: true\n    steps:"),
      expected: "continue-on-error",
    },
    {
      id: "shell swallow added",
      mutate: (text) =>
        mutate(
          text,
          '--summary "$GITHUB_STEP_SUMMARY" --output tmp/milestone-attachment-sweep.json',
          '--summary "$GITHUB_STEP_SUMMARY" --output tmp/milestone-attachment-sweep.json || true',
        ),
      expected: "forbidden bypass construct",
    },
    {
      id: "issues events removed",
      mutate: (text) => mutate(text, "  issues:\n", "  issues_removed:\n"),
      expected: "on.issues.types",
    },
    {
      id: "summary target removed",
      mutate: (text) => text.replaceAll('--summary "$GITHUB_STEP_SUMMARY"', ""),
      expected: "GITHUB_STEP_SUMMARY",
    },
  ];

  test("the unmutated workflow passes every static assertion", () => {
    expect(scanWorkflow(read(WORKFLOW))).toEqual([]);
    expect(SCANNED_FILES).toContain(WORKFLOW);
  });

  test("each mutation is rejected and names the offending field", () => {
    const text = read(WORKFLOW);
    for (const mutation of mutations) {
      const findings = scanWorkflow(mutation.mutate(text));
      expect(
        findings.some((finding) => finding.includes(mutation.expected)),
        mutation.id,
      ).toBe(true);
    }
  });

  test("the existing invariant scanners stay unchanged and green", () => {
    expect(validateSupplyChain(ROOT)).toEqual([]);
    expect(validateBindingness(ROOT)).toEqual([]);
    expect(validateTopology(ROOT)).toEqual([]);
    expect(read("scripts/checks/ci-supply-chain.ts")).toContain(".github/workflows/ci.yml");
    expect(read("scripts/checks/ci-bindingness.ts")).toContain("ts-");
    expect(read("scripts/checks/ci-topology.ts")).toContain("ts-");
  });

  test("the issues listing drops pull-request entries before parsing", () => {
    const source = read("scripts/checks/milestone-attachment-github.ts");
    expect(source).toContain('Object.hasOwn(entry, "pull_request")');
    expect(source).toContain(".filter((entry) => !isPullRequestEntry(entry))");
  });
});
