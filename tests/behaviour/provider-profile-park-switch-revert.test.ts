/**
 * TC-PROFILE-022..028, 041, 050, 053 (lifecycle half) — expensive-window parks,
 * switch-not-park, target persistence with latest-wins, exactly-once revert,
 * honest parked decisions, dedupe, and 100-run lifecycle replay.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createResolvedProviderProbe } from "../../packages/cli/src/edge";
import type { ProfileSelectionResult } from "../../packages/core/src/contracts/index";
import {
  createProfileTargetRecord,
  createProviderFactsProbe,
  evaluateProfileLifecycle,
  persistProfileTarget,
  readProfileTarget,
  selectProfile,
} from "../../packages/core/src/provider/index";
import {
  clearParkRecord,
  createParkRecord,
  parkView,
} from "../../packages/core/src/provider/parks";
import { evaluatePeakWindow } from "../../packages/core/src/provider/peak";
import { lifecycleChain, peakWindow } from "../fixtures/provider/profile/lifecycle/fixtures";
import {
  available,
  exhausted,
  mixedChain,
  peak,
} from "../fixtures/provider/profile/selection/fixtures";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const NOW = 1_700_000_000_000;
const roots: string[] = [];

afterEach(() => {
  for (const root of roots) removeRoot(root);
  roots.length = 0;
});

const selectionOf = (
  facts: Readonly<Record<string, ReturnType<typeof available>>>,
): ProfileSelectionResult =>
  selectProfile({
    profiles: lifecycleChain(),
    probe: createProviderFactsProbe(facts),
    nowMs: NOW,
  });

const storeFor = () => {
  const root = makeTempRoot("profile-lifecycle");
  roots.push(root);
  const identity = makeIdentity(root);
  return openStore(identity).store;
};

describe("TC-PROFILE-022/023 expensive window parks with cause and absolute expiry", () => {
  test("an in-window provider parks with a closed cause and an absolute expiry", () => {
    const inside = Date.UTC(2026, 10, 7, 7, 0, 0);
    const condition = evaluatePeakWindow(peakWindow(), inside);
    expect(condition.status).toBe("parked");
    if (condition.status !== "parked") return;
    const park = createParkRecord({
      subjectKind: "provider",
      subjectName: "coding-plan",
      cause: condition.kind,
      conditions: [condition.kind],
      createdAtMs: inside,
      expiresAtMs: condition.expiresAtMs,
      evidence: condition.evidence,
    });
    expect(park.cause).toBe("peak-window");
    expect(park.expiresAtMs).toBeGreaterThan(inside);
    expect(park.state).toBe("active");
  });

  test("profiles using the parked provider are ineligible with the park named as blocker", () => {
    const result = selectionOf({ "coding-plan": peak("coding-plan"), deepseek: available() });
    if (!result.ok) throw new Error("selection failed");
    expect(result.decision.profile).toBe("deepseek");
    const mixed = result.decision.eligibility[0];
    expect(mixed?.verdict).toBe("ineligible");
    expect(mixed?.blockers.some((blocker) => blocker.value === "peak-window")).toBe(true);
  });

  test("the window clears exactly at its end with no timer", () => {
    const beforeEnd = Date.UTC(2026, 10, 7, 9, 59, 59);
    const atEnd = Date.UTC(2026, 10, 7, 10, 0, 0);
    expect(evaluatePeakWindow(peakWindow(), beforeEnd).status).toBe("parked");
    expect(evaluatePeakWindow(peakWindow(), atEnd).status).toBe("clear");
  });
});

describe("TC-PROFILE-024/025 switch-not-park and persisted target stability", () => {
  test("exhaustion switches to the next eligible profile and records the revert condition", () => {
    const selection = selectionOf({
      "coding-plan": exhausted("coding-plan"),
      deepseek: available(),
    });
    const outcome = evaluateProfileLifecycle({
      profiles: lifecycleChain(),
      selection,
      persisted: createProfileTargetRecord({
        targetProfile: "mixed",
        reason: "selection",
        nowMs: NOW,
      }),
      nowMs: NOW,
      providerName: "coding-plan",
    });
    expect(outcome.append).toBe(true);
    expect(outcome.target?.targetProfile).toBe("deepseek");
    expect(outcome.target?.reason).toBe("switch");
    expect(outcome.target?.previousProfile).toBe("mixed");
    expect(outcome.target?.revertCondition).toBe("quota-exhausted");
    const switched = outcome.events.find((event) => event.code === "profile.switched");
    expect(switched?.evidence.previousProfile).toBe("mixed");
    expect(switched?.evidence.newProfile).toBe("deepseek");
    expect(switched?.evidence.revertCondition).toBe("quota-exhausted");
  });

  test("an unchanged target stabilises across resolves with no append noise", () => {
    const selection = selectionOf({
      "coding-plan": exhausted("coding-plan"),
      deepseek: available(),
    });
    const persisted = createProfileTargetRecord({
      targetProfile: "deepseek",
      reason: "switch",
      revertCondition: "quota-exhausted",
      nowMs: NOW,
    });
    for (let index = 0; index < 3; index += 1) {
      const outcome = evaluateProfileLifecycle({
        profiles: lifecycleChain(),
        selection,
        persisted,
        nowMs: NOW,
      });
      expect(outcome.append).toBe(false);
      expect(outcome.target).toBeUndefined();
      expect(outcome.events.some((event) => event.code === "profile.switched")).toBe(false);
    }
  });

  test("a changed target appends exactly one new record and latest wins", () => {
    const store = storeFor();
    const first = persistProfileTarget({
      store,
      fenceToken: "fence-1",
      record: createProfileTargetRecord({
        targetProfile: "deepseek",
        reason: "switch",
        previousProfile: "mixed",
        revertCondition: "quota-exhausted",
        nowMs: NOW,
      }),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.appended).toBe(true);
    const readFirst = readProfileTarget(store);
    expect(readFirst.ok && readFirst.value?.targetProfile).toBe("deepseek");
    const duplicate = persistProfileTarget({
      store,
      fenceToken: "fence-2",
      record: createProfileTargetRecord({
        targetProfile: "deepseek",
        reason: "switch",
        nowMs: NOW,
      }),
    });
    expect(duplicate.ok && duplicate.value.appended).toBe(false);
    const changed = persistProfileTarget({
      store,
      fenceToken: "fence-3",
      record: createProfileTargetRecord({ targetProfile: "mixed", reason: "revert", nowMs: NOW }),
    });
    expect(changed.ok && changed.value.appended).toBe(true);
    const readLatest = readProfileTarget(store);
    expect(readLatest.ok && readLatest.value?.targetProfile).toBe("mixed");
  });
});

describe("TC-PROFILE-026/028 revert-on-recovery, dedupe and flap stabilization", () => {
  const switchRecord = () =>
    createProfileTargetRecord({
      targetProfile: "deepseek",
      reason: "switch",
      previousProfile: "mixed",
      revertCondition: "quota-exhausted",
      nowMs: NOW,
    });

  test("recovery reverts the target exactly once per episode", () => {
    const recovered = selectionOf({ "coding-plan": available(), deepseek: available() });
    const outcome = evaluateProfileLifecycle({
      profiles: lifecycleChain(),
      selection: recovered,
      persisted: switchRecord(),
      nowMs: NOW,
      providerName: "coding-plan",
    });
    expect(outcome.append).toBe(true);
    expect(outcome.target?.targetProfile).toBe("mixed");
    expect(outcome.target?.reason).toBe("revert");
    expect(outcome.events.filter((event) => event.code === "profile.reverted")).toHaveLength(1);
    const revertedEvent = outcome.events.find((event) => event.code === "profile.reverted");
    expect(revertedEvent?.evidence.providerName).toBe("coding-plan");

    const persisted = createProfileTargetRecord({
      targetProfile: "mixed",
      reason: "revert",
      previousProfile: "deepseek",
      nowMs: NOW,
    });
    const stable = evaluateProfileLifecycle({
      profiles: lifecycleChain(),
      selection: recovered,
      persisted,
      nowMs: NOW,
    });
    expect(stable.append).toBe(false);
    expect(stable.events.some((event) => event.code === "profile.reverted")).toBe(false);
  });

  test("a new episode can record a new revert", () => {
    const exhaustedSelection = selectionOf({
      "coding-plan": exhausted("coding-plan"),
      deepseek: available(),
    });
    const switched = evaluateProfileLifecycle({
      profiles: lifecycleChain(),
      selection: exhaustedSelection,
      persisted: createProfileTargetRecord({
        targetProfile: "mixed",
        reason: "revert",
        nowMs: NOW,
      }),
      nowMs: NOW,
    });
    expect(switched.target?.reason).toBe("switch");
    const recovered = selectionOf({ "coding-plan": available(), deepseek: available() });
    const reverted = evaluateProfileLifecycle({
      profiles: lifecycleChain(),
      selection: recovered,
      persisted: switched.target,
      nowMs: NOW,
    });
    expect(reverted.target?.reason).toBe("revert");
  });
});

describe("TC-PROFILE-027 nothing eligible yields an honest parked decision", () => {
  test("the decision is classified with the full eligibility list and no target", () => {
    const selection = selectionOf({
      "coding-plan": exhausted("coding-plan"),
      deepseek: exhausted("deepseek"),
    });
    expect(selection.ok).toBe(false);
    const outcome = evaluateProfileLifecycle({
      profiles: lifecycleChain(),
      selection,
      persisted: createProfileTargetRecord({
        targetProfile: "mixed",
        reason: "selection",
        nowMs: NOW,
      }),
      nowMs: NOW,
    });
    expect(outcome.append).toBe(false);
    expect(outcome.target).toBeUndefined();
    if (selection.ok) return;
    expect(selection.code).toBe("provider.profile.unavailable");
    expect(selection.eligibility).toHaveLength(2);
    expect(outcome.events.some((event) => event.code === "profile.ineligible")).toBe(true);
  });
});

describe("TC-PROFILE-041 target-profile record is additive and latest-wins", () => {
  test("the record carries its own schema id, store key, reason, and revert condition", () => {
    const record = createProfileTargetRecord({
      targetProfile: "deepseek",
      reason: "switch",
      previousProfile: "mixed",
      revertCondition: "quota-exhausted",
      nowMs: NOW,
    });
    expect(record.schemaVersion).toBe("delivery.provider.profile-target.v1");
    expect(record.targetProfile).toBe("deepseek");
    expect(record.reason).toBe("switch");
    expect(record.revertCondition).toBe("quota-exhausted");
  });
});

describe("TC-PROFILE-053 lifecycle replay", () => {
  test("100 identical lifecycle passes produce identical outcomes", () => {
    const selection = selectionOf({
      "coding-plan": exhausted("coding-plan"),
      deepseek: available(),
    });
    const persisted = createProfileTargetRecord({
      targetProfile: "mixed",
      reason: "selection",
      nowMs: NOW,
    });
    const run = () =>
      JSON.stringify(
        evaluateProfileLifecycle({
          profiles: lifecycleChain(),
          selection,
          persisted,
          nowMs: NOW,
          providerName: "coding-plan",
        }),
      );
    const expected = run();
    for (let index = 0; index < 100; index += 1) expect(run()).toBe(expected);
  });
});

/* ------------------------------------------------------------------------- *
 * GH-377 — exact expiry, cleared condition, and never-parked equivalence.
 * ------------------------------------------------------------------------- */

