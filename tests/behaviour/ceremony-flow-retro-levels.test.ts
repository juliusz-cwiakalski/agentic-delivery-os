/**
 * TC-CEREMONY-043 (follow-through verification is the first phase and cites
 * evidence), TC-CEREMONY-044 (a rerun at a new window appends an addendum),
 * TC-CEREMONY-045 (a null retro is an explicit empty success), TC-CEREMONY-047
 * (SC-M2-S3-02: a note missing its scope key is refused naming scopeKey), and
 * TC-CEREMONY-048 (SC-M2-S3-01: a conforming note produces each declared output
 * and an artifact-verified follow-through section).
 */
import { describe, expect, test } from "bun:test";
import {
  CEREMONY_FOLLOW_THROUGH_VERDICTS,
  type CeremonyNote,
} from "../../packages/core/src/contracts/index";
import { runCeremony } from "../../packages/core/src/domain/index";
import { readCeremonyRuns } from "../../packages/core/src/state/index";
import { builtinCeremonyDeclaration } from "../../packages/core/src/contracts/index";
import { prepareBuiltin, runPrepared } from "../fixtures/ceremony/builtins";
import { NOTE_WINDOW, retroNote } from "../fixtures/ceremony/notes";

const parseWrite = (entry: string): Record<string, unknown> => {
  const content = entry.slice(entry.indexOf(":") + 1);
  return JSON.parse(content) as Record<string, unknown>;
};

const retro = builtinCeremonyDeclaration("retro-evidence-pass");
if (retro === undefined) throw new Error("retro declaration missing");

describe("TC-CEREMONY-043 follow-through verification is first and evidence-cited", () => {
  test("the first phase is follow-through and every entry cites an artifact reference", () => {
    expect(retro.agenda[0]?.id).toBe("follow-through");
    expect(retro.agenda[0]?.steps[0]?.kind).toBe("fold");
    const note = retroNote("retro-evidence-pass", "window", {
      scopeKey: "follow-scope",
      followThrough: [
        { item: "action one", verdict: "applied", evidenceRef: "artifact:one" },
        { item: "action two", verdict: "partial", evidenceRef: "artifact:two" },
      ],
    } as Partial<CeremonyNote>);
    const prepared = prepareBuiltin("retro-evidence-pass", { note });
    try {
      const run = runPrepared(prepared);
      expect(run.ok).toBe(true);
      const first = prepared.harness.artifactWrites[0];
      expect(first).toBeDefined();
      if (first === undefined) return;
      const document = parseWrite(first);
      const items = document.items as {
        item: string;
        verdict: string;
        evidenceRef: string;
      }[];
      expect(items).toHaveLength(2);
      for (const item of items) {
        expect(CEREMONY_FOLLOW_THROUGH_VERDICTS).toContain(item.verdict as never);
        expect(item.evidenceRef.length).toBeGreaterThan(0);
      }
    } finally {
      prepared.harness.dispose();
    }
  });
});

describe("TC-CEREMONY-044 a rerun at a new window appends an addendum", () => {
  test("the prior note body is preserved and exactly one new run is recorded", () => {
    const prepared = prepareBuiltin("retro-evidence-pass", {
      note: retroNote("retro-evidence-pass", "window", {
        scopeKey: "addendum-scope",
        window: NOTE_WINDOW,
      }),
    });
    try {
      expect(runPrepared(prepared).ok).toBe(true);
      const nextWindow = {
        start: "2026-11-16T00:00:00.000Z",
        end: "2026-11-16T23:59:59.999Z",
      };
      const second = runCeremony({
        declaration: prepared.declaration,
        env: prepared.harness.env,
        note: retroNote("retro-evidence-pass", "window", {
          scopeKey: "addendum-scope",
          window: nextWindow,
        }),
        noteSupplied: true,
        apply: false,
      });
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.data.reused).toBe(false);
      const body = prepared.harness.memory.get("addendum-scope") ?? "";
      expect(body).toContain(NOTE_WINDOW.start);
      expect(body).toContain(nextWindow.start);
      const runs = readCeremonyRuns(prepared.harness.store);
      expect(runs.ok).toBe(true);
      if (runs.ok) expect(runs.value.records).toHaveLength(2);
    } finally {
      prepared.harness.dispose();
    }
  });
});

describe("TC-CEREMONY-045 a null retro is an explicit empty success", () => {
  test("no finding, no action, and no fabrication; the run is verified", () => {
    const note = retroNote("retro-evidence-pass", "window", {
      scopeKey: "null-scope",
      evidenceRefs: [],
      facts: [],
      interpretations: [],
      wins: [],
      gaps: [],
      candidateLessons: [],
      actions: [],
    });
    const prepared = prepareBuiltin("retro-evidence-pass", { note });
    try {
      const run = runPrepared(prepared);
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      expect(run.data.verdict).toBe("verified");
      const followThrough = parseWrite(prepared.harness.artifactWrites[0] ?? "x:{}");
      expect(followThrough.items).toEqual([]);
      expect(followThrough.verifiedEmpty).toBe(true);
      const insights = prepared.harness.artifactWrites
        .map(parseWrite)
        .find((document) => document.schemaId === "delivery.ceremony.retro-insights.v1");
      expect(insights?.findingSet).toEqual([]);
      const body = prepared.harness.memory.get("null-scope") ?? "";
      expect(body).toContain('"actions":[]');
    } finally {
      prepared.harness.dispose();
    }
  });
});

describe("TC-CEREMONY-047 a note missing its scope key is refused naming scopeKey", () => {
  test("exit 1 identity ceremony.note-invalid and no output exists", () => {
    const note = {
      schemaId: "delivery.ceremony.note.v1",
      ceremony: "retro-evidence-pass",
      window: NOTE_WINDOW,
      level: "window",
      trigger: "schedule:daily",
      participants: [],
      evidenceRefs: [],
      facts: [],
      interpretations: [],
      wins: [],
      gaps: [],
      candidateLessons: [],
      actions: [],
      confidence: "low",
    } as unknown as CeremonyNote;
    const prepared = prepareBuiltin("retro-evidence-pass", { note });
    try {
      const run = runPrepared(prepared);
      expect(run.ok).toBe(false);
      if (!run.ok) {
        expect(run.error.code).toBe("ceremony.note-invalid");
        expect(run.error.field).toBe("scopeKey");
      }
      expect(prepared.harness.artifactContents.size).toBe(0);
      expect(prepared.harness.memory.size).toBe(0);
    } finally {
      prepared.harness.dispose();
    }
  });
});

describe("TC-CEREMONY-048 a conforming note produces every declared output", () => {
  test("each agenda step writes its output and follow-through carries a verified action", () => {
    const note = retroNote("retro-evidence-pass", "window", {
      scopeKey: "conforming-scope",
      actions: ["verify the follow-through artifact"],
    });
    const prepared = prepareBuiltin("retro-evidence-pass", { note });
    try {
      const run = runPrepared(prepared);
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      expect(run.data.verdict).toBe("verified");
      expect(run.data.steps).toHaveLength(5);
      for (const step of run.data.steps) {
        expect(step.verification).toBe("verified");
        expect(step.artifactRef.length).toBeGreaterThan(0);
      }
      const followThrough = parseWrite(prepared.harness.artifactWrites[0] ?? "x:{}");
      const items = followThrough.items as { verdict: string }[];
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items[0]?.verdict).toBe("applied");
      expect(prepared.harness.memory.get("conforming-scope")).toBeDefined();
    } finally {
      prepared.harness.dispose();
    }
  });
});
