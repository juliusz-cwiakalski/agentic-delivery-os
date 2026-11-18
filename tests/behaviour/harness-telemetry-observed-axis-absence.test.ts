/**
 * TC-HARNESS-047 — observed-axis absence (AC-F5-7, AC-F5-1, NFR-6).
 *
 * An unstated agent, model, or both: the row LANDS, the marker names exactly the
 * absent axis, the delivered non-null field holds the declared empty-string
 * placeholder, the same-axis `optional-field-absent` warning is emitted,
 * `invalid-session-identity` is not, and an unstated observed agent yields a
 * null seat with `unresolved-seat`.
 */
import { describe, expect, test } from "bun:test";
import {
  HARNESS_OBSERVED_ABSENCE_PLACEHOLDER,
  HARNESS_UNRESOLVED_SEAT_REASON,
} from "../../packages/core/src/contracts/index";
import { ROOT_BINDING, extractOpencode } from "../fixtures/harness/telemetry-attempts";
import {
  ROOT_SESSION,
  buildOpencodeStore,
  type StoreVariant,
} from "../fixtures/harness/opencode-store/build";

const rootRowOf = (variant: StoreVariant) => {
  const store = buildOpencodeStore({ variant });
  const captured = extractOpencode({
    store,
    heldSessionIds: [ROOT_SESSION],
    bindings: { [ROOT_SESSION]: ROOT_BINDING },
  });
  expect(captured.ok).toBe(true);
  if (!captured.ok) return undefined;
  return captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
};

describe("TC-HARNESS-047 an unstated observed axis still lands", () => {
  test("an unstated agent lands with the agent marker and the placeholder", () => {
    const row = rootRowOf("unstated-agent");
    expect(row).toBeDefined();
    expect(row?.absentObservedAxes).toEqual(["agent"]);
    expect(row?.agent).toBe(HARNESS_OBSERVED_ABSENCE_PLACEHOLDER);
    expect(typeof row?.agent).toBe("string");
    expect(
      row?.warnings.some(
        (warning) => warning.reason === "optional-field-absent" && warning.field === "agent",
      ),
    ).toBe(true);
    expect(row?.warnings.some((warning) => warning.reason === "invalid-session-identity")).toBe(
      false,
    );
    // An unstated observed agent never asserts the binding's seat.
    expect(row?.seat).toBeNull();
    expect(row?.warnings.some((warning) => warning.reason === HARNESS_UNRESOLVED_SEAT_REASON)).toBe(
      true,
    );
    // The observed model is still reported.
    expect(row?.model.length).toBeGreaterThan(0);
  });

  test("an unstated model lands with the model marker and the placeholder", () => {
    const row = rootRowOf("unstated-model");
    expect(row?.absentObservedAxes).toEqual(["model"]);
    expect(row?.model).toBe(HARNESS_OBSERVED_ABSENCE_PLACEHOLDER);
    expect(
      row?.warnings.some(
        (warning) => warning.reason === "optional-field-absent" && warning.field === "model",
      ),
    ).toBe(true);
    // The stated agent still receives the binding's seat.
    expect(row?.seat).toBe(ROOT_BINDING.seat);
  });

  test("both unstated axes are named together, once each", () => {
    const row = rootRowOf("unstated-both");
    expect(row?.absentObservedAxes).toEqual(["agent", "model"]);
    expect(row?.agent).toBe(HARNESS_OBSERVED_ABSENCE_PLACEHOLDER);
    expect(row?.model).toBe(HARNESS_OBSERVED_ABSENCE_PLACEHOLDER);
    expect(row?.seat).toBeNull();
  });

  test("the complete control carries no marker, no placeholder, and its seat", () => {
    const row = rootRowOf("full");
    expect(row?.absentObservedAxes).toBeUndefined();
    expect(row?.agent).toBe("agent-a");
    expect(row?.model.length).toBeGreaterThan(0);
    expect(row?.seat).toBe(ROOT_BINDING.seat);
    expect(row?.warnings.some((warning) => warning.reason === "optional-field-absent")).toBe(false);
  });
});
