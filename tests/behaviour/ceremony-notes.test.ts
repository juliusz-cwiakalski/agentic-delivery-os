/**
 * TC-CEREMONY-039 — the note intake contract: an absent required note, a
 * missing member, a wrong ceremony, a scope-key disagreement, a pinned-window
 * disagreement, and the retro fixed-schema members are each refused by the
 * declared identity naming the field, before any output exists.
 */
import { describe, expect, test } from "bun:test";
import type { CeremonyDeclaration, CeremonyNote } from "../../packages/core/src/contracts/index";
import { runCeremony } from "../../packages/core/src/domain/index";
import { readFixture } from "../fixtures/ceremony/declarations";
import { makeEngineHarness } from "../fixtures/ceremony/engine";
import { conformingNote, NOTE_WINDOW } from "../fixtures/ceremony/notes";

const noteDeclaration = (): CeremonyDeclaration =>
  readFixture("valid-note.json") as unknown as CeremonyDeclaration;

const refusalOf = (run: ReturnType<typeof runCeremony>) =>
  run.ok ? undefined : { code: run.error.code, field: run.error.field, summary: run.error.summary };

describe("TC-CEREMONY-039 note intake is validated before any output", () => {
  test("an absent required note is input.value.rejected naming the note", () => {
    const harness = makeEngineHarness();
    try {
      const run = runCeremony({
        declaration: noteDeclaration(),
        env: harness.env,
        noteSupplied: false,
        apply: false,
      });
      expect(refusalOf(run)?.code).toBe("input.value.rejected");
      expect(refusalOf(run)?.field).toBe("note");
      expect(harness.artifactContents.size).toBe(0);
      expect(harness.store.readRecords().ok).toBe(true);
    } finally {
      harness.dispose();
    }
  });

  test("a note missing its scope key is ceremony.note-invalid naming scopeKey", () => {
    const harness = makeEngineHarness();
    try {
      const note = conformingNote("project-note-pass");
      const withoutScope: CeremonyNote = {
        schemaId: note.schemaId,
        ceremony: note.ceremony,
        window: note.window,
      };
      const run = runCeremony({
        declaration: noteDeclaration(),
        env: harness.env,
        note: withoutScope,
        noteSupplied: true,
        apply: false,
      });
      expect(refusalOf(run)?.code).toBe("ceremony.note-invalid");
      expect(refusalOf(run)?.field).toBe("scopeKey");
      expect(harness.artifactContents.size).toBe(0);
    } finally {
      harness.dispose();
    }
  });

  test("a note naming another ceremony is refused naming both identifiers", () => {
    const harness = makeEngineHarness();
    try {
      const run = runCeremony({
        declaration: noteDeclaration(),
        env: harness.env,
        note: conformingNote("some-other-ceremony"),
        noteSupplied: true,
        apply: false,
      });
      expect(refusalOf(run)?.code).toBe("ceremony.note-invalid");
      expect(refusalOf(run)?.field).toBe("ceremony");
      expect(refusalOf(run)?.summary).toContain("some-other-ceremony");
      expect(refusalOf(run)?.summary).toContain("project-note-pass");
    } finally {
      harness.dispose();
    }
  });

  test("a note missing another required member names that member", () => {
    const harness = makeEngineHarness();
    try {
      const note = conformingNote("project-note-pass");
      const withoutWindow: CeremonyNote = {
        schemaId: note.schemaId,
        ceremony: note.ceremony,
        scopeKey: note.scopeKey,
      };
      const run = runCeremony({
        declaration: noteDeclaration(),
        env: harness.env,
        note: withoutWindow,
        noteSupplied: true,
        apply: false,
      });
      expect(refusalOf(run)?.code).toBe("ceremony.note-invalid");
      expect(refusalOf(run)?.field).toBe("window");
    } finally {
      harness.dispose();
    }
  });

  test("a note fact carrying no text is refused naming facts", () => {
    const harness = makeEngineHarness();
    try {
      const note = conformingNote("project-note-pass", {
        facts: [{ evidenceRef: "evidence:session-1" } as never],
      });
      const run = runCeremony({
        declaration: noteDeclaration(),
        env: harness.env,
        note,
        noteSupplied: true,
        apply: false,
      });
      expect(refusalOf(run)?.code).toBe("ceremony.note-invalid");
      expect(refusalOf(run)?.field).toBe("facts");
      expect(harness.artifactContents.size).toBe(0);
    } finally {
      harness.dispose();
    }
  });

  test("a note fact with an empty citation is refused naming facts", () => {
    const harness = makeEngineHarness();
    try {
      const note = conformingNote("project-note-pass", {
        facts: [{ text: "a cited item", evidenceRef: "" }],
      });
      const run = runCeremony({
        declaration: noteDeclaration(),
        env: harness.env,
        note,
        noteSupplied: true,
        apply: false,
      });
      expect(refusalOf(run)?.code).toBe("ceremony.note-invalid");
      expect(refusalOf(run)?.field).toBe("facts");
    } finally {
      harness.dispose();
    }
  });

  test("a --window disagreement names both windows and is input.value.rejected", () => {
    const harness = makeEngineHarness();
    try {
      const run = runCeremony({
        declaration: noteDeclaration(),
        env: harness.env,
        note: conformingNote("project-note-pass"),
        noteSupplied: true,
        window: { start: "2026-11-14T00:00:00.000Z", end: "2026-11-14T23:59:59.999Z" },
        apply: false,
      });
      expect(refusalOf(run)?.code).toBe("input.value.rejected");
      expect(refusalOf(run)?.field).toBe("window");
      expect(refusalOf(run)?.summary).toContain("2026-11-14");
      expect(refusalOf(run)?.summary).toContain(NOTE_WINDOW.start);
    } finally {
      harness.dispose();
    }
  });

  test("a note scope key disagreeing with a literal declaration is refused", () => {
    const harness = makeEngineHarness();
    try {
      const run = runCeremony({
        declaration: readFixture("valid-literal.json") as unknown as CeremonyDeclaration,
        env: harness.env,
        note: conformingNote("project-literal-sweep", { scopeKey: "different-scope" }),
        noteSupplied: true,
        apply: false,
      });
      expect(refusalOf(run)?.code).toBe("ceremony.note-invalid");
      expect(refusalOf(run)?.field).toBe("scopeKey");
    } finally {
      harness.dispose();
    }
  });

  test("a retro note missing a fixed-schema member names that member", () => {
    const harness = makeEngineHarness();
    try {
      const note = conformingNote("project-note-pass", {
        level: "window",
        trigger: "owner-note",
        participants: ["delivery-agent"],
        evidenceRefs: ["evidence:window"],
        interpretations: [],
        wins: [{ text: "win", mechanism: "mechanism" }],
        gaps: [],
        candidateLessons: [],
        actions: [],
        confidence: "low",
      });
      const run = runCeremony({
        declaration: noteDeclaration(),
        env: harness.env,
        note,
        noteSupplied: true,
        apply: false,
      });
      expect(refusalOf(run)?.code).toBe("ceremony.note-invalid");
      expect(refusalOf(run)?.field).toBe("facts");
    } finally {
      harness.dispose();
    }
  });

  test("a conforming note is the paired accepting control", () => {
    const harness = makeEngineHarness();
    try {
      const run = runCeremony({
        declaration: noteDeclaration(),
        env: harness.env,
        note: conformingNote("project-note-pass"),
        noteSupplied: true,
        apply: false,
      });
      expect(run.ok).toBe(true);
      if (run.ok) expect(run.data.verdict).toBe("verified");
    } finally {
      harness.dispose();
    }
  });
});