const parkEntries = {
  "coding-plan": { name: "coding-plan", class: "subscription" as const, enabled: true },
  deepseek: { name: "deepseek", class: "pay-per-token" as const, enabled: true },
};

const quotaPark = (expiresAtMs: number) =>
  createParkRecord({
    subjectKind: "provider",
    subjectName: "coding-plan",
    cause: "quota-exhausted",
    conditions: ["quota-exhausted"],
    createdAtMs: NOW - 1_000,
    expiresAtMs,
    evidence: {},
  });

describe("GH-377 TC-PROFILE-076 the park is inactive at exactly its expiry", () => {
  test("T-1 active, T expired, T+1 expired; the decision follows the read-time rule", () => {
    const expiresAt = NOW;
    const record = quotaPark(expiresAt);
    const verdictAt = (instant: number) =>
      createResolvedProviderProbe(parkEntries, instant, undefined, {
        parks: { ok: true, value: [parkView(record, instant)] },
      });
    expect(verdictAt(expiresAt - 1).probe("coding-plan")).toMatchObject({
      available: false,
      condition: "quota-exhausted",
    });
    expect(verdictAt(expiresAt).probe("coding-plan")).toMatchObject({
      available: true,
      condition: "clear",
    });
    expect(verdictAt(expiresAt + 1).probe("coding-plan")).toMatchObject({
      available: true,
      condition: "clear",
    });

    const expired = selectProfile({
      profiles: mixedChain(),
      probe: verdictAt(expiresAt),
      nowMs: expiresAt,
    });
    if (!expired.ok) throw new Error("expired selection failed");
    expect(expired.decision.profile).toBe("mixed");
    expect(expired.decision.seatModels.pm).toBe("claude-opus");
  });
});

