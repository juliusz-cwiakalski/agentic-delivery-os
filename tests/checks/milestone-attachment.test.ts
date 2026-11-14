/**
 * TC-CHK-001 / TC-CHK-006 — the canonical contract-v1 decision table and the
 * fixed comment/summary projection.
 *
 * The table is the oracle: each row fixes the verdict, the tracker writes, and
 * the one job summary. The adversarial fixtures prove the comment body and the
 * run-summary projection carry no issue-authored text.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type EvaluationInput,
  EXEMPTION_LABEL,
  evaluate,
  FLAG_LABEL,
  isMarkerComment,
  MARKER_COMMENT_BODY,
  MARKER_TOKEN,
  MILESTONE_ACTIONS,
  renderJobSummary,
  TRACKER_WRITES,
  type TrackerWrite,
  VERDICTS,
  WRITE_VERBS,
  type WriteVerb,
} from "../../scripts/checks/milestone-attachment";

const ROOT = process.cwd();
const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

type Row = {
  readonly rule: string;
  readonly input: EvaluationInput;
  readonly trackerWrites: readonly TrackerWrite[];
};

const input = (overrides: Partial<EvaluationInput>): EvaluationInput => ({
  action: "edited",
  state: "open",
  changeLabel: true,
  exemption: false,
  milestone: false,
  flag: false,
  markerCommentPresent: false,
  ...overrides,
});

const rows: readonly Row[] = [
  { rule: "1", input: input({ changeLabel: false }), trackerWrites: [] },
  { rule: "1", input: input({ state: "closed" }), trackerWrites: [] },
  {
    rule: "2",
    input: input({ exemption: true, action: "opened" }),
    trackerWrites: [],
  },
  {
    rule: "2",
    input: input({
      exemption: true,
      milestone: true,
      flag: true,
      markerCommentPresent: true,
    }),
    trackerWrites: [],
  },
  {
    rule: "2",
    input: input({ exemption: true, milestone: true, action: "milestoned" }),
    trackerWrites: [],
  },
  {
    rule: "3",
    input: input({ milestone: true, flag: true, markerCommentPresent: true }),
    trackerWrites: ["removeFlag"],
  },
  {
    rule: "3",
    input: input({ milestone: true, action: "milestoned", markerCommentPresent: true }),
    trackerWrites: [],
  },
  {
    rule: "4a",
    input: input({ action: "opened" }),
    trackerWrites: ["addFlag", "postMarkerComment"],
  },
  {
    rule: "4a",
    input: input({ action: "opened", markerCommentPresent: true }),
    trackerWrites: ["addFlag"],
  },
  {
    rule: "4b",
    input: input({ action: "opened", flag: true, markerCommentPresent: true }),
    trackerWrites: [],
  },
  {
    rule: "4c",
    input: input({ action: "demilestoned", markerCommentPresent: true }),
    trackerWrites: ["addFlag"],
  },
  {
    rule: "4c",
    input: input({
      action: "demilestoned",
      flag: true,
      markerCommentPresent: true,
    }),
    trackerWrites: [],
  },
  { rule: "4f", input: input({ action: "demilestoned" }), trackerWrites: [] },
  {
    rule: "4d",
    input: input({ flag: true, markerCommentPresent: true }),
    trackerWrites: [],
  },
  {
    rule: "4d",
    input: input({ action: "labeled", flag: true }),
    trackerWrites: [],
  },
  {
    rule: "4e",
    input: input({ markerCommentPresent: true }),
    trackerWrites: [],
  },
  { rule: "4f", input: input({}), trackerWrites: [] },
  { rule: "4f", input: input({ action: "labeled" }), trackerWrites: [] },
  { rule: "4f", input: input({ action: "unlabeled" }), trackerWrites: [] },
  { rule: "4f", input: input({ action: "reopened" }), trackerWrites: [] },
  {
    rule: "4f",
    input: input({ action: "demilestoned", flag: true }),
    trackerWrites: [],
  },
  {
    rule: "4d",
    input: input({ action: "unlabeled", flag: true }),
    trackerWrites: [],
  },
  {
    rule: "4d",
    input: input({ action: "reopened", flag: true, markerCommentPresent: true }),
    trackerWrites: [],
  },
];

const expectedWrites = (trackerWrites: readonly TrackerWrite[]): readonly WriteVerb[] => [
  ...trackerWrites,
  "writeJobSummary",
];

const trackerWritesOf = (writes: readonly WriteVerb[]): readonly TrackerWrite[] =>
  writes.filter((write): write is TrackerWrite => write !== "writeJobSummary");

describe("TC-CHK-001 canonical contract-v1 decision table", () => {
  test("the input is the seven-field normalised contract with a closed action set", () => {
    expect(Object.keys(input({})).sort()).toEqual(
      [
        "action",
        "changeLabel",
        "exemption",
        "flag",
        "markerCommentPresent",
        "milestone",
        "state",
      ].sort(),
    );
    expect(MILESTONE_ACTIONS).toEqual([
      "opened",
      "edited",
      "labeled",
      "unlabeled",
      "milestoned",
      "demilestoned",
      "reopened",
    ]);
    expect(MILESTONE_ACTIONS).not.toContain("title");
    expect(MILESTONE_ACTIONS).not.toContain("body");
    expect(MILESTONE_ACTIONS).not.toContain("author");
  });

  test("every canonical row yields its verdict, tracker writes, and one job summary", () => {
    for (const row of rows) {
      const result = evaluate(row.input);
      expect(result.writes, row.rule).toEqual(expectedWrites(row.trackerWrites));
      expect(trackerWritesOf(result.writes), row.rule).toEqual(row.trackerWrites);
      expect(
        result.writes.filter((write) => write === "writeJobSummary"),
        row.rule,
      ).toHaveLength(1);
    }
  });

  test("precedence is first-match, not conjunction", () => {
    expect(evaluate(input({ state: "closed", exemption: true })).verdict).toBe("out-of-scope");
    expect(evaluate(input({ exemption: true, milestone: true, flag: true })).writes).toEqual(
      expectedWrites([]),
    );
    expect(evaluate(input({ milestone: true, flag: true })).writes).toEqual(
      expectedWrites(["removeFlag"]),
    );
    expect(evaluate(input({ flag: true, action: "edited" })).writes).toEqual(expectedWrites([]));
    // demilestoned with the marker is a restore path, not the 4d catch-all.
    expect(
      evaluate(input({ action: "demilestoned", flag: true, markerCommentPresent: true })),
    ).toEqual({ verdict: "restored", writes: expectedWrites([]) });
  });

  test("the full product always yields exactly one closed verdict and one summary", () => {
    const booleans = [false, true] as const;
    for (const action of MILESTONE_ACTIONS) {
      for (const state of ["open", "closed"] as const) {
        for (const changeLabel of booleans) {
          for (const exemption of booleans) {
            for (const milestone of booleans) {
              for (const flag of booleans) {
                for (const markerCommentPresent of booleans) {
                  const result = evaluate({
                    action,
                    state,
                    changeLabel,
                    exemption,
                    milestone,
                    flag,
                    markerCommentPresent,
                  });
                  expect(VERDICTS).toContain(result.verdict);
                  expect(result.writes.every((write) => WRITE_VERBS.includes(write))).toBe(true);
                  expect(result.writes.filter((write) => write === "writeJobSummary")).toHaveLength(
                    1,
                  );
                  expect(new Set(result.writes).size).toBe(result.writes.length);
                }
              }
            }
          }
        }
      }
    }
  });

  test("the write vocabulary is closed and every verb is exercised", () => {
    const produced = new Set(rows.flatMap((row) => evaluate(row.input).writes));
    for (const write of produced) expect(WRITE_VERBS).toContain(write);
    for (const write of WRITE_VERBS) expect(produced).toContain(write);
    expect(TRACKER_WRITES).toEqual(["addFlag", "removeFlag", "postMarkerComment"]);
    expect(FLAG_LABEL).toBe("needs-milestone");
    expect(EXEMPTION_LABEL).toBe("backlog-capture");
  });

  test("evaluation is deterministic and independent of table order", () => {
    for (const row of rows) {
      expect(evaluate(row.input)).toEqual(evaluate(row.input));
    }
    const forward = rows.map((row) => evaluate(row.input));
    const backward = [...rows]
      .reverse()
      .map((row) => evaluate(row.input))
      .reverse();
    expect(forward).toEqual(backward);
  });

  test("branch and verb completeness is a meta-assertion", () => {
    expect(new Set(rows.map((row) => row.rule))).toEqual(
      new Set(["1", "2", "3", "4a", "4b", "4c", "4d", "4e", "4f"]),
    );
    const produced = new Set(rows.flatMap((row) => evaluate(row.input).writes));
    expect(new Set(produced)).toEqual(new Set(WRITE_VERBS));
  });
});

describe("TC-CHK-006 fixed comment and summary projection", () => {
  const adversarial = ["issue-text-injection.json", "issue-log-forging.json"];

  const fixture = (name: string): Record<string, unknown> => {
    const parsed: unknown = JSON.parse(
      read(`tests/fixtures/milestone-attachment/adversarial/${name}`),
    );
    if (typeof parsed !== "object" || parsed === null) throw new Error("invalid fixture");
    return parsed as Record<string, unknown>;
  };

  test("the comment body is one fixed constant with the required anchors", () => {
    expect(MARKER_COMMENT_BODY).toContain(MARKER_TOKEN);
    expect(MARKER_COMMENT_BODY).toContain("doc/guides/milestone-management.md");
    expect(MARKER_COMMENT_BODY).toContain("backlog-capture");
    expect(MARKER_COMMENT_BODY).toMatch(/does not\s+block work/i);
    expect(isMarkerComment(MARKER_COMMENT_BODY)).toBe(true);
    expect(isMarkerComment("a human comment")).toBe(false);
  });

  test("the body is byte-identical under adversarial issue content", () => {
    let reference: string | undefined;
    for (const name of adversarial) {
      const issue = fixture(name);
      const tokens = [issue.title, issue.body, issue.author].filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      );
      const body = MARKER_COMMENT_BODY;
      reference = reference ?? body;
      expect(body).toBe(reference);
      for (const token of tokens) {
        expect(body.includes(token), `${name}: ${token.slice(0, 20)}`).toBe(false);
      }
    }
  });

  test("the summary carries only issue number, verdict, and writes", () => {
    for (const name of adversarial) {
      const issue = fixture(name);
      const number = issue.number as number;
      const evaluation = evaluate(input({ action: "opened" }));
      const summary = renderJobSummary(number, evaluation);
      expect(summary).toContain(`#${number}`);
      expect(summary).toContain("flagged");
      expect(summary).toContain("addFlag");
      expect(summary).toContain("postMarkerComment");
      expect([...summary].every((character) => character.charCodeAt(0) >= 0x20)).toBe(true);
      for (const key of ["title", "body", "author"]) {
        const value = issue[key];
        if (typeof value === "string") expect(summary.includes(value)).toBe(false);
      }
    }
  });
});
