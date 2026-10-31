/**
 * TC-CONFIG-006/007/014–022/024 — real config command composition through the
 * existing runCli surface, with injected streams, sources and fixture catalogs.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createLegacyCompat } from "@delivery-os/adapters/legacy";
import type { ConfigCatalog } from "@delivery-os/core";
import type { BrandingInputError, ResolverInput } from "@delivery-os/core/branding";
import type { BrandIdentity, Result } from "@delivery-os/core/contracts";
import { assertEnvelopeContract } from "@delivery-os/testkit";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { FIXTURE_CATALOG } from "../fixtures/config/catalog";

const ROOT = process.cwd();
const REPO = "/repo";
const HOME = "/home/synthetic";
const DIR = ".synthetic";
const PROBE = `${ROOT}/tests/fixtures/config/config-cli-probe.ts`;
const FILES = {
  committed: `${REPO}/${DIR}/config.yaml`,
  local: `${REPO}/${DIR}/config.local.yaml`,
  system: `/etc/xdg/${DIR}/config.yaml`,
  user: `${HOME}/.config/${DIR}/config.yaml`,
} as const;

const ok = <T extends { ok: true }, E>(result: T | { ok: false; error: E }): T => {
  if (!result.ok) throw new Error("fixture setup failed");
  return result;
};

type FileFacts = {
  readonly exists: (path: string) => boolean;
  readonly readText: (path: string) => string;
};

const files = (contents: Record<string, string>): FileFacts => ({
  exists: (path) => Object.hasOwn(contents, path),
  readText: (path) => {
    const content = contents[path];
    if (content === undefined) throw new Error("missing test file");
    return content;
  },
});

const bufferSink = (): { write: (chunk: string) => void; readonly value: string } => {
  let text = "";
  return {
    write: (chunk: string) => {
      text += chunk;
    },
    get value() {
      return text;
    },
  };
};

const build = (options: {
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly catalog?: ConfigCatalog;
  readonly contents?: Record<string, string>;
  readonly fs?: FileFacts;
  readonly resolveBrand?: (input: ResolverInput) => Result<BrandIdentity, BrandingInputError>;
}) => {
  const program = createConfigProgram({
    workingName: "synthetic",
    environment: options.environment ?? {},
    cwd: "/work",
    homeDirectory: HOME,
    platform: "linux",
    ...(options.catalog === undefined ? {} : { catalog: options.catalog }),
    fs: options.fs ?? files(options.contents ?? {}),
    ...(options.resolveBrand === undefined ? {} : { resolveBrand: options.resolveBrand }),
  });
  return ok(program);
};

type Run = { readonly exitCode: number; readonly stdout: string; readonly stderr: string };

const run = async (
  args: readonly string[],
  options: {
    readonly environment?: Readonly<Record<string, string | undefined>>;
    readonly catalog?: ConfigCatalog;
    readonly contents?: Record<string, string>;
    readonly fs?: FileFacts;
    readonly program?: ReturnType<typeof build>;
  } = {},
): Promise<Run> => {
  const built = options.program ?? build(options);
  const stdout = bufferSink();
  const stderr = bufferSink();
  let tick = 0;
  const ticks = [1000, 1007] as const;
  const deps: CliDependencies = {
    brand: built.brand,
    clock: {
      now: () => {
        const index = Math.min(tick, 1);
        tick += 1;
        return ticks[index] ?? 1000;
      },
    },
    newRunId: () => "run-config-cli",
    secrets: built.secrets,
    program: built.program,
  };
  const exitCode = await runCli(["config", ...args], { stdout, stderr }, deps);
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};

const baseEnvironment = {
  SYNTHETIC_X_TEST__REQUIREDVALUE: "required",
  SYNTHETIC_X_TEST__CREDENTIAL: "SECRET-CANARY",
} as const;

const syntheticBrand = (): BrandIdentity => ({
  productName: "synthetic",
  binaryName: "synthetic",
  packageScope: "@delivery-os",
  environmentPrefix: "SYNTHETIC_",
  configDirectoryName: DIR,
  stateDirectoryName: `${DIR}-state`,
  mcpToolPrefix: "synthetic_",
  telemetryNamespace: "delivery",
  docsBaseUrl: "https://delivery-os.github.io/synthetic/",
  repositoryUrl: "https://github.com/delivery-os/synthetic",
  releaseAssetPrefix: "synthetic-",
  installPath: `~/${DIR}/bin/synthetic`,
});

const committed = (body: string): Record<string, string> => ({ [FILES.committed]: body });

const expectConfigCode = async (
  args: readonly string[],
  options: Parameters<typeof run>[1],
  code: string,
  canary?: string,
): Promise<void> => {
  const result = await run([...args, "--json"], options);
  expect(result.exitCode).toBe(1);
  const envelope = JSON.parse(result.stdout) as {
    data?: unknown;
    error?: { code: string };
  };
  expect(envelope.error?.code).toBe(code);
  expect(envelope).not.toHaveProperty("data");
  expect(assertEnvelopeContract(envelope)).toEqual([]);
  if (canary !== undefined) {
    expect(result.stdout + result.stderr).not.toContain(canary);
  }
};

describe("TC-CONFIG-014 frozen branding bootstrap", () => {
  test("resolves branding once before discovery and serves an injected override", async () => {
    const order: string[] = [];
    const built = build({
      environment: { DELIVERY_OS_WORKING_NAME: "synthetic" },
      fs: {
        exists: () => {
          order.push("discovery");
          return false;
        },
        readText: () => "",
      },
      resolveBrand: (input) => {
        order.push(input.override ?? input.workingName);
        return { ok: true, value: syntheticBrand() };
      },
    });
    expect(order).toEqual(["synthetic"]);
    const result = await run(["--project-root", REPO], { program: built });
    expect(result.exitCode).toBe(0);
    expect(order[0]).toBe("synthetic");
    expect(order).toContain("discovery");
    expect(JSON.parse(result.stdout)).toEqual({});
  });

  test("invalid names and overrides keep the echo-free branding failure", () => {
    const invalidName = createConfigProgram({
      workingName: "",
      environment: {},
      cwd: "/work",
      homeDirectory: HOME,
      platform: "linux",
      fs: files({}),
    });
    expect(invalidName.ok).toBe(false);
    if (!invalidName.ok) expect(invalidName.error).toEqual({ field: "workingName", code: "empty" });
    const invalidOverride = createConfigProgram({
      workingName: "synthetic",
      environment: { DELIVERY_OS_WORKING_NAME: " " },
      cwd: "/work",
      homeDirectory: HOME,
      platform: "linux",
      fs: files({}),
    });
    expect(invalidOverride.ok).toBe(false);
    if (!invalidOverride.ok) {
      expect(invalidOverride.error).toEqual({ field: "override", code: "whitespace-only" });
    }
  });

  test("excludes the neutral override even when its prefix overlaps", async () => {
    const result = await run(["--project-root", REPO, "--json"], {
      environment: {
        DELIVERY_OS_WORKING_NAME: "delivery os",
        DELIVERY_OS_X_TEST__REQUIREDVALUE: "required",
        DELIVERY_OS_X_TEST__CREDENTIAL: "SECRET-CANARY",
        DELIVERY_OS_UNRELATED: "must fail",
      },
      catalog: FIXTURE_CATALOG,
      contents: {},
    });
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("config.environment.unmapped");
  });
});

describe("TC-CONFIG-015/018 debug, get and human payloads", () => {
  test("empty production basic is exactly {}", async () => {
    const result = await run(["--project-root", REPO]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("{}\n");
    expect(result.stderr).toBe("");
    const machine = await run(["--project-root", REPO, "--json"]);
    const envelope = JSON.parse(machine.stdout) as { data: unknown };
    expect(envelope.data).toEqual({});
    expect(assertEnvelopeContract(envelope)).toEqual([]);
  });

  test("debug and get expose the same winning file origin and loaded/skipped evidence", async () => {
    const options = {
      environment: baseEnvironment,
      catalog: FIXTURE_CATALOG,
      contents: committed("x-test:\n  nested:\n    first: file-first\n"),
    };
    const debug = await run(["debug", "--project-root", REPO], options);
    expect(debug.exitCode).toBe(0);
    const payload = JSON.parse(debug.stdout) as {
      config: { "x-test": { nested: { first: string } } };
      origins: Record<string, string>;
      loadedFiles: string[];
      skippedLayers: Array<{ layer: string; reason: string }>;
    };
    expect(payload.config["x-test"].nested.first).toBe("file-first");
    expect(payload.origins["x-test.nested.first"]).toBe(
      `layer=project-committed file=${FILES.committed} line=3`,
    );
    expect(payload.loadedFiles).toEqual([FILES.committed]);
    expect(payload.skippedLayers).toEqual([
      { layer: "system", reason: "missing" },
      { layer: "user-global", reason: "missing" },
      { layer: "project-local", reason: "missing" },
    ]);
    const alias = await run(["--debug", "--project-root", REPO], options);
    expect(alias.stdout).toBe(debug.stdout);
    const get = await run(
      ["get", "x-test.nested.first", "--show-origin", "--project-root", REPO],
      options,
    );
    expect(JSON.parse(get.stdout)).toEqual({
      key: "x-test.nested.first",
      value: "file-first",
      origin: payload.origins["x-test.nested.first"],
    });
    const value = await run(["get", "x-test.nested.first", "--project-root", REPO], options);
    expect(JSON.parse(value.stdout)).toBe("file-first");
  });

  test("unknown get is a classified validation failure, not empty success", async () => {
    await expectConfigCode(
      ["get", "x-test.missing", "--project-root", REPO],
      { environment: baseEnvironment, catalog: FIXTURE_CATALOG, contents: {} },
      "config.key.unknown",
    );
  });
});

describe("TC-CONFIG-007/016/022 classified failures and warnings", () => {
  test("malformed source names the layer and contains no canary", async () => {
    await expectConfigCode(
      ["debug", "--project-root", REPO],
      { contents: committed("x-test: [ MALFORMED-CANARY") },
      "config.file.malformed",
      "MALFORMED-CANARY",
    );
  });

  test("file secret, interpolation, path, reset and strict warnings are classified", async () => {
    await expectConfigCode(
      ["debug", "--project-root", REPO],
      {
        environment: baseEnvironment,
        catalog: FIXTURE_CATALOG,
        contents: committed("x-test:\n  credential: FILE-SECRET-CANARY\n"),
      },
      "config.secret.forbidden",
      "FILE-SECRET-CANARY",
    );
    await expectConfigCode(
      ["debug", "--project-root", REPO],
      {
        environment: baseEnvironment,
        catalog: FIXTURE_CATALOG,
        contents: committed('x-test:\n  oldValue: "${SECRET:-default}"\n'),
      },
      "config.interpolation.rejected",
    );
    await expectConfigCode(
      ["debug", "--project-root", REPO],
      {
        environment: {
          ...baseEnvironment,
          SYNTHETIC_X_TEST__NESTED__SECOND: "UNREGISTERED-ENV-CANARY",
        },
        catalog: FIXTURE_CATALOG,
        contents: {},
      },
      "config.value.invalid",
      "UNREGISTERED-ENV-CANARY",
    );
    await expectConfigCode(
      ["debug", "--project-root", REPO],
      {
        environment: baseEnvironment,
        catalog: FIXTURE_CATALOG,
        contents: { [FILES.local]: "x-test:\n  localPath: /machine/path\n" },
      },
      "config.path.forbidden",
    );
    await expectConfigCode(
      ["debug", "--project-root", REPO],
      {
        environment: baseEnvironment,
        catalog: FIXTURE_CATALOG,
        contents: committed("reset: [12]\n"),
      },
      "config.reset.invalid",
    );
    const warned = await run(["--strict", "debug", "--project-root", REPO, "--json"], {
      environment: baseEnvironment,
      catalog: FIXTURE_CATALOG,
      contents: committed("x-test:\n  oldValue: deprecated-value\n"),
    });
    expect(warned.exitCode).toBe(1);
    const envelope = JSON.parse(warned.stdout) as { data?: unknown; error?: { code: string } };
    expect(envelope.error?.code).toBe("config.warning.strict");
    expect(envelope).not.toHaveProperty("data");
    expect(warned.stdout + warned.stderr).not.toContain("deprecated-value");
  });

  test("unregistered malformed, schema and restriction canaries stay out of both streams", async () => {
    const cases = [
      ["x-test: [ UNREGISTERED-MALFORMED", "config.file.malformed"],
      ["x-test:\n  nested:\n    second: .inf # UNREGISTERED-NONJSON", "config.file.malformed"],
    ] as const;
    for (const [body, code] of cases) {
      const result = await run(["debug", "--project-root", REPO, "--json"], {
        environment: baseEnvironment,
        catalog: FIXTURE_CATALOG,
        contents: committed(body),
      });
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain(code);
      expect(result.stdout + result.stderr).not.toContain("UNREGISTERED-");
    }
  });
});

describe("TC-CONFIG-021 actual host switches through config CLI", () => {
  const probe = (env: Record<string, string>) => {
    const childEnv: Record<string, string> = {};
    for (const [name, value] of Object.entries(process.env)) {
      if (value !== undefined) childEnv[name] = value;
    }
    delete childEnv.LOG_TOKENS;
    delete childEnv.LOG_STREAM;
    const result = spawnSync(
      "bun",
      [
        "run",
        PROBE,
        JSON.stringify({
          environment: {},
          content: "x-test: [ CONFIG-HOST-CANARY",
          args: ["debug", "--project-root", "/repo", "--json"],
        }),
      ],
      { cwd: ROOT, encoding: "utf8", env: { ...childEnv, ...env } },
    );
    const parsed = JSON.parse(result.stdout) as {
      exitCode: number;
      stdout: string;
      stderr: string;
    };
    return parsed;
  };

  test("LOG_TOKENS/LOG_STREAM block before parse with no source canary", () => {
    for (const env of [{ LOG_TOKENS: "1" }, { LOG_STREAM: "1" }]) {
      const result = probe(env);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("config.value.invalid");
      expect(result.stdout + result.stderr).not.toContain("CONFIG-HOST-CANARY");
    }
    const control = probe({});
    expect(control.exitCode).toBe(1);
    expect(control.stdout).toContain("config.file.malformed");
    expect(control.stdout + control.stderr).not.toContain("CONFIG-HOST-CANARY");
  });
});

describe("TC-CONFIG-019 registered redaction and one envelope", () => {
  test("registered secret values are redacted in human and machine payloads", async () => {
    const options = {
      environment: baseEnvironment,
      catalog: FIXTURE_CATALOG,
      contents: committed("x-test:\n  nested:\n    first: file-first\n"),
    };
    const human = await run(["--project-root", REPO], options);
    expect(human.exitCode).toBe(0);
    expect(human.stdout).not.toContain("SECRET-CANARY");
    expect(human.stdout).toContain("[redacted]");
    const machine = await run(["--project-root", REPO, "--json"], options);
    expect(machine.stdout).not.toContain("SECRET-CANARY");
    const envelope = JSON.parse(machine.stdout) as { data: unknown };
    expect(envelope.data).toEqual(JSON.parse(human.stdout));
    expect(assertEnvelopeContract(envelope)).toEqual([]);
    expect(machine.stdout.trim().split("\n\n")).toHaveLength(1);
  });

  test("debug warnings are safe and emitted through the chokepoint", async () => {
    const result = await run(["debug", "--project-root", REPO, "--json"], {
      environment: baseEnvironment,
      catalog: FIXTURE_CATALOG,
      contents: committed("x-test:\n  oldValue: WARNING-CANARY\n"),
    });
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("deprecated");
    expect(result.stderr).not.toContain("WARNING-CANARY");
    const envelope = JSON.parse(result.stdout) as { data: unknown };
    expect(assertEnvelopeContract(envelope)).toEqual([]);
  });
});

describe("TC-CONFIG-006/024 selector and legacy composition", () => {
  test("explicit --config wins over the environment selector and skips local", async () => {
    const options = {
      environment: {
        ...baseEnvironment,
        SYNTHETIC_CONFIG: "/env/config.yaml",
      },
      catalog: FIXTURE_CATALOG,
      contents: {
        "/selected/config.yaml": "x-test:\n  nested:\n    first: selected\n",
        "/env/config.yaml": "x-test:\n  nested:\n    first: env\n",
      },
    };
    const result = await run(
      ["debug", "--config", "/selected/config.yaml", "--project-root", REPO],
      options,
    );
    const payload = JSON.parse(result.stdout) as {
      config: { "x-test": { nested: { first: string } } };
      loadedFiles: string[];
    };
    expect(payload.config["x-test"].nested.first).toBe("selected");
    expect(payload.loadedFiles).toEqual(["/selected/config.yaml"]);
  });

  test("legacy facts map current names once and current values win", async () => {
    const built = build({
      environment: {
        ADOS_X_TEST__REQUIREDVALUE: "legacy-required",
        SYNTHETIC_X_TEST__CREDENTIAL: "SECRET-CANARY",
      },
      catalog: FIXTURE_CATALOG,
      contents: {},
    });
    const first = await run(["--project-root", REPO], { program: built });
    expect(first.exitCode).toBe(0);
    expect(first.stderr).toContain("legacy compatibility");
    const second = await run(["--project-root", REPO], { program: built });
    expect(second.stderr).toBe("");
    const compat = createLegacyCompat({
      current: { environmentPrefix: "SYNTHETIC_", configDirectoryName: DIR },
      warn: () => undefined,
    });
    const facts = compat.resolveConfigFacts({
      facts: { ADOS_X_TEST__REQUIREDVALUE: "legacy", ADOS_CONFIG: "/legacy.yaml" },
      environment: {
        SYNTHETIC_X_TEST__REQUIREDVALUE: "current",
        SYNTHETIC_CONFIG: "/current.yaml",
      },
      homeDirectory: HOME,
    });
    expect(facts.environment.SYNTHETIC_X_TEST__REQUIREDVALUE).toBe("current");
    expect(facts.selectedConfig).toBe("/current.yaml");
  });
});
