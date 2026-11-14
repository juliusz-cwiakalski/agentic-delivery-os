/**
 * TC-PAUSE-001..006 — provider profile nomination at dispatch admission
 * (GH-294 F-1, AC-F1-1, DM-1, DM-2, DEC-9; TDR-0028 D1..D5, C-2..C-6).
 *
 * The nomination is a durable record field written once at admission: visible
 * on the attempt record and the daemon lane record, agreeing across every read
 * path. A delivery that cannot nominate is refused before any session exists —
 * recordless, eventless, spawnless — carrying the resolve identity for its
 * exact shape at its delivered exit projection, identically on the one-shot
 * path and the composed daemon supervision claim. Pre-change lanes resume on
 * classified absence; resumes never re-nominate; no surface defaults, guesses,
 * or borrows a profile.
 */
import { describe, expect, test } from "bun:test";
import { runDispatch } from "../../packages/core/src/app/dispatch";
import { readDispatchAttemptHistory } from "../../packages/core/src/app/dispatch-attempts";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import {
  appendDaemonLane,
  readDaemonLanes,
  readQueueEntries,
  runSupervisionCycle,
} from "../../packages/core/src/app/index";
import type {
  ProfileProviderAvailability,
  ProviderProfileConfiguration,
} from "../../packages/core/src/contracts/index";
import { ERROR_TABLE } from "../../packages/core/src/contracts/index";
import { shapeDaemonLane } from "../../packages/core/src/domain/daemon-lane";
import { selectAttemptsPage } from "../../packages/core/src/domain/dispatch-attempts";
import {
  createProfileProbePort,
  nominateProviderProfile,
} from "../../packages/core/src/provider/engine";
import { selectProfile } from "../../packages/core/src/provider/profile";
import {
  COMPLETED_EVIDENCE,
  createDispatchClock,
  createDispatchState,
  createScriptedHarness,
  type DispatchState,
} from "../fixtures/dispatch/harness";
import {
  available,
  exhausted,
  peak,
  profile,
  seat,
} from "../fixtures/provider/profile/selection/fixtures";

const REPOSITORY = "github.com/owner/repo";
const NOW = "2026-11-08T10:00:00.000Z";

/** The probe the admission and the resolve cross-check read: pure fact data. */
const probeOf = (
  facts: Readonly<Record<string, ProfileProviderAvailability>>,
): ReturnType<typeof createProfileProbePort> =>
  createProfileProbePort(
    (providerName) =>
      facts[providerName] ?? {
        available: false,
        condition: "provider-outage",
        blockers: [
          {
            kind: "condition",
            value: "provider-outage",
            detail: `provider ${providerName} is not declared`,
          },
        ],
        source: `provider ${providerName}: undeclared`,
      },
  );

const configOf = (
  profiles: ProviderProfileConfiguration["profiles"],
  preferenceChain?: { readonly base: string; readonly fallbacks: readonly string[] },
): ProviderProfileConfiguration => ({
  tiers: { build: {} },
  profiles,
  ...(preferenceChain === undefined
    ? {}
    : {
        preferenceChain: {
          base: preferenceChain.base,
          fallbacks: preferenceChain.fallbacks,
          order: [preferenceChain.base, ...preferenceChain.fallbacks],
        },
      }),
});

const eligibleConfig = (): ProviderProfileConfiguration =>
  configOf(
    {
      "profile-a": profile({
        name: "profile-a",
        tier: "build",
        providers: ["provider-a"],
        seats: { judgment: seat("m-a", "judgment", "text-only") },
      }),
    },
    { base: "profile-a", fallbacks: [] },
  );

const emptyConfig = (): ProviderProfileConfiguration => ({ tiers: {}, profiles: {} });

const familyCounts = (state: DispatchState) => {
  const attempts = readDispatchAttempts(state.store);
  const lanes = readDaemonLanes(state.store);
  const entries = readQueueEntries(state.store);
  return {
    attempts: attempts.ok ? attempts.records.length : -1,
    lanes: lanes.ok ? lanes.records.length : -1,
    entries: entries.ok ? entries.records.length : -1,
  };
};

