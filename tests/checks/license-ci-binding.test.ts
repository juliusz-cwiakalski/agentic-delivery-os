/**
 * TC-LICREG-020, 021, 028, 029 — CI bindingness, topology, and dependency
 * surface guards for the license gate. The workflow itself stays untouched.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  scanText as scanBindingness,
  validate as validateBindingness,
} from "../../scripts/checks/ci-bindingness";
import { validate as validateSupplyChain } from "../../scripts/checks/ci-supply-chain";
import { BASH_JOBS, TS_JOBS, validate as validateTopology } from "../../scripts/checks/ci-topology";
import { validate as validateScriptSurface } from "../../scripts/checks/script-surface";

const ROOT = process.cwd();
const CI_PATH = ".github/workflows/ci.yml";
const LICENSE_JOB = "ts-license-audit";
const PINNED_CHECK =
  "pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm check:boundaries && bun run scripts/checks/exports-parity.ts";

type WorkflowJob = {
  permissions?: Record<string, unknown>;
  steps?: Array<{ run?: string }>;
  "timeout-minutes"?: unknown;
};
type Workflow = { jobs?: Record<string, WorkflowJob> };

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

const gitShow = (path: string): string => {
  try {
    return execFileSync("git", ["show", `origin/main-tools:${path}`], {
      cwd: ROOT,
      encoding: "utf8",
    });
  } catch {
    throw new Error(
      `origin/main-tools is unavailable; fetch the base branch before reading ${path}`,
    );
  }
};

const gitDiffNames = (...paths: string[]): string[] => {
  let output: string;
  try {
    output = execFileSync(
      "git",
      ["diff", "--name-only", "origin/main-tools...HEAD", "--", ...paths],
      {
        cwd: ROOT,
        encoding: "utf8",
      },
    );
  } catch {
    throw new Error(
      `origin/main-tools is unavailable; fetch the base branch before diffing ${paths.join(" ")}`,
    );
  }
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

describe("license CI binding", () => {
  test("TC-LICREG-020 ts-license-audit is present, unmodified, and binding", () => {
    const text = readFileSync(join(ROOT, CI_PATH), "utf8");
    const workflow = parseYaml(text) as Workflow;
    const jobs = workflow.jobs ?? {};
    const job = jobs[LICENSE_JOB];
    if (!job) throw new Error(`${LICENSE_JOB} job is missing from ${CI_PATH}`);

    const runs = (job.steps ?? [])
      .map((step) => step.run)
      .filter((run): run is string => typeof run === "string");
    expect(runs).toContain("bun run scripts/checks/license-audit.ts");
    expect(job.permissions?.contents).toBe("read");
    expect(job["timeout-minutes"]).toBeUndefined();

    const block = jobBlock(text, LICENSE_JOB);
    for (const bypass of ["continue-on-error", "|| true", "set +e", "if: always()", "exit 0"]) {
      expect(block, `${LICENSE_JOB} contains ${bypass}`).not.toContain(bypass);
    }

    const baseBlock = jobBlock(gitShow(CI_PATH), LICENSE_JOB);
    expect(baseBlock.length).toBeGreaterThan(0);
    expect(block).toBe(baseBlock);

    expect(TS_JOBS.filter((jobId) => jobId === LICENSE_JOB).length).toBe(1);
    expect(TS_JOBS).toContain(LICENSE_JOB);
    expect(Object.keys(jobs).sort()).toEqual([...TS_JOBS, ...BASH_JOBS].sort());

    expect(scanBindingness(text)).toEqual([]);

    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(manifest.scripts.check).toBe(PINNED_CHECK);
  });

  test("TC-LICREG-021 CI topology, bindingness, supply-chain, and surface invariants are green", () => {
    expect(validateTopology(ROOT)).toEqual([]);
    expect(validateBindingness(ROOT)).toEqual([]);
    expect(validateSupplyChain(ROOT)).toEqual([]);
    expect(validateScriptSurface(ROOT)).toEqual([]);

    for (const script of ["ci-topology", "ci-bindingness", "ci-supply-chain", "script-surface"]) {
      const result = spawnSync("bun", ["run", join(ROOT, `scripts/checks/${script}.ts`)], {
        cwd: ROOT,
        encoding: "utf8",
      });
      expect(result.status, `${script}: ${result.stderr ?? ""}`).toBe(0);
    }
  });

  test("TC-LICREG-028 no new dependency and no lockfile or manifest change", () => {
    expect(gitDiffNames("pnpm-lock.yaml")).toEqual([]);
    expect(gitDiffNames("package.json")).toEqual([]);
    expect(gitDiffNames("packages/*/package.json")).toEqual([]);

    const base = JSON.parse(gitShow("package.json")) as {
      devDependencies?: Record<string, string>;
    };
    const delivered = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys(delivered.devDependencies ?? {}).sort()).toEqual(
      Object.keys(base.devDependencies ?? {}).sort(),
    );
  });

  test("TC-LICREG-029 pre-existing audit test titles are preserved", () => {
    const base = gitShow("tests/checks/license-audit.test.ts");
    const delivered = readFileSync(join(ROOT, "tests/checks/license-audit.test.ts"), "utf8");
    const titles = [...base.matchAll(/\btest\("([^"]+)"/g)]
      .map((match) => match[1])
      .filter((title): title is string => typeof title === "string");
    expect(titles.length).toBe(13);
    for (const title of titles) {
      expect(delivered, title).toContain(`test("${title}"`);
    }
    expect(delivered).not.toContain("test.skip");
    expect(delivered).not.toContain("test.only");
  });

  test("TC-LICREG-029 only the license audit script changed outside tests and docs", () => {
    expect(gitDiffNames("scripts", "tools", ".opencode", ".ados-claude")).toEqual([
      "scripts/checks/license-audit.ts",
    ]);
  });
});
