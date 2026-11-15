/**
 * Stable cross-repository fixture identities (GH-310). Every repoKey matches the
 * delivered project-key grammar; tests never hardcode a key the fixtures do not
 * mint or declare here.
 */

export const CHANGE_REF = "GH-310";

export type MemberFixture = {
  readonly repoKey: string;
  readonly slice: string;
  readonly branch: string;
  readonly pullRequest: string;
  readonly headSha: string;
  /** The member's tracker work-item identity (DM-8): never derived from the ref. */
  readonly issue: string;
  readonly label: string;
};

export const API_MEMBER: MemberFixture = {
  repoKey: "api-service-1a2b3c4d",
  slice: "packages/api — HTTP surface",
  branch: "feat/GH-310/api-slice",
  pullRequest: "311",
  headSha: "1111111111111111111111111111111111111111",
  issue: "411",
  label: "api-service",
};

export const WEB_MEMBER: MemberFixture = {
  repoKey: "web-ui-5e6f7a8b",
  slice: "packages/web — console",
  branch: "feat/GH-310/web-slice",
  pullRequest: "312",
  headSha: "2222222222222222222222222222222222222222",
  issue: "412",
  label: "web-ui",
};

export const DOCS_MEMBER: MemberFixture = {
  repoKey: "docs-site-9c0d1e2f",
  slice: "docs — guide",
  branch: "feat/GH-310/docs-slice",
  pullRequest: "313",
  headSha: "3333333333333333333333333333333333333333",
  issue: "413",
  label: "docs-site",
};

/** The declared member ref for one member identity. */
export const memberRef = (repoKey: string, changeRef: string = CHANGE_REF): string =>
  `${changeRef}@${repoKey}`;
