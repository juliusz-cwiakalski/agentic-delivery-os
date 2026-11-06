/**
 * TC-BLK-015 — per-type answer channels: choice records the selected option
 * value; every channel, range, both/neither, empty, and already-answered
 * violation is `input.value.rejected` with zero appends.
 */
import { describe, expect, test } from "bun:test";
import { createBlockersHarness } from "../fixtures/blockers/harness";
import { makeQuestion } from "../fixtures/blockers/records";

const threeOptions = () =>
  makeQuestion({ id: "q-choice", audience: "coordinator", options: ["a", "b", "c"] });

describe("TC-BLK-015 answer channels", () => {
  test("positive choice indices record the option value, never the index", async () => {
    const cases: readonly [string, string][] = [
      ["1", "a"],
      ["2", "b"],
      ["3", "c"],
    ];
    for (const [index, expected] of cases) {
      const harness = createBlockersHarness({ seedQuestions: [threeOptions()] });
      try {
        const run = await harness.run(["answer", "q-choice", "--choice", index]);
        expect(run.exitCode, index).toBe(0);
        expect(run.data?.choice).toBe(expected);
        expect(harness.read().answers[0]?.choice).toBe(expected);
      } finally {
        harness.cleanup();
      }
    }
  });

  test("text answers are accepted for each options-less type", async () => {
    const harness = createBlockersHarness({
      seedQuestions: [
        makeQuestion({ id: "q-s", type: "spec-ambiguity", audience: "owner", options: [] }),
        makeQuestion({
          id: "q-c",
          type: "credential-missing",
          audience: "owner",
          question: "GITHUB_TOKEN",
          options: [],
        }),
        makeQuestion({ id: "q-e", type: "external-wait", audience: "coordinator", options: [] }),
      ],
    });
    try {
      for (const [id, text] of [
        ["q-s", "use criterion two"],
        ["q-c", "GITHUB_TOKEN"],
        ["q-e", "vendor replied"],
      ] as const) {
        const run = await harness.run(["answer", id, "--text", text]);
        expect(run.exitCode, id).toBe(0);
        expect(run.data?.text).toBe(text);
      }
      expect(harness.read().answers).toHaveLength(3);
    } finally {
      harness.cleanup();
    }
  });

  test("wrong channel, out-of-range, both/neither, empty, and answered are refused", async () => {
    const harness = createBlockersHarness({
      seedQuestions: [
        threeOptions(),
        makeQuestion({ id: "q-s", type: "spec-ambiguity", audience: "owner", options: [] }),
        makeQuestion({
          id: "q-c",
          type: "credential-missing",
          audience: "owner",
          question: "GITHUB_TOKEN",
          options: [],
        }),
        makeQuestion({ id: "q-e", type: "external-wait", audience: "coordinator", options: [] }),
      ],
    });
    try {
      const refused: readonly (readonly string[])[] = [
        ["answer", "q-choice", "--text", "wrong channel"],
        ["answer", "q-s", "--choice", "1"],
        ["answer", "q-c", "--choice", "1"],
        ["answer", "q-e", "--choice", "1"],
        ["answer", "q-choice", "--choice", "0"],
        ["answer", "q-choice", "--choice", "4"],
        ["answer", "q-choice", "--choice", "-1"],
        ["answer", "q-choice", "--choice", "nope"],
        ["answer", "q-s", "--choice", "1", "--text", "both"],
        ["answer", "q-s"],
        ["answer", "q-s", "--text", ""],
      ];
      for (const argv of refused) {
        const run = await harness.run(argv);
        expect(run.exitCode, argv.join(" ")).toBe(1);
        expect(run.envelope?.error, argv.join(" ")).toMatchObject({
          code: "input.value.rejected",
          category: "user",
          retryable: false,
          consequence: "not_landed",
        });
        expect(run.data).toBeUndefined();
      }
      expect(harness.read().answers).toHaveLength(0);
      expect(harness.read().questions).toHaveLength(4);
    } finally {
      harness.cleanup();
    }
  });

  test("a valid answer after each refusal still succeeds on the same open question", async () => {
    const harness = createBlockersHarness({ seedQuestions: [threeOptions()] });
    try {
      expect((await harness.run(["answer", "q-choice", "--text", "wrong"])).exitCode).toBe(1);
      expect((await harness.run(["answer", "q-choice", "--choice", "2"])).exitCode).toBe(0);
      expect(harness.read().answers[0]?.choice).toBe("b");
    } finally {
      harness.cleanup();
    }
  });

  test("an already-answered question is refused and the authoritative answer is unchanged", async () => {
    const harness = createBlockersHarness({ seedQuestions: [threeOptions()] });
    try {
      expect((await harness.run(["answer", "q-choice", "--choice", "1"])).exitCode).toBe(0);
      const before = harness.ledgerBytes();
      const second = await harness.run(["answer", "q-choice", "--choice", "2"]);
      expect(second.exitCode).toBe(1);
      expect(second.envelope?.error).toMatchObject({ code: "input.value.rejected" });
      expect(harness.ledgerBytes().equals(before)).toBe(true);
      expect(harness.read().answers[0]?.choice).toBe("a");
    } finally {
      harness.cleanup();
    }
  });
});
