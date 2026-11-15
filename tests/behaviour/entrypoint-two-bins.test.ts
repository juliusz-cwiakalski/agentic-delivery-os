/**
 * GH-320 TC-BIN-001..006 — the two-bin process edge.
 *
 * `jaiship` is a real process edge declaring its own default identity beside the
 * unchanged `delivery-os` alias; both delegate to one shared launcher
 * composition. Help and version stay isolated from state, git, and
 * configuration, the install-path read answers per identity, and the alias's
 * observable self-description is byte-identical to the captured baseline.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import { allHelpEntries, renderHelp, renderRootHelp } from "../../packages/cli/src/help";
import { bufferSink } from "../golden/helpers";

const ROOT = process.cwd();
const manifest = JSON.parse(readFileSync(join(ROOT, "packages/cli/package.json"), "utf8")) as {
  readonly bin?: Readonly<Record<string, string>>;
};

type ProcResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

const BASE_ENVIRONMENT: Record<string, string> = {
  PATH: process.env.PATH ?? "",
  HOME: process.env.HOME ?? "",
  TMPDIR: process.env.TMPDIR ?? "",
};

const spawnBin = (
  entry: string,
  argv: readonly string[],
  environment: Record<string, string> = {},
  cwd: string = ROOT,
): ProcResult => {
  const result = spawnSync("bun", [entry, ...argv], {
    cwd,
    encoding: "utf8",
    env: { ...BASE_ENVIRONMENT, ...environment },
  });
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

const deliveryOsEntry = join(ROOT, "packages/cli/bin/delivery-os.ts");
const jaishipEntry = join(ROOT, "packages/cli/bin/jaiship.ts");

const identityOf = (workingName: string) => {
  const resolved = resolveBrandIdentity({ workingName });
  if (!resolved.ok) throw new Error(`the resolver rejected ${workingName}`);
  return resolved.value;
};

/** The normalised help text: every binary-name occurrence collapses to one token. */
const normalise = (text: string, binaryName: string): string =>
  text.split(binaryName).join("<bin>");

const familyRows = (text: string): readonly string[] => {
  const rows: string[] = [];
  for (const line of text.split("\n")) {
    const match = /^ {2}([a-z][a-z0-9-]*) {2}\S/u.exec(line);
    if (match?.[1] !== undefined) rows.push(match[1]);
  }
  return rows;
};

const tempDir = (label: string): string => mkdtempSync(join(tmpdir(), `gh320-${label}-`));