describe("GH-377 TC-PROFILE-077 a cleared condition restores the profile before expiry", () => {
  test("the cleared generation wins while its expiry is still in the future", () => {
    const active = quotaPark(NOW + 3_600_000);
    const before = createResolvedProviderProbe(parkEntries, NOW, undefined, {
      parks: { ok: true, value: [parkView(active, NOW)] },
    });
    expect(before.probe("coding-plan")).toMatchObject({
      available: false,
      condition: "quota-exhausted",
    });

    const cleared = clearParkRecord(active, NOW);
    const after = createResolvedProviderProbe(parkEntries, NOW, undefined, {
      parks: { ok: true, value: [parkView(cleared, NOW)] },
    });
    expect(after.probe("coding-plan")).toMatchObject({ available: true, condition: "clear" });
    const selection = selectProfile({ profiles: mixedChain(), probe: after, nowMs: NOW });
    if (!selection.ok) throw new Error("cleared selection failed");
    expect(selection.decision.profile).toBe("mixed");
    expect(selection.decision.seatModels.pm).toBe("claude-opus");
  });
});

describe("GH-377 TC-PROFILE-078 a never-parked state yields the identical decision", () => {
  test("an expired park and an absent park produce the same selection", () => {
    const expired = createResolvedProviderProbe(parkEntries, NOW, undefined, {
      parks: { ok: true, value: [parkView(quotaPark(NOW), NOW)] },
    });
    const never = createResolvedProviderProbe(parkEntries, NOW, undefined, {
      parks: { ok: true, value: [] },
    });
    const expiredSelection = selectProfile({ profiles: mixedChain(), probe: expired, nowMs: NOW });
    const neverSelection = selectProfile({ profiles: mixedChain(), probe: never, nowMs: NOW });
    expect(JSON.stringify(expiredSelection)).toBe(JSON.stringify(neverSelection));
  });
});
