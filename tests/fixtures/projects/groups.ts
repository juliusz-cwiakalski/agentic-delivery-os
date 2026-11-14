/**
 * GH-309 project-group fixtures: real member checkouts with minted durable keys,
 * declared-member configuration documents, and a deterministic document writer.
 *
 * Every checkout lives under the approved temp base, its identity marker is
 * minted through the delivered scope policy, and no fixture writes an index or
 * touches `$HOME`. Configuration documents are per-case data, never `*.test.ts`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PROJECT_GROUPS_CONFIG_SCHEMA } from "../../../packages/core/src/contracts/projects";
import type { ProductionProjectsHarness } from "./production";
import { type HostFixture, projectScopeFor } from "./state-scope";
import { createRepository } from "./temp-repos";

/** One real checkout plus the durable repository key its marker records. */
export type MemberCheckout = {
  readonly root: string;
  readonly repoKey: string;
};

/** Create one checkout and mint its durable identity marker. */
export const createMemberCheckout = (
  parent: string,
  name: string,
  host: HostFixture,
): MemberCheckout => {
  const root = createRepository(parent, name);
  const scope = projectScopeFor({
    cwd: root,
    hostRoot: host.hostRoot,
    home: host.home,
    brand: host.brand,
  });
  if (scope.scope.kind !== "project") {
    throw new Error(`the fixture checkout ${root} did not resolve to a project scope`);
  }
  return { root, repoKey: scope.scope.projectKey };
};

/** One declared member selector as the YAML document spells it. */
export type MemberDeclaration = {
  readonly selector: "root" | "repoKey";
  readonly value: string;
  readonly trackerKind?: string;
};

const yamlString = (value: string): string => JSON.stringify(value);

/** Render one `delivery.projects.groups.v1` document with a single group. */
export const projectGroupsDocument = (input: {
  readonly groupKey: string;
  readonly name?: string;
  readonly workspaceRoot?: string;
  readonly members: readonly MemberDeclaration[];
}): string => {
  const memberLines = input.members.flatMap((member) => [
    `      - ${member.selector}: ${yamlString(member.value)}`,
    `        trackerKind: ${member.trackerKind ?? "github"}`,
  ]);
  return [
    `schema: ${PROJECT_GROUPS_CONFIG_SCHEMA}`,
    "groups:",
    `  - groupKey: ${input.groupKey}`,
    `    name: ${input.name ?? "Fixture Group"}`,
    ...(input.workspaceRoot === undefined
      ? []
      : [`    workspaceRoot: ${yamlString(input.workspaceRoot)}`]),
    "    members:",
    ...memberLines,
    "",
  ].join("\n");
};

/** The per-case configuration document path inside one invoking checkout. */
export const projectGroupsConfigPathFor = (harness: ProductionProjectsHarness): string =>
  join(harness.checkout, harness.brand.configDirectoryName, "projects.yaml");

/** Write one configuration document into the invoking checkout. */
export const writeProjectGroupsConfig = (
  harness: ProductionProjectsHarness,
  text: string,
): string => {
  const path = projectGroupsConfigPathFor(harness);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return path;
};
