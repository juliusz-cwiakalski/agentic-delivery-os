/**
 * TC-BLK-035 — bounds and declared truncation on every surface: the 8-question
 * cap, content caps, the 65 536-byte machine cap, the 24-line/4 096-byte human
 * cap, exact omitted counts, and hostile identifier clamping.
 */
import { describe, expect, test } from "bun:test";
import {
  BLOCKERS_MAX_HUMAN_BYTES,
  BLOCKERS_MAX_MACHINE_BYTES,
} from "../../packages/core/src/contracts/index";
import { buildBlockerListData, renderBlockersHuman } from "../../packages/core/src/domain/blockers";
import { aggregateStatus, projectBrief } from "../../packages/core/src/domain/index";
import {
  AT_CAP_ANSWER,
  AT_CAP_OPTION,
  AT_CAP_QUESTION,
  atCapOptions,
  capSizedQuestions,
  hostileLane,
  OVER_CAP_ANSWER,
  OVER_CAP_OPTION,
  OVER_CAP_QUESTION,
} from "../fixtures/blockers/bounds";
import { createBlockersHarness, FIXED_NOW_MS } from "../fixtures/blockers/harness";
import { makeQuestion } from "../fixtures/blockers/records";
import { baseFacts, briefRuntime, runBriefCli } from "../fixtures/brief/harness";
import { blockersRead } from "../fixtures/status/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const questions = (count: number) => capSizedQuestions(count);

describe("TC-BLK-035 bounds and truncation", () => {
  test("eight questions render fully; nine render eight with an exact omitted count", () => {
    const atCap = buildBlockerListData(questions(8), [], FIXED_NOW_MS);
    expect(atCap.questions).toHaveLength(8);
    expect(atCap.truncated).toBe(false);
    expect(atCap.omitted).toBe(0);
    const over = buildBlockerListData(questions(9), [], FIXED_NOW_MS);
    expect(over.questions).toHaveLength(8);
    expect(over.truncated).toBe(true);
    expect(over.omitted).toBe(1);
    expect(
      over.questions.map((question) => (question.status === "open" ? question.rank : -1)),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test("the digest and brief use the same cap and omitted count", () => {
    const records = questions(9);
    const digest = aggregateStatus(baseFacts({ blockers: blockersRead(records, []) }));
    const section = digest.sections.find((entry) => entry.id === "typed-questions");
    expect(section?.questions).toHaveLength(8);
    expect(section?.counts.omitted).toBe(1);
    expect(section?.truncated).toBe(true);
    const brief = projectBrief(baseFacts({ blockers: blockersRead(records, []) }));
    const anchor = brief.anchors.find((entry) => entry.group === "blocker-questions");
    expect(anchor?.items).toHaveLength(8);
    expect(anchor?.omitted).toBe(1);
    expect(anchor?.truncated).toBe(true);
    expect(brief.truncation.some((marker) => marker.target === "blocker-questions")).toBe(true);
  });

  test("the highest-priority question survives truncation", () => {
    const records = questions(9);
    const data = buildBlockerListData(records, [], FIXED_NOW_MS);
    const first = data.questions[0];
    expect(first?.status).toBe("open");
    if (first?.status === "open") expect(first.rank).toBe(1);
  });

  test("human mode stays within 24 lines and 4 096 bytes and marks omissions", () => {
    const data = buildBlockerListData(questions(9), [], FIXED_NOW_MS);
    const human = renderBlockersHuman(data, SYNTHETIC_BRAND);
    const lines = human.split("\n").filter((line) => line.length > 0);
    expect(lines.length).toBeLessThanOrEqual(24);
    expect(Buffer.byteLength(human, "utf8")).toBeLessThanOrEqual(BLOCKERS_MAX_HUMAN_BYTES);
    expect(lines.at(-1)).toContain("more questions omitted");
  });

  test("machine data stays within 65 536 bytes and hostile identifiers are clamped", () => {
    const hostile = makeQuestion({
      id: "q-hostile",
      lane: hostileLane(),
      ref: `GH-${"R".repeat(2_000)}`,
      askedAt: "2026-11-06T10:00:00Z",
    });
    const data = buildBlockerListData([hostile], [], FIXED_NOW_MS);
    expect(Buffer.byteLength(JSON.stringify(data), "utf8")).toBeLessThanOrEqual(
      BLOCKERS_MAX_MACHINE_BYTES,
    );
    const rendered = data.questions[0];
    if (rendered?.status === "open") {
      expect(rendered.lane.length).toBe(160);
      expect(rendered.lane.endsWith("+")).toBe(true);
      expect(rendered.ref?.length).toBe(160);
      expect(rendered.ref?.endsWith("+")).toBe(true);
    }
  });

  test("content caps are accepted at the boundary and refused one over", async () => {
    const harness = createBlockersHarness();
    try {
      const accepted = await harness.run([
        "publish",
        "decision-needed",
        "--lane",
        "L5",
        "--options",
        atCapOptions().join(","),
        AT_CAP_QUESTION,
      ]);
      expect(accepted.exitCode).toBe(0);
      const refusedQuestion = await harness.run([
        "publish",
        "decision-needed",
        "--lane",
        "L5",
        "--options",
        "a",
        OVER_CAP_QUESTION,
      ]);
      expect(refusedQuestion.exitCode).toBe(1);
      const refusedOption = await harness.run([
        "publish",
        "decision-needed",
        "--lane",
        "L5",
        "--options",
        OVER_CAP_OPTION,
        "q",
      ]);
      expect(refusedOption.exitCode).toBe(1);
    } finally {
      harness.cleanup();
    }
    const answerHarness = createBlockersHarness({
      seedQuestions: [
        makeQuestion({ id: "q-t", type: "spec-ambiguity", audience: "owner", options: [] }),
      ],
    });
    try {
      expect((await answerHarness.run(["answer", "q-t", "--text", AT_CAP_ANSWER])).exitCode).toBe(
        0,
      );
      const second = createBlockersHarness({
        seedQuestions: [
          makeQuestion({ id: "q-t", type: "spec-ambiguity", audience: "owner", options: [] }),
        ],
      });
      try {
        expect((await second.run(["answer", "q-t", "--text", OVER_CAP_ANSWER])).exitCode).toBe(1);
      } finally {
        second.cleanup();
      }
    } finally {
      answerHarness.cleanup();
    }
  });

  test("the brief CLI stays within the machine cap with the over-cap corpus", async () => {
    const run = await runBriefCli(
      ["--json", "brief"],
      briefRuntime(baseFacts({ blockers: blockersRead(questions(9), []) })),
    );
    expect(run.exitCode).toBe(0);
    const data = (JSON.parse(run.stdout) as Record<string, unknown>).data;
    expect(Buffer.byteLength(JSON.stringify(data), "utf8")).toBeLessThanOrEqual(65_536);
    expect(BLOCKERS_MAX_MACHINE_BYTES).toBe(65_536);
    expect(AT_CAP_OPTION).toHaveLength(60);
  });
});
