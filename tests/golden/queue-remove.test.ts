/**
 * TC-QLC-010 (GH-292) — the removal payload key set, envelope shape, human
 * text, and refusal shapes are pinned by committed goldens (new files for the
 * new case; the delivered derived-document goldens are untouched).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REMOVAL_PAYLOAD_KEYS } from "../fixtures/queue/removal/cases";
import { createRemovalHarness } from "../fixtures/queue/removal/harness";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/queue/removal/golden");
const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;

describe("queue remove golden", () => {
  test("the success envelope is byte-identical to the committed golden", async () => {
    const harness = createRemovalHarness("golden-remove-success");
    harness.seedEntry({ ref: "GH-241", priority: 5 });
    const run = await harness.run(["queue", "remove", "GH-241", "--reason", "abandoned", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(join(GOLDEN, "remove-success.json"), "utf8"));
    // The exact payload key set: no `sequence`, no `mutation`.
    const data = json(run.stdout).data as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(REMOVAL_PAYLOAD_KEYS);
    // The envelope top level is exactly the delivered five members.
    expect(Object.keys(json(run.stdout)).sort()).toEqual([
      "data",
      "exitCode",
      "runId",
      "schemaVersion",
      "timing",
    ]);
  });

  test("the human form is byte-identical and names the ref, removed, reason, and ready set", async () => {
    const harness = createRemovalHarness("golden-remove-human");
    harness.seedEntry({ ref: "GH-241", priority: 5 });
    const run = await harness.run(["queue", "remove", "GH-241", "--reason", "abandoned"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(join(GOLDEN, "remove-success.txt"), "utf8"));
    expect(run.stdout).toContain("GH-241");
    expect(run.stdout).toContain("removed");
    expect(run.stdout).toContain("abandoned");
    expect(run.stdout).toContain("ready=");
  });

  test("the refusal envelope carries the table-derived error", async () => {
    const harness = createRemovalHarness("golden-remove-refusal");
    harness.seedEntry({ ref: "GH-241" });
    const run = await harness.run(["queue", "remove", "GH-241", "--json"]);
    expect(run.exitCode).toBe(1);
    expect(run.stdout).toBe(
      readFileSync(join(GOLDEN, "remove-refusal-reason-missing.json"), "utf8"),
    );
    const error = json(run.stdout).error as Record<string, unknown>;
    expect(Object.keys(error).sort()).toEqual([
      "category",
      "code",
      "consequence",
      "remediationHint",
      "retryable",
      "summary",
    ]);
    expect(error.code).toBe("queue.reason-missing");
  });

  test("every exit is a projected class digit", async () => {
    const harness = createRemovalHarness("golden-remove-exits");
    harness.seedEntry({ ref: "GH-241" });
    const applied = await harness.run(["queue", "remove", "GH-241", "--reason", "landed", "--json"]);
    const refused = await harness.run(["queue", "remove", "GH-241", "--reason", "landed", "--json"]);
    for (const run of [applied, refused]) {
      const envelope = json(run.stdout) as { exitCode: number };
      expect([0, 1, 2]).toContain(envelope.exitCode);
    }
  });
});
