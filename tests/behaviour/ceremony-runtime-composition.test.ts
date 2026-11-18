/**
 * TC-CEREMONY-066 — the shipped `ceremony` runtime earns its verdicts: the
 * composed intake never synthesises an evidence reference, so an owner-note
 * item with no citation is `uncovered` and a follow-through action with no
 * delivered artifact cannot be `applied` (AC-F3-4, AC-F9-2, AC-F9-3).
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ceremonyArtifactsDirectory } from "../../packages/adapters/src/file/index";
import { createCeremonyCommandRuntime } from "../../packages/cli/src/edge";
import { CEREMONY_NOTE_SCHEMA } from "../../packages/core/src/contracts/index";
import { readCeremonySteps } from "../../packages/core/src/state/index";
import { NOTE_WINDOW } from "../fixtures/ceremony/notes";
import { makeCeremonyState, NOW_MS } from "../fixtures/ceremony/state";

const WORKSPACE = "workspace-runtime";

type Composed = ReturnType<typeof createCeremonyCommandRuntime>;

const makeRuntime = (): {
  readonly runtime: Composed;
  readonly root: string;
  readonly stateRoot: string;
  readonly state: ReturnType<typeof makeCeremonyState>;
  readonly dispose: () => void;
} => {
  const root = mkdtempSync(join(tmpdir(), "ceremony-runtime-"));
  const state = makeCeremonyState("runtime");
  const runtime = createCeremonyCommandRuntime({
    store: state.store,
    stateDirectory: state.root,
    changesDirectory: join(root, "doc/changes"),
    workspaceId: WORKSPACE,
    clock: { nowMs: () => NOW_MS },
    newRunId: () => "run-runtime-0001",
    newFenceToken: () => "fence-runtime",
    gitRoot: root,
    configurationDirectoryName: ".delivery",
    repositoryId: "github.com/example/repo",
  });
  return {
    runtime,
    root,
    stateRoot: state.root,
    state,
    dispose: () => {
      state.dispose();
      rmSync(root, { recursive: true, force: true });
    },
  };
};

const writeNote = (root: string, note: Record<string, unknown>): string => {
  const path = join(root, "note.json");
  writeFileSync(path, JSON.stringify(note), "utf8");
  return path;
};

/** Read the artifact bytes one recorded step wrote, following its reference. */
const artifactOf = (
  stateRoot: string,
  runId: string,
  store: ReturnType<typeof makeCeremonyState>["store"],
): Record<string, unknown> | undefined => {
  const steps = readCeremonySteps(store, runId);
  if (!steps.ok) return undefined;
  const directory = ceremonyArtifactsDirectory(stateRoot, WORKSPACE);
  for (const step of steps.value.records) {
    const name = step.artifactRef.slice(step.artifactRef.indexOf(":") + 1);
    if (name.length === 0) continue;
    try {
      const parsed = JSON.parse(readFileSync(join(directory, name), "utf8")) as Record<
        string,
        unknown
      >;
      if (parsed.schemaId === "delivery.ceremony.assessment.v1") return parsed;
    } catch {
      // An unreadable artifact is not the document under assertion.
    }
  }
  return undefined;
};

describe("TC-CEREMONY-066 the shipped assessment never invents an item citation", () => {
  test("an owner-note item with no citation is uncovered and the run verifies", async () => {
    const composed = makeRuntime();
    try {
      const note = writeNote(composed.root, {
        schemaId: CEREMONY_NOTE_SCHEMA,
        ceremony: "testing-session-assessment",
        scopeKey: "scope-runtime",
        window: NOTE_WINDOW,
        facts: ["an uncited item", "another uncited item"],
      });
      const run = await composed.runtime.run({
        name: "testing-session-assessment",
        notePath: note,
        apply: false,
      });
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      const data = run.data as { verdict: string; runId: string };
      expect(data.verdict).toBe("verified");
      const assessment = artifactOf(composed.stateRoot, data.runId, composed.state.store);
      expect(assessment).toBeDefined();
      const items = (assessment?.items ?? []) as {
        item: string;
        verdict: string;
        evidenceRef?: string;
      }[];
      expect(items).toHaveLength(2);
      for (const item of items) {
        expect(item.verdict).toBe("uncovered");
        expect(item.evidenceRef).toBeUndefined();
      }
      expect(assessment?.unassessedCount).toBe(0);
    } finally {
      composed.dispose();
    }
  });

  test("a note fact's resolvable citation is covered; an unresolvable one is uncovered", async () => {
    const composed = makeRuntime();
    try {
      const note = writeNote(composed.root, {
        schemaId: CEREMONY_NOTE_SCHEMA,
        ceremony: "testing-session-assessment",
        scopeKey: "scope-runtime-citations",
        window: NOTE_WINDOW,
        evidenceRefs: ["evidence:session-1"],
        facts: [
          { text: "covered item", evidenceRef: "evidence:session-1" },
          { text: "unresolvable item", evidenceRef: "evidence:absent" },
          { text: "uncited item" },
        ],
      });
      const run = await composed.runtime.run({
        name: "testing-session-assessment",
        notePath: note,
        apply: false,
      });
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      const data = run.data as { verdict: string; runId: string };
      expect(data.verdict).toBe("verified");
      const assessment = artifactOf(composed.stateRoot, data.runId, composed.state.store);
      const items = (assessment?.items ?? []) as {
        item: string;
        verdict: string;
        evidenceRef?: string;
        reason?: string;
      }[];
      const byItem = new Map(items.map((item) => [item.item, item]));
      expect(byItem.get("covered item")?.verdict).toBe("covered");
      expect(byItem.get("covered item")?.evidenceRef).toBe("evidence:session-1");
      const unresolvable = byItem.get("unresolvable item");
      expect(unresolvable?.verdict).toBe("uncovered");
      expect(unresolvable?.evidenceRef).toBe("evidence:absent");
      expect(unresolvable?.reason).toContain("is not delivered");
      expect(byItem.get("uncited item")?.verdict).toBe("uncovered");
      expect(assessment?.unassessedCount).toBe(0);
    } finally {
      composed.dispose();
    }
  });
});
