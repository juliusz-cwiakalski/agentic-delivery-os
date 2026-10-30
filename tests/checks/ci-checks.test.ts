/**
 * TC-SCAFFOLD-018 / 024 / 037 / 038 — CI check mutations.
 *
 * Each check passes on the live tree and fails on a mutated temp copy, naming
 * the diverging location (pins), the injected construct (bindingness), the
 * floating ref (supply chain), or the advisory (vulnerability gate).
 */
import { describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  scanText as scanBindingness,
  validate as validateBindingness,
} from "../../scripts/checks/ci-bindingness";
import {
  scanText as scanSupplyChain,
  validate as validateSupplyChain,
} from "../../scripts/checks/ci-supply-chain";
import { BASH_JOBS, TS_JOBS, validate as validateTopology } from "../../scripts/checks/ci-topology";
import { runSyncCheck } from "../../scripts/checks/error-table-sync";
import { validate as validatePins } from "../../scripts/checks/pin-equality";
import { validate as validateScriptSurface } from "../../scripts/checks/script-surface";
import {
  validateFixture,
  validate as validateVulnerabilities,
} from "../../scripts/checks/vulnerability-gate";

const ROOT = process.cwd();
const PIN_FILES = [
  ".bun-version",
  "package.json",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
];

const makePinTree = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "pins-"));
  for (const relative of PIN_FILES) {
    const target = join(directory, relative);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(ROOT, relative), target);
  }
  return directory;
};

