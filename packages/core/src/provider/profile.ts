/**
 * Provider profile selection policy (GH-234 F-2, F-3, F-4; DM-6, DM-8).
 *
 * Pure and runtime-neutral: imports only core contracts and the pure
 * `./parks` formatter. No ambient clock, randomness, locale, environment, or
 * I/O enters a resolution pass. Identical configuration, provider facts, and
 * injected clock produce identical decisions, eligibility lists, events, and
 * env records (NFR-1).
 */
import {
  type EnvRecord,
  type ProfileBlocker,
  type ProfileEligibility,
  type ProfileEvent,
  type ProfileEvidence,
  type ProfileProbePort,
  type ProfileProviderAvailability,
  type ProfileSelectionDecision,
  type ProfileSelectionResult,
  PROFILE_EVIDENCE_FIELDS,
  PROFILE_EVIDENCE_MAX_BYTES,
  PROFILE_EVENT_SEVERITIES,
  type ProviderEnvRecordPolicy,
  type ProviderProfile,
  type ProviderProfileConfiguration,
  type ProviderProfileSeat,
} from "#contracts";
import { formatUtcIso } from "./parks.js";
import { buildProfileEnvRecord } from "./profile-env-record.js";

export type ProfileSelectionInput = {
  readonly profiles: ProviderProfileConfiguration;
  readonly probe: ProfileProbePort;
  readonly nowMs: number;
  readonly agent?: string;
  readonly requireVision?: boolean;
};

/**
 * Declarative heuristic policy (F-2, DEC-7). Weights and rules are supplied as
 * data; no weight or threshold is embedded in the evaluated path.
 */
export type ProfileHeuristicPolicy = {
  readonly consequenceWeight: number;
  readonly reasoningDepthWeight: number;
  readonly volumeWeight: number;
  readonly amplificationThreshold: number;
  readonly amplificationMultiplier: number;
  readonly familyDiversityMax: number;
};

/** The task facts a scoring pass consumes (F-2). */
export type ProfileTaskFacts = {
  readonly consequenceOfError: number;
  readonly reasoningDepth: number;
  readonly volume: number;
};

/**
 * Score a task under a declared policy: consequence x reasoningDepth / volume,
 * amplified once at the declared threshold. Deterministic and pure.
 */
export const scoreProfileTask = (
  facts: ProfileTaskFacts,
  policy: ProfileHeuristicPolicy,
): number => {
  const base =
    (facts.consequenceOfError *
      policy.consequenceWeight *
      (facts.reasoningDepth * policy.reasoningDepthWeight)) /
    (Math.max(facts.volume, 1) * policy.volumeWeight);
  return base >= policy.amplificationThreshold ? base * policy.amplificationMultiplier : base;
};

/** Whether one more task of a model family stays within the declared diversity cap. */
export const familyDiversityAllowed = (
  familyCount: number,
  policy: ProfileHeuristicPolicy,
): boolean => familyCount < policy.familyDiversityMax;

export type ProfileSelectionOptions = {
  /** The rung label carried by the decision; the pacing engine supplies it. */
  readonly rung?: string;
  /** The seat-model map after pacing; defaults to the selected profile's models. */
  readonly seatModels?: Readonly<Record<string, string>>;
};

const capabilityBlocker = (
  seatName: string,
  seat: ProviderProfileSeat | undefined,
): ProfileBlocker => ({
  kind: "capability",
  value: "vision-capable",
  detail:
    seat === undefined
      ? `seat ${seatName} is not declared`
      : `seat ${seatName} is declared ${seat.capability}`,
});

const conditionBlocker = (
  providerName: string,
  availability: ProfileProviderAvailability,
): ProfileBlocker => ({
  kind: "condition",
  value: availability.condition,
  detail: availability.source.length > 0 ? availability.source : `provider ${providerName}`,
});

const unavailable = (providerName: string): ProfileProviderAvailability => ({
  available: false,
  condition: "provider-outage",
  blockers: [
    {
      kind: "condition",
      value: "provider-outage",
      detail: `probe for provider ${providerName} did not return a verdict`,
    },
  ],
  source: `provider ${providerName}: probe failed`,
});

/** The seat a resolution targets: the agent override, the agent seat, or the first seat. */
export const targetSeatName = (profile: ProviderProfile, agent?: string): string | undefined => {
  if (agent !== undefined) {
    const override = profile.agentOverrides[agent];
    if (override !== undefined) return override;
    if (profile.seats[agent] !== undefined) return agent;
  }
  return Object.keys(profile.seats).sort()[0];
};

