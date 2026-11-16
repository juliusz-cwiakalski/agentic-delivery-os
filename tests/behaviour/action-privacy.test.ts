/**
 * TC-ACTION-031 — privacy: references, identities, roles, dates, and bounded
 * text only; canary secrets never survive into records, envelopes, or rendered
 * rows; the redaction chokepoint composes on every new path; a clean control is
 * unchanged (NFR-7, §20).
 */
import { describe, expect, test } from "bun:test";
import { conformingDraft } from "../fixtures/action/builders";
import { FILING_MS } from "../fixtures/action/clock";
import { runActionCli } from "../fixtures/action/run";
import { actionSnapshot, fileAction } from "../fixtures/action/seed";
import { makeActionStore } from "../fixtures/action/store";

const CANARY = "planted-action-secret-canary";

describe("TC-ACTION-031 the canary never survives a record or render", () => {
  test("a canary in adjacent fields is redacted from the record and every render", async () => {
    const fixture = makeActionStore("privacy");
    try {
      const argv = [
        "retro",
        "action",
        "file",
        "--owner",
        `agent-role:${CANARY}`,
        "--owner-kind",
        "agent-role",
        "--verb",
        "add",
        "--outcome",
        `the guard rejects ${CANARY}`,
        "--tracker",
        "GH-287",
        "--due",
        "2026-11-30T00:00:00Z",
        "--artifact",
        `artifact:${CANARY}`,
        "--outcome-evidence",
        "metric:rejection-rate",
        "--outcome-window",
        "2026-12-01T00:00:00Z..2026-12-15T00:00:00Z",
        "--rollback",
        `revert ${CANARY}`,
        "--window",
        "window-a",
        "--json",
      ] as const;
      const filed = await runActionCli(argv, fixture.store, { secrets: [CANARY] });
      expect(filed.exitCode).toBe(0);
      expect(filed.stdout).not.toContain(CANARY);

      const records = actionSnapshot(fixture.store).actions;
      expect(records).toHaveLength(1);
      expect(JSON.stringify(records)).not.toContain(CANARY);

      const listed = await runActionCli(["retro", "action", "list", "--json"], fixture.store, {
        secrets: [CANARY],
      });
      expect(listed.stdout).not.toContain(CANARY);
      const human = await runActionCli(["retro", "action", "list"], fixture.store, {
        secrets: [CANARY],
      });
      expect(human.stdout).not.toContain(CANARY);
    } finally {
      fixture.cleanup();
    }
  });

  test("the clean control renders its text unchanged (targeted, not blanket)", async () => {
    const fixture = makeActionStore("privacy-clean");
    try {
      const outcome = "the guard rejects the malformed envelope";
      expect(
        (
          await runActionCli(
            [
              "retro",
              "action",
              "file",
              "--owner-kind",
              "agent-role",
              "--owner",
              "agent-role:reviewer",
              "--verb",
              "add",
              "--outcome",
              outcome,
              "--tracker",
              "GH-287",
              "--due",
              "2026-11-30T00:00:00Z",
              "--artifact",
              "artifact:tests/guard.test.ts",
              "--outcome-evidence",
              "metric:x",
              "--outcome-window",
              "2026-12-01T00:00:00Z..2026-12-15T00:00:00Z",
              "--rollback",
              "revert the guard",
              "--window",
              "window-a",
              "--json",
            ],
            fixture.store,
          )
        ).exitCode,
      ).toBe(0);
      const listed = await runActionCli(["retro", "action", "list", "--json"], fixture.store);
      expect(listed.stdout).toContain(outcome);
      expect(actionSnapshot(fixture.store).actions).toHaveLength(1);
    } finally {
      fixture.cleanup();
    }
  });

  test("records carry references, identities, dates, and bounded text only", () => {
    const fixture = makeActionStore("privacy-shape");
    try {
      expect(fileAction(fixture.store, conformingDraft(), { filedAt: FILING_MS }).ok).toBe(true);
      const [record] = actionSnapshot(fixture.store).actions;
      expect(Object.keys(record ?? {}).sort()).toEqual([
        "actionId",
        "dueDate",
        "dueDateLapses",
        "filedAt",
        "level",
        "measurableOutcome",
        "outcomeVerifier",
        "owner",
        "ownerKind",
        "rollbackCondition",
        "schemaId",
        "trackerCorroboration",
        "trackerEntry",
        "verb",
        "verificationArtifact",
        "window",
      ]);
    } finally {
      fixture.cleanup();
    }
  });
});
