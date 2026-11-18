/**
 * TC-HARNESS-044 — the mandatory-usage boundary (OQ-8, AC-F5-5, AC-F6-2).
 *
 * The mandatory set is the session identity plus at least one observable usage
 * fact. A held session the store holds without one is a failed-session entry
 * with the closed reason; a session with a usage fact lands even when an
 * identity axis is unstated.
 */
import { describe, expect, test } from "bun:test";
import { HARNESS_MANDATORY_USAGE_FACTS } from "../../packages/core/src/contracts/index";
import { extractOpencode } from "../fixtures/harness/telemetry-attempts";
import { ROOT_SESSION, buildOpencodeStore } from "../fixtures/harness/opencode-store/build";

describe("TC-HARNESS-044 mandatory usage", () => {
  test("the declared mandatory set is the session identity plus one usage fact", () => {
    expect([...HARNESS_MANDATORY_USAGE_FACTS]).toEqual(["token", "cost"]);
  });

  test("a held session with no token and no cost becomes one failed-session entry", () => {
    const store = buildOpencodeStore({ variant: "empty-session" });
    const captured = extractOpencode({ store, heldSessionIds: ["ses_empty"] });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    expect(captured.value.failedSessions).toHaveLength(1);
    expect(captured.value.failedSessions[0]?.reason).toBe("no-usage-fact");
  });

  test("a session with a token fact lands even when the agent axis is unstated", () => {
    const store = buildOpencodeStore({ variant: "unstated-agent" });
    const captured = extractOpencode({ store, heldSessionIds: [ROOT_SESSION] });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const root = captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
    expect(root).toBeDefined();
    expect(root?.tokens.input).toBeGreaterThan(0);
    expect(captured.value.failedSessions.some((entry) => entry.sessionId === ROOT_SESSION)).toBe(
      false,
    );
  });
});