/**
 * Structural evidence caps (NFR-8, remediation 10.4). Applied before
 * serialization so a pathological configuration can never carry unbounded
 * evidence into an event; `createProfileEvent` re-asserts the total byte bound
 * afterwards.
 */
const PROFILE_EVIDENCE_STRING_MAX_BYTES = 128;
const PROFILE_EVIDENCE_ARRAY_MAX_ITEMS = 8;
const PROFILE_EVIDENCE_ITEM_MAX_BYTES = 96;
const PROFILE_IDENTITY_MAX_BYTES = 256;

/** Count UTF-8 bytes without a runtime text-encoding API. */
const utf8ByteLength = (text: string): number => {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
};

/** Truncate to at most the byte budget without splitting a code point. */
const truncateToUtf8Bytes = (text: string, maxBytes: number): string => {
  if (utf8ByteLength(text) <= maxBytes) return text;
  let bytes = 0;
  let result = "";
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    const width = code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes + width > maxBytes) break;
    result += character;
    bytes += width;
  }
  return result;
};

/** Project evidence through the closed allowlist and structural caps (NFR-8). */
export const projectProfileEvidence = (evidence: ProfileEvidence): ProfileEvidence => {
  const projected: Record<string, unknown> = {};
  for (const field of PROFILE_EVIDENCE_FIELDS) {
    const value = evidence[field];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      projected[field] = value
        .slice(0, PROFILE_EVIDENCE_ARRAY_MAX_ITEMS)
        .map((item) => truncateToUtf8Bytes(String(item), PROFILE_EVIDENCE_ITEM_MAX_BYTES));
    } else if (typeof value === "string") {
      projected[field] = truncateToUtf8Bytes(value, PROFILE_EVIDENCE_STRING_MAX_BYTES);
    }
  }
  return projected as ProfileEvidence;
};

/**
 * Shrink evidence deterministically until the event fits: first halve the
 * array fields, then halve the longest string, then drop the last field.
 */
const shrinkEvidence = (evidence: ProfileEvidence): ProfileEvidence => {
  const next: Record<string, unknown> = { ...evidence };
  for (const [key, value] of Object.entries(next)) {
    if (Array.isArray(value) && value.length > 0) {
      next[key] = value.slice(0, Math.floor(value.length / 2));
      return next as ProfileEvidence;
    }
  }
  let longestKey: string | undefined;
  let longestBytes = 0;
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === "string") {
      const bytes = utf8ByteLength(value);
      if (bytes > longestBytes) {
        longestKey = key;
        longestBytes = bytes;
      }
    }
  }
  if (longestKey !== undefined && longestBytes > 0) {
    next[longestKey] = truncateToUtf8Bytes(
      next[longestKey] as string,
      Math.floor(longestBytes / 2),
    );
    return next as ProfileEvidence;
  }
  const keys = Object.keys(next);
  const last = keys[keys.length - 1];
  if (last !== undefined) {
    delete next[last];
    return next as ProfileEvidence;
  }
  return evidence;
};

export type ProfileEventInput = {
  readonly code: ProfileEvent["code"];
  readonly severity?: ProfileEvent["severity"];
  readonly createdAtMs: number;
  readonly message: string;
  readonly evidence: ProfileEvidence;
};

/** A deterministic profile event identity from the closed evidence fields. */
export const profileEventIdentity = (input: ProfileEventInput): string => {
  const e = input.evidence;
  return [
    input.code,
    e.profileName ?? "",
    e.previousProfile ?? "",
    e.newProfile ?? "",
    e.tier ?? "",
    e.rung ?? "",
    e.reason ?? "",
    (e.blockers ?? []).join(","),
  ].join(":");
};

