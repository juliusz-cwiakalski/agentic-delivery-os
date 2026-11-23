/**
 * TC-F7-006 / AC-F7-5 — the defect and integrity suites ride the existing test
 * jobs offline, and the pinned CI topology is unchanged (NFR-2, NFR-12).
 *
 * The discovery half is mechanical: Bun assigns no test file name by magic, so
 * this check asserts each new suite is an existing `*.test.ts` file that the
 * repository's own discovery configuration admits — not under `tmp/`, not under
 * a built tree, and not named as a fixture. The topology half reads the
 * repository's pin and the workflows and requires the file set, per-file job set
 * and per-file trigger set to equal it; the pin's own mutation controls live in
 * the delivered `tests/structure/ci-topology-pin.test.ts` and are reused, not
 * duplicated.
 *
 * Offline is asserted statically over the new suites' sources: no network call
 * site, no transport import, and no child-process seam. The mock tier's own
 * guards count the runtime calls; a suite that never imports a way out has
 * nothing to count.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const ROOT = process.cwd();

/** The suites this phase adds; each must be discovered by `bun test`. */
const NEW_SUITES = [
  "tests/structure/defect-f1-merge-refusal-containment.test.ts",
  "tests/structure/defect-suite-presence.test.ts",
  "tests/behaviour/defect-f4-phase-mirror.test.ts",
  "tests/behaviour/defect-f8-serial-merge-churn.test.ts",
  "tests/checks/merge-suite-discovery.test.ts",
  // GH-366 adds the offline ambient-read absence scan for the resolution.
  "tests/checks/merge-branch-read-scan.test.ts",
] as const;

/** The fixture the serial defect suite reads is data, never a discovered suite. */
const FIXTURE = "tests/fixtures/merge/serial-three.ts";

const BUNFIG = "bunfig.toml";
const WORKFLOW_DIR = ".github/workflows";
const PIN = "tests/fixtures/pins/workflow-topology.json";

/** The `pathIgnorePatterns` values the repository's Bun configuration declares. */
const ignorePatterns = (): readonly string[] => {
  const text = readFileSync(join(ROOT, BUNFIG), "utf8");
  const match = /pathIgnorePatterns\s*=\s*\[([^\]]*)\]/u.exec(text);
  if (match === null) throw new Error("bunfig.toml declares no pathIgnorePatterns");
  return [...(match[1] ?? "").matchAll(/"([^"]+)"/gu)].map((entry) => entry[1] as string);
};

/** Whether one repository-relative path is admitted by discovery. */
const discovered = (file: string): boolean => {
  if (!existsSync(join(ROOT, file))) return false;
  if (!file.endsWith(".test.ts")) return false;
  return !ignorePatterns().some((pattern) => new Bun.Glob(pattern).match(file));
};

type WorkflowPin = {
  readonly workflows: Readonly<
    Record<string, { readonly jobs: readonly string[]; readonly triggers: readonly string[] }>
  >;
};

const pin = JSON.parse(readFileSync(join(ROOT, PIN), "utf8")) as WorkflowPin;

const workflowFiles = (): readonly string[] =>
  readdirSync(join(ROOT, WORKFLOW_DIR))
    .filter((entry) => entry.endsWith(".yml") || entry.endsWith(".yaml"))
    .sort();

const parseWorkflow = (file: string): { jobs: string[]; triggers: string[] } => {
  const document = parse(readFileSync(join(ROOT, WORKFLOW_DIR, file), "utf8")) as {
    jobs?: Record<string, unknown>;
    on?: Record<string, unknown>;
  };
  return {
    jobs: Object.keys(document.jobs ?? {}).sort(),
    triggers: Object.keys(document.on ?? {}).sort(),
  };
};

/** The static import/egress surface of one suite, as named findings. */
const egressFindings = (file: string): readonly string[] => {
  const text = readFileSync(join(ROOT, file), "utf8");
  const findings: string[] = [];
  const forbidden = [
    /\bfetch\s*\(/u,
    /from\s+"node:child_process"/u,
    /from\s+"node:http"/u,
    /from\s+"node:https"/u,
    /from\s+"node:net"/u,
    /from\s+"node:tls"/u,
    /\bBun\.spawn\s*\(/u,
    /\bexecSync\s*\(/u,
    /\bexecFileSync\s*\(/u,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(text)) findings.push(`${file}: ${pattern.source}`);
  }
  return findings;
};

describe("TC-F7-006 the new suites are discovered by the existing test job", () => {
  test("every new suite is an admitted *.test.ts file and none sits under an ignored tree", () => {
    expect(NEW_SUITES).toHaveLength(6);
    for (const file of NEW_SUITES) {
      expect(discovered(file), file).toBe(true);
    }
    // The ignore patterns are live: a suite moved under `tmp/` is not admitted.
    expect(discovered("tmp/tmpdir/defect-f8-serial-merge-churn.test.ts")).toBe(false);
    expect(discovered(FIXTURE)).toBe(false);
    expect(ignorePatterns()).toContain("tmp/**");
    expect(ignorePatterns()).toContain("**/dist/**");
  });

  test("the aggregate test stage is the one that discovers them", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(manifest.scripts?.test).toBe("bun test");
    const bunfig = readFileSync(join(ROOT, BUNFIG), "utf8");
    expect(bunfig).toContain('root = "."');
    // The job that runs the aggregate stage is the delivered one, unchanged.
    const ci = readFileSync(join(ROOT, WORKFLOW_DIR, "ci.yml"), "utf8");
    expect(ci).toContain("pnpm test");
  });

  test("no new suite imports a network or child-process seam", () => {
    for (const file of NEW_SUITES) {
      expect(egressFindings(file), file).toEqual([]);
    }
    // The scan is non-vacuous: a file that imports the child-process seam is
    // named, so an added import in a new suite cannot pass by omission.
    expect(egressFindings("packages/adapters/src/daemon/process.ts").length).toBeGreaterThan(0);
  });
});

describe("TC-F7-006 the pinned topology is unchanged", () => {
  test("the workflow file set, per-file jobs and per-file triggers equal the pin", () => {
    expect(workflowFiles()).toEqual(Object.keys(pin.workflows).sort());
    for (const file of workflowFiles()) {
      const actual = parseWorkflow(file);
      const expected = pin.workflows[file];
      expect(expected, file).toBeDefined();
      if (expected === undefined) continue;
      expect(actual.jobs, `${file}: jobs`).toEqual([...expected.jobs].sort());
      expect(actual.triggers, `${file}: triggers`).toEqual([...expected.triggers].sort());
    }
  });

  test("the aggregate test job and its two pinned suites keep their check names", () => {
    const ci = parseWorkflow("ci.yml");
    expect(ci.jobs).toContain("ts-test");
    expect(ci.jobs).toContain("ts-pins");
    // The new suites add no job, trigger, permission, upload, or artifact field:
    // the pin carries the exact sets and this case compares them above.
    const text = readFileSync(join(ROOT, WORKFLOW_DIR, "ci.yml"), "utf8");
    expect(text).not.toContain("defect-f1-merge-refusal-containment");
    expect(text).not.toContain("defect-f8-serial-merge-churn");
  });
});
