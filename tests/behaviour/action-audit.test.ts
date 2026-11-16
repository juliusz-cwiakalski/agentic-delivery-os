/**
 * TC-ACTION-035 (audit half) — every invocation lands one command-audit record
 * with runId, timing, and claimed identity, and an audit-write failure is a
 * diagnostic that never changes the outcome or exit (§10, NFR-5).
 */
import { describe, expect, test } from "bun:test";
import { conformingDraft } from "../fixtures/action/builders";
import { FILING_MS } from "../fixtures/action/clock";
import { runActionCli } from "../fixtures/action/run";
import { fileAction } from "../fixtures/action/seed";
import { makeActionStore } from "../fixtures/action/store";

type AuditRecord = Parameters<
  NonNullable<import("../../../packages/cli/src/index").CliAuditDependencies["record"]>
>[0];

describe("TC-ACTION-035 one audit record per invocation", () => {
  test("file, close, list, and report each land one audit record", async () => {
    const records: AuditRecord[] = [];
    const audit = {
      scope: "change:GH-287",
      record: (facts: AuditRecord) => {
        records.push(facts);
        return { ok: true as const };
      },
    };
    const fixture = makeActionStore("audit");
    try {
      for (const argv of [
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
          "an outcome",
          "--tracker",
          "GH-287",
          "--due",
          "2026-11-30T00:00:00Z",
          "--artifact",
          "artifact:x",
          "--outcome-evidence",
          "metric:x",
          "--outcome-window",
          "2026-12-01T00:00:00Z..2026-12-15T00:00:00Z",
          "--rollback",
          "revert",
          "--window",
          "window-a",
          "--json",
        ],
        ["retro", "action", "list", "--json"],
        [
          "retro",
          "action",
          "close",
          "--action",
          "action-fixture",
          "--route",
          "done",
          "--decision",
          "d",
          "--artifact",
          "artifact:x",
          "--json",
        ],
        ["retro", "report", "--json"],
      ] as const) {
        const before = records.length;
        const run = await runActionCli(argv, fixture.store, { audit });
        expect(run.exitCode === 0 || run.exitCode === 1, argv.join(" ")).toBe(true);
        expect(records.length - before, argv.join(" ")).toBe(1);
      }
      expect(records.every((record) => typeof record.runId === "string")).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  test("a failing audit writer never changes the outcome or exit", async () => {
    const fixture = makeActionStore("audit-failure");
    try {
      expect(fileAction(fixture.store, conformingDraft(), { filedAt: FILING_MS }).ok).toBe(true);
      const audit = {
        scope: "change:GH-287",
        record: () => ({ ok: false as const, code: "state.write.failed" }),
      };
      const withoutAudit = await runActionCli(["retro", "action", "list", "--json"], fixture.store);
      const withFailingAudit = await runActionCli(
        ["retro", "action", "list", "--json"],
        fixture.store,
        {
          audit,
        },
      );
      expect(withFailingAudit.exitCode).toBe(withoutAudit.exitCode);
      expect(withFailingAudit.stdout).toBe(withoutAudit.stdout);
    } finally {
      fixture.cleanup();
    }
  });
});
