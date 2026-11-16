/**
 * TC-CEREMONY-068 — the shipped mirror sync resolves a real affected-repository
 * target set and a real landing path: the declared targets come from the
 * committed projects configuration, the register set is the invoking
 * repository's committed decision records, a dry run computes the write set and
 * precondition-checks without landing, `--apply` lands an equal mirror, and a
 * drifted or absent target is `unverified` naming the target
 * (AC-F3-5, AC-F4-5, NFR-12).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCeremonyCommandRuntime } from "../../packages/cli/src/edge";
import { makeCeremonyState, NOW_MS } from "../fixtures/ceremony/state";

const WORKSPACE = "workspace-mirror";
const INVOKING = "github.com/example/invoking";
const TARGET_A = "github.com/example/target-a";
const TARGET_B = "github.com/example/target-b";

const REGISTER_FILES: Readonly<Record<string, string>> = {
  "ODR-0001-first.md": "# ODR-0001 first decision\n\nstatus: Accepted\n",
  "ODR-0002-second.md": "# ODR-0002 second decision\n\nstatus: Accepted\n",
};

type Composed = ReturnType<typeof createCeremonyCommandRuntime>;

const makeWorld = (
  options: { readonly withAbsentTarget?: boolean } = {},
): {
  readonly runtime: Composed;
  readonly store: ReturnType<typeof makeCeremonyState>["store"];
  readonly root: string;
  readonly targetRoots: ReadonlyMap<string, string>;
  readonly dispose: () => void;
} => {
  const state = makeCeremonyState("mirror");
  const root = mkdtempSync(join(tmpdir(), "ceremony-mirror-"));
  const gitRoot = join(root, "invoking");
  mkdirSync(join(gitRoot, "doc", "decisions"), { recursive: true });
  mkdirSync(join(gitRoot, ".delivery"), { recursive: true });
  for (const [name, text] of Object.entries(REGISTER_FILES)) {
    writeFileSync(join(gitRoot, "doc", "decisions", name), text, "utf8");
  }
  const targetRoots = new Map<string, string>();
  const members: string[] = [];
  for (const target of [TARGET_A, TARGET_B]) {
    const targetRoot = join(root, target.replaceAll("/", "-"));
    mkdirSync(targetRoot, { recursive: true });
    targetRoots.set(target, targetRoot);
    members.push(
      `    - root: ${JSON.stringify(targetRoot)}\n      repoKey: ${JSON.stringify(target)}\n      trackerKind: github`,
    );
  }
  if (options.withAbsentTarget === true) {
    const absentRoot = join(root, "absent-checkout");
    targetRoots.set("github.com/example/absent", absentRoot);
    members.push(
      `    - root: ${JSON.stringify(absentRoot)}\n      repoKey: "github.com/example/absent"\n      trackerKind: github`,
    );
  }
  writeFileSync(
    join(gitRoot, ".delivery", "projects.yaml"),
    `groups:\n  - groupKey: factory\n    name: Factory\n    members:\n${members.join("\n")}\n`,
    "utf8",
  );
  const runtime = createCeremonyCommandRuntime({
    store: state.store,
    stateDirectory: state.root,
    changesDirectory: join(root, "doc", "changes"),
    workspaceId: WORKSPACE,
    clock: { nowMs: () => NOW_MS },
    newRunId: () => `run-mirror-${Math.random().toString(36).slice(2, 8)}`,
    newFenceToken: () => "fence-mirror",
    gitRoot,
    configurationDirectoryName: ".delivery",
    repositoryId: INVOKING,
  });
  return {
    runtime,
    store: state.store,
    root,
    targetRoots,
    dispose: () => {
      state.dispose();
      rmSync(root, { recursive: true, force: true });
    },
  };
};

const windowFor = (suffix: string) => ({
  start: `2026-11-16T0${suffix}:00:00.000Z`,
  end: `2026-11-16T0${suffix}:59:59.999Z`,
});

describe("TC-CEREMONY-068 the dry run computes the write set and lands nothing", () => {
  test("a fresh target set is dry-run at exit-ok semantics with no decisions written", async () => {
    const world = makeWorld();
    try {
      const run = await world.runtime.run({
        name: "decision-record-mirror-sync",
        window: windowFor(1),
        apply: false,
      });
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      const data = run.data as { verdict: string; applied: boolean };
      expect(data.verdict).toBe("dry-run");
      expect(data.applied).toBe(false);
      for (const targetRoot of world.targetRoots.values()) {
        expect(existsSync(join(targetRoot, "doc", "decisions"))).toBe(false);
      }
    } finally {
      world.dispose();
    }
  });
});

describe("TC-CEREMONY-068 --apply lands an equal mirror", () => {
  test("each declared target holds exactly the register set, byte for byte", async () => {
    const world = makeWorld();
    try {
      const run = await world.runtime.run({
        name: "decision-record-mirror-sync",
        window: windowFor(2),
        apply: true,
      });
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      const data = run.data as { verdict: string; applied: boolean };
      expect(data.verdict).toBe("verified");
      expect(data.applied).toBe(true);
      for (const targetRoot of world.targetRoots.values()) {
        for (const [name, text] of Object.entries(REGISTER_FILES)) {
          const path = join(targetRoot, "doc", "decisions", name);
          expect(existsSync(path)).toBe(true);
          expect(readFileSync(path, "utf8")).toBe(text);
        }
      }
    } finally {
      world.dispose();
    }
  });

  test("a target carrying an extra record drifts in both directions and is unverified naming it", async () => {
    const world = makeWorld();
    try {
      const first = await world.runtime.run({
        name: "decision-record-mirror-sync",
        window: windowFor(3),
        apply: true,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error("first apply failed");
      const targetRoot = world.targetRoots.get(TARGET_A);
      if (targetRoot === undefined) throw new Error("missing target root");
      writeFileSync(
        join(targetRoot, "doc", "decisions", "ODR-9999-extra.md"),
        "# ODR-9999 extra\n",
        "utf8",
      );
      const drifted = await world.runtime.run({
        name: "decision-record-mirror-sync",
        window: windowFor(4),
        apply: true,
      });
      expect(drifted.ok).toBe(true);
      if (!drifted.ok) return;
      const data = drifted.data as {
        verdict: string;
        steps: { outcome: string; reason?: string }[];
      };
      expect(data.verdict).toBe("unverified");
      const failed = data.steps.find((step) => step.outcome === "unverified");
      expect(failed?.reason).toContain(TARGET_A);
    } finally {
      world.dispose();
    }
  });
});

describe("TC-CEREMONY-068 an absent declared target fails its precondition by name", () => {
  test("the run is unverified naming the absent checkout", async () => {
    const world = makeWorld({ withAbsentTarget: true });
    try {
      const run = await world.runtime.run({
        name: "decision-record-mirror-sync",
        window: windowFor(5),
        apply: false,
      });
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      const data = run.data as {
        verdict: string;
        steps: { outcome: string; reason?: string }[];
      };
      expect(data.verdict).toBe("unverified");
      const failed = data.steps.find((step) => step.outcome === "unverified");
      expect(failed?.reason).toContain("github.com/example/absent");
    } finally {
      world.dispose();
    }
  });
});

describe("TC-CEREMONY-068 no declared projects configuration degrades declaredly", () => {
  test("a repository with no projects.yaml reports the unavailable collector", async () => {
    const state = makeCeremonyState("mirror-plain");
    const root = mkdtempSync(join(tmpdir(), "ceremony-mirror-plain-"));
    try {
      const runtime = createCeremonyCommandRuntime({
        store: state.store,
        stateDirectory: state.root,
        changesDirectory: join(root, "doc", "changes"),
        workspaceId: WORKSPACE,
        clock: { nowMs: () => NOW_MS },
        newRunId: () => "run-mirror-plain",
        newFenceToken: () => "fence-mirror-plain",
        gitRoot: root,
        configurationDirectoryName: ".delivery",
        repositoryId: INVOKING,
      });
      const run = await runtime.run({
        name: "decision-record-mirror-sync",
        window: windowFor(6),
        apply: false,
      });
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      const data = run.data as { verdict: string };
      // No declared targets and no register: the sync reports the declared
      // failure rather than fabricating an empty landing.
      expect(data.verdict).toBe("unverified");
    } finally {
      state.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
