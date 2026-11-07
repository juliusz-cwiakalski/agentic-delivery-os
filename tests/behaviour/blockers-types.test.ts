/**
 * TC-BLK-014 — the closed four-type set: every valid type publishes; unknown,
 * case, separator, whitespace, and numeric variants are refused
 * `blockers.invalid-type` with zero persisted bytes.
 */
import { describe, expect, test } from "bun:test";
import { BLOCKER_QUESTION_TYPES } from "../../packages/core/src/contracts/index";
import { createBlockersHarness } from "../fixtures/blockers/harness";

const publish = (
  type: string,
  question: string,
  extra: readonly string[] = [],
): readonly string[] => ["publish", type, "--lane", "L2", ...extra, question];

describe("TC-BLK-014 closed type set", () => {
  test("all four valid types publish successfully and coexist", async () => {
    const harness = createBlockersHarness();
    try {
      const cases: readonly (readonly string[])[] = [
        publish("decision-needed", "pick", ["--options", "a,b"]),
        publish("spec-ambiguity", "which spec?"),
        publish("credential-missing", "GITHUB_TOKEN"),
        publish("external-wait", "awaiting vendor"),
      ];
      for (const argv of cases) {
        const run = await harness.run(argv);
        expect(run.exitCode, argv[1]).toBe(0);
        const question = run.data?.question as Record<string, unknown> | undefined;
        expect(question?.type).toBe(argv[1] as string);
      }
      expect(harness.read().questions.map((question) => question.type)).toEqual([
        "decision-needed",
        "spec-ambiguity",
        "credential-missing",
        "external-wait",
      ]);
    } finally {
      harness.cleanup();
    }
  });

  test("unknown, case, separator, whitespace, empty, and numeric variants are refused", async () => {
    const harness = createBlockersHarness();
    try {
      const invalid = [
        "unknown",
        "Decision-Needed",
        "decision_needed",
        "decision needed",
        "",
        " decision-needed ",
        "123",
      ];
      for (const type of invalid) {
        const before = harness.ledgerBytes();
        const run = await harness.run(publish(type, "text"));
        expect(run.exitCode, JSON.stringify(type)).toBe(1);
        expect(run.envelope?.error, JSON.stringify(type)).toMatchObject({
          code: "blockers.invalid-type",
          category: "user",
          retryable: false,
          consequence: "not_landed",
        });
        expect(run.data).toBeUndefined();
        expect(harness.ledgerBytes().equals(before)).toBe(true);
        const error = run.envelope?.error as Record<string, unknown> | undefined;
        const message = String(error?.remediationHint ?? "");
        expect(message).toContain("decision-needed");
        expect(message).toContain("external-wait");
      }
      expect(harness.read().verifiedEmpty).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test("a valid publish after each refusal still succeeds", async () => {
    const harness = createBlockersHarness();
    try {
      expect((await harness.run(publish("nope", "x"))).exitCode).toBe(1);
      expect((await harness.run(publish("spec-ambiguity", "valid after refusal"))).exitCode).toBe(
        0,
      );
      expect(harness.read().questions).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });

  test("the closed set is data-driven: a fifth-type copy accepts it locally", () => {
    const types: readonly string[] = [...BLOCKER_QUESTION_TYPES, "fifth-type"];
    const accepts = (value: string): boolean => types.includes(value);
    expect(accepts("fifth-type")).toBe(true);
    expect((BLOCKER_QUESTION_TYPES as readonly string[]).includes("fifth-type")).toBe(false);
    expect(BLOCKER_QUESTION_TYPES).toHaveLength(4);
  });
});
