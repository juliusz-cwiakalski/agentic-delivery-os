/**
 * GH-320 TC-BIN-030..036 and TC-BIN-013 (state half) — the prior-identity host
 * state root.
 *
 * One effective host root per invocation: an absolute current override wins and
 * disables the fallback; otherwise the current default root when present;
 * otherwise the prior default root when present; otherwise the current default
 * root as ordinary first use. No current default root is created while the
 * fallback holds, and the prior identity's environment names are never read.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { resolveProjectScope } from "../../packages/core/src/app/state-scope";
import {
  runThroughComposition,
  SHAPES,
  scratchCheckout,
  scratchHome,
} from "../fixtures/entrypoint/prior-identity/harness";

const PRIOR_ROOT = ".delivery-os-state";
const CURRENT_ROOT = ".jaiship-state";

const identifier = "0123456789abcdef0123456789abcdef";

/** The seeded prior host root: the delivered artifact shape plus one project. */
const seededPrior = (projectKey: string): Record<string, string> => ({
  [`${PRIOR_ROOT}/host-index.json`]: '{"schemaVersion":"delivery.host-index.v1","projects":[]}\n',
  [`${PRIOR_ROOT}/projects/${projectKey}/edge.log`]: '{"kind":"delivery.seed"}\n',
});

const withTrees = async <T>(
  body: (trees: {
    readonly checkout: ReturnType<typeof scratchCheckout>;
    readonly home: ReturnType<typeof scratchHome>;
  }) => Promise<T>,
  homeFiles: Readonly<Record<string, string>> = {},
  checkoutFiles: Readonly<Record<string, string>> = SHAPES.configOnly,
): Promise<T> => {
  const checkout = scratchCheckout("state", checkoutFiles);
  const home = scratchHome("state-home", homeFiles);
  try {
    return await body({ checkout, home });
  } finally {
    checkout.dispose();
    home.dispose();
  }
};

const listing = (root: string): readonly string[] =>
  existsSync(root) ? readdirSync(root).sort() : [];

