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

const NOW = 1_700_000_000_000;

export const eligibility: readonly ProfileEligibility[] = [
  {
    profile: "mixed",
    verdict: "ineligible",
    blockers: [
      {
        kind: "condition",
        value: "quota-exhausted",
        detail: "coding-plan: weekly window at threshold",
      },
    ],
  },
  { profile: "deepseek", verdict: "eligible", blockers: [] },
];

export const selectedEvent: ProfileEvent = {
  code: "profile.selected",
  severity: "info",
  identity: "profile.selected:deepseek:powerful:rung-conserve:selection:",
  createdAt: "2023-11-14T22:13:20.000Z",
  createdAtMs: NOW,
  message: "selected profile deepseek",
  evidence: { profileName: "deepseek", tier: "powerful", rung: "conserve", reason: "selection" },
};

export const switchedEvent: ProfileEvent = {
  ...selectedEvent,
  code: "profile.switched",
  identity: "profile.switched:deepseek:mixed:deepseek::switch:quota-exhausted:",
  message: "profile target switched from mixed to deepseek",
  evidence: {
    profileName: "deepseek",
    previousProfile: "mixed",
    newProfile: "deepseek",
    reason: "switch",
    revertCondition: "quota-exhausted",
  },
};

export const profileDecision = (): ProfileSelectionDecision => ({
  profile: "deepseek",
  tier: "powerful",
  rung: "conserve",
  agentOverrides: { reviewer: "coder" },
  eligibility,
  events: [switchedEvent],
  seatModels: { pm: "deepseek-reasoner", coder: "deepseek-chat" },
});

export const selectedResult = (): ProfileSelectionResult => ({
  ok: true,
  outcome: "switched",
  decision: profileDecision(),
  target: {
    schemaVersion: "delivery.provider.profile-target.v1",
    targetProfile: "deepseek",
    reason: "switch",
    previousProfile: "mixed",
    revertCondition: "quota-exhausted",
    createdAt: "2023-11-14T22:13:20.000Z",
    createdAtMs: NOW,
    evidence: { profileName: "deepseek", reason: "switch" },
  },
  events: [switchedEvent],
});

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
  },
  {
    name: "deepseek",
    condition: "clear",
    source: "balance 12.50 vs floor 5.00",
    checkedAt: "2023-11-14T22:13:20.000Z",
  },
  {
    name: "openai",
    condition: "quota-exhausted",
    source: "5h 100%, weekly 61%",
    checkedAt: "2023-11-14T22:13:20.000Z",
  },
] as const;
