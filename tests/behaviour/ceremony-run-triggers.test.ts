/**
 * TC-CEREMONY-062 (explicit-run trigger kind and resolution), TC-CEREMONY-063
 * (note-less scheduled idempotency on the derived UTC day), and
 * TC-CEREMONY-064 (note-less event-only requires `--window` before any write).
 */
import { describe, expect, test } from "bun:test";
import type { CeremonyDeclaration } from "../../packages/core/src/contracts/index";
import { runCeremony } from "../../packages/core/src/domain/index";
import { readCeremonyRuns } from "../../packages/core/src/state/index";
import { makeEngineHarness } from "../fixtures/ceremony/engine";
import { readFixture, withPath } from "../fixtures/ceremony/declarations";
import { conformingNote } from "../fixtures/ceremony/notes";

const multiTrigger = (): CeremonyDeclaration =>
  withPath(
    withPath(readFixture("valid-repository.json"), "triggers", [
      { kind: "event", event: "owner-note" },
      { kind: "event", event: "session-end" },
    ]),
    "scopeKey",
    { kind: "literal", value: "session-alpha" },
  ) as unknown as CeremonyDeclaration;

describe("TC-CEREMONY-062 an explicit run records kind explicit with its resolution", () => {
  test("a single declared trigger resolves as declaration", () => {
    const harness = makeEngineHarness();
    try {
      const run = runCeremony({
        declaration: readFixture(
          "valid-note-less-scheduled.json",
        ) as unknown as CeremonyDeclaration,
        env: harness.env,
        noteSupplied: false,
        apply: false,
      });
      expect(run.ok).toBe(true);
      const runs = readCeremonyRuns(harness.store);
      expect(runs.ok).toBe(true);
      if (!runs.ok) return;
      expect(runs.value.records).toHaveLength(1);
      expect(runs.value.records[0]?.trigger).toMatchObject({
        kind: "explicit",
        resolution: "declaration",
        declared: "schedule:daily",
      });
    } finally {
      harness.dispose();
    }
  });

  test("a note naming a declared trigger resolves as note", () => {
    const harness = makeEngineHarness();
    try {
      const declaration = multiTrigger();
      const note = conformingNote(declaration.id, { trigger: "session-end" });
      const run = runCeremony({
        declaration,
        env: harness.env,
        note,
        noteSupplied: true,
        apply: false,
      });
      expect(run.ok).toBe(true);
      const runs = readCeremonyRuns(harness.store);
      expect(runs.ok).toBe(true);
      if (!runs.ok) return;
      expect(runs.value.records[0]?.trigger).toMatchObject({
        kind: "explicit",
        resolution: "note",
        declared: "event:session-end",
      });
    } finally {
      harness.dispose();
    }
  });

  test("several declared triggers with no note resolve as unspecified and name the set", () => {
    const harness = makeEngineHarness();
    try {
      const run = runCeremony({
        declaration: multiTrigger(),
        env: harness.env,
        noteSupplied: false,
        apply: false,
        window: { start: "2026-11-16T00:00:00.000Z", end: "2026-11-16T23:59:59.999Z" },
      });
      expect(run.ok).toBe(true);
      const runs = readCeremonyRuns(harness.store);
      expect(runs.ok).toBe(true);
      if (!runs.ok) return;
      expect(runs.value.records[0]?.trigger.kind).toBe("explicit");
      expect(runs.value.records[0]?.trigger.resolution).toBe("unspecified");
      expect(runs.value.records[0]?.trigger.declaredSet).toEqual([
        "event:owner-note",
        "event:session-end",
      ]);
    } finally {
      harness.dispose();
    }
  });

  test("a note naming an undeclared trigger is refused before any write", () => {
    const harness = makeEngineHarness();
    try {
      const declaration = multiTrigger();
      const note = conformingNote(declaration.id, { trigger: "change-merged" });
      const run = runCeremony({
        declaration,
        env: harness.env,
        note,
        noteSupplied: true,
        apply: false,
      });
      expect(run.ok).toBe(false);
      if (!run.ok) {
        expect(run.error.code).toBe("input.value.rejected");
        expect(run.error.summary).toContain("change-merged");
        expect(run.error.summary).toContain("event:owner-note");
      }
      const runs = readCeremonyRuns(harness.store);
      expect(runs.ok).toBe(true);
      if (runs.ok) expect(runs.value.records).toEqual([]);
      expect(harness.artifactContents.size).toBe(0);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-CEREMONY-063 note-less scheduled idempotency on the derived UTC day", () => {
  test("two runs in one UTC day derive the same day window and repository key", () => {
    const harness = makeEngineHarness();
    try {
      const declaration = readFixture(
        "valid-note-less-scheduled.json",
      ) as unknown as CeremonyDeclaration;
      const first = runCeremony({
        declaration,
        env: harness.env,
        noteSupplied: false,
        apply: false,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.data.window.start).toBe("2026-11-16T00:00:00.000Z");
      expect(first.data.window.end).toBe("2026-11-16T23:59:59.999Z");
      expect(first.data.scopeKey).toEqual({
        value: "github.com/example/repo",
        derivation: "repository",
      });
      const artifacts = harness.artifactContents.size;
      const second = runCeremony({
        declaration,
        env: harness.env,
        noteSupplied: false,
        apply: false,
      });
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.data.reused).toBe(true);
      expect(second.data.runId).toBe(first.data.runId);
      const runs = readCeremonyRuns(harness.store);
      expect(runs.ok).toBe(true);
      if (runs.ok) expect(runs.value.records).toHaveLength(1);
      expect(harness.artifactContents.size).toBe(artifacts);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-CEREMONY-064 note-less event-only runs require --window before any write", () => {
  test("without --window the refusal names --window and nothing is read or written", () => {
    const harness = makeEngineHarness();
    try {
      const declaration = readFixture(
        "valid-note-less-event.json",
      ) as unknown as CeremonyDeclaration;
      const run = runCeremony({ declaration, env: harness.env, noteSupplied: false, apply: false });
      expect(run.ok).toBe(false);
      if (!run.ok) {
        expect(run.error.code).toBe("input.value.rejected");
        expect(run.error.field).toBe("--window");
        expect(run.error.summary).toContain("--window");
      }
      expect(harness.inputCalls).toEqual([]);
      const runs = readCeremonyRuns(harness.store);
      expect(runs.ok).toBe(true);
      if (runs.ok) expect(runs.value.records).toEqual([]);
      expect(harness.artifactContents.size).toBe(0);
    } finally {
      harness.dispose();
    }
  });

  test("with --window the identity is complete and the window is recorded", () => {
    const harness = makeEngineHarness();
    try {
      const window = { start: "2026-11-16T00:00:00.000Z", end: "2026-11-16T12:00:00.000Z" };
      const run = runCeremony({
        declaration: readFixture("valid-note-less-event.json") as unknown as CeremonyDeclaration,
        env: harness.env,
        noteSupplied: false,
        apply: false,
        window,
      });
      expect(run.ok).toBe(true);
      const runs = readCeremonyRuns(harness.store);
      expect(runs.ok).toBe(true);
      if (!runs.ok) return;
      expect(runs.value.records[0]?.scopeKey.value).toBe("github.com/example/repo");
      expect(runs.value.records[0]?.trigger.actualWindow).toEqual(window);
    } finally {
      harness.dispose();
    }
  });

  test("the paired scheduled declaration derives its window without --window", () => {
    const harness = makeEngineHarness();
    try {
      const run = runCeremony({
        declaration: readFixture(
          "valid-note-less-scheduled.json",
        ) as unknown as CeremonyDeclaration,
        env: harness.env,
        noteSupplied: false,
        apply: false,
      });
      expect(run.ok).toBe(true);
    } finally {
      harness.dispose();
    }
  });
});
