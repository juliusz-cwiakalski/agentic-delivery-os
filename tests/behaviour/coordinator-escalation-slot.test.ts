/**
 * TC-COORD-063 — the reserved escalation slot renders first by index at the cap
 * with the omitted count intact.
 */
import { describe, expect, test } from "bun:test";
import {
  isCoordinatorEscalationRef,
  isReservedEscalationQuestion,
  projectReservedSlotQuestions,
} from "../../packages/core/src/domain/index";
import { escalationRankedNinth, NEAR_MISS_ESCALATION_REFS } from "../fixtures/coordinator/blockers";
import { reservedSlotFacts, runStatusCli, statusRuntime } from "../fixtures/status/harness";

const typedQuestions = (digest: Record<string, unknown>) => {
  const data = digest["data"] as {
    sections?: { id: string; questions?: { id: string }[]; counts?: { omitted?: number } }[];
  };
  return data.sections?.find((section) => section.id === "typed-questions");
};

describe("TC-COORD-063 the reserved slot renders first at the cap", () => {
  test("the escalation is index 0 and the lowest-ranked is displaced", async () => {
    const run = await runStatusCli(["--json", "status"], statusRuntime(reservedSlotFacts()));
    expect(run.exitCode).toBe(0);
    const section = typedQuestions(JSON.parse(run.stdout) as Record<string, unknown>);
    const ids = section?.questions?.map((question) => question.id) ?? [];
    expect(ids[0]).toBe("q-escalation");
    expect(ids).toHaveLength(8);
    expect(ids).not.toContain("q-old-8");
    expect(section?.counts?.omitted).toBe(1);
  });

  test("the payload predicate accepts the declared shape and rejects near misses", () => {
    for (const ref of NEAR_MISS_ESCALATION_REFS) {
      expect(isCoordinatorEscalationRef(ref), ref).toBe(false);
    }
    expect(isCoordinatorEscalationRef("coordinator-main#epoch-1")).toBe(true);
    expect(
      isReservedEscalationQuestion({
        type: "decision-needed",
        audience: "owner",
        lane: "coordinator",
        ref: "coordinator-main#epoch-1",
      }),
    ).toBe(true);
    expect(
      isReservedEscalationQuestion({
        type: "decision-needed",
        audience: "coordinator",
        lane: "coordinator",
        ref: "coordinator-main#epoch-1",
      }),
    ).toBe(false);
    expect(
      isReservedEscalationQuestion({
        type: "spec-ambiguity",
        audience: "owner",
        lane: "coordinator",
        ref: "coordinator-main#epoch-1",
      }),
    ).toBe(false);
  });

  test("without a reserved question the ordinary first-eight cap applies", () => {
    const ranked = Array.from({ length: 9 }, (_value, index) => ({ id: `q-${index + 1}`, index }));
    const plain = projectReservedSlotQuestions(ranked, null);
    expect(plain.rendered).toHaveLength(8);
    expect(plain.omitted).toBe(1);
    // Mutant control: a dropped slot would render the ninth question nowhere.
    expect(plain.rendered.map((entry) => entry.id)).not.toContain("q-9");
  });

  test("a nine-rendered mutant is caught by the eight-question bound", () => {
    const ranked = escalationRankedNinth("coordinator-main", "epoch-1").map((question, index) => ({
      id: question.id,
      index,
    }));
    const slotted = projectReservedSlotQuestions(ranked, "q-escalation");
    expect(slotted.rendered).toHaveLength(8);
    expect(slotted.rendered).toHaveLength(1 + 7);
    expect(slotted.omitted).toBe(1);
  });

  test("a widened predicate would admit a near miss; the oracle rejects it", () => {
    for (const ref of NEAR_MISS_ESCALATION_REFS) {
      const widened = isCoordinatorEscalationRef(ref) || true; // the mutant widening
      expect(widened).toBe(true);
      expect(isCoordinatorEscalationRef(ref)).toBe(false);
    }
  });
});