const withTemp = async <T>(label: string, body: (root: string) => Promise<T> | T): Promise<T> => {
  const root = tempDir(label);
  try {
    return await body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

describe("TC-BIN-001 the second bin answers the jaiship identity at the process edge", () => {
  test("process-edge: `jaiship --version` prints one line, exit 0, empty stderr", () => {
    const run = spawnBin("packages/cli/bin/jaiship.ts", ["--version"]);
    expect(run.exitCode).toBe(0);
    expect(run.stderr).toBe("");
    expect(run.stdout).toMatch(/^jaiship \d+\.\d+\.\d+ \(build .+\)\n$/u);
  });

  test("process-edge: the workspace link answers the same identity", () => {
    const link = join(ROOT, "node_modules/.bin/jaiship");
    if (!existsSync(link)) throw new Error("the workspace link is absent: run `pnpm install`");
    const result = spawnSync("pnpm", ["exec", "jaiship", "--version"], {
      cwd: ROOT,
      encoding: "utf8",
      env: BASE_ENVIRONMENT,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^jaiship \d+\.\d+\.\d+ \(build .+\)\n$/u);
  });

  test("process-edge: the manifest maps the new bin to an existing Bun entry file", () => {
    const path = manifest.bin?.jaiship;
    expect(path).toBe("./bin/jaiship.ts");
    const file = readFileSync(join(ROOT, "packages/cli", path ?? ""), "utf8");
    expect(file.startsWith("#!/usr/bin/env bun")).toBe(true);
    expect(file).not.toContain("runCli(");
  });

  test("process-edge: the output is identical from a directory outside the checkout", async () => {
    await withTemp("cwd", (root) => {
      const inside = spawnBin("packages/cli/bin/jaiship.ts", ["--version"]);
      const outside = spawnBin(jaishipEntry, ["--version"], {}, root);
      expect(outside.exitCode).toBe(0);
      expect(outside.stdout).toBe(inside.stdout);
    });
  });
});

describe("TC-BIN-002 the alias keeps byte-identical version and help output", () => {
  const baseline = JSON.parse(
    readFileSync(join(ROOT, "tests/fixtures/entrypoint/alias-baseline.json"), "utf8"),
  ) as {
    readonly capturedFrom: string;
    readonly cells: {
      readonly version: { readonly exitCode: number; readonly stdout: string; readonly stderr: string };
      readonly help: { readonly exitCode: number; readonly stdout: string; readonly stderr: string };
      readonly invalidOverrideStatusJson: {
        readonly exitCode: number;
        readonly stdout: string;
        readonly stderr: string;
      };
    };
  };

  /** Drop the per-run envelope fields a byte baseline cannot pin. */
  const stableEnvelope = (text: string): unknown => {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const { runId: _runId, timing: _timing, ...rest } = parsed;
    return rest;
  };

  test("alias-baseline: `--version` and `--help` match the pre-change baseline", () => {
    const version = spawnBin("packages/cli/bin/delivery-os.ts", ["--version"]);
    expect({ ...version }).toEqual({ ...baseline.cells.version });
    const help = spawnBin("packages/cli/bin/delivery-os.ts", ["--help"]);
    expect({ ...help }).toEqual({ ...baseline.cells.help });
  });

  test("alias-baseline: the invalid-override containment projection is unchanged", () => {
    const run = spawnBin("packages/cli/bin/delivery-os.ts", ["status", "--json"], {
      DELIVERY_OS_WORKING_NAME: "bad/name",
    });
    expect(run.exitCode).toBe(baseline.cells.invalidOverrideStatusJson.exitCode);
    expect(stableEnvelope(run.stdout)).toEqual(
      stableEnvelope(baseline.cells.invalidOverrideStatusJson.stdout),
    );
    expect(run.stderr).toBe(baseline.cells.invalidOverrideStatusJson.stderr);
  });

  test("alias-baseline: the baseline commit is an ancestor of HEAD", () => {
    const result = spawnSync("git", ["merge-base", "--is-ancestor", baseline.capturedFrom, "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
  });

  test("alias-baseline: the alias declares no prior identity", () => {
    const source = readFileSync(deliveryOsEntry, "utf8");
    expect(source).not.toContain("priorWorkingName");
    expect(source).toContain("DEFAULT_WORKING_NAME");
  });
});

describe("TC-BIN-003 help family parity is exact and non-vacuous", () => {
  const alias = identityOf("delivery-os");
  const next = identityOf("jaiship");

  test("family-parity: both help renders carry exactly the declared twenty families", () => {
    const declared = [...PROMPT_REQUIRED_COMMANDS].sort();
    for (const brand of [alias, next]) {
      expect([...familyRows(renderRootHelp(brand))].sort()).toEqual(declared);
    }
    // The rendered order is identical across the two bins (PAR-TP-1).
    expect(familyRows(renderRootHelp(alias))).toEqual(familyRows(renderRootHelp(next)));
    expect(PROMPT_REQUIRED_COMMANDS.length).toBe(20);
  });

  test("family-parity: the normalised texts are identical and only the binary name differs", () => {
    const aliasText = renderRootHelp(alias);
    const nextText = renderRootHelp(next);
    expect(normalise(aliasText, alias.binaryName)).toBe(normalise(nextText, next.binaryName));
    expect(aliasText).not.toBe(nextText);
    expect(aliasText.split(alias.binaryName).length).toBe(nextText.split(next.binaryName).length);
  });

  test("family-parity: a removed or added family fails the comparison by name", () => {
    const compare = (rows: readonly string[]) =>
      JSON.stringify([...rows].sort()) === JSON.stringify([...PROMPT_REQUIRED_COMMANDS].sort());
    const removed = PROMPT_REQUIRED_COMMANDS.filter((command) => command !== "status");
    expect(compare(removed)).toBe(false);
    const added = [...PROMPT_REQUIRED_COMMANDS, "invented-family"];
    expect(compare(added)).toBe(false);
  });
});

describe("TC-BIN-004 per-command help follows the invoking identity", () => {
  const alias = identityOf("delivery-os");
  const next = identityOf("jaiship");

  test("per-command-help: every page follows its identity and differs only by the binary name", () => {
    const entries = allHelpEntries().filter((entry) => entry.path.length > 0);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      const aliasText = renderHelp(entry, alias);
      const nextText = renderHelp(entry, next);
      expect(normalise(aliasText, alias.binaryName)).toBe(normalise(nextText, next.binaryName));
      expect(aliasText).toContain(alias.binaryName);
      expect(nextText).toContain(next.binaryName);
    }
  });

  test("per-command-help: the render inventory is the delivered inventory", () => {
    expect(allHelpEntries().filter((entry) => entry.path.length > 0).length).toBeGreaterThan(1);
  });
});

describe("TC-BIN-005 self-description isolation holds for three reads on both bins", () => {
  const reads = ["--version", "--help", "--print-install-path"] as const;

  const run = async (
    declaredWorkingName: string,
    argv: readonly string[],
    environment: Record<string, string>,
  ) => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    let composed = 0;
    const exitCode = await runEntrypoint(argv, {
      streams: { stdout, stderr },
      environment,
      declaredWorkingName,
      composeProgram: () => {
        composed += 1;
        throw new Error("self-description must not compose");
      },
      clock: { now: () => 1 },
      newRunId: () => "run-isolation",
    });
    return { exitCode, stdout: stdout.value, stderr: stderr.value, composed };
  };

  test("isolation: all six cells stay isolated under a poisoned environment", async () => {
    await withTemp("isolation", async (root) => {
      writeFileSync(join(root, "config.yaml"), "not: [valid");
      const environment = {
        DELIVERY_OS_WORKING_NAME: "poisoned-product",
        JAISHIP_STATE_DIR: root,
        DELIVERY_OS_STATE_DIR: root,
        HOME: root,
        CI: "true",
        GITHUB_TOKEN: "canary-secret-value",
      };
      for (const [bin, name] of [
        ["delivery-os", "delivery-os"],
        ["jaiship", "jaiship"],
      ] as const) {
        for (const read of reads) {
          const result = await run(name, [read], environment);
          expect({ bin, read, exit: result.exitCode }).toEqual({ bin, read, exit: 0 });
          expect(result.stderr).toBe("");
          expect(result.composed).toBe(0);
          expect(result.stdout).not.toContain("canary-secret-value");
        }
      }
    });
  });

  test("isolation: the clean and poisoned renders are byte-identical", async () => {
    for (const name of ["delivery-os", "jaiship"]) {
      for (const read of reads) {
        const clean = await run(name, [read], {});
        // Poison that is not an identity source: an invalid YAML file, state
        // overrides, and CI. A working-name override legitimately changes the
        // identity, so the byte-equality cell leaves it out.
        const poisoned = await run(name, [read], {
          JAISHIP_STATE_DIR: "/nonexistent/state",
          DELIVERY_OS_STATE_DIR: "/nonexistent/state",
          CI: "true",
        });
        expect(poisoned.stdout).toBe(clean.stdout);
      }
    }
  });
});

describe("TC-BIN-006 the install-path read answers per identity without adding a family", () => {
  const readInstallPath = async (declaredWorkingName: string, environment: Record<string, string> = {}) => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    let composed = 0;
    const exitCode = await runEntrypoint(["--print-install-path"], {
      streams: { stdout, stderr },
      environment,
      declaredWorkingName,
      composeProgram: () => {
        composed += 1;
        throw new Error("the install-path read must not compose");
      },
    });
    return { exitCode, stdout: stdout.value, stderr: stderr.value, composed };
  };

  test("install-path: each selector answers its own brand install path", async () => {
    const next = await readInstallPath("jaiship");
    expect(next).toEqual({
      exitCode: 0,
      stdout: "~/.jaiship/bin/jaiship\n",
      stderr: "",
      composed: 0,
    });
    const alias = await readInstallPath("delivery-os");
    expect(alias.stdout).toBe("~/.delivery-os/bin/delivery-os\n");
    expect(alias.exitCode).toBe(0);
  });

  test("install-path: the member answers the effective override identity", async () => {
    const override = { DELIVERY_OS_WORKING_NAME: "acme" };
    expect((await readInstallPath("jaiship", override)).stdout).toBe("~/.acme/bin/acme\n");
    expect((await readInstallPath("delivery-os", override)).stdout).toBe("~/.acme/bin/acme\n");
  });

  test("install-path: the value is the resolver's installPath and adds no family row", async () => {
    for (const name of ["delivery-os", "jaiship"]) {
      const brand = identityOf(name);
      expect((await readInstallPath(name)).stdout).toBe(`${brand.installPath}\n`);
    }
    expect(PROMPT_REQUIRED_COMMANDS as readonly string[]).not.toContain("--print-install-path");
    expect(familyRows(renderRootHelp(identityOf("jaiship"))).length).toBe(20);
    expect(renderRootHelp(identityOf("jaiship"))).not.toContain("--print-install-path");
  });
});
