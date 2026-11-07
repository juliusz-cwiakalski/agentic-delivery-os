/**
 * TC-BLK-024 — the answering identity resolves from the branding-named
 * environment fact: exact `owner`/`coordinator` honored, absent/unrecognized
 * defaults to `owner`, claimed-not-proven, and no audit evidence is persisted.
 */
import { describe, expect, test } from "bun:test";
import { callerAudienceVariableName } from "../../packages/core/src/domain/blockers";
import { createBlockersHarness } from "../fixtures/blockers/harness";
import { BRAND_A, BRAND_B } from "../fixtures/blockers/identity";
import { makeQuestion } from "../fixtures/blockers/records";

const ownerQuestion = () =>
  makeQuestion({ id: "q-o", type: "decision-needed", audience: "owner", options: ["a", "b"] });
const coordinatorQuestion = () =>
  makeQuestion({
    id: "q-c",
    type: "decision-needed",
    audience: "coordinator",
    options: ["a", "b"],
  });

const answerQuestion = async (
  fact: string | undefined,
  question: ReturnType<typeof makeQuestion>,
) => {
  const harness = createBlockersHarness({ callerAudienceFact: fact, seedQuestions: [question] });
  try {
    const run = await harness.run(["answer", question.id, "--choice", "1"]);
    return {
      run,
      read: harness.read(),
      ledger: harness.ledgerText(),
      calls: harness.session.calls,
    };
  } finally {
    harness.cleanup();
  }
};

describe("TC-BLK-024 answering identity resolution", () => {
  test("the variable name derives from the brand environment prefix", () => {
    expect(callerAudienceVariableName(BRAND_A)).toBe("EXAMPLE_PRODUCT_CALLER_AUDIENCE");
    expect(callerAudienceVariableName(BRAND_B)).toBe("SECOND_PRODUCT_CALLER_AUDIENCE");
    expect(callerAudienceVariableName(BRAND_A)).not.toBe(callerAudienceVariableName(BRAND_B));
  });

  test("exact coordinator is honored and routes correctly", async () => {
    const owner = await answerQuestion("coordinator", ownerQuestion());
    expect(owner.run.exitCode).toBe(1);
    expect(owner.run.envelope?.error).toMatchObject({ code: "blockers.audience-mismatch" });
    const coordinator = await answerQuestion("coordinator", coordinatorQuestion());
    expect(coordinator.run.exitCode).toBe(0);
    expect(coordinator.run.data?.audience).toBe("coordinator");
  });

  test("exact owner is honored and answers both audiences", async () => {
    const owner = await answerQuestion("owner", ownerQuestion());
    expect(owner.run.exitCode).toBe(0);
    expect(owner.run.data?.audience).toBe("owner");
    const coordinator = await answerQuestion("owner", coordinatorQuestion());
    expect(coordinator.run.exitCode).toBe(0);
    expect(coordinator.run.data?.audience).toBe("owner");
  });

  test("absent and unrecognized facts default to owner, never elevated", async () => {
    for (const fact of [undefined, "", "Coordinator", "admin"]) {
      const result = await answerQuestion(fact, ownerQuestion());
      expect(result.run.exitCode, String(fact)).toBe(0);
      expect(result.run.data?.audience, String(fact)).toBe("owner");
    }
    for (const fact of [undefined, "", "Coordinator", "admin"]) {
      const result = await answerQuestion(fact, coordinatorQuestion());
      expect(result.run.exitCode, String(fact)).toBe(0);
      expect(result.run.data?.audience, String(fact)).toBe("owner");
    }
  });

  test("only the resolved audience is persisted; no raw variable or audit record exists", async () => {
    const result = await answerQuestion("coordinator", coordinatorQuestion());
    expect(result.run.exitCode).toBe(0);
    expect(result.read.answers).toHaveLength(1);
    expect(result.read.answers[0]?.answeringAudience).toBe("coordinator");
    expect(result.ledger).not.toContain("CALLER_AUDIENCE");
    expect(result.ledger).not.toContain("EXAMPLE_PRODUCT_");
    expect(result.calls).toEqual([]);
  });

  test("changing the fact between runs changes the routing decision (live control)", async () => {
    const asOwner = await answerQuestion("owner", ownerQuestion());
    expect(asOwner.run.exitCode).toBe(0);
    const asCoordinator = await answerQuestion("coordinator", ownerQuestion());
    expect(asCoordinator.run.exitCode).toBe(1);
    expect(asCoordinator.read.answers).toHaveLength(0);
  });
});
