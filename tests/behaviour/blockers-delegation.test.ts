/**
 * TC-BLK-023 — the delegation policy-as-data exception: the shipped map lets an
 * owner answer a coordinator question, refuses coordinator->owner, and a deep
 * copy that delegates changes the outcome. Authority is never invented.
 */
import { describe, expect, test } from "bun:test";
import { BLOCKER_DELEGATION_POLICY_ROWS } from "../../packages/core/src/contracts/index";
import { resolveBlockerDelegation } from "../../packages/core/src/domain/blockers";
import { createBlockersHarness } from "../fixtures/blockers/harness";
import {
  coordinatorOwnerAllowed,
  missingCoordinatorOwner,
  shippedPolicy,
} from "../fixtures/blockers/policy";
import { makeQuestion } from "../fixtures/blockers/records";

const coordinatorQuestion = () =>
  makeQuestion({
    id: "q-c",
    type: "decision-needed",
    audience: "coordinator",
    options: ["full", "lite"],
  });
const ownerQuestion = () =>
  makeQuestion({
    id: "q-o",
    type: "decision-needed",
    audience: "owner",
    options: ["full", "lite"],
  });

describe("TC-BLK-023 policy-as-data delegation", () => {
  test("the shipped map allows an owner to answer a coordinator question", async () => {
    const harness = createBlockersHarness({
      callerAudienceFact: "owner",
      seedQuestions: [coordinatorQuestion()],
    });
    try {
      const run = await harness.run(["answer", "q-c", "--choice", "1"]);
      expect(run.exitCode).toBe(0);
      expect(run.data).toMatchObject({ audience: "owner", choice: "full" });
      expect(harness.read().answers[0]?.answeringAudience).toBe("owner");
    } finally {
      harness.cleanup();
    }
  });

  test("the shipped map refuses a coordinator answering an owner question", async () => {
    const harness = createBlockersHarness({
      callerAudienceFact: "coordinator",
      seedQuestions: [ownerQuestion()],
    });
    try {
      const run = await harness.run(["answer", "q-o", "--choice", "1"]);
      expect(run.exitCode).toBe(1);
      expect(run.envelope?.error).toMatchObject({ code: "blockers.audience-mismatch" });
    } finally {
      harness.cleanup();
    }
  });

  test("a deep copy that delegates coordinator->owner changes the outcome", async () => {
    const harness = createBlockersHarness({
      callerAudienceFact: "coordinator",
      delegationPolicy: coordinatorOwnerAllowed(),
      seedQuestions: [ownerQuestion()],
    });
    try {
      const run = await harness.run(["answer", "q-o", "--choice", "2"]);
      expect(run.exitCode).toBe(0);
      expect(run.data).toMatchObject({ audience: "coordinator", choice: "lite" });
    } finally {
      harness.cleanup();
    }
  });

  test("same-audience answers are allowed under both maps", () => {
    for (const policy of [shippedPolicy(), coordinatorOwnerAllowed()]) {
      expect(resolveBlockerDelegation(policy, "owner", "owner").allowed).toBe(true);
      expect(resolveBlockerDelegation(policy, "coordinator", "coordinator").allowed).toBe(true);
    }
  });

  test("a missing row is a declared refusal, never an implicit allow", () => {
    const decision = resolveBlockerDelegation(missingCoordinatorOwner(), "owner", "coordinator");
    expect(decision).toEqual({ allowed: false, policy: "none", declared: false });
    expect(resolveBlockerDelegation(shippedPolicy(), "owner", "coordinator")).toEqual({
      allowed: false,
      policy: "none",
      declared: true,
    });
  });

  test("the production map is unchanged after the mutation controls", () => {
    const before = JSON.stringify(BLOCKER_DELEGATION_POLICY_ROWS);
    resolveBlockerDelegation(coordinatorOwnerAllowed(), "owner", "coordinator");
    expect(JSON.stringify(BLOCKER_DELEGATION_POLICY_ROWS)).toBe(before);
  });
});