describe("TC-BIN-030 the prior host root is effective when the current root is absent", () => {
  test("prior-root: the policy selects the prior root over injected facts", () => {
    const selected = resolveProjectScope({
      environment: { HOME: "/home/operator" },
      environmentPrefix: "JAISHIP_",
      stateDirectoryName: CURRENT_ROOT,
      priorStateDirectoryName: PRIOR_ROOT,
      homeDirectory: "/home/operator",
      defaultRootExists: { current: false, prior: true },
      checkout: { kind: "unbound" },
      ports: {
        readMarker: () => ({ state: "absent" }),
        writeMarker: () => undefined,
        newProjectIdentifier: () => identifier,
      },
    });
    expect(selected.ok).toBe(true);
    if (selected.ok) {
      expect(selected.value.hostRootSelection.kind).toBe("prior");
      expect(selected.value.scope.hostRoot).toBe(`/home/operator/${PRIOR_ROOT}`);
      expect(selected.value.hostRootSelection.priorDefaultRoot).toBe(
        `/home/operator/${PRIOR_ROOT}`,
      );
    }
  });

  test("prior-root: a composed run uses the prior root and notices once", async () => {
    await withTrees(async ({ checkout, home }) => {
      const run = await runThroughComposition({
        bin: "jaiship",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(run.exitCode).toBe(0);
      const notices = run.notices.filter((line) => line.includes("state-read"));
      expect(notices).toHaveLength(1);
      expect(notices[0]).toContain(join(home.root, PRIOR_ROOT));
      expect(notices[0]).toContain(join(home.root, CURRENT_ROOT));
      expect(listing(join(home.root, PRIOR_ROOT, "projects")).length).toBeGreaterThan(0);
    }, seededPrior("seed-0001aaaa"));
  });
});

describe("TC-BIN-031 no current-identity root is created while the fallback holds", () => {
  test("no-second-root: read, store-opening, and mutating invocations create no current root", async () => {
    await withTrees(async ({ checkout, home }) => {
      const before = listing(home.root);
      for (const argv of [
        ["status", "--json"],
        ["projects", "list", "--json"],
        ["queue", "add", "GH-320", "--priority", "5", "--json"],
      ] as const) {
        const run = await runThroughComposition({
          bin: "jaiship",
          argv,
          checkout: checkout.root,
          home: home.root,
        });
        expect({ argv, exit: run.exitCode }).toEqual({ argv, exit: 0 });
        expect(existsSync(join(home.root, CURRENT_ROOT))).toBe(false);
      }
      const after = listing(home.root);
      expect(after).toEqual(before);
      // The mutation landed under the prior root's project store.
      const projects = join(home.root, PRIOR_ROOT, "projects");
      expect(listing(projects).length).toBeGreaterThan(0);
    }, seededPrior("seed-0002bbbb"));
  });
});

describe("TC-BIN-032 an absolute current override wins and disables the fallback", () => {
  test("override-wins: the absolute override is the effective root and no notice appears", async () => {
    const overrides: string[] = [];
    await withTrees(async ({ checkout, home }) => {
      const override = join(home.root, "explicit-state");
      overrides.push(override);
      const run = await runThroughComposition({
        bin: "jaiship",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
        extra: { JAISHIP_STATE_DIR: override },
      });
      expect(run.exitCode).toBe(0);
      expect(run.notices.some((line) => line.includes("state-read"))).toBe(false);
      expect(existsSync(override)).toBe(true);
      expect(listing(join(home.root, PRIOR_ROOT, "projects"))).toEqual(["seed-0003cccc"]);
    }, seededPrior("seed-0003cccc"));
  });

  test("override-wins: a relative override is refused naming the variable", async () => {
    await withTrees(async ({ checkout, home }) => {
      const run = await runThroughComposition({
        bin: "jaiship",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
        extra: { JAISHIP_STATE_DIR: "relative/state" },
      });
      expect(run.exitCode).not.toBe(0);
      const payload = JSON.parse(run.stdout) as { readonly error?: { readonly code?: string } };
      expect(payload.error?.code).toBe("config.value.invalid");
      expect(run.notices.some((line) => line.includes("state-read"))).toBe(false);
    }, seededPrior("seed-0004dddd"));
  });
});

describe("TC-BIN-033 both default roots present: current wins, prior reported not used", () => {
  test("both-roots: the current root is used and the prior is reported once as skipped", async () => {
    const homeFiles = {
      ...seededPrior("seed-0005eeee"),
      [`${CURRENT_ROOT}/host-index.json`]: '{"schemaVersion":"delivery.host-index.v1"}\n',
    };
    await withTrees(async ({ checkout, home }) => {
      const run = await runThroughComposition({
        bin: "jaiship",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(run.exitCode).toBe(0);
      const skipped = run.notices.filter((line) => line.includes("state-skipped"));
      expect(skipped).toHaveLength(1);
      expect(skipped[0]).toContain(join(home.root, PRIOR_ROOT));
      expect(run.notices.some((line) => line.includes("state-read"))).toBe(false);
      // The current root's host index is the one that may be maintained.
      expect(existsSync(join(home.root, CURRENT_ROOT, "host-index.json"))).toBe(true);
    }, homeFiles);
  });
});

describe("TC-BIN-034 prior-prefix overrides are never read", () => {
  test("prior-prefix: DELIVERY_OS_STATE_DIR does not displace the prior default root", async () => {
    await withTrees(async ({ checkout, home }) => {
      const foreign = join(home.root, "foreign-state");
      const run = await runThroughComposition({
        bin: "jaiship",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
        extra: { DELIVERY_OS_STATE_DIR: foreign },
      });
      expect(run.exitCode).toBe(0);
      expect(existsSync(foreign)).toBe(false);
      expect(run.notices.some((line) => line.includes("state-read"))).toBe(true);
    }, seededPrior("seed-0006ffff"));
  });
});

describe("TC-BIN-035 one effective root serves reads and the store operations that follow", () => {
  test("single-root: a mutation and a later read share the prior root", async () => {
    await withTrees(async ({ checkout, home }) => {
      const added = await runThroughComposition({
        bin: "jaiship",
        argv: ["queue", "add", "GH-320", "--priority", "5", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(added.exitCode).toBe(0);
      const read = await runThroughComposition({
        bin: "jaiship",
        argv: ["queue", "list", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(read.exitCode).toBe(0);
      expect(read.stdout).toContain("GH-320");
      expect(existsSync(join(home.root, CURRENT_ROOT))).toBe(false);
    }, seededPrior("seed-0007aaaa"));
  });
});

describe("TC-BIN-036 first use creates the current root and emits no notice", () => {
  test("first-use: the current root is created and no notice appears", async () => {
    await withTrees(
      async ({ checkout, home }) => {
        const run = await runThroughComposition({
          bin: "jaiship",
          argv: ["status", "--json"],
          checkout: checkout.root,
          home: home.root,
        });
        expect(run.exitCode).toBe(0);
        expect(existsSync(join(home.root, CURRENT_ROOT))).toBe(true);
        expect(run.notices).toEqual([]);
      },
      {},
      SHAPES.noConfig,
    );
  });

  test("first-use: the alias creates its own root identically", async () => {
    await withTrees(
      async ({ checkout, home }) => {
        const run = await runThroughComposition({
          bin: "delivery-os",
          argv: ["status", "--json"],
          checkout: checkout.root,
          home: home.root,
        });
        expect(run.exitCode).toBe(0);
        expect(existsSync(join(home.root, PRIOR_ROOT))).toBe(true);
        expect(existsSync(join(home.root, CURRENT_ROOT))).toBe(false);
        expect(run.notices).toEqual([]);
      },
      {},
      SHAPES.noConfig,
    );
  });
});

describe("TC-BIN-013 the alias never reads forward (state half)", () => {
  test("alias: only a .jaiship root is not selected forward", async () => {
    await withTrees(
      async ({ checkout, home }) => {
        rmSync(join(home.root, PRIOR_ROOT), { recursive: true, force: true });
        const run = await runThroughComposition({
          bin: "delivery-os",
          argv: ["status", "--json"],
          checkout: checkout.root,
          home: home.root,
        });
        expect(run.exitCode).toBe(0);
        expect(run.notices).toEqual([]);
        expect(existsSync(join(home.root, PRIOR_ROOT))).toBe(true);
      },
      { [`${CURRENT_ROOT}/host-index.json`]: "{}\n" },
    );
  });
});
