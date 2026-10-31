/**
 * TC-WIRE-001..003 — binding ts-invariants wiring, the build-free offline local
 * command, and the new suites running under the binding test job.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { scanText as scanBindingness } from "../../scripts/checks/ci-bindingness";
import { BASH_JOBS, TS_JOBS } from "../../scripts/checks/ci-topology";
import { EXPECTED_ALLOWLIST } from "../fixtures/privacy-literals/registry";
import { RULE_POSITIVES } from "../fixtures/privacy-literals/rules";
import {
  createPrivacyRepo,
  gitStatus,
  ROOT,
  runCheck,
  scan,
  snapshotTree,
} from "./privacy-support";

const CI_PATH = ".github/workflows/ci.yml";
const GUARD_COMMAND = "bun run scripts/checks/privacy-literals.ts";
const AGGREGATE =
  "pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm check:boundaries && bun run scripts/checks/exports-parity.ts";
const NEW_SUITES = [
  "tests/checks/privacy-literals.test.ts",
  "tests/checks/privacy-registry.test.ts",
  "tests/checks/privacy-scope.test.ts",
  "tests/checks/privacy-reporting.test.ts",
  "tests/checks/privacy-authoring.test.ts",
  "tests/checks/privacy-performance.test.ts",
  "tests/behaviour/envelope-content-policy.test.ts",
] as const;

const workflowText = (): string => readFileSync(join(ROOT, CI_PATH), "utf8");

const jobBlock = (text: string, jobId: string): string => {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line === `  ${jobId}:`);
  if (start < 0) return "";
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^ {2}[a-z0-9-]+:\s*$/.test(lines[index] as string)) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
};

type Workflow = {
  jobs?: Record<string, { steps?: Array<{ run?: string }>; "continue-on-error"?: unknown }>;
};

export const validateGuardWiring = (text: string): string[] => {
  const failures: string[] = [];
  const workflow = parseYaml(text) as Workflow;
  const job = workflow.jobs?.["ts-invariants"];
  if (job === undefined) return ["ci.yml: ts-invariants job is missing"];
  if (job["continue-on-error"] !== undefined) {
    failures.push("ci.yml: ts-invariants must not be advisory (continue-on-error)");
  }
  const steps = job.steps ?? [];
  if (!steps.some((step) => (step.run ?? "").includes(GUARD_COMMAND))) {
    failures.push(`ci.yml: ts-invariants must invoke ${GUARD_COMMAND}`);
  }
  const jobs = Object.keys(workflow.jobs ?? {}).sort();
  const expected = [...TS_JOBS, ...BASH_JOBS].sort();
  if (JSON.stringify(jobs) !== JSON.stringify(expected)) {
    failures.push(
      `ci.yml: job set changed (unexpected: ${jobs.filter((id) => !expected.includes(id)).join(", ") || "none"})`,
    );
  }
  return failures;
};

const replaceInJob = (text: string, jobId: string, search: string, replacement: string): string => {
  const block = jobBlock(text, jobId);
  return block.length === 0 ? text : text.replace(block, block.replace(search, replacement));
};

describe("TC-WIRE-001 binding ts-invariants invocation", () => {
  test("the live workflow invokes the guard by name with no bypass and no new job", () => {
    expect(validateGuardWiring(workflowText())).toEqual([]);
    expect(scanBindingness(workflowText())).toEqual([]);
    expect(jobBlock(workflowText(), "ts-invariants")).toContain(GUARD_COMMAND);
    expect(jobBlock(workflowText(), "ts-invariants")).not.toContain("continue-on-error");
  });

  test("the workflow diff against origin/main-tools is additions-only", () => {
    const diff = execFileSync(
      "git",
      ["diff", "--unified=0", "origin/main-tools...HEAD", "--", CI_PATH],
      { cwd: ROOT, encoding: "utf8" },
    );
    const removed = diff
      .split("\n")
      .filter((line) => line.startsWith("-") && !line.startsWith("---"));
    expect(removed).toEqual([]);
  });

  test("mutation controls are caught by name", () => {
    const text = workflowText();
    const removed = text.replace(`          ${GUARD_COMMAND}\n`, "");
    expect(validateGuardWiring(removed).some((failure) => failure.includes(GUARD_COMMAND))).toBe(
      true,
    );

    const advisory = text.replace(
      "  ts-invariants:\n",
      "  ts-invariants:\n    continue-on-error: true\n",
    );
    expect(scanBindingness(advisory).some((failure) => failure.includes("ts-invariants"))).toBe(
      true,
    );

    const bypass = replaceInJob(text, "ts-invariants", GUARD_COMMAND, `${GUARD_COMMAND} || true`);
    expect(scanBindingness(bypass).some((failure) => failure.includes("|| true"))).toBe(true);

    const extraJob = `${text}\n  ts-privacy-extra:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo extra\n`;
    expect(validateGuardWiring(extraJob).length).toBeGreaterThan(0);
  });

  test("failure propagation: the guard fails on a planted tree and passes on a clean one", () => {
    const value = RULE_POSITIVES[4]?.value as string;
    const planted = createPrivacyRepo({ "scanned/planted.txt": `${value}\n` });
    const clean = createPrivacyRepo({});
    try {
      const failing = runCheck(planted.root);
      expect(failing.status).toBe(1);
      expect(`${failing.stdout}${failing.stderr}`).toContain("secret.credential-assignment");
      expect(runCheck(clean.root).status).toBe(0);
    } finally {
      planted.cleanup();
      clean.cleanup();
    }
  });

  test("the aggregate check string is byte-unchanged and does not chain the guard", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(manifest.scripts.check).toBe(AGGREGATE);
    expect(manifest.scripts.check).not.toContain("privacy");
    expect(manifest.scripts["check:privacy-literals"]).toBe(GUARD_COMMAND);
  });
});

describe("TC-WIRE-002 local command is offline, build-free, and count-reporting", () => {
  test("the local command exits 0 with the required counts", () => {
    const result = spawnSync("pnpm", ["check:privacy-literals"], { cwd: ROOT, encoding: "utf8" });
    expect(result.status).toBe(0);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).toContain("file(s) scanned");
    expect(output).toContain("7 rule(s)");
    expect(output).toContain("class private-literal");
    expect(output).toContain("class cloud-term");
    expect(output).toContain("vacuous");
    expect(output).toContain("distinct length(s)");
  });

  test("the import graph is build-free and external-dependency-free", () => {
    const source = readFileSync(join(ROOT, "scripts/checks/privacy-literals.ts"), "utf8");
    const specifiers = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1] ?? "");
    for (const specifier of specifiers) {
      expect(
        specifier.startsWith("node:") ||
          specifier.startsWith("./") ||
          specifier.startsWith("../../"),
      ).toBe(true);
      expect(specifier).not.toContain("dist/");
      expect(specifier).not.toContain("@delivery-os/");
    }
  });

  test("the guard runs from a temp clone with no dist and from a planted copy", () => {
    const clean = createPrivacyRepo({});
    const value = RULE_POSITIVES[4]?.value as string;
    const planted = createPrivacyRepo({ "scanned/planted.txt": `${value}\n` });
    const cloneRoot = mkdtempSync(join(tmpdir(), "privacy-wire-clone-"));
    try {
      execFileSync("git", ["clone", "--no-hardlinks", "--quiet", ROOT, join(cloneRoot, "repo")]);
      const cleanRun = spawnSync(
        "bun",
        ["run", join(cloneRoot, "repo", "scripts/checks/privacy-literals.ts")],
        {
          cwd: clean.root,
          encoding: "utf8",
        },
      );
      expect(cleanRun.status).toBe(0);
      const plantedRun = spawnSync(
        "bun",
        ["run", join(cloneRoot, "repo", "scripts/checks/privacy-literals.ts")],
        {
          cwd: planted.root,
          encoding: "utf8",
        },
      );
      expect(plantedRun.status).toBe(1);
      expect(plantedRun.stdout).toContain("secret.credential-assignment");
    } finally {
      rmSync(cloneRoot, { recursive: true, force: true });
      clean.cleanup();
      planted.cleanup();
    }
  });

  test("the command is read-only, deterministic, and unaffected by a throwing fetch", () => {
    const before = snapshotTree(ROOT);
    const statusBefore = gitStatus(ROOT);
    const first = runCheck(ROOT, ["--json"]);
    const second = runCheck(ROOT, ["--json"]);
    expect(first.status).toBe(0);
    expect(first.stdout).toBe(second.stdout);
    expect(snapshotTree(ROOT)).toEqual(before);
    expect(gitStatus(ROOT)).toBe(statusBefore);
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (() => {
        throw new Error("network not licensed");
      }) as typeof fetch;
      expect(scan(ROOT).failures).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("TC-WIRE-003 new suites run under the binding test job", () => {
  test("ts-test runs pnpm test and the test script has no bypass", () => {
    const job = jobBlock(workflowText(), "ts-test");
    expect(job).toContain("pnpm test");
    expect(job).not.toContain("continue-on-error");
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(manifest.scripts.test).toBe("bun test");
    for (const bypass of ["--bail", "--passWithNoTests", "--filter", "|| true"]) {
      expect(manifest.scripts.test).not.toContain(bypass);
    }
  });

  test("bunfig discovery covers the new suites and excludes none of them", () => {
    const bunfig = readFileSync(join(ROOT, "bunfig.toml"), "utf8");
    expect(bunfig).toContain('root = "."');
    for (const suite of NEW_SUITES) {
      expect(bunfig).not.toContain(suite);
      if (!existsSync(join(ROOT, suite))) continue;
      expect(readFileSync(join(ROOT, suite), "utf8").length).toBeGreaterThan(0);
    }
  });

  const SUITE_FILTERS: Record<string, string> = {
    "tests/checks/privacy-literals.test.ts": "each rule fires exactly once",
    "tests/checks/privacy-registry.test.ts": "the valid control",
    "tests/checks/privacy-scope.test.ts": "an untracked-but-not-ignored value is scanned",
    "tests/checks/privacy-reporting.test.ts": "two runs in each mode",
    "tests/checks/privacy-authoring.test.ts": "a piped literal yields",
    "tests/checks/privacy-performance.test.ts": "the distinct-length envelope",
    "tests/behaviour/envelope-content-policy.test.ts": "clean envelopes",
  };

  test("each new suite runs explicitly with a non-zero pass count", () => {
    for (const suite of NEW_SUITES) {
      if (!existsSync(join(ROOT, suite))) continue;
      const filter = SUITE_FILTERS[suite];
      const args = filter === undefined ? ["test", suite] : ["test", suite, "-t", filter];
      const result = spawnSync("bun", args, { cwd: ROOT, encoding: "utf8" });
      expect(result.status, suite).toBe(0);
      const match = /(\d+) pass/.exec(`${result.stdout}${result.stderr}`);
      expect(match, suite).not.toBeNull();
      expect(Number(match?.[1] ?? 0), suite).toBeGreaterThan(0);
    }
  }, 180_000);

  test("a deliberately failing temp test fails the runner naming the file", () => {
    const root = mkdtempSync(join(tmpdir(), "privacy-failing-"));
    try {
      const path = join(root, "deliberate.test.ts");
      writeFileSync(
        path,
        'import { expect, test } from "bun:test";\ntest("deliberate failure", () => { expect(1).toBe(2); });\n',
      );
      const result = spawnSync("bun", ["test", path], { cwd: ROOT, encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toContain("deliberate.test.ts");
      expect(`${result.stdout}${result.stderr}`).toContain("fail");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a temp copy of one suite with an injected failing case fails by file name", () => {
    const root = mkdtempSync(join(tmpdir(), "privacy-suite-copy-"));
    try {
      const imports: Array<[string, string]> = [
        [
          "../../scripts/checks/privacy-literals",
          pathToFileURL(join(ROOT, "scripts/checks/privacy-literals.ts")).href,
        ],
        ["./privacy-support", pathToFileURL(join(ROOT, "tests/checks/privacy-support.ts")).href],
        [
          "../fixtures/privacy-literals/rules",
          pathToFileURL(join(ROOT, "tests/fixtures/privacy-literals/rules.ts")).href,
        ],
        [
          "../fixtures/privacy-literals/registry",
          pathToFileURL(join(ROOT, "tests/fixtures/privacy-literals/registry.ts")).href,
        ],
      ];
      let source = readFileSync(join(ROOT, "tests/checks/privacy-scope.test.ts"), "utf8");
      for (const [search, replacement] of imports) source = source.replaceAll(search, replacement);
      source += '\ntest("injected failure", () => { expect(1).toBe(2); });\n';
      const path = join(root, "privacy-scope-copy.test.ts");
      writeFileSync(path, source);
      const result = spawnSync("bun", ["test", path], { cwd: ROOT, encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toContain("privacy-scope-copy.test.ts");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 120_000);
});
