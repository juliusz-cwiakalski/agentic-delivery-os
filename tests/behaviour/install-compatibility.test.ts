/**
 * GH-346 TC-INST-043..046 — the compatibility check: advisory on the write
 * paths, a typed verdict on the report path, a bounded header-only enumeration,
 * and deterministic reporting (F-7; READ-TP-1).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInstallCommandDefinition } from "../../packages/cli/src/commands/install";
import { createProductionComposer } from "../../packages/cli/src/production";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
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
import { plantForeignRecord, writeHeader } from "../fixtures/install/state-roots";

const brand = (() => {
  const resolved = resolveBrandIdentity({ workingName: "jaiship" });
  if (!resolved.ok) throw new Error("the resolver rejected jaiship");
  return resolved.value;
})();

type Output = {
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
};

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

/** The handler data, or an empty record for a human-form arm. */
const dataOf = (outcome: Output): Record<string, unknown> => outcome.data ?? {};

let base: InstallScratch;
let running: FixtureArtifact;
let other: FixtureArtifact;

beforeAll(() => {
  base = createInstallScratch("compat");
  running = createFixtureArtifact("compat-running");
  other = createFixtureArtifact("compat-other");
});

afterAll(() => {
  removeFixtureArtifact(running);
  removeFixtureArtifact(other);
  base.dispose();
});

