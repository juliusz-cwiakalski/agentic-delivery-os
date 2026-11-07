/**
 * TC-BLK-043 — the identifier-field credential guard: a registered secret in
 * `lane`/`ref` is refused with zero bytes on publish and answer; legitimate
 * `L2`/`GH-230`/`PDEV-123` and unregistered token-like identifiers are accepted.
 */
import { describe, expect, test } from "bun:test";
import { evaluateBlockerGuard } from "../../packages/core/src/domain/blockers";
import {
  LANE_WITH_SECRET,
  LEGITIMATE_IDENTIFIERS,
  legacySecretLane,
  REGISTERED_SECRET,
  REGISTERED_SECRET_B,
  secrets,
  secretsB,
  UNREGISTERED_TOKEN_LIKE,
} from "../fixtures/blockers/credentials";
import { createBlockersHarness } from "../fixtures/blockers/harness";
import { makeQuestion } from "../fixtures/blockers/records";

describe("TC-BLK-043 identifier-field guard", () => {
  test("a registered secret in --lane is refused on publish with zero bytes", async () => {
    const harness = createBlockersHarness({ secrets: secrets() });
    try {
      for (const lane of [REGISTERED_SECRET, LANE_WITH_SECRET]) {
        const before = harness.ledgerBytes();
        const run = await harness.run(["publish", "spec-ambiguity", "--lane", lane, "which spec?"]);
        expect(run.exitCode, lane).toBe(1);
        expect(run.envelope?.error, lane).toMatchObject({
          code: "blockers.credential-value-rejected",
          category: "user",
          consequence: "not_landed",
        });
        expect(harness.ledgerBytes().equals(before)).toBe(true);
        expect(run.stdout.includes(REGISTERED_SECRET)).toBe(false);
        expect(run.stderr.includes(REGISTERED_SECRET)).toBe(false);
      }
      expect(harness.read().verifiedEmpty).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test("a seeded question whose lane carries a registered secret is refused on the answer path", async () => {
    const harness = createBlockersHarness({
      secrets: secrets(),
      seedQuestions: [
        makeQuestion({
          id: "q-legacy",
          type: "spec-ambiguity",
          audience: "owner",
          lane: legacySecretLane,
          options: [],
        }),
      ],
    });
    try {
      const before = harness.ledgerBytes();
      const run = await harness.run(["answer", "q-legacy", "--text", "answer"]);
      expect(run.exitCode).toBe(1);
      expect(run.envelope?.error).toMatchObject({ code: "blockers.credential-value-rejected" });
      expect(harness.ledgerBytes().equals(before)).toBe(true);
      expect(harness.read().answers).toHaveLength(0);
      expect(harness.session.calls).toEqual([]);
    } finally {
      harness.cleanup();
    }
  });

  test("legitimate identifiers and unregistered token-like identifiers are accepted verbatim", async () => {
    const harness = createBlockersHarness({ secrets: secrets() });
    try {
      const lane = await harness.run([
        "publish",
        "spec-ambiguity",
        "--lane",
        LEGITIMATE_IDENTIFIERS.lane,
        "legit lane",
      ]);
      expect(lane.exitCode).toBe(0);
      expect((lane.data?.question as Record<string, unknown> | undefined)?.lane).toBe("L2");

      for (const ref of LEGITIMATE_IDENTIFIERS.refs) {
        const seeded = createBlockersHarness({
          secrets: secrets(),
          seedQuestions: [
            makeQuestion({
              id: "q-ref",
              type: "spec-ambiguity",
              audience: "owner",
              lane: "L2",
              ref,
              options: [],
            }),
          ],
        });
        try {
          const answer = await seeded.run(["answer", "q-ref", "--text", "answer"]);
          expect(answer.exitCode, ref).toBe(0);
          expect(seeded.read().questions[0]?.ref).toBe(ref);
        } finally {
          seeded.cleanup();
        }
      }

      const tokenLike = await harness.run([
        "publish",
        "spec-ambiguity",
        "--lane",
        UNREGISTERED_TOKEN_LIKE,
        "token-like lane",
      ]);
      expect(tokenLike.exitCode).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test("swapping the registered record changes the identifier verdict", async () => {
    const withA = createBlockersHarness({ secrets: secrets() });
    try {
      expect(
        (await withA.run(["publish", "spec-ambiguity", "--lane", `L-${REGISTERED_SECRET}`, "q"]))
          .exitCode,
      ).toBe(1);
    } finally {
      withA.cleanup();
    }
    const withB = createBlockersHarness({ secrets: secretsB() });
    try {
      const accepted = await withB.run([
        "publish",
        "spec-ambiguity",
        "--lane",
        `L-${REGISTERED_SECRET}`,
        "q",
      ]);
      expect(accepted.exitCode).toBe(0);
      expect(
        (await withB.run(["publish", "spec-ambiguity", "--lane", `L-${REGISTERED_SECRET_B}`, "q"]))
          .exitCode,
      ).toBe(1);
    } finally {
      withB.cleanup();
    }
  });

  test("the guard covers the identifier path; the content-only control is accepted", () => {
    expect(
      evaluateBlockerGuard({ lane: `L-${REGISTERED_SECRET}`, secrets: secrets() }),
    ).toMatchObject({
      ok: false,
      code: "blockers.credential-value-rejected",
    });
    expect(
      evaluateBlockerGuard({ ref: `GH-${REGISTERED_SECRET}`, secrets: secrets() }),
    ).toMatchObject({
      ok: false,
      code: "blockers.credential-value-rejected",
    });
    expect(evaluateBlockerGuard({ question: "clean question", secrets: secrets() })).toEqual({
      ok: true,
    });
  });

  test("a valid publish after an identifier refusal still succeeds", async () => {
    const harness = createBlockersHarness({ secrets: secrets() });
    try {
      expect(
        (await harness.run(["publish", "spec-ambiguity", "--lane", REGISTERED_SECRET, "q"]))
          .exitCode,
      ).toBe(1);
      expect(
        (await harness.run(["publish", "spec-ambiguity", "--lane", "L2", "clean"])).exitCode,
      ).toBe(0);
      expect(harness.read().questions).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });
});