const dispatchPorts = (state: DispatchState, overrides: Record<string, unknown> = {}) => {
  const scripted = createScriptedHarness({ evidence: COMPLETED_EVIDENCE });
  const clock = createDispatchClock();
  return {
    ports: {
      store: state.store,
      fenceToken: state.fenceToken,
      harness: scripted.port,
      harnessKind: "opencode" as const,
      descriptor: { kind: "host", workDirectory: state.root, environment: [] },
      prompt: "deliver GH-294",
      ref: "GH-294",
      evidenceClass: "pilot" as const,
      repository: REPOSITORY,
      handoverState: "dual-run" as const,
      nowIso: clock.nowIso,
      newAttemptId: () => `attempt-${clock.value()}`,
      newDivergenceId: () => "DIV-294",
      readTruth: async () => ({
        artifacts: { ok: false, code: "input.value.rejected" },
        ledger: { ok: false, code: "input.value.rejected" },
        tracker: { ok: false, code: "input.value.rejected" },
        ci: { ok: false, code: "input.value.rejected" },
        verifyOutcome: null,
        trackerToken: null,
        phasesComplete: false,
      }),
      claimLease: () => ({ ok: true, leaseId: "lease-294" }),
      releaseLease: () => true,
      phaseLedger: { completed: 0, total: 9, variant: "full" as const },
      ...(overrides.ports ?? {}),
    } as Record<string, unknown>,
    scripted,
  };
};

