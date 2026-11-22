/**
 * Deterministic CLI data fixtures for the profile/watch golden and behaviour
 * suites (GH-234 F-9). No clock, path, or vendor body is embedded.
 */
import type {
  ProfileEligibility,
  ProfileEvent,
  ProfileSelectionDecision,
  ProfileSelectionResult,
} from "../../../../../packages/core/src/contracts/index";
import { createResolvedProviderProbe } from "../../../../../packages/cli/src/edge";
import {
  createProfileTargetRecord,
  evaluateProfileLifecycle,
  selectProfile,
} from "../../../../../packages/core/src/provider/index";
import { createParkRecord, parkView } from "../../../../../packages/core/src/provider/parks";
import { mixedChain } from "../selection/fixtures";

const NOW = 1_700_000_000_000;

/**
 * The committed recorded-park fixture: coding-plan carries an active
 * `quota-exhausted` park, deepseek is clear. The golden decision is the pure
 * selection over that fixture, projected through the delivered lifecycle so the
 * pinned switched envelope is reachable from recorded facts rather than a
 * canned literal (GH-377 TC-PROFILE-089/090).
 */
const recordedParkSelection = () => {
  const base = mixedChain();
  const deepseek = base.profiles.deepseek;
  if (deepseek === undefined) throw new Error("golden deepseek profile missing");
  const profiles = {
    ...base,
    profiles: {
      ...base.profiles,
      deepseek: { ...deepseek, agentOverrides: { reviewer: "coder" } },
    },
  };
  const park = createParkRecord({
    subjectKind: "provider",
    subjectName: "coding-plan",
    cause: "quota-exhausted",
    conditions: ["quota-exhausted"],
    createdAtMs: NOW - 1_000,
    expiresAtMs: NOW + 3_600_000,
    evidence: {},
  });
  const selection = selectProfile(
    {
      profiles,
      probe: createResolvedProviderProbe(
        {
          "coding-plan": { name: "coding-plan", class: "subscription", enabled: true },
          deepseek: { name: "deepseek", class: "pay-per-token", enabled: true },
        },
        NOW,
        undefined,
        { parks: { ok: true, value: [parkView(park, NOW)] } },
      ),
      nowMs: NOW,
    },
    { rung: "conserve" },
  );
  if (!selection.ok) throw new Error("recorded-park golden selection failed");
  const lifecycle = evaluateProfileLifecycle({
    profiles,
    selection,
    persisted: createProfileTargetRecord({
      targetProfile: "mixed",
      reason: "selection",
      nowMs: NOW,
    }),
    nowMs: NOW,
    providerName: "coding-plan",
  });
  return { selection, lifecycle };
};

const recordedPark = recordedParkSelection();
const selectedSelection = recordedPark.selection;
if (!selectedSelection.ok) throw new Error("recorded-park golden selection failed");

export const eligibility: readonly ProfileEligibility[] = selectedSelection.decision.eligibility;

export const selectedEvent: ProfileEvent = selectedSelection.events[0] as ProfileEvent;

export const switchedEvent: ProfileEvent =
  recordedPark.lifecycle.events.find((event) => event.code === "profile.switched") ??
  selectedEvent;

export const profileDecision = (): ProfileSelectionDecision => selectedSelection.decision;

export const selectedResult = (): ProfileSelectionResult => recordedPark.lifecycle.selection;

export const refusedResult = (): ProfileSelectionResult => ({
  ok: false,
  code: "provider.profile.unavailable",
  summary: "no provider profile is eligible under the current conditions",
  eligibility: [
    {
      profile: "mixed",
      verdict: "ineligible",
      blockers: [{ kind: "condition", value: "quota-exhausted", detail: "coding-plan" }],
    },
    {
      profile: "deepseek",
      verdict: "ineligible",
      blockers: [{ kind: "condition", value: "provider-outage", detail: "deepseek" }],
    },
  ],
  events: [],
});

export const envRecord = {
  recordFormat: "data-v1" as const,
  entries: [
    { operation: "set" as const, name: "OC_ADOS_AGENT_PM_MODEL", value: "deepseek-reasoner" },
    { operation: "set" as const, name: "OC_ADOS_AGENT_CODER_MODEL", value: "deepseek-chat" },
  ],
  serialized:
    "# model-env data-v1\nset OC_ADOS_AGENT_PM_MODEL=deepseek-reasoner\nset OC_ADOS_AGENT_CODER_MODEL=deepseek-chat\n",
};

export const watchProviders = [
  {
    name: "coding-plan",
    condition: "clear",
    source: "weekly 61%, rolling 12%",
    checkedAt: "2023-11-14T22:13:20.000Z",
    // Live-read semantics (GH-350 F-7): the observation instant is the read
    // instant, so the age is zero and the effective bound is the default.
    observedAt: "2023-11-14T22:13:20.000Z",
    ageSeconds: 0,
    maxAgeSeconds: 900,
  },
  {
    name: "deepseek",
    condition: "clear",
    source: "balance 12.50 vs floor 5.00",
    checkedAt: "2023-11-14T22:13:20.000Z",
    observedAt: "2023-11-14T22:13:20.000Z",
    ageSeconds: 0,
    maxAgeSeconds: 900,
  },
  {
    name: "openai",
    condition: "quota-exhausted",
    source: "5h 100%, weekly 61%",
    checkedAt: "2023-11-14T22:13:20.000Z",
    observedAt: "2023-11-14T22:13:20.000Z",
    ageSeconds: 0,
    maxAgeSeconds: 900,
  },
] as const;
