/**
 * TC-SUP-051 — per-action duplicate-supervision refusal: an action whose object
 * another supervision authority is actively acting on is refused with the live
 * claim and holder named (exit 1, retryable, not_landed); a live daemon's mere
 * presence refuses nothing; a park intent is refused by neither identity
 * (GH-295 AC-F6-1, AC-F8-1, DEC-8).
 */
import { describe, expect, test } from "bun:test";
import { readQueueParks } from "../../packages/core/src/app/index";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import {
  actingAuthority,
  daemonClaim,
  LANE_REF,
  seedHeartbeat,
  seedLane,
  seedLaneRecord,
  seedLiveLease,
  stalledAndParked,
} from "../fixtures/supervise/records";

type JsonEnvelope = {
  readonly error?: {
    readonly code: string;
    readonly retryable?: boolean;
    readonly summary?: string;
  };
  readonly data?: Record<string, unknown>;
};

const restarts = (harness: ReturnType<typeof createSupervisionHarness>): number => {
  const records = harness.store.readRecords();
  if (!records.ok) return -1;
  return records.value.records.filter((record) => record.kind === "economics.restart").length;
};

describe("TC-SUP-051 the acting-authority cell refuses per action", () => {
  test("the failure names the live claim and holder, lands nothing, and is retryable", async () => {
    const harness = createSupervisionHarness({ label: "dup-acting" });
    try {
      stalledAndParked(harness.seed);
      actingAuthority(harness.seed, { objectRef: LANE_REF, authorityHolder: "acting-holder" });
      const run = await harness.runCli(["supervise", "--json"], {
        admitRestart: () => ({ outcome: "admit", restarts: 0 }),
      });
      expect(run.exitCode).toBe(1);
      const envelope = JSON.parse(run.stdout) as JsonEnvelope;
      expect(envelope.data).toBeUndefined();
      expect(envelope.error?.code).toBe("supervise.duplicate-supervision");
      expect(envelope.error?.retryable).toBe(true);
      expect(envelope.error?.summary ?? "").toContain("daemon-preemption");
      expect(envelope.error?.summary ?? "").toContain("acting-holder");
      expect(restarts(harness)).toBe(0);
      expect(readQueueParks(harness.store).ok).toBe(true);
    } finally {
      harness.remove();
    }
  });

  test("the retry control applies once the acting window has passed", async () => {
    const harness = createSupervisionHarness({ label: "dup-retry" });
    try {
      stalledAndParked(harness.seed);
      actingAuthority(harness.seed, { objectRef: LANE_REF });
      const retryNow = harness.nowMs + 400_000;
      const run = await harness.runCli(["supervise", "--json"], {
        nowMs: retryNow,
        admitRestart: () => ({ outcome: "admit", restarts: 0 }),
      });
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as JsonEnvelope).data;
      expect(data).toBeDefined();
      expect(restarts(harness)).toBe(1);
      expect(readQueueParks(harness.store).ok).toBe(true);
    } finally {
      harness.remove();
    }
  });
});

describe("TC-SUP-051 presence alone refuses nothing", () => {
  test("a genuinely live resident daemon claim rides data while the park lands at exit 0", async () => {
    const harness = createSupervisionHarness({ label: "dup-presence" });
    try {
      seedLane(harness.seed, LANE_REF);
      // The lane's own observation is aged (the stalled lane); the daemon's
      // heartbeat trail ends at the injected now, so the claim is genuinely
      // live rather than a stale trail dressed as live (F-9).
      seedLaneRecord(harness.seed, { offsetMs: -(300_000 + 5) });
      daemonClaim(harness.seed, { live: true });
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as JsonEnvelope).data;
      if (data === undefined) throw new Error("report data missing");
      const daemon = (data.supervisors as readonly Record<string, unknown>[]).find(
        (claim) => claim.claimKind === "daemon-instance",
      );
      expect(daemon).toBeDefined();
      expect(daemon?.classification).toBe("progressing");
      expect(
        ((daemon?.evidence ?? []) as readonly { code: string }[]).some(
          (item) => item.code === "claim-live",
        ),
      ).toBe(true);
      expect(((data.actions ?? []) as readonly Record<string, unknown>[]).length).toBe(1);
      expect(((data.actions ?? []) as readonly Record<string, unknown>[])[0]?.kind).toBe(
        "supervised-stall-park",
      );
      expect(readQueueParks(harness.store).ok).toBe(true);
    } finally {
      harness.remove();
    }
  });
});

describe("TC-SUP-051 the held-session cell is refused by neither identity", () => {
  test("the park intent lands and the run exits 0", async () => {
    const harness = createSupervisionHarness({ label: "dup-held" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -(300_000 + 1) });
      seedLiveLease(harness.seed, { ref: LANE_REF, holder: "session-holder" });
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as JsonEnvelope).data;
      if (data === undefined) throw new Error("report data missing");
      const actions = data.actions as readonly Record<string, unknown>[];
      expect(actions.map((action) => action.kind)).toEqual(["safe-boundary-park-intent"]);
      expect(
        ((data.supervisors ?? []) as readonly Record<string, unknown>[]).some(
          (claim) => claim.claimKind === "per-ref-lease",
        ),
      ).toBe(true);
    } finally {
      harness.remove();
    }
  });
});
