/**
 * TC-SUP-003 — grammar containment refuses before any read and the human text
 * renders the same facts as the machine payload (GH-295 AC-F1-1, AC-F8-1,
 * DEC-6).
 */
import { describe, expect, test } from "bun:test";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import {
  LANE_REF,
  seedCommitEffect,
  seedHeartbeat,
  seedLane,
  seedLiveLease,
} from "../fixtures/supervise/records";

type JsonEnvelope = {
  readonly exitCode: number;
  readonly error?: { readonly code: string };
  readonly data?: Record<string, unknown>;
};

describe("TC-SUP-003 grammar containment runs before any read", () => {
  test("an extra positional, an unknown flag, and a positional after --json are refused", async () => {
    const harness = createSupervisionHarness({ label: "grammar" });
    try {
      seedLane(harness.seed, LANE_REF);
      for (const argv of [
        ["supervise", "GH-123", "--json"],
        ["supervise", "--unknown-flag", "--json"],
        ["supervise", "--json", "extra"],
      ]) {
        const run = await harness.runCli(argv);
        expect(run.exitCode, argv.join(" ")).toBe(1);
        const envelope = JSON.parse(run.stdout) as JsonEnvelope;
        expect(envelope.error?.code).toBe("fallback.invocation");
        expect(envelope.data).toBeUndefined();
        // Containment precedes every read.
        expect(harness.reads.count, argv.join(" ")).toBe(0);
      }
    } finally {
      harness.remove();
    }
  });

  test("the human render carries the same facts as the machine payload", async () => {
    const harness = createSupervisionHarness({ label: "grammar-human" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -120_000 });
      seedCommitEffect(harness.seed, { offsetMs: -60_000 });
      seedLiveLease(harness.seed, { ref: LANE_REF, holder: "holder-a" });
      const machine = await harness.runCli(["supervise", "--json"]);
      const human = await harness.runCli(["supervise"]);
      expect(machine.exitCode).toBe(0);
      expect(human.exitCode).toBe(0);
      const data = (JSON.parse(machine.stdout) as JsonEnvelope).data;
      if (data === undefined) throw new Error("report data missing");
      expect(human.stdout).toContain(String(data.repo));
      expect(human.stdout).toContain(`lane ${LANE_REF} progressing`);
      expect(human.stdout).toContain("holder-a");
      // One fold per run, and no second fold for the human text.
      expect(harness.reads.count).toBe(1);
      // The binary name comes from the injected brand only.
      expect(human.stdout.split("\n")[0]?.startsWith("example-product supervise")).toBe(true);
      for (const literal of ["jaiship", "delivery-os", "ados"]) {
        expect(human.stdout.toLowerCase()).not.toContain(literal);
      }
    } finally {
      harness.remove();
    }
  });
});
