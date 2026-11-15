/**
 * GH-320 TC-BIN-084 — the cross-cutting hermeticity guard, in both implementable
 * halves (D11).
 *
 * Half (a): a static import/surface scan over the identity and composition
 * modules proves they reach no network API and compose no real-home state path.
 * Half (b): a spawned `bun --preload <arm-counters> test <named suites>` proves
 * the executed suites acquire nothing at run time, with a canary that trips
 * every counter class so the guard cannot pass vacuously.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PRELOAD = join(ROOT, "tests/checks/support/arm-counters.preload.ts");
const BASE = join(ROOT, "tmp/tmpdir/gh320-hermetic");

const MODULES = [
  "packages/cli/src/bin-launcher.ts",
  "packages/cli/src/entrypoint.ts",
  "packages/cli/src/production.ts",
] as const;

const GUARDED_SUITES = [
  "tests/behaviour/entrypoint-two-bins.test.ts",
  "tests/behaviour/identity-override.test.ts",
  "tests/behaviour/prior-identity-config-fallback.test.ts",
  "tests/behaviour/prior-identity-state-fallback.test.ts",
  "tests/behaviour/prior-identity-notice.test.ts",
  "tests/structure/entrypoint-bin.test.ts",
  "tests/structure/install-launcher.test.ts",
  "tests/checks/install-launcher-installer.test.ts",
  "tests/checks/identity-docs.test.ts",
] as const;

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

/** The static half's rule, driven over injected module texts. */
export const networkSurfaceViolations = (
  modules: readonly { readonly file: string; readonly text: string }[],
): string[] => {
  const failures: string[] = [];
  for (const module of modules) {
    for (const marker of ["node:http", "node:https", "node:dns", "node:net", '"node:os"']) {
      if (module.text.includes(marker)) {
        failures.push(`${module.file}: imports the network/runtime primitive ${marker}`);
      }
    }
    if (module.text.includes("os.homedir()")) {
      failures.push(`${module.file}: composes a real-home path with os.homedir()`);
    }
    const fetches = module.text.split("fetch(").length - 1;
    if (module.file.endsWith("production.ts")) {
      // The delivered injected GitHub transport is the one declared network
      // seam; nothing else may reach the network.
      if (fetches !== 1) {
        failures.push(`${module.file}: ${String(fetches)} fetch sites, expected the one transport`);
      }
      if (!module.text.includes("const response = await fetch(")) {
        failures.push(`${module.file}: the network seam is not the delivered transport default`);
      }
      continue;
    }
    if (fetches !== 0) {
      failures.push(`${module.file}: ${String(fetches)} fetch sites, expected none`);
    }
  }
  return failures;
};

const staticModules = (): { readonly file: string; readonly text: string }[] =>
  MODULES.map((file) => ({ file, text: read(file) }));

describe("TC-BIN-084 half (a): the identity surface cannot acquire", () => {
  test("no identity module reaches a network primitive or a real-home path", () => {
    expect(networkSurfaceViolations(staticModules())).toEqual([]);
  });

  test("the scan is non-vacuous: an injected network import and homedir call fail by name", () => {
    const injected = [
      ...staticModules(),
      { file: "packages/cli/src/rogue.ts", text: 'import "node:https";\n' },
      { file: "packages/cli/src/rogue-home.ts", text: "const home = os.homedir();\n" },
    ];
    const failures = networkSurfaceViolations(injected).join("\n");
    expect(failures).toContain("packages/cli/src/rogue.ts: imports the network/runtime primitive");
    expect(failures).toContain("rogue-home.ts: composes a real-home path");
  });

  test("every executed guarded suite works in scratch roots, never the real home", () => {
    for (const suite of GUARDED_SUITES) {
      const text = read(suite);
      const mutatesRealHome = /writeFileSync\(join\(homedir\(\)/u.test(text);
      const fakeRealRoot = /\/homedir\(\)\s*,\s*"\.(?:delivery-os|jaiship)/u.test(text);
      expect({ suite, mutatesRealHome, fakeRealRoot }).toEqual({
        suite,
        mutatesRealHome: false,
        fakeRealRoot: false,
      });
    }
  });
});

const withScratch = <T>(label: string, body: (root: string) => T): T => {
  mkdirSync(BASE, { recursive: true, mode: 0o700 });
  const root = mkdtempSync(join(BASE, `${label}-`));
  try {
    return body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const runGuarded = (
  root: string,
  targets: readonly string[],
  options: {
    readonly testSuites?: boolean;
    readonly environment?: Readonly<Record<string, string>>;
  } = {},
) => {
  const report = join(root, "report.json");
  const home = join(root, "home");
  mkdirSync(home, { recursive: true });
  writeFileSync(report, "");
  const result = spawnSync(
    "bun",
    ["--preload", PRELOAD, ...(options.testSuites === false ? [] : ["test"]), ...targets],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: home,
        TMPDIR: join(root, "tmp"),
        GH320_HERMETIC_REPORT: report,
        GH320_HERMETIC_ALLOWED_ROOTS: [root, process.env.TMPDIR ?? ""].filter(Boolean).join(":"),
        ...options.environment,
      },
    },
  );
  const text = readFileSync(report, "utf8");
  const tallies = text === "" ? {} : (JSON.parse(text) as Record<string, readonly string[]>);
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    tallies,
  };
};

describe("TC-BIN-084 half (b): the executed suites acquire nothing", () => {
  test("the spawned preload run over the named suites reports zero violations", () => {
    withScratch("guarded", (root) => {
      mkdirSync(join(root, "tmp"), { recursive: true });
      const run = runGuarded(root, GUARDED_SUITES);
      expect({ status: run.status, tallies: run.tallies }).toEqual({ status: 0, tallies: {} });
    });
  }, 600_000);

  test("the canary trips every counter class so the guard cannot pass vacuously", () => {
    withScratch("canary", (root) => {
      mkdirSync(join(root, "tmp"), { recursive: true });
      // A canary script run under the same preload: it performs every
      // acquisition class the guard asserts, so the counters must trip.
      const canary = join(root, "canary-script.ts");
      writeFileSync(
        canary,
        [
          'await fetch("https://example.invalid/probe").catch(() => undefined);',
          'Bun.spawnSync(["curl", "https://example.invalid"], { stdout: "ignore", stderr: "ignore" });',
          "void process.env.GITHUB_TOKEN;",
          "await Bun.sleep(5);",
          'await Bun.write("/definitely-outside-the-allowlist/probe.txt", "x").catch(() => undefined);',
          "",
        ].join("\n"),
      );
      const run = runGuarded(root, [canary], { testSuites: false });
      expect(run.status).not.toBe(0);
      for (const klass of ["network", "networkCommand", "secretRead", "sleep", "write"]) {
        expect({ klass, hits: (run.tallies[klass] ?? []).length > 0 }).toEqual({
          klass,
          hits: true,
        });
      }
      expect(run.tallies.network?.[0]).toContain("fetch https://example.invalid/probe");
      expect(run.tallies.write?.[0]).toContain("/definitely-outside-the-allowlist/probe.txt");
    });
  }, 300_000);
});
