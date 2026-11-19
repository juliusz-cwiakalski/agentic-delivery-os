/**
 * TC-HARNESS-025 — the declared caps, the counted truncation marks, and the
 * bounded read discipline (NFR-3, T-10, T-11).
 */
import { describe, expect, test } from "bun:test";
import {
  HARNESS_MAX_AGENTS,
  HARNESS_MAX_MODELS,
  HARNESS_MAX_SESSIONS,
} from "../../packages/core/src/contracts/index";
import { extractOpencode } from "../fixtures/harness/telemetry-attempts";
import { buildCappedStore, buildOpencodeStore } from "../fixtures/harness/opencode-store/build";

describe("TC-HARNESS-025 bounds", () => {
  test("the caps are the delivered 64/16/16", () => {
    expect(HARNESS_MAX_SESSIONS).toBe(64);
    expect(HARNESS_MAX_AGENTS).toBe(16);
    expect(HARNESS_MAX_MODELS).toBe(16);
  });

  test("a union over the session cap truncates with the counted omission", () => {
    const store = buildCappedStore();
    const held = store.sessionIds.slice(0, HARNESS_MAX_SESSIONS + 4);
    const captured = extractOpencode({ store, heldSessionIds: held });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    expect(captured.value.sessionTruncation).toEqual({
      truncated: true,
      omitted: 4,
      cap: HARNESS_MAX_SESSIONS,
    });
  });

  test("a session over the group cap truncates with a counted warning, never a silent drop", () => {
    const store = buildOpencodeStore({ rootGroups: 17 });
    const captured = extractOpencode({ store });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const truncation = captured.value.warnings.find((warning) => warning.reason === "truncated");
    expect(truncation?.field).toContain(`cap=${String(16)}`);
  });

  test("an under-cap capture carries no truncation mark (control)", () => {
    const store = buildOpencodeStore();
    const captured = extractOpencode({ store });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    expect(captured.value.sessionTruncation).toBeUndefined();
    expect(captured.value.agentTruncation).toBeUndefined();
    expect(captured.value.modelTruncation).toBeUndefined();
  });
});
