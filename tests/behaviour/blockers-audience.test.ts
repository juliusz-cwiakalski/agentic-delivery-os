/**
 * TC-BLK-021/022 — the closed audience set, publish default `coordinator`, and
 * SC-M1-24's exact cross-audience refusal: `blockers.audience-mismatch`, exit 1,
 * not_landed, audience + `delegation policy: none` named, question still open.
 */
import { describe, expect, test } from "bun:test";
import { BLOCKER_AUDIENCES } from "../../packages/core/src/contracts/index";
import { createBlockersHarness } from "../fixtures/blockers/harness";
import { coordinatorOwnerAllowed } from "../fixtures/blockers/policy";
import { makeQuestion } from "../fixtures/blockers/records";

const ownerQuestion = () =>
  makeQuestion({
    id: "q-9043",
    type: "decision-needed",
    audience: "owner",
    lane: "L2",
    options: ["full", "lite"],
  });

describe("TC-BLK-021 audience closed set and default", () => {
  test("explicit and default audiences are recorded and rendered", async () => {
    const harness = createBlockersHarness();
    try {
      const owner = await harness.run([
        "publish",
        "spec-ambiguity",
        "--lane",
        "L2",
        "--audience",
        "owner",
        "owner question",
      ]);
      expect((owner.data?.question as Record<string, unknown> | undefined)?.audience).toBe("owner");
      const coordinator = await harness.run([
        "publish",
        "external-wait",
        "--lane",
        "L3",
        "--audience",
        "coordinator",
        "coordinator question",
      ]);
      expect((coordinator.data?.question as Record<string, unknown> | undefined)?.audience).toBe(
        "coordinator",
      );
      const defaulted = await harness.run(["publish", "spec-ambiguity", "--lane", "L2", "default"]);
      expect((defaulted.data?.question as Record<string, unknown> | undefined)?.audience).toBe(
        "coordinator",
      );
      const list = await harness.run(["list"]);
      const questions = list.data?.questions as Record<string, unknown>[] | undefined;
      for (const question of questions ?? []) {
        expect(BLOCKER_AUDIENCES).toContain(question.audience as string);
      }
      const human = await harness.run(["list"], { json: false });
      expect(human.stdout).toContain("audience=owner");
      expect(human.stdout).toContain("audience=coordinator");
    } finally {
      harness.cleanup();
    }
  });

  test("invalid explicit audiences are refused with zero bytes", async () => {
    const harness = createBlockersHarness();
    try {
      for (const audience of ["Owner", "human", ""]) {
        const before = harness.ledgerBytes();
        const run = await harness.run([
          "publish",
          "spec-ambiguity",
          "--lane",
          "L2",
          "--audience",
          audience,
          "q",
        ]);
        expect(run.exitCode, audience).toBe(1);
        expect(run.envelope?.error, audience).toMatchObject({ code: "input.value.rejected" });
        expect(harness.ledgerBytes().equals(before)).toBe(true);
      }
      expect(harness.read().verifiedEmpty).toBe(true);
      expect(BLOCKER_AUDIENCES).toHaveLength(2);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-BLK-022 SC-M1-24 cross-audience refusal pinned exactly", () => {
  test("coordinator answering an owner question is refused with the policy named", async () => {
    const harness = createBlockersHarness({
      callerAudienceFact: "coordinator",
      seedQuestions: [ownerQuestion()],
    });
    try {
      const before = harness.ledgerBytes();
      const run = await harness.run(["answer", "q-9043", "--choice", "1"]);
      expect(run.exitCode).toBe(1);
      expect(run.data).toBeUndefined();
      const error = run.envelope?.error as Record<string, unknown>;
      expect(error).toMatchObject({
        code: "blockers.audience-mismatch",
        category: "user",
        retryable: false,
        consequence: "not_landed",
      });
      const hint = String(error.remediationHint);
      expect(hint).toContain("owner");
      expect(hint).toContain("delegation policy: none");
      expect(String(error.summary)).toContain("q-9043");
      expect(harness.ledgerBytes().equals(before)).toBe(true);
      expect(harness.read().answers).toHaveLength(0);
      expect(harness.session.calls).toEqual([]);

      const open = await harness.run(["list", "--open"]);
      const openQuestions = open.data?.questions as Record<string, unknown>[];
      expect(openQuestions).toHaveLength(1);
      expect(openQuestions[0]).toMatchObject({ id: "q-9043", status: "open", rank: 1 });
      const all = await harness.run(["list"]);
      const allQuestions = all.data?.questions as Record<string, unknown>[] | undefined;
      expect(allQuestions?.[0]?.status).toBe("open");
    } finally {
      harness.cleanup();
    }
  });

  test("the same question answered by an owner succeeds", async () => {
    const harness = createBlockersHarness({
      callerAudienceFact: "owner",
      seedQuestions: [ownerQuestion()],
    });
    try {
      const run = await harness.run(["answer", "q-9043", "--choice", "1"]);
      expect(run.exitCode).toBe(0);
      expect(run.data).toMatchObject({ answered: "q-9043", audience: "owner", choice: "full" });
      expect(harness.read().answers).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });

  test("a policy copy that delegates coordinator->owner succeeds", async () => {
    const harness = createBlockersHarness({
      callerAudienceFact: "coordinator",
      delegationPolicy: coordinatorOwnerAllowed(),
      seedQuestions: [ownerQuestion()],
    });
    try {
      const run = await harness.run(["answer", "q-9043", "--choice", "1"]);
      expect(run.exitCode).toBe(0);
      expect(run.data).toMatchObject({ audience: "coordinator", choice: "full" });
    } finally {
      harness.cleanup();
    }
  });

  test("an owner-audience question answered by owner never triggers a mismatch", async () => {
    const harness = createBlockersHarness({
      callerAudienceFact: "owner",
      seedQuestions: [ownerQuestion()],
    });
    try {
      const run = await harness.run(["answer", "q-9043", "--choice", "2"]);
      expect(run.exitCode).toBe(0);
      expect(harness.read().answers[0]).toMatchObject({
        questionId: "q-9043",
        answeringAudience: "owner",
        choice: "lite",
      });
    } finally {
      harness.cleanup();
    }
  });
});
