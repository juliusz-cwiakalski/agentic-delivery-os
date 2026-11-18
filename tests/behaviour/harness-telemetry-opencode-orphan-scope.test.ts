/**
 * TC-HARNESS-043 (scope half) / DM-8 — attribution is the held identities the
 * work item records, never a work-item column, a title, or a store-wide scan.
 */
import { describe, expect, test } from "bun:test";
import { extractOpencode, ROOT_BINDING } from "../fixtures/harness/telemetry-attempts";
import {
  OTHER_SESSION,
  ROOT_SESSION,
  buildOpencodeStore,
} from "../fixtures/harness/opencode-store/build";

describe("TC-HARNESS-043 held-identity scope", () => {
  test("only the held identity's tree is read; an unrelated root is never touched", () => {
    const store = buildOpencodeStore({ variant: "unrelated" });
    const captured = extractOpencode({
      store,
      heldSessionIds: [ROOT_SESSION],
      bindings: { [ROOT_SESSION]: ROOT_BINDING },
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    expect(captured.value.records.some((row) => row.sessionId === OTHER_SESSION)).toBe(false);
    expect(captured.value.records.some((row) => row.sessionId === ROOT_SESSION)).toBe(true);
  });

  test("a held identity the store does not hold is an absence, not a failure", () => {
    const store = buildOpencodeStore();
    const captured = extractOpencode({ store, heldSessionIds: ["ses_never_recorded"] });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    expect(captured.value.records).toHaveLength(0);
    expect(captured.value.failedSessions).toHaveLength(0);
    expect(captured.value.absences).toEqual([
      { sessionId: "ses_never_recorded", reason: "session-not-in-store" },
    ]);
  });

  test("an empty union captures zero rows without reading the store for sessions", () => {
    const store = buildOpencodeStore();
    const captured = extractOpencode({ store, heldSessionIds: [] });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    expect(captured.value.records).toHaveLength(0);
    expect(captured.value.absences).toBeUndefined();
    expect(captured.value.unattributedAttempts).toBeUndefined();
  });
});
