/**
 * TC-CAP-001 / TC-CAP-002 — capsule location resolution and the event contract.
 *
 * Structure-level: the one month-scan resolver is read-only and deterministic;
 * the envelope and both closed vocabularies are exactly the declared sets; the
 * contracts module is data-only.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CAPSULE_ENVELOPE_KEYS,
  CAPSULE_EVENT_KINDS,
  CAPSULE_MAX_CANDIDATES,
  CAPSULE_MAX_CANDIDATE_BYTES,
  CAPSULE_MAX_EVENTS,
  CAPSULE_MAX_EVENT_PAYLOAD_BYTES,
  CAPSULE_MAX_INDEX_LINES,
  CAPSULE_MAX_BYTES,
  CAPSULE_SCHEMA_ID,
  CAPSULE_WRITERS,
} from "../../packages/core/src/contracts/index";
import { resolveChangeFolder } from "../../packages/adapters/src/file/change-folder";
import {
  CAPSULE_FOLDER,
  CAPSULE_NOW,
  CAPSULE_REF,
  makeChangeTree,
  makeMemoryFs,
  makeMemoryRuntime,
} from "../fixtures/capsule/harness";

const ROOT = process.cwd();

const sha = (text: string): string => createHash("sha256").update(text).digest("hex");

const snapshot = (dir: string): readonly string[] => {
  const entries: string[] = [];
  const walk = (path: string): void => {
    for (const name of readdirSync(path).sort()) {
      const next = join(path, name);
      const stat = statSync(next);
      if (stat.isDirectory()) {
        entries.push(`${next}:dir:${stat.mtimeMs}`);
        walk(next);
      } else {
        entries.push(`${next}:${sha(readFileSync(next, "utf8"))}:${stat.size}:${stat.mtimeMs}`);
      }
    }
  };
  walk(dir);
  return entries;
};

describe("TC-CAP-001 capsule location resolution", () => {
  test("walks months ascending, folders ascending, and takes the first match", () => {
    const tree = makeChangeTree();
    try {
      const later = resolveChangeFolder({
        changeRef: CAPSULE_REF,
        changesDirectory: tree.changes,
        fs: {
          exists: (path) => {
            try {
              readdirSync(path);
              return true;
            } catch {
              return false;
            }
          },
          listDirectory: (path) => readdirSync(path),
        },
      });
      expect(later.ok).toBe(true);
      if (later.ok) expect(later.folder).toBe(tree.folder);
    } finally {
      tree.cleanup();
    }
  });

  test("an earlier month wins over a later one and the result is stable", () => {
    const tree = makeChangeTree({ month: "2026-12" });
    try {
      const earlier = join(tree.changes, "2026-10", `2026-10-01--${CAPSULE_REF}--earlier`);
      mkdirSync(earlier, { recursive: true });
      const fs = { exists: () => true, listDirectory: (path: string) => readdirSync(path) };
      const first = resolveChangeFolder({
        changeRef: CAPSULE_REF,
        changesDirectory: tree.changes,
        fs,
      });
      const second = resolveChangeFolder({
        changeRef: CAPSULE_REF,
        changesDirectory: tree.changes,
        fs,
      });
      expect(first.ok && first.folder).toBe(
        `${tree.changes}/2026-10/2026-10-01--${CAPSULE_REF}--earlier`,
      );
      expect(second).toEqual(first);
    } finally {
      tree.cleanup();
    }
  });

  test("requires the exact --ref-- token", () => {
    const tree = makeChangeTree({ name: `2026-11-07--${CAPSULE_REF}0--wrong` });
    try {
      const result = resolveChangeFolder({
        changeRef: CAPSULE_REF,
        changesDirectory: tree.changes,
        fs: { exists: () => true, listDirectory: (path: string) => readdirSync(path) },
      });
      expect(result.ok).toBe(false);
    } finally {
      tree.cleanup();
    }
  });

  test("resolves an absent ref as a classified condition with zero creation", () => {
    const tree = makeChangeTree();
    try {
      const before = snapshot(tree.root);
      const result = resolveChangeFolder({
        changeRef: "GH-999",
        changesDirectory: tree.changes,
        fs: { exists: () => true, listDirectory: (path: string) => readdirSync(path) },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("capsule.folder-absent");
      expect(snapshot(tree.root)).toEqual(before);
    } finally {
      tree.cleanup();
    }
  });

  test("resolution is read-only and never creates a capsule or an archive tree", () => {
    const tree = makeChangeTree();
    try {
      const before = snapshot(tree.root);
      resolveChangeFolder({
        changeRef: CAPSULE_REF,
        changesDirectory: tree.changes,
        fs: { exists: () => true, listDirectory: (path: string) => readdirSync(path) },
      });
      expect(snapshot(tree.root)).toEqual(before);
      expect(() => statSync(join(tree.folder, "events.jsonl"))).toThrow();
      expect(() => statSync(join(tree.folder, "candidates"))).toThrow();
      expect(() => statSync(join(tree.changes, "archive"))).toThrow();
    } finally {
      tree.cleanup();
    }
  });
});

describe("TC-CAP-002 capsule contract", () => {
  test("the schema id and the closed vocabularies are exactly declared", () => {
    expect(CAPSULE_SCHEMA_ID).toBe("delivery.capsule.event.v1");
    expect(CAPSULE_EVENT_KINDS.length).toBe(11);
    expect(new Set(CAPSULE_EVENT_KINDS).size).toBe(11);
    expect([...CAPSULE_WRITERS].sort()).toEqual(["closeout", "commit", "phase", "verify"]);
  });

  test("the declared caps are the pinned values", () => {
    expect(CAPSULE_MAX_EVENTS).toBe(2_000);
    expect(CAPSULE_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(CAPSULE_MAX_EVENT_PAYLOAD_BYTES).toBe(4 * 1024);
    expect(CAPSULE_MAX_CANDIDATES).toBe(100);
    expect(CAPSULE_MAX_CANDIDATE_BYTES).toBe(8 * 1024);
    expect(CAPSULE_MAX_INDEX_LINES).toBe(200);
  });

  test("one written event carries exactly the pinned envelope key set", () => {
    const memory = makeMemoryFs({
      directories: ["/changes", "/changes/2026-11", `/changes/2026-11/${CAPSULE_FOLDER}`],
    });
    const runtime = makeMemoryRuntime(memory, "/changes");
    const result = runtime.append({
      changeRef: CAPSULE_REF,
      workspaceChangesDirectory: "/changes",
      writer: "phase",
      kind: "phase.transition",
      eventKey: "phase-1-complete",
      payload: { phaseId: "1", operation: "complete", outcome: "completed" },
      runId: "run-0001",
    });
    expect(result.ok).toBe(true);
    const file = `/changes/2026-11/${CAPSULE_FOLDER}/events.jsonl`;
    const lines = (memory.files.get(file) ?? "").split("\n").filter((line) => line.length > 0);
    expect(lines.length).toBe(2);
    for (const line of lines) {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      expect(Object.keys(parsed).sort()).toEqual([...CAPSULE_ENVELOPE_KEYS].sort());
      expect(parsed.schemaId).toBe(CAPSULE_SCHEMA_ID);
      expect(parsed.occurredAt).toBe(CAPSULE_NOW);
    }
    expect(lines.every((line) => !line.includes("\r"))).toBe(true);
  });

  test("the contracts module is data-only", () => {
    const text = readFileSync(join(ROOT, "packages/core/src/contracts/capsule.ts"), "utf8");
    expect(text.includes("node:")).toBe(false);
    expect(text.includes("function ")).toBe(false);
    expect(text.includes('from "#contracts"')).toBe(false);
    expect(text.includes("new ")).toBe(false);
  });

  test("appending a candidate directory file set is bounded", () => {
    const memory = makeMemoryFs({
      directories: [
        "/changes",
        "/changes/2026-11",
        `/changes/2026-11/${CAPSULE_FOLDER}`,
        `/changes/2026-11/${CAPSULE_FOLDER}/candidates`,
      ],
    });
    for (let index = 0; index < CAPSULE_MAX_CANDIDATES; index += 1) {
      memory.files.set(
        `/changes/2026-11/${CAPSULE_FOLDER}/candidates/candidate-${index}.yaml`,
        "statement: bounded\n",
      );
    }
    const runtime = makeMemoryRuntime(memory, "/changes");
    expect(runtime.readCandidates(CAPSULE_REF).ok).toBe(true);
    memory.files.set(
      `/changes/2026-11/${CAPSULE_FOLDER}/candidates/candidate-over.yaml`,
      "statement: over\n",
    );
    const over = runtime.readCandidates(CAPSULE_REF);
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.code).toBe("capsule.candidate-cap");
      expect(over.refused).toBe(1);
    }
  });
});

describe("TC-CAP-002/P10 contract constants and step ownership", () => {
  test("the closeout domain uses contract data, not duplicated literals or index remaps", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "packages/core/src/domain/closeout.ts"),
      "utf8",
    );
    expect(source.includes("slice(0, 64)")).toBe(false);
    expect(source.includes('"delivery.capsule.v1"')).toBe(false);
    expect(source.includes("closeoutStepDefinitions[index]")).toBe(false);
    expect(source.includes("CAPSULE_MAX_SESSIONS")).toBe(true);
    expect(source.includes("CAPSULE_CONTRACT_VERSION")).toBe(true);
    const { buildCloseoutPlan } = await import("../../packages/core/src/domain/closeout");
    const { makeFacts } = await import("../fixtures/closeout/harness");
    const { CLOSEOUT_STEP_IDS } = await import("../../packages/core/src/contracts/index");
    expect(buildCloseoutPlan(makeFacts()).steps.map((step) => step.stepId)).toEqual([
      ...CLOSEOUT_STEP_IDS,
    ]);
  });
});