const fresh = (): InstallScratch => createInstallScratch("compat-arm");
const identityA = fixtureIdentity();
const identityB = fixtureIdentity({ commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" });
const runtimeFor = (
  target: InstallScratch,
  roots: readonly string[],
  options: { readonly artifact?: string; readonly identity?: typeof identityA } = {},
) =>
  createInstallRuntime({
    scratch: target,
    runningArtifactPath: options.artifact ?? running.path,
    identity: options.identity ?? identityA,
    stateRoots: roots,
  });
describe("TC-INST-043 the compatibility advisory never blocks an install or a rollback", () => {
  test("one line per not-accepted root, exit unchanged, and the install completes", async () => {
    const target = fresh();
    try {
      const incompatibleRoot = join(target.base, "projects", "foreign");
      writeHeader(incompatibleRoot, "delivery.state.v99");
      const roots = [target.stateRoot, incompatibleRoot];
      const outcome = await invoke(runtimeFor(target, roots));
      expect(outcome.error).toBeUndefined();
      expect(outcome.data?.outcome).toBe("installed");
      const advisories = (dataOf(outcome).advisories as readonly string[]) ?? [];
      expect(advisories).toHaveLength(1);
      expect(advisories[0]).toContain(incompatibleRoot);
      expect(advisories[0]).toContain("delivery.state.v99");
      expect(advisories[0]).toContain("delivery.state.v1");
      // A rollback with the same advisory also completes.
      await invoke(runtimeFor(target, roots, { artifact: other.path, identity: identityB }));
      const rolled = await invoke(
        runtimeFor(target, roots, { artifact: target.destinationPath, identity: identityB }),
        ["rollback"],
      );
      expect(rolled.error).toBeUndefined();
      expect(rolled.data?.outcome).toBe("rolled-back");
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-044 install status reports the per-root verdict with the declared exits", () => {
  test("accepted, unreadable, unchecked, and not-accepted each report their outcome", async () => {
    const target = fresh();
    try {
      await invoke(runtimeFor(target, [target.stateRoot]));
      const acceptedRoot = join(target.base, "projects", "accepted");
      const unreadableRoot = join(target.base, "projects", "unreadable");
      const uncheckedRoot = join(target.base, "projects", "absent");
      const rejectedRoot = join(target.base, "projects", "rejected");
      writeHeader(acceptedRoot, "delivery.state.v1");
      mkdirSync(unreadableRoot, { recursive: true });
      writeFileSync(join(unreadableRoot, "header.fixture.json"), "not json\n");
      writeHeader(rejectedRoot, "delivery.state.v99");
      const roots = [acceptedRoot, unreadableRoot, uncheckedRoot, rejectedRoot];
      const status = await invoke(runtimeFor(target, roots), ["status"]);
      expect(status.error?.code).toBe("install.state.incompatible");
      expect(status.error?.summary).toContain(rejectedRoot);
      expect(status.error?.summary).toContain("delivery.state.v99");
      expect(status.error?.summary).toContain("delivery.state.v1");
      expect(status.error?.summary).toContain("judged 4");
      // Without the rejected root the report is a success payload at exit 0.
      const clean = await invoke(
        runtimeFor(target, [acceptedRoot, unreadableRoot, uncheckedRoot]),
        ["status"],
      );
      expect(clean.error).toBeUndefined();
      const format = clean.data?.stateFormat as {
        readonly roots: readonly {
          readonly root: string;
          readonly outcome: string;
          readonly observed: string | null;
        }[];
        readonly judged: number;
        readonly truncated: boolean;
      };
      expect(format.roots.map((entry) => [entry.root, entry.outcome])).toEqual([
        [acceptedRoot, "accepted"],
        [unreadableRoot, "unreadable"],
        [uncheckedRoot, "unchecked"],
      ]);
      expect(format.roots.find((entry) => entry.root === uncheckedRoot)?.observed).toBeNull();
      expect(format.judged).toBe(3);
      expect(format.truncated).toBe(false);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-044b the human status distinguishes an absent record from an unreadable one", () => {
  test("the installed line repeats the record's condition", async () => {
    const target = fresh();
    try {
      mkdirSync(target.configRoot, { recursive: true });
      writeFileSync(target.recordPath, "{ damaged\n");
      const unreadableRuntime = runtimeFor(target, [target.stateRoot]);
      const unreadable = await invoke(unreadableRuntime, ["status"]);
      expect(unreadable.error).toBeUndefined();
      const unreadableText =
        createInstallCommandDefinition(unreadableRuntime).humanText?.(unreadable.data, brand) ?? "";
      expect(unreadableText).toContain("installed: unreadable");
      expect(unreadableText).toContain("record: unreadable");
      rmSync(target.recordPath, { force: true });
      const absentRuntime = runtimeFor(target, [target.stateRoot]);
      const absent = await invoke(absentRuntime, ["status"]);
      expect(absent.error).toBeUndefined();
      const absentText =
        createInstallCommandDefinition(absentRuntime).humanText?.(absent.data, brand) ?? "";
      expect(absentText).toContain("installed: absent");
      expect(absentText).toContain("record: absent");
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-045 the enumeration is header-only, capped, and non-persistent", () => {
  test("a planted payload below a project never flips the verdict and nothing is written", async () => {
    const target = fresh();
    try {
      await invoke(runtimeFor(target, [target.stateRoot]));
      const project = join(target.base, "projects", "canary");
      writeHeader(project, "delivery.state.v1");
      plantForeignRecord(project);
      const before = snapshotTree(target.stateRoot);
      const status = await invoke(runtimeFor(target, [project]), ["status"]);
      expect(status.error).toBeUndefined();
      expect(snapshotTree(target.stateRoot)).toEqual(before);
      expect((dataOf(status).stateFormat as { readonly judged?: number }).judged).toBe(1);
    } finally {
      target.dispose();
    }
  });

  test("the judged count never exceeds the declared cap and an exceeded cap reports truncated", async () => {
    const target = fresh();
    try {
      await invoke(runtimeFor(target, [target.stateRoot]));
      const roots = [target.stateRoot];
      for (let index = 0; index < 140; index += 1)
        roots.push(join(target.base, "projects", `p-${String(index)}`));
      const status = await invoke(runtimeFor(target, roots), ["status"]);
      expect(status.error).toBeUndefined();
      const format = status.data?.stateFormat as {
        readonly judged: number;
        readonly truncated: boolean;
        readonly roots: readonly unknown[];
      };
      expect(format.judged).toBe(128);
      expect(format.roots).toHaveLength(128);
      expect(format.truncated).toBe(true);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-045b the production composition reports the enumeration's truncation", () => {
  test("more than 128 project roots are judged capped and reported truncated", async () => {
    const root = mkdtempSync(join(process.cwd(), "tmp/tmpdir/gh346-compat-production-"));
    try {
      const home = join(root, "home");
      const hostRoot = join(home, brand.stateDirectoryName);
      const projects = join(hostRoot, "projects");
      mkdirSync(projects, { recursive: true });
      for (let index = 0; index < 140; index += 1) {
        mkdirSync(join(projects, `project-${String(index)}`));
      }
      const artifactPath = join(root, "artifact");
      writeFileSync(artifactPath, Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x00]), { mode: 0o755 });
      chmodSync(artifactPath, 0o755);
      const program = createProductionComposer({
        environment: { HOME: home, PATH: process.env.PATH ?? "" },
        cwd: root,
        homeDirectory: home,
        workingName: "jaiship",
        buildIdentity: fixtureIdentity(),
        runningArtifactPath: artifactPath,
        ownsInstallation: true,
      })(brand);
      const definition = program.commands.install;
      if (definition === undefined) throw new Error("install is not composed");
      const outcome = (await definition.handler({
        command: "install",
        flags: {},
        argv: ["install", "status"],
        positionals: ["status"],
        brand,
      } as never)) as Output;
      expect(outcome.error).toBeUndefined();
      const format = outcome.data?.stateFormat as {
        readonly judged: number;
        readonly truncated: boolean;
        readonly roots: readonly unknown[];
      };
      // 140 project roots plus the host root: the cap is visible as a fact, not
      // silently re-derived from the already capped list.
      expect(format.truncated).toBe(true);
      expect(format.judged).toBe(128);
      expect(format.roots).toHaveLength(128);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("TC-INST-046 install status is deterministic across repeated runs", () => {
  test("two runs over one machine state produce identical ordered facts", async () => {
    const target = fresh();
    try {
      const acceptedRoot = join(target.base, "projects", "accepted");
      writeHeader(acceptedRoot, "delivery.state.v1");
      const roots = [target.stateRoot, acceptedRoot];
      await invoke(runtimeFor(target, roots));
      const first = await invoke(runtimeFor(target, roots), ["status"]);
      const second = await invoke(runtimeFor(target, roots), ["status"]);
      expect(JSON.stringify(first.data)).toBe(JSON.stringify(second.data));
      expect(Object.keys(first.data ?? {})).toEqual([
        "schemaVersion",
        "running",
        "installed",
        "recordState",
        "recordPath",
        "rollback",
        "targetStability",
        "stateFormat",
        "pathBlock",
      ]);
    } finally {
      target.dispose();
    }
  });
});