/** Construct one structured profile event with bounded evidence (NFR-8). */
export const createProfileEvent = (input: ProfileEventInput): ProfileEvent => {
  const boundedEvidence = projectProfileEvidence(input.evidence);
  const identity = truncateToUtf8Bytes(
    profileEventIdentity({ ...input, evidence: boundedEvidence }),
    PROFILE_IDENTITY_MAX_BYTES,
  );
  const head = {
    code: input.code,
    severity: input.severity ?? PROFILE_EVENT_SEVERITIES[0],
    identity,
    createdAt: formatUtcIso(input.createdAtMs),
    createdAtMs: input.createdAtMs,
  } as const;
  const build = (message: string, evidence: ProfileEvidence): ProfileEvent => ({
    ...head,
    message,
    evidence,
  });

  // Shrink the evidence until the empty-message skeleton fits on its own.
  let evidence = boundedEvidence;
  let skeleton = build("", evidence);
  for (;;) {
    if (utf8ByteLength(JSON.stringify(skeleton)) <= PROFILE_EVIDENCE_MAX_BYTES) break;
    const shrunk = shrinkEvidence(evidence);
    if (shrunk === evidence) break;
    evidence = shrunk;
    skeleton = build("", evidence);
  }
  const budget = Math.max(0, PROFILE_EVIDENCE_MAX_BYTES - utf8ByteLength(JSON.stringify(skeleton)));
  let message = input.message;
  if (utf8ByteLength(message) > budget) {
    message =
      budget > 3
        ? `${truncateToUtf8Bytes(message, budget - 3)}...`
        : truncateToUtf8Bytes(message, budget);
  }
  let event = build(message, evidence);
  // Re-assert the bound after truncation; JSON escaping can widen the text.
  while (utf8ByteLength(JSON.stringify(event)) > PROFILE_EVIDENCE_MAX_BYTES && message.length > 0) {
    message = message.slice(0, -1);
    event = build(message, evidence);
  }
  return event;
};

/**
 * Evaluate the preference chain: capability gate first, then provider
 * eligibility in declared order. Probes are lazy (only profiles reached before
 * a decision) and memoized once per provider per pass (NFR-5). Probe failure is
 * never availability.
 */
export const selectProfile = (
  input: ProfileSelectionInput,
  options: ProfileSelectionOptions = {},
): ProfileSelectionResult => {
  const chain = input.profiles.preferenceChain;
  if (chain === undefined || chain.order.length === 0) {
    return {
      ok: false,
      code: "provider.profile.absent",
      summary: "no provider preference chain is declared",
      eligibility: [],
      events: [],
    };
  }
  const memo = new Map<string, ProfileProviderAvailability>();
  const availability = (providerName: string): ProfileProviderAvailability => {
    const cached = memo.get(providerName);
    if (cached !== undefined) return cached;
    let verdict: ProfileProviderAvailability;
    try {
      verdict = input.probe.probe(providerName);
    } catch {
      verdict = unavailable(providerName);
    }
    memo.set(providerName, verdict);
    return verdict;
  };

  const eligibility: ProfileEligibility[] = [];
  let selected: ProviderProfile | undefined;
  for (const profileName of chain.order) {
    const profile = input.profiles.profiles[profileName];
    if (selected !== undefined) {
      eligibility.push({ profile: profileName, verdict: "shadowed", blockers: [] });
      continue;
    }
    if (profile === undefined) {
      eligibility.push({
        profile: profileName,
        verdict: "ineligible",
        blockers: [
          {
            kind: "condition",
            value: "profile-absent",
            detail: `profile ${profileName} is not declared`,
          },
        ],
      });
      continue;
    }
    const blockers: ProfileBlocker[] = [];
    if (input.requireVision === true) {
      const seatName = targetSeatName(profile, input.agent);
      const seat = seatName === undefined ? undefined : profile.seats[seatName];
      if (seat === undefined || seat.capability !== "vision-capable") {
        blockers.push(capabilityBlocker(seatName ?? "<none>", seat));
      }
    }
    for (const providerName of profile.providers) {
      const verdict = availability(providerName);
      if (!verdict.available) {
        if (verdict.blockers.length > 0) blockers.push(...verdict.blockers);
        else blockers.push(conditionBlocker(providerName, verdict));
      }
    }
    if (blockers.length === 0) {
      selected = profile;
      eligibility.push({ profile: profileName, verdict: "eligible", blockers: [] });
    } else {
      eligibility.push({ profile: profileName, verdict: "ineligible", blockers });
    }
  }

  if (selected === undefined) {
    const allBlockers = eligibility.flatMap((entry) => entry.blockers);
    const capabilityOnly =
      allBlockers.length > 0 && allBlockers.every((blocker) => blocker.kind === "capability");
    const blockers = eligibility.flatMap((entry) =>
      entry.blockers.map((blocker) => `${entry.profile}:${blocker.kind}:${blocker.value}`),
    );
    const event = createProfileEvent({
      code: "profile.ineligible",
      severity: "warning",
      createdAtMs: input.nowMs,
      message: capabilityOnly
        ? "no provider profile satisfies the hard capability gate"
        : "no provider profile is eligible under the current conditions",
      evidence: {
        reason: capabilityOnly ? "capability-gate" : "no-eligible-profile",
        blockers,
      },
    });
    return {
      ok: false,
      code: capabilityOnly ? "provider.profile.capability-denied" : "provider.profile.unavailable",
      summary: capabilityOnly
        ? "no provider profile satisfies the hard capability gate"
        : "no provider profile is eligible under the current conditions",
      eligibility,
      events: [event],
    };
  }

  const rung = options.rung ?? "base";
  const seatModels: Record<string, string> = options.seatModels
    ? { ...options.seatModels }
    : Object.fromEntries(
        Object.entries(selected.seats).map(([seatName, seat]) => [seatName, seat.model]),
      );
  const refusedTop = eligibility.find((entry) => entry.verdict === "ineligible");
  const selectionEvent = createProfileEvent({
    code: "profile.selected",
    createdAtMs: input.nowMs,
    message: `selected profile ${selected.name} at rung ${rung}`,
    evidence: {
      profileName: selected.name,
      tier: selected.tier,
      rung,
      reason: "selection",
      ...(refusedTop === undefined
        ? {}
        : {
            blockers: refusedTop.blockers.map((blocker) => `${blocker.kind}:${blocker.value}`),
          }),
    },
  });
  const decision: ProfileSelectionDecision = {
    profile: selected.name,
    tier: selected.tier,
    rung,
    agentOverrides: selected.agentOverrides,
    eligibility,
    events: [selectionEvent],
    seatModels,
  };
  return { ok: true, outcome: "selected", decision, events: [selectionEvent] };
};

