/**
 * TC-BLK-029 (unit half) — the shared ranking key: priority class -> oldest
 * asked-at -> id, contiguous ranks, answered resolved after open, permutation
 * invariance, and priority-map liveness.
 */
import { describe, expect, test } from "bun:test";
import {
  BLOCKER_PRIORITY_BY_TYPE,
  type BlockerQuestionType,
} from "../../packages/core/src/contracts/index";
import {
  buildBlockerListData,
  rankBlockerQuestions,
} from "../../packages/core/src/domain/blockers";
import { aggregateStatus, projectBrief } from "../../packages/core/src/domain/index";
import {
  answeredOlderThanOpen,
  rankingQuestions,
  reverse,
  tiedIdQuestions,
} from "../fixtures/blockers/ranking";
import { FIXED_MS, makeAnswer, makeQuestion } from "../fixtures/blockers/records";
import { baseFacts, blockersRead } from "../fixtures/status/harness";

describe("TC-BLK-029 shared ranking", () => {
  test("priority class wins before age", () => {
    const ranked = rankBlockerQuestions(rankingQuestions(), [], FIXED_MS);
    expect(ranked.open.map((item) => item.id)).toEqual(["q-b", "q-c", "q-d", "q-a"]);
    expect(ranked.open.map((item) => item.type)).toEqual([
      "decision-needed",
      "credential-missing",
      "spec-ambiguity",
      "external-wait",
    ]);
    expect(ranked.open[0]?.age).toBe(3_600_000);
    expect(ranked.open[1]?.age).toBe(3_600_000);
  });

  test("an exact age tie orders by id ascending, not insertion order", () => {
    const ranked = rankBlockerQuestions(tiedIdQuestions(), [], FIXED_MS);
    expect(ranked.open.map((item) => item.id)).toEqual(["q-y", "q-z"]);
    const reversed = rankBlockerQuestions(reverse(tiedIdQuestions()), [], FIXED_MS);
    expect(reversed.open.map((item) => item.id)).toEqual(["q-y", "q-z"]);
  });

  test("ranks are contiguous 1..N over open questions", () => {
    const ranked = rankBlockerQuestions(rankingQuestions(), [], FIXED_MS);
    expect(ranked.open.map((item) => item.rank)).toEqual([1, 2, 3, 4]);
    expect(new Set(ranked.open.map((item) => item.rank)).size).toBe(4);
  });

  test("answered questions are excluded from the ranking and resolved after open", () => {
    const { questions, answers } = answeredOlderThanOpen();
    const ranked = rankBlockerQuestions(questions, answers, FIXED_MS);
    expect(ranked.open.map((item) => item.id)).toEqual(["q-open"]);
    expect(ranked.answered.map((item) => item.id)).toEqual(["q-closed"]);
    expect(ranked.answered[0]?.status).toBe("answered");
    expect(ranked.answered[0]?.answer.choice).toBe("a");
    expect(ranked.open.some((item) => item.id === "q-closed")).toBe(false);
  });

  test("answered records are ordered by age then id, never interleaved", () => {
    const questions = [
      makeQuestion({
        id: "q-open",
        type: "spec-ambiguity",
        askedAt: "2026-11-06T11:00:00Z",
        options: [],
      }),
      makeQuestion({
        id: "q-newer",
        type: "decision-needed",
        askedAt: "2026-11-06T10:00:00Z",
        options: ["a"],
      }),
      makeQuestion({
        id: "q-older",
        type: "decision-needed",
        askedAt: "2026-11-05T10:00:00Z",
        options: ["a"],
      }),
    ];
    const answers = [
      makeAnswer({ questionId: "q-newer", choice: "a" }),
      makeAnswer({ questionId: "q-older", choice: "a" }),
    ];
    const ranked = rankBlockerQuestions(questions, answers, FIXED_MS);
    expect(ranked.open.map((item) => item.id)).toEqual(["q-open"]);
    expect(ranked.answered.map((item) => item.id)).toEqual(["q-older", "q-newer"]);
  });

  test("reversing the input order changes nothing", () => {
    const forward = rankBlockerQuestions(rankingQuestions(), [], FIXED_MS);
    const backward = rankBlockerQuestions(reverse(rankingQuestions()), [], FIXED_MS);
    expect(backward.open.map((item) => item.id)).toEqual(forward.open.map((item) => item.id));
    expect(backward.open.map((item) => item.rank)).toEqual(forward.open.map((item) => item.rank));
  });

  test("changing one fact changes the order as predicted", () => {
    const questions = [
      makeQuestion({
        id: "q-1",
        type: "spec-ambiguity",
        askedAt: "2026-11-06T10:00:00Z",
        options: [],
      }),
      makeQuestion({
        id: "q-2",
        type: "spec-ambiguity",
        askedAt: "2026-11-06T11:00:00Z",
        options: [],
      }),
    ];
    const ranked = rankBlockerQuestions(questions, [], FIXED_MS);
    expect(ranked.open.map((item) => item.id)).toEqual(["q-1", "q-2"]);
    const changed = rankBlockerQuestions(
      [
        questions[0] as ReturnType<typeof makeQuestion>,
        { ...questions[1], askedAt: "2026-11-06T09:00:00Z" },
      ],
      [],
      FIXED_MS,
    );
    expect(changed.open.map((item) => item.id)).toEqual(["q-2", "q-1"]);
  });

  test("the priority map is data-driven (liveness)", () => {
    const questions = [
      makeQuestion({
        id: "q-e",
        type: "external-wait",
        askedAt: "2026-11-06T11:00:00Z",
        options: [],
      }),
      makeQuestion({
        id: "q-d",
        type: "decision-needed",
        askedAt: "2026-11-06T10:00:00Z",
        options: ["a"],
      }),
    ];
    const shipped = rankBlockerQuestions(questions, [], FIXED_MS);
    expect(shipped.open.map((item) => item.id)).toEqual(["q-d", "q-e"]);
    const mutated: Readonly<Record<BlockerQuestionType, number>> = {
      ...BLOCKER_PRIORITY_BY_TYPE,
      "external-wait": 0,
    };
    const changed = rankBlockerQuestions(questions, [], FIXED_MS, mutated);
    expect(changed.open.map((item) => item.id)).toEqual(["q-e", "q-d"]);
  });

  test("the ranking is deterministic across two calls", () => {
    const first = rankBlockerQuestions(rankingQuestions(), [], FIXED_MS);
    const second = rankBlockerQuestions(rankingQuestions(), [], FIXED_MS);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});

describe("TC-BLK-029 surface integration half", () => {
  test("list, digest section, and brief anchor share the same ids and ranks", () => {
    const questions = rankingQuestions();
    const list = buildBlockerListData(questions, [], FIXED_MS);
    const listOpen = list.questions
      .filter((question) => question.status === "open")
      .map((question) => ({ id: question.id, rank: question.rank }));
    const digest = aggregateStatus(
      baseFacts({ blockers: blockersRead(questions, []) }),
    ).sections.find((section) => section.id === "typed-questions");
    const digestItems = (digest?.questions ?? []).map((question) => ({
      id: question.id,
      rank: question.rank,
    }));
    const brief = projectBrief(baseFacts({ blockers: blockersRead(questions, []) }));
    const anchor = brief.anchors.find((entry) => entry.group === "blocker-questions");
    const briefItems = (anchor?.items ?? []).map((item) => {
      const evidence = item.evidence;
      return {
        id: item.identity,
        rank: evidence.kind === "blocker-question" ? evidence.rank : -1,
      };
    });
    expect(digestItems).toEqual(listOpen);
    expect(briefItems).toEqual(listOpen);
  });
});
