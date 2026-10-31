/**
 * TC-CONFIG-025 — packed core/adapters consumers under Node and Bun.
 *
 * The consumer is installed from real tarballs in an isolated directory with
 * `--ignore-workspace`, so resolution cannot rely on the workspace dev hoist.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTION_SCHEMA, resolveConfig } from "@delivery-os/core";

const ROOT = process.cwd();
const PROBE = `import { PRODUCTION_SCHEMA, resolveConfig } from "@delivery-os/core";
import { parseConfigYaml } from "@delivery-os/adapters/file";

const resolved = resolveConfig();
if (!resolved.ok || JSON.stringify(resolved.value.values) !== "{}") {
  throw new Error("empty production resolver mismatch");
}
const parsed = parseConfigYaml("value: one", "system", "probe.yaml");
if (!parsed.ok) throw new Error("packed parser failed");
process.stdout.write(JSON.stringify({ schema: PRODUCTION_SCHEMA, parsed: parsed.facts.values }));
`;
const SUBPATH = 'import "@delivery-os/core/config";\n';

const command = (
  name: string,
  args: readonly string[],
  cwd: string,
  env?: Record<string, string>,
) => {
  const result = spawnSync(name, [...args], {
    cwd,
    encoding: "utf8",
    ...(env !== undefined ? { env } : {}),
  });
  if (result.status !== 0) {
    throw new Error(`${name} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result;
};

const pack = (packageName: string, destination: string): string => {
  mkdirSync(destination, { recursive: true });
  command("pnpm", ["pack", "--pack-destination", destination], join(ROOT, "packages", packageName));
  const tarballs = readdirSync(destination).filter((name) => name.endsWith(".tgz"));
  const tarball = tarballs[0];
  if (tarballs.length !== 1 || tarball === undefined) {
    throw new Error(`expected one ${packageName} tarball`);
  }
  return join(destination, tarball);
};

const makeConsumer = (): string => {
  mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true });
  const directory = mkdtempSync(join(ROOT, "tmp", "tmpdir", "packed-config-"));
  const consumer = join(directory, "consumer");
  try {
    const tarballs = join(directory, "tarballs");
    mkdirSync(consumer, { recursive: true });
    mkdirSync(tarballs, { recursive: true });
    const core = pack("core", join(tarballs, "core"));
    const adapters = pack("adapters", join(tarballs, "adapters"));
    writeFileSync(
      join(consumer, "package.json"),
      `${JSON.stringify(
        {
          name: "packed-config-consumer",
          private: true,
          type: "module",
          dependencies: {
            "@delivery-os/core": `file:${core}`,
            "@delivery-os/adapters": `file:${adapters}`,
          },
          // pnpm pack rewrites the adapters dependency to "0.0.0"; resolve it
          // back to this run's core tarball instead of the registry.
          pnpm: { overrides: { "@delivery-os/core": `file:${core}` } },
        },
        null,
        2,
      )}\n`,
    );
    // Hermetic install env: HOME and the XDG roots point into this run's
    // scratch directory, so pnpm resolves from a cold store on every machine
    // and local runs match fresh-checkout CI truth.
    const hermeticHome = join(directory, "hermetic-home");
    mkdirSync(join(hermeticHome, "data"), { recursive: true });
    mkdirSync(join(hermeticHome, "cache"), { recursive: true });
    mkdirSync(join(hermeticHome, "config"), { recursive: true });
    const installEnv: Record<string, string> = {};
    for (const [name, value] of Object.entries(process.env)) {
      if (value !== undefined) installEnv[name] = value;
    }
    installEnv.HOME = hermeticHome;
    installEnv.XDG_DATA_HOME = join(hermeticHome, "data");
    installEnv.XDG_CACHE_HOME = join(hermeticHome, "cache");
    installEnv.XDG_CONFIG_HOME = join(hermeticHome, "config");
    command("pnpm", ["install", "--ignore-workspace", "--ignore-scripts"], consumer, installEnv);
    writeFileSync(join(consumer, "probe.mjs"), PROBE);
    writeFileSync(join(consumer, "subpath.mjs"), SUBPATH);
    return consumer;
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
};

const runRuntime = (runtime: "node" | "bun", file: string, consumer: string) => {
  const environment: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) environment[name] = value;
  }
  delete environment.LOG_TOKENS;
  delete environment.LOG_STREAM;
  return spawnSync(runtime, runtime === "bun" ? ["run", file] : [file], {
    cwd: consumer,
    encoding: "utf8",
    env: environment,
  });
};

describe("packed config consumers", () => {
  test("Node and Bun import packed resolver/schema/contracts/adapters with shipped artifacts", () => {
    const consumer = makeConsumer();
    try {
      for (const runtime of ["node", "bun"] as const) {
        const probe = runRuntime(runtime, "probe.mjs", consumer);
        expect(probe.status).toBe(0);
        const output = JSON.parse(probe.stdout ?? "") as { schema: unknown; parsed: unknown };
        expect(output.schema).toEqual(PRODUCTION_SCHEMA);
        expect(output.parsed).toEqual({ value: "one" });
      }
      const core = join(consumer, "node_modules/@delivery-os/core");
      const schema = JSON.parse(readFileSync(join(core, "dist/config/config.schema.json"), "utf8"));
      expect(schema).toEqual(PRODUCTION_SCHEMA);
      expect(readFileSync(join(core, "dist/config/defaults-positions.json"), "utf8")).toContain(
        "core/src/config/defaults.ts",
      );
      expect(readFileSync(join(core, "dist/index.d.ts"), "utf8")).toContain("resolveConfig");
      expect(readFileSync(join(core, "dist/contracts/index.d.ts"), "utf8")).toContain(
        "ConfigSourceFacts",
      );
      const adapters = join(consumer, "node_modules/@delivery-os/adapters");
      expect(readFileSync(join(adapters, "dist/file/index.d.ts"), "utf8")).toContain(
        "parseConfigYaml",
      );
    } finally {
      rmSync(join(consumer, ".."), { recursive: true, force: true });
    }
  }, 240_000);

  test("the core ./config subpath does not exist under either runtime", () => {
    const consumer = makeConsumer();
    try {
      for (const runtime of ["node", "bun"] as const) {
        const result = runRuntime(runtime, "subpath.mjs", consumer);
        expect(result.status).not.toBe(0);
        const message = `${result.stdout}${result.stderr}`;
        if (runtime === "node") {
          expect(message).toContain("./config");
          expect(message).toContain("exports");
        } else {
          expect(message).toContain("@delivery-os/core/config");
        }
      }
    } finally {
      rmSync(join(consumer, ".."), { recursive: true, force: true });
    }
  }, 240_000);

  test("production resolution remains empty outside the workspace", () => {
    expect(resolveConfig()).toMatchObject({ ok: true, value: { values: {}, origins: {} } });
  });
});