/* ------------------------------------------------------------------------- *
 * Spawn-time resolution (GH-234 F-8, DEC-3, DEC-6).
 *
 * Resolution always runs before the spawn port; a refusal stops the spawn and
 * the env record reaches the port as validated data only.
 * ------------------------------------------------------------------------- */

export type ProfileSpawnPort = {
  readonly spawn: (environment: Readonly<Record<string, string>>) => void;
};

export type ProfileSpawnInput = ProfileSelectionInput & {
  readonly namePrefix: string;
  readonly policy?: ProviderEnvRecordPolicy;
  /**
   * A lifecycle-projected selection from the caller (the production edge).
   * When absent the pure selection runs here; when present the caller's
   * switch/revert outcome and events are preserved.
   */
  readonly selection?: ProfileSelectionResult;
};

export type ProfileSpawnOutcome =
  | {
      readonly ok: true;
      readonly selection: ProfileSelectionResult;
      readonly envRecord: EnvRecord;
      readonly variables: Readonly<Record<string, string>>;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly summary: string;
      readonly eligibility: readonly ProfileEligibility[];
      readonly events: readonly ProfileEvent[];
    };

/** Resolve a profile and build the hardened env record; never spawns. */
export const resolveProfileForSpawn = (input: ProfileSpawnInput): ProfileSpawnOutcome => {
  const selection = input.selection ?? selectProfile(input);
  if (!selection.ok) {
    return {
      ok: false,
      code: selection.code,
      summary: selection.summary,
      eligibility: selection.eligibility,
      events: selection.events,
    };
  }
  const profile = input.profiles.profiles[selection.decision.profile];
  if (profile === undefined) {
    return {
      ok: false,
      code: "provider.profile.invalid",
      summary: `selected profile ${selection.decision.profile} is not declared`,
      eligibility: selection.decision.eligibility,
      events: selection.events,
    };
  }
  const built = buildProfileEnvRecord({
    seatModels: selection.decision.seatModels,
    seats: profile.seats,
    namePrefix: input.namePrefix,
    ...(input.policy === undefined ? {} : { policy: input.policy }),
  });
  if (!built.ok) {
    return {
      ok: false,
      code: built.error.code,
      summary: built.error.detail,
      eligibility: selection.decision.eligibility,
      events: selection.events,
    };
  }
  return {
    ok: true,
    selection: {
      ...selection,
      decision: { ...selection.decision, envRecord: built.record },
    },
    envRecord: built.record,
    variables: built.record.entries.reduce<Record<string, string>>((variables, entry) => {
      if (entry.operation === "set") variables[entry.name] = entry.value;
      return variables;
    }, {}),
  };
};

export type ProfileSpawnRunInput = ProfileSpawnInput & {
  readonly spawnPort: ProfileSpawnPort;
};

/** Resolve before spawning; a refusal stops the port call entirely. */
export const runProfileSpawn = (input: ProfileSpawnRunInput): ProfileSpawnOutcome => {
  const outcome = resolveProfileForSpawn(input);
  if (!outcome.ok) return outcome;
  input.spawnPort.spawn(outcome.variables);
  return outcome;
};
