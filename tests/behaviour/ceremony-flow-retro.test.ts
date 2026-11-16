/**
 * TC-CEREMONY-014 — the retro evidence pass at each of the four sub-R1 levels:
 * the declared per-level note is produced and that level's declared trigger is
 * recorded, with resolution `note`.
 */
import { describe, expect, test } from "bun:test";
import { readCeremonyRuns } from "../../packages/core/src/state/index";
import {
  RETRO_LEVEL_TRIGGER_LABELS,
  retroDeclarationShape,
} from "../../packages/core/src/domain/index";
import { prepareBuiltin, runPrepared } from "../fixtures/ceremony/builtins";
import { retroNote } from "../fixtures/ceremony/notes";
import { builtinCeremonyDeclaration } from "../../packages/core/src/contracts/index";

const LEVELS = ["session", "incident", "window", "project"] as const;

describe("TC-CEREMONY-014 the retro evidence pass at four levels", () => {
  const declaration = builtinCeremonyDeclaration("retro-evidence-pass");
  if (declaration === undefined) throw new Error("retro declaration missing");

  test("the declaration declares exactly the four sub-R1 triggers and no change-merged", () => {
    const shape = retroDeclarationShape(declaration);
    expect(shape.declaresChangeMerged).toBe(false);
    expect(shape.levels).toEqual([...LEVELS]);
    expect(shape.triggerLabels.sort()).toEqual(
      LEVELS.map((level) => RETRO_LEVEL_TRIGGER_LABELS[level]).sort(),
    );
  });

  test.each(LEVELS)("%s produces its level note and records the declared trigger", (level) => {
    const note = retroNote("retro-evidence-pass", level, { scopeKey: `scope-${level}` });
    const prepared = prepareBuiltin("retro-evidence-pass", { note });
    try {
      const run = runPrepared(prepared);
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      expect(run.data.verdict).toBe("verified");
      expect(run.data.trigger).toMatchObject({
        kind: "explicit",
        resolution: "note",
        declared: RETRO_LEVEL_TRIGGER_LABELS[level],
      });
      const body = prepared.harness.memory.get(`scope-${level}`);
      expect(body).toBeDefined();
      if (body !== undefined) {
        const written = JSON.parse(body) as Record<string, unknown>;
        expect(written.level).toBe(level);
        expect(written.scopeKey).toBe(`scope-${level}`);
      }
      const runs = readCeremonyRuns(prepared.harness.store);
      expect(runs.ok).toBe(true);
      if (runs.ok) {
        expect(runs.value.records).toHaveLength(1);
        expect(runs.value.records[0]?.trigger.resolution).toBe("note");
      }
    } finally {
      prepared.harness.dispose();
    }
  });
});
