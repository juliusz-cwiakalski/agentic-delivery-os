/**
 * Deterministic cross-repository plan fixture builder (GH-310). The renderer
 * emits real YAML through the same parse path production uses; tests can also
 * mutate one parsed member entry to model a defect.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { API_MEMBER, CHANGE_REF, DOCS_MEMBER, type MemberFixture, WEB_MEMBER } from "./constants";

/** One member declaration as the fixture spells it. */
export type MemberSpec = {
  readonly repoKey?: unknown;
  readonly slice?: unknown;
  readonly branch?: unknown;
  readonly pullRequest?: unknown;
  readonly dependsOn?: readonly unknown[];
  readonly gates?: readonly unknown[];
  readonly [unknownField: string]: unknown;
};

const scalar = (value: unknown): string => JSON.stringify(value);

const array = (values: readonly unknown[]): string => `[${values.map(scalar).join(", ")}]`;

/** Build a member spec from one fixture identity, in declared field order. */
export const memberSpec = (
  member: MemberFixture,
  overrides: Partial<MemberSpec> = {},
): MemberSpec => ({
  repoKey: member.repoKey,
  slice: member.slice,
  branch: member.branch,
  pullRequest: member.pullRequest,
  dependsOn: [],
  gates: ["ci-green", "push-parity"],
  ...overrides,
});

const renderMember = (member: MemberSpec): readonly string[] => {
  const lines: string[] = [];
  const ordered = ["repoKey", "slice", "branch", "pullRequest", "dependsOn", "gates"] as const;
  for (const key of ordered) {
    if (!Object.hasOwn(member, key)) continue;
    const value = member[key];
    if (value === undefined) continue;
    if (Array.isArray(value)) lines.push(`    ${key}: ${array(value)}`);
    else lines.push(`    ${key}: ${scalar(value)}`);
  }
  for (const key of Object.keys(member)) {
    if ((ordered as readonly string[]).includes(key)) continue;
    const value = member[key];
    if (value === undefined) continue;
    if (Array.isArray(value)) lines.push(`    ${key}: ${array(value)}`);
    else lines.push(`    ${key}: ${scalar(value)}`);
  }
  return lines;
};

/** Render one `delivery.plan.v1` document with an optional member set. */
export const planYaml = (
  input: {
    readonly members?: readonly MemberSpec[];
    readonly workItemRef?: string;
    readonly tier?: string;
    readonly phases?: readonly number[];
  } = {},
): string => {
  const lines: string[] = [
    `schemaVersion: "delivery.plan.v1"`,
    `workItemRef: ${scalar(input.workItemRef ?? CHANGE_REF)}`,
    "tier:",
    `  name: ${scalar(input.tier ?? "full")}`,
    `  phases: ${array(input.phases ?? [1, 2])}`,
    `defaultLeases: ["repo:main-tools"]`,
    `defaultWeightClass: "standard"`,
  ];
  if (input.members !== undefined) {
    if (input.members.length === 0) {
      lines.push("members: []");
    } else {
      lines.push("members:");
      for (const member of input.members) {
        const rendered = renderMember(member);
        lines.push(`  - ${rendered[0]?.trimStart() ?? ""}`);
        lines.push(...rendered.slice(1));
      }
    }
  }
  lines.push(
    "phases:",
    `  - id: 1`,
    `    title: "Declare the change"`,
    `    kind: "planning"`,
    `    scope:`,
    `      files: ["doc/changes/chg-GH-310-plan.yaml"]`,
    `  - id: 2`,
    `    title: "Deliver the change"`,
    `    kind: "delivery"`,
    `    scope:`,
    `      files: ["packages/core/src/index.ts"]`,
  );
  return `${lines.join("\n")}\n`;
};

/** The valid two-member baseline plan (`web` dependsOn `api`). */
export const twoMemberPlanYaml = (input: { readonly workItemRef?: string } = {}): string =>
  planYaml({
    ...(input.workItemRef === undefined ? {} : { workItemRef: input.workItemRef }),
    members: [
      memberSpec(API_MEMBER, { gates: ["ci-green", "push-parity", "owner-gate"] }),
      memberSpec(WEB_MEMBER, {
        dependsOn: [API_MEMBER.repoKey],
        gates: ["ci-green", "push-parity"],
      }),
    ],
  });

/** The three-member plan (`docs` declares no `pullRequest`). */
export const threeMemberPlanYaml = (): string =>
  planYaml({
    members: [
      memberSpec(API_MEMBER, { gates: ["ci-green", "push-parity", "owner-gate"] }),
      memberSpec(WEB_MEMBER, {
        dependsOn: [API_MEMBER.repoKey],
        gates: ["ci-green", "push-parity"],
      }),
      memberSpec(DOCS_MEMBER, { pullRequest: undefined, dependsOn: [], gates: ["ci-green"] }),
    ],
  });

/**
 * A member-less baseline: the exact `valid/baseline.yaml` bytes are committed
 * under `tests/fixtures/plan/valid/`, so this builder is only for synthetic
 * worlds that need a plan without members.
 */
export const memberlessPlanYaml = (): string =>
  planYaml({ workItemRef: CHANGE_REF, phases: [1, 2] });

/** Write one change folder: exactly one spec and one plan, no member folder. */
export const writeChangeFolder = (root: string, planText: string): string => {
  const folder = join(root, "doc", "changes", "2026-11", `2026-11-14--${CHANGE_REF}--fixture`);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, `chg-${CHANGE_REF}-spec.md`), "# fixture spec\n");
  writeFileSync(join(folder, `chg-${CHANGE_REF}-plan.yaml`), planText);
  return folder;
};
