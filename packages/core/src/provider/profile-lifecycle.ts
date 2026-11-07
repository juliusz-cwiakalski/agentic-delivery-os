/**
 * Provider profile lifecycle — park/switch/revert and target persistence
 * (GH-234 F-6; EVT-1..EVT-4).
 *
 * Runtime-neutral: the policy is pure over the selection result, the persisted
 * target, and the injected clock. The single state writer in this module takes
 * an injected store port and mirrors the delivered park persistence discipline:
 * one fenced append, latest-wins record, verified post-append read, and no
 * schema-version bump.
 */
import {
  type ProfileEvent,
  type ProfileSelectionResult,
  type ProfileTargetRecord,
  type ProfileTargetReason,
  PROFILE_TARGET_RECORD_KEY,
  PROFILE_TARGET_SCHEMA_ID,
  type ProviderProfileConfiguration,
  type StateJsonValue,
  type StateResult,
  type StateStorePort,
} from "#contracts";
import { formatUtcIso } from "./parks.js";
import { createProfileEvent, projectProfileEvidence } from "./profile.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export type ProfileTargetRecordInput = {
  readonly targetProfile: string;
  readonly reason: ProfileTargetReason;
  readonly previousProfile?: string;
  readonly revertCondition?: string;
  readonly providerName?: string;
  readonly nowMs: number;
};

/** Construct one target-profile record payload (EVT-4). */
export const createProfileTargetRecord = (
  input: ProfileTargetRecordInput,
): ProfileTargetRecord => ({
  schemaVersion: PROFILE_TARGET_SCHEMA_ID,
  targetProfile: input.targetProfile,
  reason: input.reason,
  ...(input.previousProfile === undefined ? {} : { previousProfile: input.previousProfile }),
  ...(input.revertCondition === undefined ? {} : { revertCondition: input.revertCondition }),
  ...(input.providerName === undefined ? {} : { providerName: input.providerName }),
  createdAt: formatUtcIso(input.nowMs),
  createdAtMs: input.nowMs,
  evidence: projectProfileEvidence({
    profileName: input.targetProfile,
    reason: input.reason,
    ...(input.previousProfile === undefined ? {} : { previousProfile: input.previousProfile }),
    ...(input.revertCondition === undefined ? {} : { revertCondition: input.revertCondition }),
    ...(input.providerName === undefined ? {} : { providerName: input.providerName }),
  }),
});

const targetFromJson = (value: unknown): ProfileTargetRecord | undefined => {
  if (!isRecord(value)) return undefined;
  if (value.schemaVersion !== PROFILE_TARGET_SCHEMA_ID) return undefined;
  if (typeof value.targetProfile !== "string") return undefined;
  if (value.reason !== "selection" && value.reason !== "switch" && value.reason !== "revert") {
    return undefined;
  }
  if (typeof value.createdAt !== "string" || typeof value.createdAtMs !== "number") {
    return undefined;
  }
  return value as unknown as ProfileTargetRecord;
};

const readKey = (store: StateStorePort, key: string): StateResult<StateJsonValue | undefined> => {
  const read = store.read({ requiredKeys: [key] });
  if (read.ok) return { ok: true, value: read.value.values[key] };
  if (read.error.code === "state.keys.missing") return { ok: true, value: undefined };
  return read;
};

/** Read the latest persisted target profile, or undefined when none is recorded. */
export const readProfileTarget = (
  store: StateStorePort,
): StateResult<ProfileTargetRecord | undefined> => {
  const probe = store.read({ requiredKeys: [] });
  if (!probe.ok) return probe;
  if (probe.value.evidence.verifiedEmpty) return { ok: true, value: undefined };
  const value = readKey(store, PROFILE_TARGET_RECORD_KEY);
  if (!value.ok) return value;
  if (value.value === undefined) return { ok: true, value: undefined };
  const record = targetFromJson(value.value);
  if (record === undefined) {
    return {
      ok: false,
      error: {
        kind: "state",
        code: "state.store.torn",
        consequence: "not_landed",
        location: { path: PROFILE_TARGET_RECORD_KEY },
      },
    };
  }
  return { ok: true, value: record };
};

export type PersistProfileTargetInput = {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly record: ProfileTargetRecord;
};

export type PersistProfileTargetOutcome = {
  readonly record: ProfileTargetRecord;
  readonly appended: boolean;
};

/**
 * Persist a target record only when it differs from the latest record; the
 * append is fenced and verified by a post-append read.
 */
