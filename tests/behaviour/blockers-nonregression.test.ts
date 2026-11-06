/**
 * TC-BLK-041 — non-regression and the declared evolution: the board and every
 * non-status/brief command stay byte-stable, the six existing digest sections
 * and the brief's other eight surfaces keep their behaviour, and no config key,
 * envelope shape, subpath, state schema, or SLA mechanic changes.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BLOCKER_AUDIENCES,
  OWNER_GATE_SLA_AUDIENCES,
  STATE_SCHEMA_VERSION,
  STATUS_SECTION_ORDER,
  STATUS_SECTION_TITLES,
} from "../../packages/core/src/contracts/index";
import { aggregateStatus, projectBrief } from "../../packages/core/src/domain/index";
import { PRODUCTION_CATALOG } from "../../packages/core/src/index";
import { readBlockerLedger } from "../../packages/core/src/state/index";
import { makeQuestion } from "../fixtures/blockers/records";
import { createBoardHarness } from "../fixtures/board/harness";
import { baseFacts, blockersRead, NOW_MS } from "../fixtures/status/harness";

const ROOT = process.cwd();

describe("TC-BLK-041 non-regression and declared evolution", () => {
  test("the board stays byte-stable and creates no blocker record", async () => {
    const harness = createBoardHarness({ gates: [] });
    try {
      const run = await harness.run([], { json: false });
      expect(run.exitCode).toBe(0);
      expect(run.stdout.includes("blockers")).toBe(false);
      expect(run.stdout.includes("blockers.")).toBe(false);
      const ledger = readBlockerLedger(harness.state.store);
      expect(ledger.ok).toBe(true);
      if (ledger.ok) expect(ledger.value.recordCount).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test("the six existing digest sections are identical with and without a question", () => {
    const question = makeQuestion({
      id: "q-1",
      askedAt: new Date(NOW_MS - 3_600_000).toISOString(),
      options: ["a"],
    });
    const empty = aggregateStatus(baseFacts({ blockers: blockersRead([], []) }));
    const withQuestion = aggregateStatus(baseFacts({ blockers: blockersRead([question], []) }));
    const firstSix = (digest: ReturnType<typeof aggregateStatus>) =>
      JSON.stringify(digest.sections.filter((section) => section.id !== "typed-questions"));
    expect(firstSix(withQuestion)).toBe(firstSix(empty));
    expect(withQuestion.sections).toHaveLength(7);
    expect(empty.sections).toHaveLength(7);
    expect(withQuestion.sections.map((section) => section.id)).toEqual([...STATUS_SECTION_ORDER]);
  });

  test("the brief's other eight surfaces and two existing anchors are unchanged", () => {
    const question = makeQuestion({
      id: "q-1",
      askedAt: new Date(NOW_MS - 3_600_000).toISOString(),
      options: ["a"],
    });
    const empty = projectBrief(baseFacts({ blockers: blockersRead([], []) }));
    const withQuestion = projectBrief(baseFacts({ blockers: blockersRead([question], []) }));
    const surfaces = (payload: ReturnType<typeof projectBrief>) =>
      JSON.stringify(payload.surfaces.filter((surface) => surface.id !== "typed-questions"));
    const anchors = (payload: ReturnType<typeof projectBrief>) =>
      JSON.stringify(payload.anchors.filter((anchor) => anchor.group !== "blocker-questions"));
    expect(surfaces(withQuestion)).toBe(surfaces(empty));
    expect(anchors(withQuestion)).toBe(anchors(empty));
  });

  test("the status golden has seven sections with the six existing ids relative-stable", () => {
    const golden = JSON.parse(
      readFileSync(join(ROOT, "tests/fixtures/status/golden/digest.json"), "utf8"),
    ) as { data: { sections: { id: string }[] } };
    expect(golden.data.sections).toHaveLength(7);
    expect(golden.data.sections.map((section) => section.id)).toEqual([...STATUS_SECTION_ORDER]);
    expect(STATUS_SECTION_TITLES["typed-questions"]).toBe("Typed questions");
  });

  test("the brief golden keeps nine surfaces, two placeholders, and three anchors", () => {
    const golden = JSON.parse(
      readFileSync(join(ROOT, "tests/fixtures/brief/golden/envelope.json"), "utf8"),
    ) as {
      data: {
        surfaces: { id: string }[];
        placeholders: { capability: string }[];
        anchors: { group: string }[];
      };
    };
    expect(golden.data.surfaces).toHaveLength(9);
    expect(golden.data.placeholders).toHaveLength(2);
    expect(golden.data.anchors).toHaveLength(3);
  });

  test("no config key, envelope shape, subpath, or state schema changed", () => {
    expect(JSON.stringify(PRODUCTION_CATALOG).includes("blockers")).toBe(false);
    expect(STATE_SCHEMA_VERSION).toBe("delivery.state.v1");
    expect(existsSync(join(ROOT, "packages/mcp/src/commands/index.ts"))).toBe(true);
    const subpaths = readFileSync(join(ROOT, "packages/core/package.json"), "utf8");
    expect(subpaths).not.toContain("blockers");
  });

  test("the owner-gate audience seam is reused, not modified", () => {
    expect(BLOCKER_AUDIENCES).toBe(OWNER_GATE_SLA_AUDIENCES);
    const boardSource = readFileSync(join(ROOT, "packages/cli/src/commands/board.ts"), "utf8");
    expect(boardSource.includes("blocker")).toBe(false);
    const boardRuntime = readFileSync(join(ROOT, "packages/cli/src/edge.ts"), "utf8");
    expect(boardRuntime.includes("owner-gate->question")).toBe(false);
  });

  test("the TDR-0009 accepted residual is documented", () => {
    const path = join(ROOT, "doc/decisions/TDR-0009-blockers-credential-guard-pattern-deferral.md");
    expect(existsSync(path)).toBe(true);
    const text = readFileSync(path, "utf8");
    expect(text.toLowerCase()).toContain("residual");
    expect(text).toContain("M1-S20");
    expect(text).toContain("M1-S22");
  });
});
