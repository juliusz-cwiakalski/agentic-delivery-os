/**
 * TC-BLK-016 — option contract and content caps: at-cap accepted, over-cap,
 * missing, empty, and misplaced options refused with zero bytes; multibyte
 * counts characters for content.
 */
import { describe, expect, test } from "bun:test";
import {
  BLOCKER_CONTENT_LIMITS,
  validateBlockerPublish,
} from "../../packages/core/src/domain/blockers";
import {
  AT_CAP_ANSWER,
  AT_CAP_OPTION,
  AT_CAP_QUESTION,
  atCapOptions,
  MULTIBYTE_ANSWER,
  MULTIBYTE_QUESTION,
  OVER_CAP_ANSWER,
  OVER_CAP_OPTION,
  OVER_CAP_QUESTION,
  OVER_MULTIBYTE_ANSWER,
  OVER_MULTIBYTE_QUESTION,
} from "../fixtures/blockers/bounds";
import { createBlockersHarness } from "../fixtures/blockers/harness";
import { makeQuestion } from "../fixtures/blockers/records";

const publishDecision = (question: string, options: readonly string[]): readonly string[] => [
  "publish",
  "decision-needed",
  "--lane",
  "L5",
  "--options",
  options.join(","),
  question,
];

describe("TC-BLK-016 option contract and content caps", () => {
  test("four 60-char options and a 120-char question are accepted in order", async () => {
    const harness = createBlockersHarness();
    try {
      const options = atCapOptions();
      const run = await harness.run(publishDecision(AT_CAP_QUESTION, options));
      expect(run.exitCode).toBe(0);
      const record = harness.read().questions[0];
      expect(record?.options).toEqual(options);
      expect(record?.question).toBe(AT_CAP_QUESTION);
    } finally {
      harness.cleanup();
    }
  });

  test("missing, empty, short-element, five, and over-long options are refused", async () => {
    const harness = createBlockersHarness();
    try {
      const cases: readonly (readonly string[])[] = [
        ["publish", "decision-needed", "--lane", "L5", "no options"],
        ["publish", "decision-needed", "--lane", "L5", "--options", "", "empty options"],
        ["publish", "decision-needed", "--lane", "L5", "--options", "a,,b", "empty element"],
        ["publish", "decision-needed", "--lane", "L5", "--options", "a,b,c,d,e", "five options"],
        [
          "publish",
          "decision-needed",
          "--lane",
          "L5",
          "--options",
          `a,${OVER_CAP_OPTION}`,
          "long option",
        ],
        ["publish", "decision-needed", "--lane", "L5", "--options", "a", OVER_CAP_QUESTION],
        ["publish", "decision-needed", "--lane", "L5", "--options", "a", ""],
      ];
      for (const argv of cases) {
        const before = harness.ledgerBytes();
        const run = await harness.run(argv);
        expect(run.exitCode, argv.join(" ")).toBe(1);
        expect(run.envelope?.error, argv.join(" ")).toMatchObject({
          code: "input.value.rejected",
        });
        expect(harness.ledgerBytes().equals(before)).toBe(true);
      }
      expect(harness.read().verifiedEmpty).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test("options on a non-decision type are refused", async () => {
    const harness = createBlockersHarness();
    try {
      const run = await harness.run([
        "publish",
        "spec-ambiguity",
        "--lane",
        "L2",
        "--options",
        "a,b",
        "which spec?",
      ]);
      expect(run.exitCode).toBe(1);
      expect(run.envelope?.error).toMatchObject({ code: "input.value.rejected" });
      expect(harness.read().verifiedEmpty).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test("multibyte content counts characters at the boundary", async () => {
    const harness = createBlockersHarness();
    try {
      const accepted = await harness.run(publishDecision(MULTIBYTE_QUESTION, ["a"]));
      expect(accepted.exitCode).toBe(0);
      const refused = await harness.run(publishDecision(OVER_MULTIBYTE_QUESTION, ["a"]));
      expect(refused.exitCode).toBe(1);
      expect(refused.envelope?.error).toMatchObject({ code: "input.value.rejected" });

      const answerHarness = createBlockersHarness({
        seedQuestions: [
          makeQuestion({ id: "q-t", type: "spec-ambiguity", audience: "owner", options: [] }),
        ],
      });
      try {
        const atCap = await answerHarness.run(["answer", "q-t", "--text", MULTIBYTE_ANSWER]);
        expect(atCap.exitCode).toBe(0);
      } finally {
        answerHarness.cleanup();
      }
      const overHarness = createBlockersHarness({
        seedQuestions: [
          makeQuestion({ id: "q-t", type: "spec-ambiguity", audience: "owner", options: [] }),
        ],
      });
      try {
        const over = await overHarness.run(["answer", "q-t", "--text", OVER_MULTIBYTE_ANSWER]);
        expect(over.exitCode).toBe(1);
        expect(over.envelope?.error).toMatchObject({ code: "input.value.rejected" });
      } finally {
        overHarness.cleanup();
      }
    } finally {
      harness.cleanup();
    }
  });

  test("the ASCII answer cap boundary accepts 160 and refuses 161", async () => {
    const harness = createBlockersHarness({
      seedQuestions: [
        makeQuestion({ id: "q-160", type: "spec-ambiguity", audience: "owner", options: [] }),
        makeQuestion({ id: "q-161", type: "spec-ambiguity", audience: "owner", options: [] }),
      ],
    });
    try {
      expect((await harness.run(["answer", "q-160", "--text", AT_CAP_ANSWER])).exitCode).toBe(0);
      expect((await harness.run(["answer", "q-161", "--text", OVER_CAP_ANSWER])).exitCode).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("the caps are injectable data: a widened copy accepts the over-cap form", () => {
    const widened = {
      ...BLOCKER_CONTENT_LIMITS,
      maxQuestionChars: 130,
      maxOptionChars: 70,
      maxOptions: 5,
    };
    const result = validateBlockerPublish(
      {
        type: "decision-needed",
        lane: "L5",
        question: OVER_CAP_QUESTION,
        options: [OVER_CAP_OPTION, "b", "c", "d", "e"],
      },
      widened,
    );
    expect(result.ok).toBe(true);
    const production = validateBlockerPublish({
      type: "decision-needed",
      lane: "L5",
      question: OVER_CAP_QUESTION,
      options: [OVER_CAP_OPTION],
    });
    expect(production.ok).toBe(false);
    expect(AT_CAP_OPTION).toHaveLength(60);
  });
});