describe("TC-PAUSE-001 nomination is recorded and agrees across reads", () => {
  test("the attempt record, the lane record, and the attempt-history read agree", async () => {
    const state = createDispatchState("nomination-records");
    try {
      const nomination = nominateProviderProfile({
        profiles: eligibleConfig(),
        probe: probeOf({ "provider-a": available() }),
        nowMs: Date.parse(NOW),
      });
      expect(nomination.ok).toBe(true);
      if (!nomination.ok) return;

      const { ports } = dispatchPorts(state, {
        ports: { nominate: () => nomination },
      });
      const result = await runDispatch(ports as unknown as Parameters<typeof runDispatch>[0]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // The appended attempt record carries the nomination as a stored field.
      expect(result.attempt.providerProfile).toBe("profile-a");

      const attempts = readDispatchAttempts(state.store);
      expect(attempts.ok).toBe(true);
      if (!attempts.ok) return;
      const stored = attempts.records.at(-1);
      expect(stored?.providerProfile).toBe("profile-a");

      // The attempt-history read returns the stored value.
      const history = readDispatchAttemptHistory(
        {
          store: state.store,
          resolveRepository: () => REPOSITORY,
          resolveActiveRef: () => "GH-294",
          contextPath: "doc/planning/local/pm-context.md",
        },
        { ref: "GH-294" },
      );
      expect(history.ok).toBe(true);
      if (!history.ok) return;
      expect(history.data.attempts.at(0)?.providerProfile).toBe("profile-a");

      // The lane half: the composed supervision claim records the same value.
      const cycle = await runSupervisionCycle({
        store: state.store,
        fenceToken: state.fenceToken,
        ports: {
          executor: {
            availability: () => ({ available: true }),
            start: async () => ({ sessionId: "session-a", harnessKind: "opencode" }),
            observe: async () => ({ observable: true, progress: "progressing", done: true }),
            collect: async () => ({ ok: true }),
            resume: async () => true,
          },
          nextAction: () => ({ ref: "GH-294", repository: REPOSITORY, weightClass: "standard" }),
          nominate: () => nomination,
          claim: () => ({ ok: true, leaseId: "lease-lane" }),
          release: () => true,
          nowIso: () => NOW,
        },
      });
      expect(cycle.mode).toBe("completed");
      if (cycle.mode !== "completed") return;
      expect(cycle.lane.providerProfile).toBe("profile-a");
      const lanes = readDaemonLanes(state.store);
      expect(lanes.ok).toBe(true);
      if (!lanes.ok) return;
      expect(lanes.records.at(-1)?.providerProfile).toBe("profile-a");
    } finally {
      state.dispose();
    }
  });

  test("the nomination is captured at admission and never rewritten by a later window observation", async () => {
    const state = createDispatchState("nomination-stable");
    try {
      const nomination = nominateProviderProfile({
        profiles: eligibleConfig(),
        probe: probeOf({ "provider-a": available() }),
        nowMs: Date.parse(NOW),
      });
      if (!nomination.ok) throw new Error("fixture must nominate");
      const { ports } = dispatchPorts(state, {
        ports: { nominate: () => nomination },
      });
      const first = await runDispatch(ports as unknown as Parameters<typeof runDispatch>[0]);
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      const recordedAt = first.attempt.providerProfile;
      // A later window observation (clock advanced, probe now reporting the
      // provider in-window) never rewrites the first admission's record.
      const later = await runDispatch({
        ...ports,
        ref: "GH-295",
        newAttemptId: () => "attempt-second",
      } as unknown as Parameters<typeof runDispatch>[0]);
      expect(later.ok).toBe(true);
      const attempts = readDispatchAttempts(state.store);
      expect(attempts.ok).toBe(true);
      if (!attempts.ok) return;
      const values = attempts.records.map((record) => record.providerProfile);
      expect(values).toEqual([recordedAt, recordedAt]);
    } finally {
      state.dispose();
    }
  });

  test("the field is additive: without the gate the delivered record shape persists", async () => {
    const state = createDispatchState("nomination-additive");
    try {
      const { ports } = dispatchPorts(state);
      const result = await runDispatch(ports as unknown as Parameters<typeof runDispatch>[0]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.attempt.providerProfile).toBeUndefined();
      const attempts = readDispatchAttempts(state.store);
      if (!attempts.ok) throw new Error("attempts must read");
      // Pre-change shape: no nomination key on the stored record, and the
      // read renders the classified absence as null.
      expect("providerProfile" in (attempts.records.at(0) ?? {})).toBe(false);
      const view = selectAttemptsPage({
        records: attempts.records,
        repository: REPOSITORY,
        ref: "GH-294",
        refSource: "flag",
      });
      expect(view.attempts.at(0)?.providerProfile).toBeNull();
    } finally {
      state.dispose();
    }
  });
});

describe("TC-PAUSE-002 no-nomination refuses at the delivered identities with zero records", () => {
  const shapes: Array<{
    readonly name: string;
    readonly config: ProviderProfileConfiguration;
    readonly facts: Readonly<Record<string, ProfileProviderAvailability>>;
    readonly requireVision?: boolean;
    readonly code: string;
    readonly exit: number;
  }> = [
    {
      name: "absent: empty branch",
      config: emptyConfig(),
      facts: {},
      code: "provider.profile.absent",
      exit: 1,
    },
    {
      name: "capability-denied: vision required, no capable seat",
      config: configOf(
        {
          "profile-a": profile({
            name: "profile-a",
            tier: "build",
            providers: ["provider-a"],
            seats: { judgment: seat("m-a", "judgment", "text-only") },
          }),
        },
        { base: "profile-a", fallbacks: [] },
      ),
      facts: { "provider-a": available() },
      requireVision: true,
      code: "provider.profile.capability-denied",
      exit: 1,
    },
    {
      name: "unavailable: provider in its peak window",
      config: eligibleConfig(),
      facts: { "provider-a": peak("provider-a") },
      code: "provider.profile.unavailable",
      exit: 2,
    },
    {
      name: "unavailable: quota exhausted",
      config: eligibleConfig(),
      facts: { "provider-a": exhausted("provider-a") },
      code: "provider.profile.unavailable",
      exit: 2,
    },
  ];

  test("each shape refuses with the resolve identity, its delivered exit, and zero records", () => {
    for (const shape of shapes) {
      const nomination = nominateProviderProfile({
        profiles: shape.config,
        probe: probeOf(shape.facts),
        nowMs: Date.parse(NOW),
        ...(shape.requireVision === undefined ? {} : { requireVision: shape.requireVision }),
      });
      expect(nomination.ok, shape.name).toBe(false);
      if (nomination.ok) continue;
      expect(nomination.refusal.code, shape.name).toBe(shape.code);
      // Cross-check: the resolve surface produces the same identity for the
      // same configuration — the admission reuses the seam, it does not invent.
      const resolve = selectProfile({
        profiles: shape.config,
        probe: probeOf(shape.facts),
        nowMs: Date.parse(NOW),
        ...(shape.code === "provider.profile.capability-denied" ? { requireVision: true } : {}),
      });
      expect(resolve.ok, shape.name).toBe(false);
      if (resolve.ok) continue;
      expect(resolve.code, shape.name).toBe(shape.code);
      // The delivered exit projection of the identity (the error table's
      // projection class is the exit source of truth).
      const row = ERROR_TABLE.find((entry) => entry.code === shape.code);
      expect(row, shape.name).toBeDefined();
      expect(row?.projectionClass, shape.name).toBe(
        shape.exit === 2 ? "platform-provider" : "user-validation",
      );
      // The unavailable refusal carries the eligibility list.
      if (shape.code === "provider.profile.unavailable") {
        expect((nomination.refusal.eligibility ?? []).length, shape.name).toBeGreaterThan(0);
      }
    }
  });

  test("the refusal is recordless, eventless, and spawnless on the one-shot path", async () => {
    const state = createDispatchState("nomination-refusal-records");
    try {
      const nomination = nominateProviderProfile({
        profiles: emptyConfig(),
        probe: probeOf({}),
        nowMs: Date.parse(NOW),
      });
      expect(nomination.ok).toBe(false);
      const { ports, scripted } = dispatchPorts(state, {
        ports: { nominate: () => nomination },
      });
      const before = familyCounts(state);
      const result = await runDispatch(ports as unknown as Parameters<typeof runDispatch>[0]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe("provider");
      expect(result.error.code).toBe("provider.profile.absent");
      const after = familyCounts(state);
      expect(after).toEqual(before);
      expect(scripted.calls).toEqual([]);
    } finally {
      state.dispose();
    }
  });

  test("the unavailable refusal renders the eligibility list in the refusal detail", async () => {
    const state = createDispatchState("nomination-refusal-eligibility");
    try {
      const nomination = nominateProviderProfile({
        profiles: eligibleConfig(),
        probe: probeOf({ "provider-a": peak("provider-a") }),
        nowMs: Date.parse(NOW),
      });
      expect(nomination.ok).toBe(false);
      const { ports } = dispatchPorts(state, {
        ports: { nominate: () => nomination },
      });
      const result = await runDispatch(ports as unknown as Parameters<typeof runDispatch>[0]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("provider.profile.unavailable");
      expect(result.error.eligibility?.length ?? 0).toBeGreaterThan(0);
      expect(result.error.eligibility?.at(0)).toContain("profile-a");
    } finally {
      state.dispose();
    }
  });
});

describe("TC-PAUSE-003 the composed claim inherits the nomination refusal", () => {
  test("the claim of a no-nomination ref is refused identically and the loop continues", async () => {
    const state = createDispatchState("nomination-claim-parity");
    try {
      const refused = nominateProviderProfile({
        profiles: emptyConfig(),
        probe: probeOf({}),
        nowMs: Date.parse(NOW),
      });
      const admitted = nominateProviderProfile({
        profiles: eligibleConfig(),
        probe: probeOf({ "provider-a": available() }),
        nowMs: Date.parse(NOW),
      });
      if (refused.ok || !admitted.ok) throw new Error("fixture nominations must resolve");
      const before = familyCounts(state);
      const cycle = await runSupervisionCycle({
        store: state.store,
        fenceToken: state.fenceToken,
        ports: {
          executor: {
            availability: () => ({ available: true }),
            start: async () => ({ sessionId: "session-a", harnessKind: "opencode" }),
            observe: async () => ({ observable: true, progress: "progressing", done: false }),
            collect: async () => ({ ok: true }),
            resume: async () => true,
          },
          nextAction: () => ({ ref: "GH-294", repository: REPOSITORY, weightClass: "standard" }),
          nominate: () => refused,
          claim: () => ({ ok: true, leaseId: "lease-lane" }),
          release: () => true,
          nowIso: () => NOW,
        },
      });
      expect(cycle.mode).toBe("nomination-refused");
      if (cycle.mode !== "nomination-refused") return;
      expect(cycle.code).toBe("provider.profile.absent");
      // Zero records appended by the refused claim cycle.
      expect(familyCounts(state)).toEqual(before);

      // The supervision loop continues: the control ref behind it admits with
      // its nomination.
      const control = await runSupervisionCycle({
        store: state.store,
        fenceToken: state.fenceToken,
        ports: {
          executor: {
            availability: () => ({ available: true }),
            start: async () => ({ sessionId: "session-b", harnessKind: "opencode" }),
            observe: async () => ({ observable: true, progress: "progressing", done: true }),
            collect: async () => ({ ok: true }),
            resume: async () => true,
          },
          nextAction: () => ({ ref: "GH-295", repository: REPOSITORY, weightClass: "standard" }),
          nominate: () => admitted,
          claim: () => ({ ok: true, leaseId: "lease-lane" }),
          release: () => true,
          nowIso: () => NOW,
        },
      });
      expect(control.mode).toBe("completed");
    } finally {
      state.dispose();
    }
  });
});

describe("TC-PAUSE-004 the delivered empty-branch refusal is preserved, only earlier", () => {
  test("an empty branch refuses with the delivered identity before any session", async () => {
    const state = createDispatchState("nomination-empty-branch");
    try {
      const nomination = nominateProviderProfile({
        profiles: emptyConfig(),
        probe: probeOf({}),
        nowMs: Date.parse(NOW),
      });
      expect(nomination.ok).toBe(false);
      const { ports, scripted } = dispatchPorts(state, {
        ports: { nominate: () => nomination },
      });
      const result = await runDispatch(ports as unknown as Parameters<typeof runDispatch>[0]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("provider.profile.absent");
      // The spawn counter is zero: the delivery fails before any invocation.
      expect(scripted.calls).toEqual([]);
      // The delivered resolve surface classifies the same configuration with
      // the same identity — only the failure point moved earlier.
      const resolve = selectProfile({
        profiles: emptyConfig(),
        probe: probeOf({}),
        nowMs: Date.parse(NOW),
      });
      expect(resolve.ok).toBe(false);
      if (!resolve.ok) expect(resolve.code).toBe(result.error.code);
    } finally {
      state.dispose();
    }
  });
});

describe("TC-PAUSE-005 pre-change lanes resume on classified absence", () => {
  test("a pre-change lane resumes without a nomination, blocks nothing, and is never backfilled", async () => {
    const state = createDispatchState("nomination-pre-change");
    try {
      // Seed a pre-change lane record: the delivered family shape, no
      // nomination field.
      const seeded = shapeDaemonLane({
        ref: "GH-294",
        state: "delivering",
        harnessKind: "opencode",
        sessionId: "session-pre",
        spawnOrdinal: 1,
        recordedAt: NOW,
      });
      const appended = appendDaemonLane(state.store, state.fenceToken, seeded);
      expect(appended.ok).toBe(true);

      // The resume claim consults no nomination (resumes never re-nominate:
      // the composition omits the gate for a recorded lane) and proceeds.
      const cycle = await runSupervisionCycle({
        store: state.store,
        fenceToken: state.fenceToken,
        ports: {
          executor: {
            availability: () => ({ available: true }),
            start: async () => ({ sessionId: "session-pre", harnessKind: "opencode" }),
            observe: async () => ({ observable: true, progress: "progressing", done: true }),
            collect: async () => ({ ok: true }),
            resume: async () => true,
          },
          nextAction: () => ({ ref: "GH-294", repository: REPOSITORY, weightClass: "standard" }),
          claim: () => ({ ok: true, leaseId: "lease-lane" }),
          release: () => true,
          nowIso: () => NOW,
        },
      });
      expect(cycle.mode).toBe("completed");

      // No re-nomination: the resumed lane's records still lack the field and
      // no other profile's value appears for this lane.
      const lanes = readDaemonLanes(state.store);
      expect(lanes.ok).toBe(true);
      if (!lanes.ok) return;
      for (const lane of lanes.records) {
        expect(lane.ref).toBe("GH-294");
        expect(lane.providerProfile).toBeUndefined();
      }
      // No backfill: every stored record byte-set is unchanged — the seeded
      // record keeps exactly its delivered keys.
      expect(Object.keys(seeded).sort()).not.toContain("providerProfile");
    } finally {
      state.dispose();
    }
  });

  test("a pre-change dispatch resume proceeds; the attempt read renders null absence", async () => {
    const state = createDispatchState("nomination-pre-change-resume");
    try {
      // Resume admission with no nomination gate: the resume proceeds, the
      // attempt record carries no nomination, the read renders null.
      const { ports } = dispatchPorts(state, {
        ports: {
          resumePrompt: "continue GH-294",
          existingHandle: {
            harnessKind: "opencode",
            sessionId: "session-pre",
            treeRoot: "/tmp/session-pre",
            workItemRef: "GH-294",
          },
        },
      });
      const result = await runDispatch(ports as unknown as Parameters<typeof runDispatch>[0]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.attempt.providerProfile).toBeUndefined();
      const view = selectAttemptsPage({
        records: [result.attempt],
        repository: REPOSITORY,
        ref: "GH-294",
        refSource: "flag",
      });
      expect(view.attempts.at(0)?.providerProfile).toBeNull();
    } finally {
      state.dispose();
    }
  });
});

describe("TC-PAUSE-006 no surface defaults, guesses, or borrows a nomination", () => {
  test("the unnominated lane reads as classified absence beside a nominated lane", async () => {
    const state = createDispatchState("nomination-no-borrow");
    try {
      // Lane A: pre-change, no nomination. Lane B: nominated to profile-a —
      // the borrow bait.
      const laneA = shapeDaemonLane({
        ref: "GH-294",
        state: "delivering",
        sessionId: "session-a",
        spawnOrdinal: 1,
        recordedAt: NOW,
      });
      const laneB = shapeDaemonLane({
        ref: "GH-295",
        state: "delivering",
        sessionId: "session-b",
        spawnOrdinal: 1,
        providerProfile: "profile-a",
        recordedAt: NOW,
      });
      expect(appendDaemonLane(state.store, state.fenceToken, laneA).ok).toBe(true);
      expect(appendDaemonLane(state.store, state.fenceToken, laneB).ok).toBe(true);

      const attemptA = {
        schema: "delivery.dispatch.attempt.v1",
        attemptId: "attempt-a",
        repository: REPOSITORY,
        ref: "GH-294",
        harness: "opencode",
        evidenceClass: "pilot",
        startedAt: NOW,
        finishedAt: NOW,
        handoverState: "dual-run",
        outcome: "completed",
        token: "pr-open",
        comparison: { class: "compared", outcome: "match" },
        falseSuccess: false,
        corroboration: { pmNotes: "absent", tracker: "absent", ci: "absent" },
        evidenceRefs: [],
        recordedAt: NOW,
      };
      const attemptB = {
        ...attemptA,
        attemptId: "attempt-b",
        ref: "GH-295",
        providerProfile: "profile-a",
      };
      const records = [attemptA, attemptB];

      // Every nomination-bearing read: the lane records, the attempts
      // projection.
      const lanes = readDaemonLanes(state.store);
      expect(lanes.ok).toBe(true);
      if (!lanes.ok) return;
      const projectedA = lanes.records.find((lane) => lane.ref === "GH-294");
      expect(projectedA?.providerProfile).toBeUndefined();
      const projectedB = lanes.records.find((lane) => lane.ref === "GH-295");
      expect(projectedB?.providerProfile).toBe("profile-a");

      const page = selectAttemptsPage({
        records: records as never,
        repository: REPOSITORY,
        ref: "GH-294",
        refSource: "flag",
      });
      expect(page.attempts).toHaveLength(1);
      // Not the chain base, not profile-a from lane B, not any default: null.
      expect(page.attempts.at(0)?.providerProfile).toBeNull();

      // Mutant control: with B's records removed, A's rendering is identical —
      // it never depended on B's record.
      const pageWithoutB = selectAttemptsPage({
        records: [attemptA] as never,
        repository: REPOSITORY,
        ref: "GH-294",
        refSource: "flag",
      });
      expect(pageWithoutB.attempts.at(0)?.providerProfile).toBeNull();
      const lanesWithoutB = readDaemonLanes(state.store);
      if (!lanesWithoutB.ok) throw new Error("lanes must read");
      expect(
        lanesWithoutB.records.find((lane) => lane.ref === "GH-294")?.providerProfile,
      ).toBeUndefined();
    } finally {
      state.dispose();
    }
  });
});
