/**
 * TC-COORD-056 — the restart bound is configuration-driven: budget `0` admits
 * no restart and escalates, and the value is observed at evaluation time.
 */
import { describe, expect, test } from "bun:test";
import { resolveConfig, resolveCoordinatorSettings } from "../../packages/core/src/index";
import { evaluateCoordinatorRestartAdmission } from "../../packages/core/src/domain/index";
import { coordinatorSource } from "../fixtures/config/coordinator";
import { EPOCH_ID, restartRecord } from "../fixtures/coordinator/states";

const boundFor = (restartBudget: number): number => {
  const resolved = resolveConfig({
    sources: [coordinatorSource({ "restart-budget": restartBudget })],
  });
  if (!resolved.ok) throw new Error(`config failed: ${resolved.error.code}`);
  const coordinator = resolveCoordinatorSettings(resolved.value.values, resolved.value.origins);
  if (!coordinator.ok) throw new Error(`settings failed: ${coordinator.error.code}`);
  return coordinator.value.restartBudget;
};

describe("TC-COORD-056 the restart bound is configuration-driven", () => {
  test("budget 0 admits no restart and therefore escalates", () => {
    const bound = boundFor(0);
    expect(bound).toBe(0);
    const admission = evaluateCoordinatorRestartAdmission({
      records: [],
      budgetEpochId: EPOCH_ID,
      bound,
    });
    expect(admission.state).toBe("refuse");
    if (admission.state === "refuse") {
      expect(admission.count).toBe(0);
      expect(admission.bound).toBe(0);
    }
  });

  test("budget 1 admits exactly one restart and then refuses", () => {
    const bound = boundFor(1);
    expect(bound).toBe(1);
    const first = evaluateCoordinatorRestartAdmission({
      records: [],
      budgetEpochId: EPOCH_ID,
      bound,
    });
    expect(first.state).toBe("admit");
    const second = evaluateCoordinatorRestartAdmission({
      records: [restartRecord({ ordinal: 1 })],
      budgetEpochId: EPOCH_ID,
      bound,
    });
    expect(second.state).toBe("refuse");
  });

  test("budget 10 admits the ninth restart and refuses the tenth", () => {
    const bound = boundFor(10);
    const nine = Array.from({ length: 9 }, (_value, index) => ({
      ...restartRecord(),
      ordinal: index + 1,
      restartId: `coordinator-main#${EPOCH_ID}#${index + 1}`,
    }));
    const below = evaluateCoordinatorRestartAdmission({
      records: nine,
      budgetEpochId: EPOCH_ID,
      bound,
    });
    expect(below.state).toBe("admit");
    if (below.state === "admit") expect(below.nextOrdinal).toBe(10);
    const ten = Array.from({ length: 10 }, (_value, index) => ({
      ...restartRecord(),
      ordinal: index + 1,
      restartId: `coordinator-main#${EPOCH_ID}#${index + 1}`,
    }));
    expect(
      evaluateCoordinatorRestartAdmission({ records: ten, budgetEpochId: EPOCH_ID, bound }).state,
    ).toBe("refuse");
  });

  test("the bound is observed at evaluation time, never cached in a record", () => {
    const records = [
      restartRecord({ ordinal: 1 }),
      restartRecord({ ordinal: 2, restartId: "coordinator-main#epoch-1#2" }),
    ];
    for (const bound of [2, 3, 10]) {
      const admission = evaluateCoordinatorRestartAdmission({
        records,
        budgetEpochId: EPOCH_ID,
        bound,
      });
      expect(admission.state).toBe(bound > 2 ? "admit" : "refuse");
      expect(admission.bound).toBe(bound);
      expect(admission.count).toBe(2);
    }
  });
});
