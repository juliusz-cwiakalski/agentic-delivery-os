/**
 * GH-320 TC-BIN-010..012 and TC-BIN-014 — the override seam across both bins.
 *
 * `DELIVERY_OS_WORKING_NAME` supplies the identity for both bins; an invalid
 * override leaves self-description answering the invoking bin's declared default
 * while a positional-free configuration-bearing command fails closed through the
 * delivered `fallback.internal` containment at exit 2, with the delivered
 * pre-composition touch left exactly as delivered (never asserted absent).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
import {
  laneYaml,
  runThroughComposition,
  scratchCheckout,
  scratchHome,
} from "../fixtures/entrypoint/prior-identity/harness";

const PRIOR_ROOT = ".delivery-os-state";
const CURRENT_ROOT = ".jaiship-state";
const FIXTURE = readFileSync(
  join(process.cwd(), "tests/fixtures/entrypoint/prior-identity/pre-change-touch.json"),
  "utf8",
) as string;
const TOUCH = JSON.parse(FIXTURE) as {
  readonly capturedFrom: string;
  readonly fixture: Readonly<Record<string, string>>;
  readonly invalidOverride: {
    readonly exitCode: number;
    readonly errorCode: string;
    readonly summary: string;
    readonly stderr: string;
  };
  readonly homeEntriesAfter: readonly string[];
  readonly repoEntriesAfter: readonly string[];
};
const BASELINE = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/entrypoint/alias-baseline.json"), "utf8"),
) as {
  readonly cells: {
    readonly invalidOverrideStatusJson: {
      readonly exitCode: number;
      readonly stdout: string;
      readonly stderr: string;
    };
  };
};

const brandOf = (workingName: string) => {
  const resolved = resolveBrandIdentity({ workingName });
  if (!resolved.ok) throw new Error(`the resolver rejected ${workingName}`);
  return resolved.value;
};

const listing = (root: string): readonly string[] => {
  const entries: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (next.startsWith(".bun")) continue;
      if (next.startsWith(".git")) continue;
      if (entry.isDirectory()) {
        entries.push(`${next}/`);
        walk(next);
      } else {
        entries.push(next);
      }
    }
  };
  walk("");
  return entries.sort();
};

const stableEnvelope = (text: string): unknown => {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const { runId: _runId, timing: _timing, ...rest } = parsed;
  return rest;
};

describe("TC-BIN-010 the override governs both bins end to end", () => {
  test("override: both bins answer acme and follow its derived paths", async () => {
    const checkout = scratchCheckout("override", { ".acme/config.yaml": laneYaml(4) });
    const home = scratchHome("override-home", { ".acme-state/host-index.json": "{}\n" });
    try {
      for (const bin of ["jaiship", "delivery-os"] as const) {
        const version = await runThroughComposition({
          bin,
          argv: ["--version"],
          checkout: checkout.root,
          home: home.root,
          extra: { DELIVERY_OS_WORKING_NAME: "acme" },
        });
        expect(version.stdout).toBe("acme 0.0.0 (build dev)\n");
        const path = await runThroughComposition({
          bin,
          argv: ["--print-install-path"],
          checkout: checkout.root,
          home: home.root,
          extra: { DELIVERY_OS_WORKING_NAME: "acme" },
        });
        expect(path.stdout).toBe("~/.acme/bin/acme\n");
        const status = await runThroughComposition({
          bin,
          argv: ["status", "--json"],
          checkout: checkout.root,
          home: home.root,
          extra: { DELIVERY_OS_WORKING_NAME: "acme" },
        });
        expect(status.exitCode).toBe(0);
        // The identity's own configuration is the one in effect.
        expect(status.fs.readCalls).toContain(join(checkout.root, ".acme", "config.yaml"));
        expect(status.fs.readCalls).not.toContain(
          join(checkout.root, ".delivery-os", "config.yaml"),
        );
      }
      expect(readdirSync(home.root)).toContain(".acme-state");
      expect(readdirSync(home.root)).not.toContain(CURRENT_ROOT);
      expect(readdirSync(home.root)).not.toContain(PRIOR_ROOT);
    } finally {
      checkout.dispose();
      home.dispose();
    }
  });
});

describe("TC-BIN-011 an empty override is ignored for both bins", () => {
  test("empty-override: empty and whitespace-only overrides answer the declared default", async () => {
    const checkout = scratchCheckout("empty-override", { ".delivery-os/config.yaml": laneYaml(4) });
    const home = scratchHome("empty-override-home");
    try {
      for (const [bin, expected] of [
        ["jaiship", "jaiship 0.0.0 (build dev)\n"],
        ["delivery-os", "delivery-os 0.0.0 (build dev)\n"],
      ] as const) {
        for (const override of ["", "   "]) {
          const run = await runThroughComposition({
            bin,
            argv: ["--version"],
            checkout: checkout.root,
            home: home.root,
            extra: { DELIVERY_OS_WORKING_NAME: override },
          });
          expect({ bin, override, out: run.stdout }).toEqual({
            bin,
            override,
            out: expected,
          });
          expect(run.notices).toEqual([]);
        }
      }
    } finally {
      checkout.dispose();
      home.dispose();
    }
  });
});

describe("TC-BIN-012 an invalid override keeps self-description and the delivered projection", () => {
  const INVALID = ["bad/name", "   ", "a".repeat(65)] as const;

  test("invalid-override: self-description answers the invoking declared default", async () => {
    const checkout = scratchCheckout("invalid", {
      ".delivery-os/config.yaml": TOUCH.fixture[".delivery-os/config.yaml"] ?? laneYaml(4),
    });
    const home = scratchHome("invalid-home");
    try {
      for (const bin of ["jaiship", "delivery-os"] as const) {
        for (const override of INVALID) {
          for (const read of ["--version", "--help"]) {
            const run = await runThroughComposition({
              bin,
              argv: [read],
              checkout: checkout.root,
              home: home.root,
              extra: { DELIVERY_OS_WORKING_NAME: override },
            });
            expect({ bin, read, exit: run.exitCode }).toEqual({ bin, read, exit: 0 });
            expect(run.stdout).toContain(`${bin} `);
            expect(run.stdout).not.toContain("bad/name");
          }
        }
      }
    } finally {
      checkout.dispose();
      home.dispose();
    }
  });

  test("invalid-override: the positional-free command yields the delivered containment", async () => {
    const checkout = scratchCheckout("invalid-pos", {
      ".delivery-os/config.yaml": TOUCH.fixture[".delivery-os/config.yaml"] ?? laneYaml(4),
    });
    const home = scratchHome("invalid-pos-home");
    try {
      for (const bin of ["jaiship", "delivery-os"] as const) {
        const run = await runThroughComposition({
          bin,
          argv: ["status", "--json"],
          checkout: checkout.root,
          home: home.root,
          extra: { DELIVERY_OS_WORKING_NAME: "bad/name" },
        });
        expect(run.exitCode).toBe(2);
        const payload = JSON.parse(run.stdout) as {
          readonly error?: { readonly code?: string; readonly summary?: string };
          readonly override?: unknown;
        };
        expect(payload.error?.code).toBe("fallback.internal");
        expect(payload.error?.summary).toBe(
          'command "status" is not part of the composed prompt-required set',
        );
        // No CLI-visible classified resolver error, and no substituted identity.
        expect(payload.override).toBeUndefined();
        expect(run.stdout).not.toContain("BrandingInputError");
        expect(run.stdout).not.toContain("delivery-os");
      }
      // The alias's projection is byte-identical to its baseline, summary included.
      const alias = await runThroughComposition({
        bin: "delivery-os",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
        extra: { DELIVERY_OS_WORKING_NAME: "bad/name" },
      });
      expect(stableEnvelope(alias.stdout)).toEqual(
        stableEnvelope(BASELINE.cells.invalidOverrideStatusJson.stdout),
      );
      expect(alias.exitCode).toBe(BASELINE.cells.invalidOverrideStatusJson.exitCode);
    } finally {
      checkout.dispose();
      home.dispose();
    }
  });

  test("invalid-override: no fallback identity is substituted and the alias emits no notice", async () => {
    const checkout = scratchCheckout("invalid-notice", {
      ".delivery-os/config.yaml": TOUCH.fixture[".delivery-os/config.yaml"] ?? laneYaml(4),
    });
    const home = scratchHome("invalid-notice-home", {
      [`${PRIOR_ROOT}/projects/seed/edge.log`]: "x\n",
    });
    try {
      // Scoped to the alias: the alias declares no prior identity, so no notice
      // can apply to it on either shape.
      const alias = await runThroughComposition({
        bin: "delivery-os",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
        extra: { DELIVERY_OS_WORKING_NAME: "bad/name" },
      });
      expect(alias.notices).toEqual([]);
      expect(alias.stdout).not.toContain("jaiship");
    } finally {
      checkout.dispose();
      home.dispose();
    }
  });

  test("invalid-override: the delivered pre-composition touch is unchanged for both bins", async () => {
    const runTouch = async (bin: "delivery-os" | "jaiship") => {
      const checkout = scratchCheckout(`touch-${bin}`, {
        ".delivery-os/config.yaml": TOUCH.fixture[".delivery-os/config.yaml"] ?? laneYaml(4),
      });
      const home = scratchHome(`touch-home-${bin}`);
      try {
        const run = await runThroughComposition({
          bin,
          argv: ["status", "--json"],
          checkout: checkout.root,
          home: home.root,
          extra: { DELIVERY_OS_WORKING_NAME: "bad/name" },
        });
        const payload = JSON.parse(run.stdout) as {
          readonly error?: { readonly summary?: string };
        };
        return {
          exitCode: run.exitCode,
          summary: payload.error?.summary,
          homeEntries: listing(home.root),
          repoEntries: listing(checkout.root),
        };
      } finally {
        checkout.dispose();
        home.dispose();
      }
    };

    // The alias matches the recorded pre-change control exactly (DoR-4 (b)).
    const alias = await runTouch("delivery-os");
    expect(alias.exitCode).toBe(TOUCH.invalidOverride.exitCode);
    expect(alias.summary).toBe(TOUCH.invalidOverride.summary);
    expect(alias.homeEntries).toEqual([...TOUCH.homeEntriesAfter]);
    expect(alias.repoEntries).toEqual([...TOUCH.repoEntriesAfter]);

    // The new bin performs the same touch under its own identity names.
    const next = await runTouch("jaiship");
    expect(next.exitCode).toBe(TOUCH.invalidOverride.exitCode);
    expect(next.summary).toBe(TOUCH.invalidOverride.summary);
    const rename = (entry: string): string =>
      entry.split(".delivery-os-state").join(".jaiship-state").split("delivery-os").join("jaiship");
    expect(next.homeEntries).toEqual([...TOUCH.homeEntriesAfter].map(rename));
    expect(next.repoEntries).toEqual([...TOUCH.repoEntriesAfter]);
  });
});

describe("TC-BIN-014 identity resolution is deterministic", () => {
  test("determinism: repeated resolutions and both paths agree per cell", async () => {
    const checkout = scratchCheckout("determinism", {});
    const otherCheckout = scratchCheckout("determinism-other", {});
    const home = scratchHome("determinism-home");
    const otherHome = scratchHome("determinism-home-other");
    try {
      const cells = [
        { declared: "jaiship", environment: {} },
        { declared: "delivery-os", environment: {} },
        { declared: "jaiship", environment: { DELIVERY_OS_WORKING_NAME: "acme" } },
        { declared: "jaiship", environment: { DELIVERY_OS_WORKING_NAME: "" } },
        { declared: "jaiship", environment: { DELIVERY_OS_WORKING_NAME: "bad/name" } },
      ] as const;
      for (const cell of cells) {
        const first = await runThroughComposition({
          bin: cell.declared as "jaiship" | "delivery-os",
          argv: ["--print-install-path"],
          checkout: checkout.root,
          home: home.root,
          extra: cell.environment,
        });
        const second = await runThroughComposition({
          bin: cell.declared as "jaiship" | "delivery-os",
          argv: ["--print-install-path"],
          checkout: otherCheckout.root,
          home: otherHome.root,
          extra: cell.environment,
        });
        expect(second.stdout).toBe(first.stdout);
        expect(second.stdout.startsWith("~/")).toBe(true);
      }
    } finally {
      checkout.dispose();
      otherCheckout.dispose();
      home.dispose();
      otherHome.dispose();
    }
  });

  test("determinism: the derived values are the resolver's for the same input", () => {
    for (const workingName of ["delivery-os", "jaiship", "acme"]) {
      const brand = brandOf(workingName);
      expect(brand.installPath).toBe(`~/${brand.configDirectoryName}/bin/${brand.binaryName}`);
      expect(brand.stateDirectoryName).toBe(`${brand.configDirectoryName}-state`);
    }
  });
});
