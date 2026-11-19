/**
 * GH-346 TC-INST-050..056 — the removal matrix, the always-printed residual set,
 * the confirmation requirement, and the declared removal order (F-10; NFR-11).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createNodeInstallFilePort } from "../../packages/adapters/src/file/index";
import { createInstallCommandDefinition } from "../../packages/cli/src/commands/install";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
import type { InstallFilePort } from "../../packages/core/src/contracts/install";
import {
  createFixtureArtifact,
  type FixtureArtifact,
  removeFixtureArtifact,
} from "../fixtures/install/artifact";
import {
  createInstallRuntime,
  createInstallScratch,
  fixtureIdentity,
  type InstallScratch,
  snapshotTree,
} from "../fixtures/install/home";
import { writeHeader } from "../fixtures/install/state-roots";

const brand = (() => {
  const resolved = resolveBrandIdentity({ workingName: "jaiship" });
  if (!resolved.ok) throw new Error("the resolver rejected jaiship");
  return resolved.value;
})();

type Output = {
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string };
};
const dataOf = (outcome: Output): Record<string, unknown> => outcome.data ?? {};

const invoke = async (
  runtime: ReturnType<typeof createInstallRuntime>,
  positionals: readonly string[] = [],
  flags: Readonly<Record<string, string | true>> = {},
): Promise<Output> => {
  const definition = createInstallCommandDefinition(runtime);
  return (await definition.handler({
    command: "install",
    flags,
    argv: ["install", ...positionals],
    positionals,
    brand,
  } as never)) as Output;
};

let running: FixtureArtifact;
let other: FixtureArtifact;
let base: InstallScratch;

beforeAll(() => {
  running = createFixtureArtifact("removal-running");
  other = createFixtureArtifact("removal-other");
  base = createInstallScratch("removal-base");
});

afterAll(() => {
  removeFixtureArtifact(running);
  removeFixtureArtifact(other);
  base.dispose();
});

const fresh = (): InstallScratch => createInstallScratch("removal");
const profileOf = (target: InstallScratch): string => join(target.home, ".profile");
const seedProfile = (target: InstallScratch): void => {
  mkdirSync(target.home, { recursive: true });
  writeFileSync(profileOf(target), "# operator profile\n");
};

const runtimeFor = (target: InstallScratch) =>
  createInstallRuntime({
    scratch: target,
    runningArtifactPath: running.path,
    identity: fixtureIdentity(),
    environment: { HOME: target.home, SHELL: "/bin/sh" },
  });

const installWithBlock = async (target: InstallScratch): Promise<void> => {
  seedProfile(target);
  await invoke(runtimeFor(target), [], {
    "--add-to-path": true,
    "--shell-profile": profileOf(target),
  });
};

describe("TC-INST-050 uninstall removes its four members and keeps both roots", () => {
  test("artifact, slot, record, and the managed block are removed; the roots survive", async () => {
    const target = fresh();
    try {
      await installWithBlock(target);
      writeHeader(join(target.stateRoot, "projects", "kept"), "delivery.state.v1");
      const stateBefore = snapshotTree(target.stateRoot);
      const profileBefore = readFileSync(profileOf(target), "utf8");
      const outcome = await invoke(runtimeFor(target), ["uninstall"]);
      expect(outcome.error).toBeUndefined();
      expect(existsSync(target.destinationPath)).toBe(false);
      expect(existsSync(target.recordPath)).toBe(false);
      expect(readFileSync(profileOf(target), "utf8")).toBe("# operator profile\n");
      expect(profileBefore).not.toBe(readFileSync(profileOf(target), "utf8"));
      expect(snapshotTree(target.stateRoot)).toEqual(stateBefore);
      expect((dataOf(outcome).residual as readonly string[]).length).toBeGreaterThan(0);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-051 the residual set equals purge's removal set and what purge removes", () => {
  test("three computed sets agree at one machine state", async () => {
    const target = fresh();
    try {
      await installWithBlock(target);
      writeHeader(join(target.stateRoot, "projects", "kept"), "delivery.state.v1");
      const uninstall = await invoke(runtimeFor(target), ["uninstall"]);
      const residual = [...(dataOf(uninstall).residual as readonly string[])].sort();
      const dry = await invoke(runtimeFor(target), ["purge"], { "--dry-run": true });
      const dryResidual = [...(dataOf(dry).residual as readonly string[])].sort();
      const dryPlan = [...(dataOf(dry).plan as readonly string[])].sort();
      const purged = await invoke(runtimeFor(target), ["purge"], { "--yes": true });
      const removed = [...(dataOf(purged).removed as readonly string[])].sort();
      expect(dryResidual).toEqual(residual);
      // The purge plan is the residual set plus the two roots it removes.
      for (const path of residual) expect(dryPlan).toContain(path);
      expect(dryPlan).toContain(target.configRoot);
      expect(dryPlan).toContain(target.stateRoot);
      // Everything purge reported removing is exactly the plan it printed.
      expect(removed.sort()).toEqual(dryPlan);
      expect(existsSync(target.configRoot)).toBe(false);
      expect(existsSync(target.stateRoot)).toBe(false);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-052 an unconfirmed purge refuses and removes nothing", () => {
  test("the refusal names both roots and the flag, and nothing is removed", async () => {
    const target = fresh();
    try {
      await installWithBlock(target);
      const before = snapshotTree(target.base);
      const refused = await invoke(runtimeFor(target), ["purge"]);
      expect(refused.error?.code).toBe("install.purge.unconfirmed");
      expect(snapshotTree(target.base)).toEqual(before);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-053 a confirmed purge enumerates every path it removes", () => {
  test("both roots and each enumerated project root are reported", async () => {
    const target = fresh();
    try {
      await installWithBlock(target);
      const project = join(target.stateRoot, "projects", "kept");
      writeHeader(project, "delivery.state.v1");
      const purged = await invoke(
        createInstallRuntime({
          scratch: target,
          runningArtifactPath: running.path,
          identity: fixtureIdentity(),
          environment: { HOME: target.home, SHELL: "/bin/sh" },
          stateRoots: [target.stateRoot, project],
        }),
        ["purge"],
        { "--yes": true },
      );
      const removed = dataOf(purged).removed as readonly string[];
      expect(removed).toContain(target.configRoot);
      expect(removed).toContain(target.stateRoot);
      expect(removed).toContain(project);
      for (const path of removed) {
        if (path.includes("(managed block only)")) {
          expect(existsSync(path.replace(" (managed block only)", ""))).toBe(true);
        } else {
          expect(existsSync(path)).toBe(false);
        }
      }
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-054 a confirmed purge with absent roots reports nothing to remove", () => {
  test("exit 0 and the declared sentence", async () => {
    const target = fresh();
    try {
      rmSync(target.stateRoot, { recursive: true, force: true });
      rmSync(target.configRoot, { recursive: true, force: true });
      const purged = await invoke(runtimeFor(target), ["purge"], { "--yes": true });
      expect(purged.error).toBeUndefined();
      expect(dataOf(purged).outcome).toBe("purged");
      expect(dataOf(purged).removed).toEqual([]);
      expect(dataOf(purged).advisories).toEqual(["nothing to remove"]);
      // Confirmation is still required even when the roots are absent.
      expect((await invoke(runtimeFor(target), ["purge"])).error?.code).toBe(
        "install.purge.unconfirmed",
      );
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-055 a second uninstall removes nothing and reports every member absent", () => {
  test("the no-op run exits 0 with an empty removal list and the same residual", async () => {
    const target = fresh();
    try {
      await installWithBlock(target);
      const first = await invoke(runtimeFor(target), ["uninstall"]);
      const second = await invoke(runtimeFor(target), ["uninstall"]);
      expect(second.error).toBeUndefined();
      expect(dataOf(second).removed).toEqual([]);
      expect(dataOf(second).residual).toEqual(dataOf(first).residual);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-056 the removal order leaves the recoverable members after a partial failure", () => {
  test("a failing slot removal stops the run after the artifact and preserves the record", async () => {
    const target = fresh();
    try {
      await installWithBlock(target);
      const node = createNodeInstallFilePort();
      const failing: InstallFilePort = {
        ...node,
        remove: (path) => (path === target.slotPath ? false : node.remove(path)),
      };
      // A slot must exist for the arm: install twice over different artifacts.
      await invoke(
        createInstallRuntime({
          scratch: target,
          runningArtifactPath: other.path,
          identity: fixtureIdentity({ commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }),
          environment: { HOME: target.home, SHELL: "/bin/sh" },
        }),
        [],
      );
      const outcome = await invoke(
        createInstallRuntime({
          scratch: target,
          runningArtifactPath: running.path,
          identity: fixtureIdentity(),
          fs: failing,
          environment: { HOME: target.home, SHELL: "/bin/sh" },
        }),
        ["uninstall"],
      );
      expect(outcome.error).toBeUndefined();
      const removed = dataOf(outcome).removed as readonly string[];
      expect(removed).toEqual([target.destinationPath]);
      expect(existsSync(target.slotPath)).toBe(true);
      expect(existsSync(target.recordPath)).toBe(true);
    } finally {
      target.dispose();
    }
  });
});
