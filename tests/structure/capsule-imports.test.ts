/**
 * TC-CAP-011 (structure half) — writer ownership and self-containment.
 *
 * Only the declared command surfaces import the capsule producer port; only the
 * runtime-aware edge composes the file runtime; an append to one change never
 * touches a sibling change folder. The closeout cross-check half completes in P3.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeMemoryFs, makeMemoryRuntime } from "../fixtures/capsule/harness";

const ROOT = process.cwd();

const commandFiles = [
  "phase.ts",
  "commit.ts",
  "verify-gates.ts",
  "closeout.ts",
  "status.ts",
  "retro.ts",
  "merge.ts",
] as const;

const text = (path: string): string => readFileSync(join(ROOT, path), "utf8");

describe("TC-CAP-011 capsule writer ownership", () => {
  test("only phase, commit, and verify import the producer port", () => {
    const importers = ["phase.ts", "commit.ts", "verify-gates.ts"].map(
      (file) => `packages/cli/src/commands/${file}`,
    );
    for (const file of importers) {
      expect(text(file).includes("CapsuleProducerPort")).toBe(true);
    }
    const others = commandFiles.filter(
      (file) => !["phase.ts", "commit.ts", "verify-gates.ts"].includes(file),
    );
    for (const file of others) {
      expect(text(`packages/cli/src/commands/${file}`).includes("CapsuleProducerPort")).toBe(false);
    }
  });

  test("only the edge composes the file runtime", () => {
    expect(text("packages/cli/src/edge.ts").includes("createCapsuleFileRuntime")).toBe(true);
    for (const file of commandFiles) {
      const source = text(`packages/cli/src/commands/${file}`);
      expect(source.includes("createCapsuleFileRuntime")).toBe(false);
      expect(source.includes("nodeCapsuleFileSystemFacts")).toBe(false);
    }
  });

  test("the adapter has no agent free-text or hardcoded change ref", () => {
    const source = text("packages/adapters/src/file/capsule.ts");
    const code = source
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return !trimmed.startsWith("*") && !trimmed.startsWith("//");
      })
      .join("\n");
    expect(/GH-\d+/.test(code)).toBe(false);
    expect(code.includes("process.env")).toBe(false);
    expect(code.includes("prompt")).toBe(false);
  });

  test("an append to one change never touches a sibling change folder", () => {
    const changes = "/changes";
    const a = "/changes/2026-11/2026-11-07--GH-240--capsule-closeout";
    const b = "/changes/2026-11/2026-11-07--GH-241--sibling";
    const memory = makeMemoryFs({
      directories: [changes, "/changes/2026-11", a, b],
      files: { [`${b}/events.jsonl`]: "sibling-content\n" },
    });
    const runtime = makeMemoryRuntime(memory, changes);
    expect(
      runtime.append({
        changeRef: "GH-240",
        workspaceChangesDirectory: changes,
        writer: "commit",
        kind: "commit.landed",
        eventKey: "k",
        payload: { commitSha: "a".repeat(40) },
        runId: "run-0001",
      }).ok,
    ).toBe(true);
    expect(memory.files.get(`${b}/events.jsonl`)).toBe("sibling-content\n");
    expect(memory.files.has(`${a}/events.jsonl`)).toBe(true);
  });
});
