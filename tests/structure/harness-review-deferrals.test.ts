/**
 * TC-CAP-049 — GH-233 F-9 is explicitly re-deferred with its production
 * consumer reason; the host runner gains no closeout-path consumer.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { HARNESS_REVIEW_DEFERRALS } from "../../packages/adapters/src/harness/index";

const CLOSEOUT_PATH = [
  "packages/cli/src/edge.ts",
  "packages/cli/src/commands/closeout.ts",
  "packages/core/src/domain/closeout.ts",
  "packages/adapters/src/harness/telemetry-claude.ts",
  "packages/adapters/src/harness/telemetry-opencode.ts",
] as const;

describe("TC-CAP-049 harness review deferrals", () => {
  test("F-8 and F-11 are recorded as resolved and F-9 as re-deferred", () => {
    const byFinding = new Map(HARNESS_REVIEW_DEFERRALS.map((entry) => [entry.finding, entry]));
    expect(byFinding.get("F-8")?.status).toBe("resolved");
    expect(byFinding.get("F-11")?.status).toBe("resolved");
    const f9 = byFinding.get("F-9");
    expect(f9?.status).toBe("re-deferred");
    expect(f9?.reason).toContain("not on the closeout extraction path");
    expect(f9?.reason).toContain("dispatch (M1-S9)");
    expect(f9?.ownerStory).toBe("M1-S9");
    expect(f9?.revisitTrigger.length).toBeGreaterThan(0);
  });

  test("no closeout-path module imports the host runner", () => {
    for (const file of CLOSEOUT_PATH) {
      const source = readFileSync(file, "utf8");
      expect(source.includes("./claude.js"), file).toBe(false);
      expect(source.includes("./opencode.js"), file).toBe(false);
      expect(source.includes("createClaudeHarness"), file).toBe(false);
      expect(source.includes("createOpencodeHarness"), file).toBe(false);
    }
  });

  test("the delivered host-runner defects are unchanged characterizations", () => {
    const host = readFileSync("packages/adapters/src/host/index.ts", "utf8");
    expect(host.includes('signal === "SIGTERM"')).toBe(true);
    expect(host.includes("stdout.length + chunk.length")).toBe(true);
    const stderrBranch = host.slice(
      host.indexOf("child.stderr?.on"),
      host.indexOf('child.on("error"'),
    );
    expect(stderrBranch.includes("[output truncated]")).toBe(false);
  });

  test("no dispatch surface or spawn-failure row was added", () => {
    const table = readFileSync("packages/core/src/contracts/error-table.ts", "utf8");
    expect(table.includes("dispatch.session.spawn-failed")).toBe(false);
    expect(table.includes('code: "dispatch.session')).toBe(false);
  });

  test("the change record references the F-9 re-deferral", () => {
    const notes = readFileSync(
      "doc/changes/2026-11/2026-11-07--GH-240--capsule-closeout/chg-GH-240-pm-notes.yaml",
      "utf8",
    );
    expect(notes.includes("F-9")).toBe(true);
    expect(notes.includes("re-deferred")).toBe(true);
  });

  test("the deferral disappears or silently resolves as fixed would fail the record", () => {
    const f9 = HARNESS_REVIEW_DEFERRALS.find((entry) => entry.finding === "F-9");
    expect(f9).toBeDefined();
    expect(f9?.status).not.toBe("resolved");
    expect(f9?.reason).not.toContain("fixed");
  });
});
