/**
 * TC-STATE-021 — the packed core state surface imports and runs under Node and
 * Bun within the TDR-0004 runtime matrix (AC-F9-3). This is the single
 * documented spawned-process probe of the change (NFR-9 exception).
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();

const PROBE = `import {
  createNodeStateEdge,
  createStateStore,
  STATE_SCHEMA_VERSION,
} from "@delivery-os/core/state";
import { STATE_DRIVER_KINDS } from "@delivery-os/core/contracts";

const root = process.argv[2];
const identity = {
  level: "local",
  workspaceId: "packed",
  fenceNamespace: "packed-fence",
  schemaVersion: STATE_SCHEMA_VERSION,
  stateDirectory: root,
};
const results = {};
for (const driver of STATE_DRIVER_KINDS) {
  const store = createStateStore(identity, { driver, edge: createNodeStateEdge() });
  const acquired = store.acquireFence("packed-writer");
  if (!acquired.ok) throw new Error("acquire: " + acquired.error.code);
  const appended = store.append(acquired.value.handle, {
    kind: "packed",
    recordKey: "k",
    payload: { driver },
  });
  if (!appended.ok) throw new Error("append: " + appended.error.code);
  store.releaseFence(acquired.value.handle);
  const read = store.read({ requiredKeys: ["k"] });
  if (!read.ok) throw new Error("read: " + read.error.code);
  results[driver] = read.value.values.k;
}
process.stdout.write(JSON.stringify({ drivers: results, kinds: STATE_DRIVER_KINDS }));
`;

const SUBPATH_PROBE = 'import "@delivery-os/core/state/internals";\n';

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

const packCore = (destination: string): string => {
  mkdirSync(destination, { recursive: true });
  command("pnpm", ["pack", "--pack-destination", destination], join(ROOT, "packages", "core"));
  const tarball = readdirSync(destination).find((name) => name.endsWith(".tgz"));
  if (tarball === undefined) throw new Error("expected one core tarball");
  return join(destination, tarball);
};

const makeConsumer = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "packed-state-"));
  const consumer = join(directory, "consumer");
  try {
    const tarballs = join(directory, "tarballs");
    mkdirSync(consumer, { recursive: true });
    mkdirSync(tarballs, { recursive: true });
    const core = packCore(tarballs);
    writeFileSync(
      join(consumer, "package.json"),
      `${JSON.stringify(
        {
          name: "packed-state-consumer",
          private: true,
          type: "module",
          dependencies: { "@delivery-os/core": `file:${core}` },
        },
        null,
        2,
      )}\n`,
    );
    const hermeticHome = join(directory, "hermetic-home");
    mkdirSync(join(hermeticHome, "data"), { recursive: true });
    mkdirSync(join(hermeticHome, "cache"), { recursive: true });
    mkdirSync(join(hermeticHome, "config"), { recursive: true });
    const env: Record<string, string> = {};
    for (const [name, value] of Object.entries(process.env)) {
      if (value !== undefined) env[name] = value;
    }
    env.HOME = hermeticHome;
    env.XDG_DATA_HOME = join(hermeticHome, "data");
    env.XDG_CACHE_HOME = join(hermeticHome, "cache");
    env.XDG_CONFIG_HOME = join(hermeticHome, "config");
    command("pnpm", ["install", "--ignore-workspace", "--ignore-scripts"], consumer, env);
    writeFileSync(join(consumer, "probe.mjs"), PROBE);
    writeFileSync(join(consumer, "subpath.mjs"), SUBPATH_PROBE);
    return consumer;
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
};

const runRuntime = (runtime: "node" | "bun", file: string, consumer: string, root: string) => {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) env[name] = value;
  }
  return spawnSync(runtime, runtime === "bun" ? ["run", file, root] : [file, root], {
    cwd: consumer,
    encoding: "utf8",
    env,
  });
};

describe("TC-STATE-021 packed Node/Bun state surface", () => {
  test("both driver kinds load and run under Node and Bun within the matrix", () => {
    const consumer = makeConsumer();
    const stateRoots: string[] = [];
    try {
      for (const runtime of ["node", "bun"] as const) {
        const stateRoot = mkdtempSync(join(tmpdir(), `packed-state-${runtime}-`));
        stateRoots.push(stateRoot);
        const result = runRuntime(runtime, "probe.mjs", consumer, stateRoot);
        if (result.status !== 0) {
          throw new Error(
            `${runtime} packed state probe failed (TDR-0004 matrix must be amended, never skipped): ` +
              `${result.stderr || result.stdout}`,
          );
        }
        const parsed = JSON.parse(result.stdout) as {
          drivers: Record<string, { driver: string }>;
          kinds: string[];
        };
        expect(parsed.kinds).toEqual(["jsonl", "sqlite"]);
        expect(parsed.drivers.jsonl).toEqual({ driver: "jsonl" });
        expect(parsed.drivers.sqlite).toEqual({ driver: "sqlite" });
      }

      const manifest = JSON.parse(
        readFileSync(join(consumer, "node_modules/@delivery-os/core/package.json"), "utf8"),
      ) as { dependencies?: Record<string, string>; exports: Record<string, unknown> };
      expect(Object.keys(manifest.dependencies ?? {})).toEqual(["ajv"]);
      expect(Object.keys(manifest.exports).sort()).toEqual([
        ".",
        "./branding",
        "./contracts",
        "./state",
      ]);

      const negative = runRuntime("node", "subpath.mjs", consumer, stateRoots[0] as string);
      expect(negative.status).not.toBe(0);
      const positive = runRuntime("node", "probe.mjs", consumer, stateRoots[0] as string);
      expect(positive.status).toBe(0);
    } finally {
      for (const root of stateRoots) rmSync(root, { recursive: true, force: true });
      rmSync(join(consumer, ".."), { recursive: true, force: true });
    }
  }, 240_000);
});
