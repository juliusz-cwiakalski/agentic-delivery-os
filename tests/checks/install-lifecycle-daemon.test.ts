/**
 * GH-346 TC-INST-080 / 081 — the daemon guard on all four mutating paths and the
 * ordered stop-before-swap claim (F-9, F-10; DEC-11, ORDER-TP-1).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInstallCommandDefinition } from "../../packages/cli/src/commands/install";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
import {
  createFixtureArtifact,
  type FixtureArtifact,
  removeFixtureArtifact,
} from "../fixtures/install/artifact";
import { createRecordingDaemon } from "../fixtures/install/daemon";
import {
  createInstallRuntime,
  createInstallScratch,
  fixtureIdentity,
  type InstallScratch,
  snapshotTree,
} from "../fixtures/install/home";

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
  running = createFixtureArtifact("daemon-running");
  other = createFixtureArtifact("daemon-other");
  base = createInstallScratch("daemon-base");
});

afterAll(() => {
  removeFixtureArtifact(running);
  removeFixtureArtifact(other);
  base.dispose();
});

const fresh = (): InstallScratch => createInstallScratch("daemon");
const live = () => createRecordingDaemon({ running: true, instanceId: "live-1", pid: 4242 });

const seeded = async (target: InstallScratch): Promise<void> => {
  await invoke(
    createInstallRuntime({
      scratch: target,
      runningArtifactPath: running.path,
      identity: fixtureIdentity(),
      environment: { HOME: target.home },
    }),
    [],
  );
  await invoke(
    createInstallRuntime({
      scratch: target,
      runningArtifactPath: other.path,
      identity: fixtureIdentity({ commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }),
      environment: { HOME: target.home },
    }),
    [],
  );
};

describe("TC-INST-080 a live daemon makes all four paths refuse and write nothing", () => {
  test("install, rollback, uninstall, and purge each answer install.daemon.running", async () => {
    for (const positionals of [
      [] as readonly string[],
      ["rollback"] as readonly string[],
      ["uninstall"] as readonly string[],
      ["purge"] as readonly string[],
    ]) {
      const target = fresh();
      try {
        await seeded(target);
        const daemon = live();
        const before = snapshotTree(target.base);
        const runtime = createInstallRuntime({
          scratch: target,
          runningArtifactPath: target.destinationPath,
          identity: fixtureIdentity({ commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }),
          environment: { HOME: target.home },
          daemon: daemon.port,
        });
        const outcome = await invoke(
          runtime,
          positionals,
          positionals.includes("purge") ? { "--yes": true } : {},
        );
        expect({ positionals, code: outcome.error?.code }).toEqual({
          positionals,
          code: "install.daemon.running",
        });
        expect(snapshotTree(target.base)).toEqual(before);
        expect(daemon.log()).toEqual(["status:running"]);
      } finally {
        target.dispose();
      }
    }
  });
});

describe("TC-INST-081 --stop-daemon stops before the swap or removal", () => {
  test("the ordered log puts the stop before any write, and the run completes", async () => {
    const target = fresh();
    try {
      await seeded(target);
      const daemon = live();
      const runtime = createInstallRuntime({
        scratch: target,
        runningArtifactPath: running.path,
        identity: fixtureIdentity({ commit: "cccccccccccccccccccccccccccccccccccccccc" }),
        environment: { HOME: target.home },
        daemon: daemon.port,
      });
      const outcome = await invoke(runtime, [], { "--stop-daemon": true });
      expect(outcome.error).toBeUndefined();
      expect(dataOf(outcome).daemon).toBe("stopped");
      expect(daemon.log()).toEqual(["status:running", "stop"]);
      // The removal paths share the same ordered guard.
      const removalDaemon = live();
      const removal = await invoke(
        createInstallRuntime({
          scratch: target,
          runningArtifactPath: target.destinationPath,
          identity: fixtureIdentity({ commit: "cccccccccccccccccccccccccccccccccccccccc" }),
          environment: { HOME: target.home },
          daemon: removalDaemon.port,
        }),
        ["uninstall"],
        { "--stop-daemon": true },
      );
      expect(removal.error).toBeUndefined();
      expect(removalDaemon.log()).toEqual(["status:running", "stop"]);
      expect(existsSync(target.destinationPath)).toBe(false);
    } finally {
      target.dispose();
    }
  });

  test("a refused rollback performs no daemon action even with --stop-daemon", async () => {
    const target = fresh();
    try {
      await seeded(target);
      writeFileSync(target.recordPath, "{ damaged\n");
      const daemon = live();
      const runtime = createInstallRuntime({
        scratch: target,
        runningArtifactPath: target.destinationPath,
        identity: fixtureIdentity({ commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }),
        environment: { HOME: target.home },
        daemon: daemon.port,
      });
      const refused = await invoke(runtime, ["rollback"], { "--stop-daemon": true });
      expect(refused.error?.code).toBe("install.record.unreadable");
      expect(daemon.log()).toEqual([]);
      expect(readFileSync(target.slotPath).length).toBeGreaterThan(0);
    } finally {
      target.dispose();
    }
  });

  test("a dry-run with --stop-daemon takes no daemon action on any guarded path", async () => {
    for (const positionals of [
      [] as readonly string[],
      ["uninstall"] as readonly string[],
      ["purge"] as readonly string[],
    ]) {
      const target = fresh();
      try {
        await seeded(target);
        const daemon = live();
        const before = snapshotTree(target.base);
        const runtime = createInstallRuntime({
          scratch: target,
          runningArtifactPath: positionals.length === 0 ? running.path : target.destinationPath,
          identity: fixtureIdentity({ commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }),
          environment: { HOME: target.home },
          daemon: daemon.port,
        });
        const outcome = await invoke(runtime, positionals, {
          "--dry-run": true,
          "--stop-daemon": true,
        });
        // No read and no stop: the ordered log is empty, so the live daemon is
        // still running and nothing was written.
        expect({ positionals, error: outcome.error }).toEqual({
          positionals,
          error: undefined,
        });
        expect(daemon.log()).toEqual([]);
        expect(daemon.state()).toEqual({ running: true, instanceId: "live-1", pid: 4242 });
        expect(snapshotTree(target.base)).toEqual(before);
        // The plan still reports the daemon disposition, as "not acted upon".
        expect(dataOf(outcome).daemon).toBe("unchecked");
        if (positionals.length === 0) {
          const plan = (dataOf(outcome).plan as readonly string[]).join("\n");
          expect(plan).toContain("daemon: unchecked");
          expect(plan).not.toContain("daemon: stopped");
        }
      } finally {
        target.dispose();
      }
    }
  });
});
