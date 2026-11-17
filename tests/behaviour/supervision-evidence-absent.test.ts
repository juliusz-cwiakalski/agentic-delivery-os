/**
 * TC-SUP-005 / TC-SUP-013 — an empty readable store is an evidence-complete
 * report, an all-unknown scope is the classified evidence-absent outcome, and an
 * unreadable store is the delivered state identity (GH-295 AC-F1-1, AC-F2-1,
 * AC-F8-1, DEC-6).
 */

import { describe, expect, test } from "bun:test";
import { appendFileSync, readdirSync } from "node:fs";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import {
  LANE_REF,
  seedCommitEffect,
  seedDaemonInstance,
  seedLane,
} from "../fixtures/supervise/records";

type JsonEnvelope = {
  readonly exitCode: number;
  readonly error?: {
    readonly code: string;
    readonly category?: string;
    readonly retryable?: boolean;
    readonly summary?: string;
  };
  readonly data?: Record<string, unknown>;
};

describe("TC-SUP-005 an empty readable scope is an empty report", () => {
  test("exit 0 with empty populations and no fabricated entry", async () => {
    const harness = createSupervisionHarness({ label: "empty" });
    try {
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const envelope = JSON.parse(run.stdout) as JsonEnvelope;
      const data = envelope.data;
      if (data === undefined) throw new Error("report data missing");
      expect(data.lanes).toEqual([]);
      expect(data.supervisors).toEqual([]);
      expect((data.counts as Record<string, number>).lanes).toBe(0);
      expect(JSON.stringify(data)).not.toContain('"classification"');
    } finally {
      harness.remove();
    }
  });
});

describe("TC-SUP-013 an all-unknown scope projects evidence-absent at exit 2", () => {
  test("the failure names the missing sources and carries no half report", async () => {
    const harness = createSupervisionHarness({ label: "all-unknown" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedDaemonInstance(harness.seed);
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(2);
      const envelope = JSON.parse(run.stdout) as JsonEnvelope;
      expect(envelope.data).toBeUndefined();
      expect(envelope.error?.code).toBe("supervise.evidence-absent");
      expect(envelope.error?.category).toBe("platform");
      expect(envelope.error?.retryable).toBe(true);
      expect(envelope.error?.summary ?? "").toContain(LANE_REF);
      expect(envelope.error?.summary ?? "").toContain("daemon-instance");
    } finally {
      harness.remove();
    }
  });

  test("a mixed scope takes the report path at exit 0 instead", async () => {
    const harness = createSupervisionHarness({ label: "mixed-boundary" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedDaemonInstance(harness.seed);
      seedCommitEffect(harness.seed, { offsetMs: -60_000 });
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as JsonEnvelope).data;
      if (data === undefined) throw new Error("report data missing");
      expect((data.lanes as readonly unknown[]).length).toBe(1);
      expect((data.supervisors as readonly unknown[]).length).toBe(1);
    } finally {
      harness.remove();
    }
  });

  test("an unreadable store exits 2 with the delivered state identity", async () => {
    const harness = createSupervisionHarness({ label: "unreadable" });
    const stateDirectory = `${harness.directory}/.supervision-state`;
    try {
      seedLane(harness.seed, LANE_REF);
      // Torn ledger content: the store's verified read must fail closed with a
      // delivered state identity, never a guessed verdict.
      const ledger = readdirSync(stateDirectory).find((name) => name.startsWith("ledger."));
      expect(ledger).toBeDefined();
      appendFileSync(`${stateDirectory}/${ledger as string}`, "{not-a-valid-record");
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(2);
      const envelope = JSON.parse(run.stdout) as JsonEnvelope;
      expect(envelope.data).toBeUndefined();
      expect(envelope.error?.code ?? "").toMatch(/^state\./u);
    } finally {
      harness.remove();
    }
  });
});
