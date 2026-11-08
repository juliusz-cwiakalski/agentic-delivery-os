/**
 * TC-PILOT-003 / TC-PILOT-004 — the stub/real matrix matches Appendix D and
 * the run makes zero outbound calls.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runEntrypoint } from "../../../packages/cli/src/entrypoint";
import { createPilot, type Pilot, type PilotSequence } from "../../fixtures/pilot/harness";
import { PILOT_MATRIX, type PilotMatrixEntry } from "../../fixtures/pilot/matrix";
import {
  type FetchGuard,
  installFetchGuard,
  installSleepGuard,
  type SleepGuard,
} from "../../fixtures/pilot/stubs";
import { bufferSink } from "../../golden/helpers";

let pilot: Pilot | undefined;
let sequence: PilotSequence | undefined;
let fetchGuard: FetchGuard | undefined;
let sleepGuard: SleepGuard | undefined;

const fixture = (): Pilot => {
  if (pilot === undefined) throw new Error("pilot fixture was not created");
  return pilot;
};

beforeAll(async () => {
  pilot = await createPilot();
  fetchGuard = installFetchGuard();
  sleepGuard = installSleepGuard();
  try {
    sequence = await pilot.runSequence();
  } finally {
    sleepGuard.restore();
    fetchGuard.restore();
  }
});

afterAll(() => {
  pilot?.cleanup();
});

const entry = (id: string): PilotMatrixEntry => {
  const found = PILOT_MATRIX.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`missing matrix row ${id}`);
  return found;
};

describe("TC-PILOT-003 stub/real matrix", () => {
  test("every Appendix D surface has a typed matrix row and evidence", () => {
    expect(PILOT_MATRIX.map((row) => row.id)).toEqual([
      "state-ledger",
      "git",
      "change-files",
      "envelopes",
      "help-version",
      "tracker",
      "ci",
      "pr-platform",
      "provider-network",
      "clock-ids",
    ]);
    for (const row of PILOT_MATRIX) {
      expect(row.evidence.length).toBeGreaterThan(0);
    }
    expect(entry("state-ledger").kind).toBe("real");
    expect(entry("git").kind).toBe("real");
    expect(entry("change-files").kind).toBe("real");
    expect(entry("envelopes").kind).toBe("real");
    expect(entry("help-version").kind).toBe("real");
    expect(entry("tracker").kind).toBe("stubbed");
    expect(entry("ci").kind).toBe("stubbed");
    expect(entry("pr-platform").kind).toBe("stubbed");
    expect(entry("provider-network").kind).toBe("stubbed");
    expect(entry("clock-ids").kind).toBe("injected");
  });

  test("real surfaces carry real evidence", () => {
    const current = fixture();
    expect(current.snapshot().ledger).toContain("phase.transition");
    expect(current.repo.commitCount()).toBeGreaterThanOrEqual(2);
    expect(current.repo.changeFolderFiles().length).toBeGreaterThan(0);
    expect(sequence?.status.exitCode).toBe(0);
    expect(sequence?.merge.exitCode).toBe(0);
  });

  test("stubbed surfaces are recorded in process with outbound=false", () => {
    const current = fixture();
    const surfaces = new Set(current.stubs.calls.map((call) => call.surface));
    expect(surfaces.has("tracker")).toBe(true);
    expect(surfaces.has("ci")).toBe(true);
    expect(surfaces.has("pr-platform")).toBe(true);
    expect(current.stubs.providerCalls.length).toBeGreaterThan(0);
    for (const call of [...current.stubs.calls, ...current.stubs.providerCalls]) {
      expect(call.outbound).toBe(false);
    }
  });

  test("the clock, run ids, and fence tokens are injected", () => {
    expect(fixture().nowIso).toBe("2026-11-07T00:00:00Z");
    expect(sequence?.status.envelope?.runId).toBeDefined();
  });

  test("the real entrypoint help/version surface renders without composing a runtime", async () => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    const exitCode = await runEntrypoint(["--version"], {
      streams: { stdout, stderr },
      environment: {},
      composeProgram: () => {
        throw new Error("help/version must not compose a command runtime");
      },
      clock: { now: () => 1000 },
      newRunId: () => "run-pilot-help",
    });
    expect(exitCode).toBe(0);
    expect(stderr.value).toBe("");
    expect(stdout.value).toContain("delivery-os");
    expect(stdout.value).toContain("0.0.0");
  });

  test("the pilot composition is test-only and claims no state/mcp/dispatch command", () => {
    const commands = Object.keys(fixture().program.commands).sort();
    expect(commands).toEqual([
      "blockers",
      "closeout",
      "commit",
      "lint",
      "merge",
      "phase",
      "plan",
      "queue",
      "status",
      "verify",
    ]);
    const source = readFileSync(join(process.cwd(), "tests/fixtures/pilot/harness.ts"), "utf8");
    expect(source).not.toContain("packages/cli/src/production");
    expect(source).not.toContain("packages/cli/src/entrypoint");
  });
});

describe("TC-PILOT-004 zero outbound calls", () => {
  test("the fetch guard records zero network attempts", () => {
    expect(fetchGuard?.attempts).toEqual([]);
  });

  test("the sleep guard records zero sleeps", () => {
    expect(sleepGuard?.sleeps).toEqual([]);
  });

  test("every spawned process is the local git binary", () => {
    const files = new Set(fixture().spawns.map((spawn) => spawn.file));
    expect([...files]).toEqual(["git"]);
    for (const spawn of fixture().spawns) {
      expect(spawn.args[0]).not.toBe("push");
    }
  });
});