describe("pin equality", () => {
  test("live tree passes", () => {
    expect(validatePins(ROOT)).toEqual([]);
  });

  test("each of the four copies diverges by name", () => {
    const mutations: Array<[string, (directory: string) => void, string]> = [
      [
        ".bun-version",
        (directory) => writeFileSync(join(directory, ".bun-version"), "9.9.9\n"),
        "engines.bun",
      ],
      [
        "package.json engines.bun",
        (directory) => {
          const path = join(directory, "package.json");
          const manifest = JSON.parse(readFileSync(path, "utf8")) as {
            engines: { bun: string };
          };
          manifest.engines.bun = "9.9.9";
          writeFileSync(path, JSON.stringify(manifest, null, 2));
        },
        "engines.bun",
      ],
      [
        "ci.yml env.BUN_VERSION",
        (directory) => {
          const path = join(directory, ".github/workflows/ci.yml");
          writeFileSync(
            path,
            readFileSync(path, "utf8").replace('BUN_VERSION: "1.4.4"', 'BUN_VERSION: "9.9.9"'),
          );
        },
        "ci.yml env.BUN_VERSION",
      ],
      [
        "release.yml bun-version",
        (directory) => {
          const path = join(directory, ".github/workflows/release.yml");
          writeFileSync(
            path,
            readFileSync(path, "utf8").replaceAll('bun-version: "1.4.4"', 'bun-version: "9.9.9"'),
          );
        },
        "release.yml bun-version",
      ],
    ];
    for (const [label, mutate, expected] of mutations) {
      const directory = makePinTree();
      try {
        mutate(directory);
        const failures = validatePins(directory);
        expect(
          failures.some((message) => message.includes(expected)),
          label,
        ).toBe(true);
        expect(
          failures.some((message) => message.includes("9.9.9")),
          label,
        ).toBe(true);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  test("range and latest shapes are rejected", () => {
    const shape = JSON.parse(
      readFileSync(join(ROOT, "tests/fixtures/pins/shape.json"), "utf8"),
    ) as { rejected: string[] };
    for (const value of shape.rejected) {
      const directory = makePinTree();
      try {
        writeFileSync(join(directory, ".bun-version"), `${value}\n`);
        expect(
          validatePins(directory).some((message) => message.includes("must be an exact")),
          value,
        ).toBe(true);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });
});

describe("CI bindingness", () => {
  test("live workflow is binding", () => {
    expect(validateBindingness(ROOT)).toEqual([]);
  });

  test("an injected continue-on-error is caught by job name", () => {
    const text = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8").replace(
      "  ts-boundaries:\n",
      "  ts-boundaries:\n    continue-on-error: true\n",
    );
    const failures = scanBindingness(text);
    expect(failures.some((message) => message.includes("ts-boundaries"))).toBe(true);
    expect(failures.some((message) => message.includes("continue-on-error"))).toBe(true);
  });
});

describe("CI supply chain", () => {
  test("live workflow is SHA-pinned with least privilege", () => {
    expect(validateSupplyChain(ROOT)).toEqual([]);
  });

  test("a floating tag is caught by name", () => {
    const text = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8").replace(
      "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
      "actions/checkout@v4",
    );
    const failures = scanSupplyChain(text);
    expect(failures.some((message) => message.includes("actions/checkout@v4"))).toBe(true);
  });
});

describe("vulnerability gate", () => {
  test("the committed lockfile has no high/critical advisories", () => {
    expect(validateVulnerabilities(ROOT)).toEqual([]);
  }, 240_000);

  test("a fixture advisory makes the gate fail", () => {
    const failures = validateFixture(ROOT);
    expect(failures.some((message) => message.includes("high"))).toBe(true);
  });
});

describe("CI topology", () => {
  test("bash jobs intact, TS jobs complete, triggers and wiring correct", () => {
    expect(validateTopology(ROOT)).toEqual([]);
  });
});

const CI_PATH = ".github/workflows/ci.yml";
const SCAN_JOB = "ts-forbidden-literals";

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

const replaceInJob = (text: string, jobId: string, search: string, replacement: string): string => {
  const block = jobBlock(text, jobId);
  return block.length === 0 ? text : text.replace(block, block.replace(search, replacement));
};

const makeWorkflowTree = (mutate: (text: string) => string): string => {
  const directory = mkdtempSync(join(tmpdir(), "ci-forbidden-job-"));
  mkdirSync(join(directory, ".github/workflows"), { recursive: true });
  cpSync(join(ROOT, "scripts/checks"), join(directory, "scripts/checks"), { recursive: true });
  cpSync(join(ROOT, "package.json"), join(directory, "package.json"));
  const text = readFileSync(join(ROOT, CI_PATH), "utf8");
  writeFileSync(join(directory, CI_PATH), mutate(text));
  return directory;
};

const BASELINE_FETCH_STEP =
  "      - name: Fetch the recorded corpus baseline\n        run: git fetch --no-tags origin 32784affbb8a1b82a57b6c4578a331b8bd99b4c4\n";

describe("forbidden-literal CI job", () => {
  test("live job is declared with full history, baseline fetch, and the gate command", () => {
    expect(validateTopology(ROOT)).toEqual([]);
    const text = readFileSync(join(ROOT, CI_PATH), "utf8");
    const block = jobBlock(text, SCAN_JOB);
    expect(block).toContain("fetch-depth: 0");
    expect(block).toContain("32784affbb8a1b82a57b6c4578a331b8bd99b4c4");
    expect(block).toContain("bun run scripts/checks/forbidden-literals.ts");
    expect(block).not.toContain("continue-on-error");
  });

  test("continue-on-error on the scan job fails bindingness naming the job", () => {
    const text = readFileSync(join(ROOT, CI_PATH), "utf8").replace(
      `  ${SCAN_JOB}:\n`,
      `  ${SCAN_JOB}:\n    continue-on-error: true\n`,
    );
    const failures = scanBindingness(text);
    expect(failures.some((message) => message.includes(SCAN_JOB))).toBe(true);
    expect(failures.some((message) => message.includes("continue-on-error"))).toBe(true);
  });

  test("removing the job from ci.yml fails topology naming it", () => {
    const directory = makeWorkflowTree((text) => text.replace(jobBlock(text, SCAN_JOB), ""));
    try {
      expect(validateTopology(directory).some((message) => message.includes(SCAN_JOB))).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("removing the baseline fetch step fails naming the missing baseline fetch", () => {
    const directory = makeWorkflowTree((text) => text.replace(BASELINE_FETCH_STEP, ""));
    try {
      expect(
        validateTopology(directory).some((message) => message.includes("missing baseline fetch")),
      ).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("a shallow checkout without the baseline fetch fails closed", () => {
    const directory = makeWorkflowTree((text) =>
      replaceInJob(
        text.replace(BASELINE_FETCH_STEP, ""),
        SCAN_JOB,
        "fetch-depth: 0",
        "fetch-depth: 1",
      ),
    );
    try {
      const failures = validateTopology(directory);
      expect(failures.some((message) => message.includes("full history"))).toBe(true);
      expect(failures.some((message) => message.includes("missing baseline fetch"))).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("aggregate chain stays five steps and ts-invariants changes are additions-only", () => {
    expect(validateScriptSurface(ROOT)).toEqual([]);
    const head = readFileSync(join(ROOT, CI_PATH), "utf8");
    const base = execFileSync("git", ["show", "origin/main-tools:.github/workflows/ci.yml"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    const headJob = jobBlock(head, "ts-invariants");
    const baseJob = jobBlock(base, "ts-invariants");
    for (const line of baseJob.split("\n").filter((entry) => entry.length > 0)) {
      expect(headJob).toContain(line);
    }
    expect(headJob).toContain("bun run scripts/checks/error-table-sync.ts");
    expect(headJob).toContain("bun run scripts/checks/exit-code-literals.ts");
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
});

describe("GH-172 CI binding", () => {
  const NEW_CHECKS = [
    "bun run scripts/checks/error-table-sync.ts",
    "bun run scripts/checks/exit-code-literals.ts",
  ];

  test("both new checks are invoked by name from ts-invariants", () => {
    const text = readFileSync(join(ROOT, CI_PATH), "utf8");
    const job = jobBlock(text, "ts-invariants");
    for (const check of NEW_CHECKS) expect(job).toContain(check);
  });

  test("TS_JOBS is unchanged and no new job id appears", () => {
    expect(TS_JOBS).toEqual([
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
    ]);
    const workflow = parseYaml(readFileSync(join(ROOT, CI_PATH), "utf8")) as {
      jobs?: Record<string, unknown>;
    };
    expect(Object.keys(workflow.jobs ?? {}).sort()).toEqual([...TS_JOBS, ...BASH_JOBS].sort());
  });

  test("the aggregate chain is unchanged and excludes the new checks", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(manifest.scripts.check).toBe(
      "pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm check:boundaries",
    );
    expect(manifest.scripts.check).not.toContain("error-table-sync");
    expect(manifest.scripts.check).not.toContain("exit-code-literals");
  });

  test("ci-bindingness reports no bypass in the invariant job", () => {
    const text = readFileSync(join(ROOT, CI_PATH), "utf8");
    const job = jobBlock(text, "ts-invariants");
    for (const bypass of ["continue-on-error", "|| true", "set +e", "exit 0"]) {
      expect(job).not.toContain(bypass);
    }
    expect(validateTopology(ROOT)).toEqual([]);
  });

  test("a drift mutation produces the non-zero exit CI would surface", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ci-sync-drift-"));
    try {
      cpSync(
        join(ROOT, "packages/core/src/contracts"),
        join(directory, "packages/core/src/contracts"),
        {
          recursive: true,
        },
      );
      cpSync(join(ROOT, "packages/cli/src"), join(directory, "packages/cli/src"), {
        recursive: true,
      });
      cpSync(join(ROOT, "tests/fixtures/result"), join(directory, "tests/fixtures/result"), {
        recursive: true,
      });
      mkdirSync(join(directory, "doc/spec/features"), { recursive: true });
      cpSync(
        join(ROOT, "doc/spec/features/feature-result-contract.md"),
        join(directory, "doc/spec/features/feature-result-contract.md"),
      );
      writeFileSync(
        join(directory, "packages/cli/src/index.ts"),
        `${readFileSync(join(directory, "packages/cli/src/index.ts"), "utf8")}\nconst drift = "input.ci.drift";\n`,
      );
      const live = await runSyncCheck({ root: ROOT });
      expect(live.failures).toEqual([]);
      const drifted = await runSyncCheck({ root: directory });
      expect(drifted.failures.length).toBeGreaterThan(0);
      const spawned = spawnSync("bun", ["run", join(ROOT, "scripts/checks/error-table-sync.ts")], {
        cwd: directory,
        encoding: "utf8",
      });
      expect(spawned.status).not.toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("the exit-literal check is invoked by name (TC-EXIT-002 step 7)", () => {
    const text = readFileSync(join(ROOT, CI_PATH), "utf8");
    expect(jobBlock(text, "ts-invariants")).toContain(
      "bun run scripts/checks/exit-code-literals.ts",
    );
  });
});
