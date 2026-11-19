/**
 * TC-HARNESS-021 / TC-HARNESS-020 — version, cost, and divergence drift: both
 * values kept, absence explicit, a reported zero preserved, no overwrite.
 */
import { describe, expect, test } from "bun:test";
import { ROOT_BINDING, extractOpencode } from "../fixtures/harness/telemetry-attempts";
import {
  ROOT_MODEL_ID,
  ROOT_SESSION,
  buildOpencodeStore,
} from "../fixtures/harness/opencode-store/build";

describe("TC-HARNESS-021 drift is disclosed, never reconciled by overwriting", () => {
  test("a stored version that differs from the probed one warns and keeps both", () => {
    const store = buildOpencodeStore({ variant: "version-drift" });
    const captured = extractOpencode({
      store,
      heldSessionIds: [ROOT_SESSION],
      pinnedVersion: "2.3.2",
      bindings: { [ROOT_SESSION]: ROOT_BINDING },
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const root = captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
    expect(root?.harnessVersion).toBe("2.2.5");
    expect(root?.warnings.some((warning) => warning.reason === "version-drift")).toBe(true);
  });

  test("an agreeing version carries no divergence warning (control)", () => {
    const store = buildOpencodeStore();
    const captured = extractOpencode({
      store,
      heldSessionIds: [ROOT_SESSION],
      pinnedVersion: "2.2.5",
      bindings: { [ROOT_SESSION]: ROOT_BINDING },
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const root = captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
    expect(root?.warnings.some((warning) => warning.reason === "version-drift")).toBe(false);
  });

  test("a missing version is explicit absence with the same-axis warning", () => {
    const store = buildOpencodeStore({ variant: "missing-version" });
    const captured = extractOpencode({ store, heldSessionIds: [ROOT_SESSION] });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const root = captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
    expect(root?.harnessVersion).toBeNull();
    expect(
      root?.warnings.some(
        (warning) =>
          warning.reason === "optional-field-absent" && warning.field === "harnessVersion",
      ),
    ).toBe(true);
  });

  test("a resolved model that differs from the observed one warns and keeps both", () => {
    const store = buildOpencodeStore();
    const captured = extractOpencode({
      store,
      heldSessionIds: [ROOT_SESSION],
      bindings: {
        [ROOT_SESSION]: { ...ROOT_BINDING, resolvedModel: "synthetic/other-model#v" },
      },
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const root = captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
    expect(root?.model).toBe(ROOT_MODEL_ID);
    expect(root?.resolvedModel).toBe("synthetic/other-model#v");
    expect(root?.warnings.some((warning) => warning.reason === "model-divergence")).toBe(true);
  });

  test("agreement carries no divergence warning (control)", () => {
    const store = buildOpencodeStore();
    const captured = extractOpencode({
      store,
      heldSessionIds: [ROOT_SESSION],
      bindings: { [ROOT_SESSION]: ROOT_BINDING },
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const root = captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
    expect(root?.warnings.some((warning) => warning.reason === "model-divergence")).toBe(false);
    expect(root?.warnings.some((warning) => warning.reason === "agent-divergence")).toBe(false);
  });
});
