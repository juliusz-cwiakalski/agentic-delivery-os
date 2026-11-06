/**
 * TC-RETRO-058 / TC-RETRO-059 — the level refusal matrix, owning-story hints,
 * zero I/O on refusal, the omitted-level default, and the locked surface.
 */
import { describe, expect, test } from "bun:test";
import { ERROR_TABLE, type ErrorTableEntry } from "../../packages/core/src/contracts/index";
import {
  auditOutcome,
  auditRecord,
  makeRetroDir,
  runRetro,
  transitionRecord,
} from "../fixtures/retro/harness";

const codeOf = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
};

const seedCollected = async (label: string) => {
  const fixture = makeRetroDir(label);
  fixture.scriptDeliveryChanges([
    {
      changeRef: "GH-232",
      completedAt: "2026-11-06T12:00:00Z",
      transitions: [transitionRecord({ changeRef: "GH-232", timestamp: "2026-11-06T12:00:00Z" })],
    },
  ]);
  fixture.scriptAudit(auditOutcome({ records: [auditRecord()] }));
  fixture.scriptStateFamilies("GH-232", {
    transitions: [transitionRecord({ changeRef: "GH-232" })],
    closeouts: [{ outcome: "complete" }],
    telemetry: [],
  });
  fixture.scriptNotes("GH-232", { retroNotes: ["note"] });
  return { fixture };
};

describe("TC-RETRO-058 level refusal matrix", () => {
  test("every declared-only level refuses with input.value.rejected and its owning story", async () => {
    for (const level of ["session", "incident", "window", "project", "fleet"] as const) {
      const fixture = makeRetroDir(`level-${level}`);
      const result = await runRetro(["retro", "collect", "--level", level, "--json"], fixture);
      expect(result.exitCode).toBe(1);
      expect(codeOf(result.error)).toBe("input.value.rejected");
      expect(result.stderr).toContain("owning story");
      expect(fixture.auditQueries).toEqual([]);
      expect(fixture.stateFamilyReads).toEqual([]);
      expect(fixture.noteReads).toEqual([]);
    }
  });

  test("an unknown or case-mismatched level refuses and performs no I/O", async () => {
    for (const level of ["quarter", "Change"]) {
      const fixture = makeRetroDir("level-unknown");
      const result = await runRetro(["retro", "collect", "--level", level, "--json"], fixture);
      expect(result.exitCode).toBe(1);
      expect(codeOf(result.error)).toBe("input.value.rejected");
      expect(fixture.auditQueries).toEqual([]);
    }
  });

  test("missing value and extra positional refuse; --ref is fallback.invocation", async () => {
    const missing = await runRetro(
      ["retro", "collect", "--level", "--json"],
      makeRetroDir("level-missing"),
    );
    expect(missing.exitCode).toBe(1);
    expect(codeOf(missing.error)).toBe("input.value.rejected");

    const extra = await runRetro(
      ["retro", "collect", "--level", "change", "extra", "--json"],
      makeRetroDir("level-extra"),
    );
    expect(extra.exitCode).toBe(1);
    expect(codeOf(extra.error)).toBe("input.value.rejected");

    const ref = await runRetro(
      ["retro", "collect", "--ref", "GH-232", "--json"],
      makeRetroDir("level-ref"),
    );
    expect(ref.exitCode).toBe(1);
    expect(codeOf(ref.error)).toBe("fallback.invocation");
  });

  test("no subcommand and an unknown subcommand refuse", async () => {
    const missing = await runRetro(["retro", "--json"], makeRetroDir("level-no-subcommand"));
    expect(missing.exitCode).toBe(1);
    expect(codeOf(missing.error)).toBe("input.value.rejected");
    const unknown = await runRetro(
      ["retro", "inspect", "--json"],
      makeRetroDir("level-unknown-subcommand"),
    );
    expect(unknown.exitCode).toBe(1);
    expect(codeOf(unknown.error)).toBe("input.value.rejected");
  });

  test("the change control succeeds and no export verb exists", async () => {
    const { fixture } = await seedCollected("level-change");
    const result = await runRetro(["retro", "collect", "--level", "change", "--json"], fixture);
    expect(result.exitCode).toBe(0);
    expect(result.data).toMatchObject({ level: "change", outcome: "collected" });

    const exportAttempt = await runRetro(
      ["retro", "export", "--json"],
      makeRetroDir("level-export"),
    );
    expect(exportAttempt.exitCode).toBe(1);
    expect(codeOf(exportAttempt.error)).toBe("input.value.rejected");
    const table = ERROR_TABLE as readonly ErrorTableEntry[];
    expect(table.some((entry) => entry.code.includes("export"))).toBe(false);
  });
});

describe("TC-RETRO-059 omitted level defaults to change and the locked surface holds", () => {
  test("collect and report both default to change; explicit --level change is equivalent", async () => {
    const first = await seedCollected("level-default");
    const omitted = await runRetro(["retro", "collect", "--json"], first.fixture);
    expect(omitted.exitCode).toBe(0);
    if (omitted.data !== undefined) {
      expect(omitted.data).toMatchObject({ level: "change" });
    }
    const reportOmitted = await runRetro(["retro", "report", "--json"], first.fixture);
    expect(reportOmitted.exitCode).toBe(0);
    if (reportOmitted.data !== undefined) {
      expect(reportOmitted.data).toMatchObject({ level: "change" });
    }

    const second = await seedCollected("level-explicit");
    const explicit = await runRetro(
      ["retro", "collect", "--level", "change", "--json"],
      second.fixture,
    );
    expect(explicit.exitCode).toBe(0);
  });

  test("--json is accepted globally and --ref is not on the locked surface", async () => {
    const { fixture } = await seedCollected("level-json");
    const stated = await runRetro(["retro", "report", "--level", "change", "--json"], fixture);
    expect(stated.exitCode).toBe(0);
    const envelope = JSON.parse(stated.stdout) as Record<string, unknown>;
    expect(Object.keys(envelope).sort()).toEqual(["data"]);
  });
});
