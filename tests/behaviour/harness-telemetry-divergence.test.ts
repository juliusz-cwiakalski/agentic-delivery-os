/**
 * TC-HARNESS-021 (group-scoping half) — a stated observed agent that differs
 * from the binding's agent carries no seat, warns on both axes as applicable, and
 * no binding crosses to another group (DM-5, T-05/T-06).
 */
import { describe, expect, test } from "bun:test";
import { ROOT_BINDING, extractOpencode } from "../fixtures/harness/telemetry-attempts";
import {
  CHILD_AGENT,
  ROOT_SESSION,
  buildOpencodeStore,
} from "../fixtures/harness/opencode-store/build";

describe("TC-HARNESS-021 group scoping and agent divergence", () => {
  test("a second group in one session carries its own agent, no seat, and the divergence warning", () => {
    const store = buildOpencodeStore({ variant: "multi-group" });
    const captured = extractOpencode({
      store,
      heldSessionIds: [ROOT_SESSION],
      bindings: { [ROOT_SESSION]: ROOT_BINDING },
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const rows = captured.value.records.filter((row) => row.sessionId === ROOT_SESSION);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const bound = rows.find((row) => row.agent === ROOT_BINDING.agent);
    const other = rows.find((row) => row.agent === CHILD_AGENT);
    expect(bound?.seat).toBe(ROOT_BINDING.seat);
    expect(other?.seat).toBeNull();
    expect(other?.warnings.some((warning) => warning.reason === "agent-divergence")).toBe(true);
    expect(other?.warnings.some((warning) => warning.reason === "unresolved-seat")).toBe(true);
    // Both values are kept: the group's own agent and model are never overwritten.
    expect(other?.agent).toBe(CHILD_AGENT);
    expect(other?.model.length).toBeGreaterThan(0);
  });

  test("the bound group carries no divergence warning (control)", () => {
    const store = buildOpencodeStore({ variant: "multi-group" });
    const captured = extractOpencode({
      store,
      heldSessionIds: [ROOT_SESSION],
      bindings: { [ROOT_SESSION]: ROOT_BINDING },
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const bound = captured.value.records.find(
      (row) => row.sessionId === ROOT_SESSION && row.agent === ROOT_BINDING.agent,
    );
    expect(bound?.warnings.some((warning) => warning.reason === "agent-divergence")).toBe(false);
  });
});
