/**
 * TC-XPLAN-007 repoKey grammar table (AC-F1-6, DEC-15): the delivered
 * `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?-[0-9a-f]{8}$` grammar, rejected shapes and
 * accepted boundary keys.
 */
import { API_MEMBER } from "../../cross-repository/constants";
import { memberSpec, planYaml } from "../../cross-repository/plan";

export type GrammarCase = {
  readonly name: string;
  readonly repoKey: string;
};

const plan = (repoKey: string): string =>
  planYaml({ members: [memberSpec(API_MEMBER, { repoKey })] });

export const REJECTED_REPO_KEYS: readonly GrammarCase[] = [
  { name: "missing hex suffix", repoKey: "api-service" },
  { name: "uppercase prefix", repoKey: "API-service-1a2b3c4d" },
  { name: "leading hyphen", repoKey: "-api-1a2b3c4d" },
  { name: "trailing hyphen", repoKey: "api--1a2b3c4d" },
  { name: "embedded space", repoKey: "api service-1a2b3c4d" },
  { name: "nine hex suffix", repoKey: "api-1a2b3c4d5" },
  { name: "underscore", repoKey: "api_service-1a2b3c4d" },
  { name: "seven hex suffix", repoKey: "api-1a2b3c4" },
];

export const ACCEPTED_REPO_KEYS: readonly GrammarCase[] = [
  { name: "minimal matching key", repoKey: "a-00000000" },
  { name: "multi-segment key", repoKey: "api-service-1a2b3c4d" },
  { name: "minted fixture key", repoKey: API_MEMBER.repoKey },
];

/** The rejected-key plan for one case. */
export const rejectedPlan = (name: string): string => {
  const fixture = REJECTED_REPO_KEYS.find((candidate) => candidate.name === name);
  if (fixture === undefined) throw new Error(`unknown grammar case ${name}`);
  return plan(fixture.repoKey);
};

/** The accepted-key plan for one case. */
export const acceptedPlan = (name: string): string => {
  const fixture = ACCEPTED_REPO_KEYS.find((candidate) => candidate.name === name);
  if (fixture === undefined) throw new Error(`unknown grammar case ${name}`);
  return plan(fixture.repoKey);
};
