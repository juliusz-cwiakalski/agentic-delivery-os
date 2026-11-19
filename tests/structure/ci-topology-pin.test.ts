/**
 * TC-GATE-002 — the base-free workflow topology pin: exact file set, exact
 * per-file job-id set (equality, not presence), exact trigger set, and the
 * pinned check-name inventory of the two delivered workflow suites.
 *
 * This tier also runs in `ts-exports`, where `origin/main-tools` may be absent,
 * so this suite imports no base-reading helper and asserts no base-dependent
 * fact; that half stays in `tests/checks/ci-checks.test.ts` under `ts-test` and
 * in gate G7.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const ROOT = process.cwd();
const PIN = "tests/fixtures/pins/workflow-topology.json";
const WORKFLOW_DIR = ".github/workflows";

type WorkflowPin = {
  readonly provenance: string;
  readonly workflows: Readonly<
    Record<string, { readonly jobs: readonly string[]; readonly triggers: readonly string[] }>
  >;
  readonly checkNames: Readonly<Record<string, readonly string[]>>;
};

const pin = JSON.parse(readFileSync(join(ROOT, PIN), "utf8")) as WorkflowPin;

const workflowNames = (): string[] =>
  readdirSync(join(ROOT, WORKFLOW_DIR))
    .filter((entry) => entry.endsWith(".yml") || entry.endsWith(".yaml"))
    .sort();

const parseWorkflow = (file: string): { jobs: string[]; triggers: string[] } => {
  const document = parse(readFileSync(join(ROOT, WORKFLOW_DIR, file), "utf8")) as {
    jobs?: Record<string, unknown>;
    on?: Record<string, unknown>;
  };
  const on = document.on ?? {};
  return {
    jobs: Object.keys(document.jobs ?? {}).sort(),
    triggers: Object.keys(on).sort(),
  };
};

const checkNames = (file: string): string[] => {
  const source = readFileSync(join(ROOT, file), "utf8");
  return [...source.matchAll(/^(?:describe|test)\("([^"]+)"/gm)].map((match) => match[1] ?? "");
};

/** Validate one topology map against the pin; every failure names file and finding. */
export const topologyViolations = (
  files: readonly string[],
  workflows: Readonly<Record<string, { jobs: readonly string[]; triggers: readonly string[] }>>,
  expected: WorkflowPin = pin,
): string[] => {
  const violations: string[] = [];
  const pinnedFiles = Object.keys(expected.workflows).sort();
  if ([...files].sort().join(",") !== pinnedFiles.join(",")) {
    for (const file of files.filter((candidate) => !pinnedFiles.includes(candidate))) {
      violations.push(`${file}: workflow file is not pinned`);
    }
    for (const file of pinnedFiles.filter((candidate) => !files.includes(candidate))) {
      violations.push(`${file}: pinned workflow file is missing`);
    }
  }
  for (const file of pinnedFiles) {
    const actual = workflows[file];
    const wanted = expected.workflows[file];
    if (actual === undefined || wanted === undefined) continue;
    for (const job of actual.jobs.filter((candidate) => !wanted.jobs.includes(candidate))) {
      violations.push(`${file}: unpinned job ${job}`);
    }
    for (const job of wanted.jobs.filter((candidate) => !actual.jobs.includes(candidate))) {
      violations.push(`${file}: job ${job} is missing`);
    }
    if ([...actual.triggers].sort().join(",") !== [...wanted.triggers].sort().join(",")) {
      violations.push(`${file}: trigger set ${actual.triggers.join(",")} differs`);
    }
  }
  return violations;
};

const currentWorkflows = (): Record<string, { jobs: string[]; triggers: string[] }> =>
  Object.fromEntries(workflowNames().map((file) => [file, parseWorkflow(file)]));

describe("TC-GATE-002 the workflow topology pin", () => {
  test("the workflow file set, per-file job sets and trigger sets equal the pins", () => {
    expect(topologyViolations(workflowNames(), currentWorkflows())).toEqual([]);
    expect(workflowNames()).toEqual([
      "ci.yml",
      "conformance-live.yml",
      "pr-base-guard.yml",
      "release.yml",
      "ticket-milestone-check.yml",
    ]);
    expect(currentWorkflows()["conformance-live.yml"]?.triggers).toEqual([
      "schedule",
      "workflow_dispatch",
    ]);
  });

  test("the two delivered workflow suites' check-name inventories equal the pins", () => {
    for (const [file, names] of Object.entries(pin.checkNames)) {
      expect(checkNames(file)).toEqual([...names]);
      expect(names.length).toBeGreaterThan(0);
    }
  });

  test("an added job, an added workflow file, an added trigger and a deleted check all fail by name", () => {
    const workflows = currentWorkflows();
    const withJob = {
      ...workflows,
      "ci.yml": { ...(workflows["ci.yml"] as { jobs: string[]; triggers: string[] }) },
    };
    withJob["ci.yml"] = {
      jobs: [...(workflows["ci.yml"]?.jobs ?? []), "purge-cache"],
      triggers: workflows["ci.yml"]?.triggers ?? [],
    };
    expect(
      topologyViolations(workflowNames(), withJob).some((message) =>
        message.includes("ci.yml: unpinned job purge-cache"),
      ),
    ).toBe(true);

    expect(
      topologyViolations([...workflowNames(), "sixth.yml"], workflows).some((message) =>
        message.includes("sixth.yml"),
      ),
    ).toBe(true);

    const withTrigger = {
      ...workflows,
      "conformance-live.yml": {
        jobs: workflows["conformance-live.yml"]?.jobs ?? [],
        triggers: [...(workflows["conformance-live.yml"]?.triggers ?? []), "push"],
      },
    };
    expect(
      topologyViolations(workflowNames(), withTrigger).some((message) =>
        message.includes("conformance-live.yml"),
      ),
    ).toBe(true);

    const checkFile = "tests/checks/conformance-workflow.test.ts";
    const reduced = checkNames(checkFile).slice(1);
    expect(reduced).not.toEqual(pin.checkNames[checkFile]);
  });

  test("the structure pin imports no base-reading helper", () => {
    const source = readFileSync(join(ROOT, "tests/structure/ci-topology-pin.test.ts"), "utf8");
    const prefix = source.split('test("the structure pin imports')[0] ?? "";
    expect(prefix).not.toMatch(/from\s+["'][^"']*ci-topology/);
    expect(prefix).not.toContain("validateTopology");
    expect(prefix).not.toContain("validateWorkflowRoot");
  });
});