export const persistProfileTarget = (
  input: PersistProfileTargetInput,
): StateResult<PersistProfileTargetOutcome> => {
  const acquired = input.store.acquireFence(input.fenceToken);
  if (!acquired.ok) return acquired;
  const handle = acquired.value.handle;
  const release = (): void => {
    input.store.releaseFence(handle);
  };
  const previous = readProfileTarget(input.store);
  if (!previous.ok) {
    release();
    return previous;
  }
  if (
    previous.value !== undefined &&
    previous.value.targetProfile === input.record.targetProfile &&
    previous.value.reason === input.record.reason
  ) {
    release();
    return { ok: true, value: { record: previous.value, appended: false } };
  }
  const appended = input.store.append(handle, {
    kind: "provider.profile-target",
    recordKey: PROFILE_TARGET_RECORD_KEY,
    payload: input.record as unknown as StateJsonValue,
  });
  if (!appended.ok) {
    release();
    return appended;
  }
  const verified = readProfileTarget(input.store);
  release();
  if (!verified.ok) return verified;
  if (verified.value?.targetProfile !== input.record.targetProfile) {
    return {
      ok: false,
      error: {
        kind: "state",
        code: "state.store.torn",
        consequence: "not_landed",
        location: { path: PROFILE_TARGET_RECORD_KEY },
      },
    };
  }
  return { ok: true, value: { record: input.record, appended: true } };
};

export type ProfileLifecycleInput = {
  readonly profiles: ProviderProfileConfiguration;
  readonly selection: ProfileSelectionResult;
  readonly persisted?: ProfileTargetRecord;
  readonly nowMs: number;
  readonly providerName?: string;
};

export type ProfileLifecycleOutcome = {
  readonly selection: ProfileSelectionResult;
  readonly target?: ProfileTargetRecord;
  readonly events: readonly ProfileEvent[];
  readonly append: boolean;
};

const deriveRevertCondition = (selection: ProfileSelectionResult): string => {
  if (!selection.ok) return "provider-recovered";
  const refused = selection.decision.eligibility.find((entry) => entry.verdict === "ineligible");
  const condition = refused?.blockers.find((blocker) => blocker.kind === "condition");
  return condition === undefined ? "provider-recovered" : condition.value;
};

const dedupe = (events: readonly ProfileEvent[]): readonly ProfileEvent[] =>
  events.filter(
    (event, index, all) =>
      all.findIndex((candidate) => candidate.identity === event.identity) === index,
  );

/**
 * Compute switch/revert events and the target record for one resolution.
 *
 * - selected base with a persisted non-base target → revert (once per episode)
 * - selected non-base with a different persisted target → switch
 * - unchanged target → no event, no append
 */
export const evaluateProfileLifecycle = (input: ProfileLifecycleInput): ProfileLifecycleOutcome => {
  const selection = input.selection;
  if (!selection.ok) {
    return { selection, events: selection.events, append: false };
  }
  const base = input.profiles.preferenceChain?.base;
  const selected = selection.decision.profile;
  const persistedTarget = input.persisted?.targetProfile;
  const events: ProfileEvent[] = [...selection.events];
  const providerName = input.providerName;

  if (base !== undefined && selected === base) {
    if (persistedTarget !== undefined && persistedTarget !== base) {
      const revertCondition = input.persisted?.revertCondition;
      const recoveringProvider = providerName ?? input.persisted?.providerName;
      events.push(
        createProfileEvent({
          code: "profile.reverted",
          createdAtMs: input.nowMs,
          message: `profile target reverted to ${base}`,
          evidence: {
            profileName: base,
            previousProfile: persistedTarget,
            newProfile: base,
            reason: "revert",
            ...(recoveringProvider === undefined ? {} : { providerName: recoveringProvider }),
            ...(revertCondition === undefined ? {} : { revertCondition }),
          },
        }),
      );
      const target = createProfileTargetRecord({
        targetProfile: base,
        reason: "revert",
        previousProfile: persistedTarget,
        ...(recoveringProvider === undefined ? {} : { providerName: recoveringProvider }),
        ...(revertCondition === undefined ? {} : { revertCondition }),
        nowMs: input.nowMs,
      });
      const deduped = dedupe(events);
      return {
        selection: { ...selection, outcome: "reverted", target, events: deduped },
        target,
        events: deduped,
        append: true,
      };
    }
    const deduped = dedupe(events);
    return { selection: { ...selection, events: deduped }, events: deduped, append: false };
  }

  if (persistedTarget === selected) {
    const deduped = dedupe(events);
    return { selection: { ...selection, events: deduped }, events: deduped, append: false };
  }
  const revertCondition = deriveRevertCondition(selection);
  const previous = persistedTarget ?? base ?? "none";
  events.push(
    createProfileEvent({
      code: "profile.switched",
      createdAtMs: input.nowMs,
      message: `profile target switched from ${previous} to ${selected}`,
      evidence: {
        profileName: selected,
        previousProfile: previous,
        newProfile: selected,
        reason: "switch",
        revertCondition,
        ...(providerName === undefined ? {} : { providerName }),
      },
    }),
  );
  const target = createProfileTargetRecord({
    targetProfile: selected,
    reason: "switch",
    previousProfile: previous,
    revertCondition,
    ...(providerName === undefined ? {} : { providerName }),
    nowMs: input.nowMs,
  });
  const deduped = dedupe(events);
  return {
    selection: { ...selection, outcome: "switched", target, events: deduped },
    target,
    events: deduped,
    append: true,
  };
};
