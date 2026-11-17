/**
 * TC-SUP-085 — offline isolation: the fixture guard rejects the live workspace
 * and a non-temp root with distinct messages, no network surface is reached, and
 * brand/clock/run id arrive from injection (GH-295 NFR-7).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import { LANE_REF, seedHeartbeat, seedLane } from "../fixtures/supervise/records";
import { guardSupervisionFixtureRoot } from "../fixtures/supervise/temp-git";

const ROOT = process.cwd();

describe("TC-SUP-085 the fixture guard rejects the live workspace and non-temp roots", () => {
  test("the live workspace is refused with its own message", () => {
    expect(() => guardSupervisionFixtureRoot(ROOT)).toThrow(
      "supervision fixture root must not be the live workspace",
    );
  });

  test("a non-temp root is refused with a distinct message", () => {
    expect(() => guardSupervisionFixtureRoot("/opt/supervision-fixture")).toThrow(
      "supervision fixture root must live under the configured temp directory",
    );
  });
});

describe("TC-SUP-085 the battery reaches no network and reads no environment", () => {
  test("a run performs zero network calls", async () => {
    const harness = createSupervisionHarness({ label: "isolation" });
    const originalFetch = globalThis.fetch;
    let networkCalls = 0;
    globalThis.fetch = (() => {
      networkCalls += 1;
      throw new Error("network is not available to the supervision battery");
    }) as typeof globalThis.fetch;
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -120_000 });
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      expect(networkCalls).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
      harness.remove();
    }
  });

  test("the brand and run id come from injection, and no module reads the environment", async () => {
    const harness = createSupervisionHarness({ label: "isolation-injected" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -120_000 });
      const run = await harness.runCli(["supervise", "--json"], { runId: "run-injected-1" });
      expect(run.exitCode).toBe(0);
      expect((JSON.parse(run.stdout) as { runId?: string }).runId).toBe("run-injected-1");
      for (const relative of [
        "packages/core/src/app/supervise.ts",
        "packages/core/src/domain/supervise.ts",
        "packages/core/src/domain/supervise-text.ts",
        "packages/cli/src/commands/supervise.ts",
      ]) {
        const text = readFileSync(join(ROOT, relative), "utf8");
        expect(text, relative).not.toContain("process.env");
        expect(text, relative).not.toContain("fetch(");
      }
    } finally {
      harness.remove();
    }
  });

  test("the fixture root lives under the configured temp directory", () => {
    const harness = createSupervisionHarness({ label: "isolation-root" });
    try {
      expect(harness.directory.startsWith(tmpdir())).toBe(true);
      expect(harness.directory).not.toBe(ROOT);
    } finally {
      harness.remove();
    }
  });
});
