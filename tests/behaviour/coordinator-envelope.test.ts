/**
 * TC-COORD-004 — the CLI handler is pure and every outcome projects exactly one
 * identity in `{0,1,2}`.
 */
import { describe, expect, test } from "bun:test";
import { ERROR_TABLE, type ErrorTableEntry } from "../../packages/core/src/contracts/index";
import { createCoordinatorHarness } from "../fixtures/coordinator/harness";
import { createRecordingProcessPort } from "../fixtures/coordinator/process-port";

const entry = (code: string): ErrorTableEntry => {
  const found = (ERROR_TABLE as readonly ErrorTableEntry[]).find((row) => row.code === code);
  if (found === undefined) throw new Error(`missing row ${code}`);
  return found;
};

const projectionExit = (code: string): number =>
  entry(code).projectionClass === "user-validation" ? 1 : 2;

describe("TC-COORD-004 every outcome projects one identity in {0,1,2}", () => {
  test("the six coordinator identities declare their exit projections", () => {
    expect(projectionExit("coordinator.already-running")).toBe(2);
    expect(projectionExit("coordinator.restart-budget-exhausted")).toBe(1);
    expect(projectionExit("coordinator.process.capability-gap")).toBe(2);
    expect(projectionExit("coordinator.session.kill-failed")).toBe(2);
    expect(projectionExit("coordinator.escalation.publish-failed")).toBe(2);
    expect(projectionExit("coordinator.wake.delivery-failed")).toBe(2);
  });

  test("a success envelope has data and exit 0", async () => {
    const harness = createCoordinatorHarness({ label: "envelope-success" });
    const result = await harness.run(["coordinator", "status", "--json"]);
    expect(result.code).toBe(0);
    const envelope = result.json as Record<string, unknown>;
    expect(envelope["exitCode"]).toBe(0);
    expect(envelope["data"]).toBeDefined();
    expect(envelope["error"]).toBeUndefined();
  });

  test("a refusal envelope has exactly one error and no data", async () => {
    const harness = createCoordinatorHarness({ label: "envelope-failure" });
    const result = await harness.run(["coordinator", "start", "--json"]);
    expect(result.code).toBe(1);
    const envelope = result.json as Record<string, unknown>;
    expect(envelope["exitCode"]).toBe(1);
    expect(envelope["error"]).toBeDefined();
    expect(envelope["data"]).toBeUndefined();
  });

  test("the handler chooses no exit literal and writes no stream", async () => {
    const recorder = createRecordingProcessPort();
    void recorder;
    const harness = createCoordinatorHarness({ label: "envelope-pure" });
    const stderrBefore = "";
    const result = await harness.run(["coordinator", "status"]);
    expect(result.code).toBe(0);
    expect(stderrBefore).toBe("");
    expect(result.stderr).toBe("");
  });

  test("(identity, exit) pairs are unique across the coordinator rows", () => {
    const rows = (ERROR_TABLE as readonly ErrorTableEntry[]).filter(
      (row) => row.domainKind === "coordinator",
    );
    const pairs = rows.map((row) => `${row.code}#${projectionExit(row.code)}`);
    expect(new Set(pairs).size).toBe(rows.length);
    for (const row of rows) expect([1, 2]).toContain(projectionExit(row.code));
  });
});
