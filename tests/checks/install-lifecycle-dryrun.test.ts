/**
 * GH-346 TC-INST-060..063 — the four zero-write dry-runs (F-11; NFR-5).
 *
 * Each plan is asserted against a full snapshot of the declared roots — paths,
 * sizes, `mtimeNs`, modes — plus a zero daemon-action log, and each printed plan
 * carries its declared content with absolute paths.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInstallCommandDefinition } from "../../packages/cli/src/commands/install";
import { renderInstallPlan } from "../../packages/cli/src/output/install-text";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
import type { InstallOutcome } from "../../packages/core/src/contracts/install";
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
  running = createFixtureArtifact("dryrun-running");
  other = createFixtureArtifact("dryrun-other");
  base = createInstallScratch("dryrun-base");
});

afterAll(() => {
  removeFixtureArtifact(running);
  removeFixtureArtifact(other);
  base.dispose();
});

const fresh = (): InstallScratch => createInstallScratch("dryrun");
const runtimeFor = (target: InstallScratch, daemon?: ReturnType<typeof createRecordingDaemon>) =>
  createInstallRuntime({
    scratch: target,
    runningArtifactPath: running.path,
    identity: fixtureIdentity(),
    environment: { HOME: target.home, SHELL: "/bin/zsh" },
    ...(daemon === undefined ? {} : { daemon: daemon.port }),
  });

describe("TC-INST-060 install --dry-run prints the declared plan and writes nothing", () => {
  test("the snapshot is unchanged and every declared fact is printed", async () => {
    const target = fresh();
    try {
      writeHeader(target.stateRoot, "delivery.state.v1");
      mkdirSync(target.home, { recursive: true });
      writeFileSync(join(target.home, ".zshrc"), "# profile\n");
      const daemon = createRecordingDaemon({ running: false });
      const before = snapshotTree(target.base);
      const outcome = await invoke(runtimeFor(target, daemon), [], {
        "--dry-run": true,
        "--add-to-path": true,
      });
      expect(outcome.error).toBeUndefined();
      expect(snapshotTree(target.base)).toEqual(before);
      expect(daemon.log()).toEqual(["status:absent"]);
      const plan = dataOf(outcome).plan as readonly string[];
      const joined = plan.join("\n");
      expect(joined).toContain(target.destinationPath);
      expect(joined).toContain(target.recordPath);
      expect(joined).toContain(target.slotPath);
      expect(joined).toContain(join(target.home, ".zshrc"));
      expect(joined).toContain("export PATH=");
      expect(joined).toContain("daemon: absent");
      expect(joined).toContain(running.path);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-061 rollback --dry-run prints the plan or the refusal in place of it", () => {
  test("a met precondition prints the two identities and the two renames", async () => {
    const target = fresh();
    try {
      await invoke(runtimeFor(target), []);
      await invoke(
        createInstallRuntime({
          scratch: target,
          runningArtifactPath: other.path,
          identity: fixtureIdentity({ commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }),
          environment: { HOME: target.home },
        }),
        [],
      );
      const before = snapshotTree(target.base);
      const outcome = await invoke(
        createInstallRuntime({
          scratch: target,
          runningArtifactPath: target.destinationPath,
          identity: fixtureIdentity({ commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }),
          environment: { HOME: target.home },
        }),
        ["rollback"],
        { "--dry-run": true },
      );
      expect(outcome.error).toBeUndefined();
      expect(snapshotTree(target.base)).toEqual(before);
      const joined = (dataOf(outcome).plan as readonly string[]).join("\n");
      expect(joined).toContain("rename 1");
      expect(joined).toContain("rename 2");
      expect(joined).toContain("record:");
      expect(dataOf(outcome).outcome).toBe("plan");
    } finally {
      target.dispose();
    }
  });

  test("an unmet precondition prints the identity, cause, and remedy at exit 0", async () => {
    const target = fresh();
    try {
      await invoke(runtimeFor(target), []);
      // Plant a slot so the slot refusals do not fire first, then damage the record.
      writeFileSync(target.slotPath, readFileSync(other.path), { mode: 0o755 });
      writeFileSync(target.recordPath, "{ damaged\n");
      const before = snapshotTree(target.base);
      const outcome = await invoke(runtimeFor(target), ["rollback"], { "--dry-run": true });
      expect(outcome.error).toBeUndefined();
      expect(dataOf(outcome).outcome).toBe("plan");
      const joined = (dataOf(outcome).plan as readonly string[]).join("\n");
      expect(joined).toContain("install.record.unreadable");
      expect(joined).toContain("cause:");
      expect(joined).toContain("remedy:");
      expect(snapshotTree(target.base)).toEqual(before);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-062 uninstall --dry-run prints two separated blocks and writes nothing", () => {
  test("the removal list and the residual set are separated", async () => {
    const target = fresh();
    try {
      await invoke(runtimeFor(target), []);
      writeHeader(join(target.stateRoot, "projects", "kept"), "delivery.state.v1");
      const before = snapshotTree(target.base);
      const outcome = await invoke(runtimeFor(target), ["uninstall"], { "--dry-run": true });
      expect(snapshotTree(target.base)).toEqual(before);
      const text = renderInstallPlan(outcome.data as InstallOutcome);
      expect(text).toContain("would remove:");
      expect(text).toContain("residual set (what purge would additionally delete):");
      expect(text.indexOf("would remove:")).toBeLessThan(
        text.indexOf("residual set (what purge would additionally delete):"),
      );
      expect((dataOf(outcome).removed as readonly string[]).length).toBeGreaterThan(0);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-063 purge --dry-run enumerates the roots without removing them", () => {
  test("both roots and every project root are listed and nothing is removed", async () => {
    const target = fresh();
    try {
      await invoke(runtimeFor(target), []);
      const project = join(target.stateRoot, "projects", "kept");
      writeHeader(project, "delivery.state.v1");
      const before = snapshotTree(target.base);
      const outcome = await invoke(
        createInstallRuntime({
          scratch: target,
          runningArtifactPath: running.path,
          identity: fixtureIdentity(),
          environment: { HOME: target.home },
          stateRoots: [target.stateRoot, project],
        }),
        ["purge"],
        { "--dry-run": true },
      );
      expect(outcome.error).toBeUndefined();
      const plan = dataOf(outcome).plan as readonly string[];
      expect(plan).toContain(target.configRoot);
      expect(plan).toContain(target.stateRoot);
      expect(plan).toContain(project);
      expect(snapshotTree(target.base)).toEqual(before);
    } finally {
      target.dispose();
    }
  });
});
