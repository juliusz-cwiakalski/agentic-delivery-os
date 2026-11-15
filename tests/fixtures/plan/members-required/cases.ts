/**
 * TC-XPLAN-006 required-field and empty-value table (AC-F1-5, DEC-15): each
 * case omits or empties one declared field and names the classified location.
 */
import { API_MEMBER } from "../../cross-repository/constants";
import { type MemberSpec, memberSpec, planYaml } from "../../cross-repository/plan";

export type RequiredMemberCase = {
  readonly name: string;
  readonly plan: string;
  readonly field: string;
};

const only = (member: MemberSpec): string => planYaml({ members: [member] });

const omit = (key: keyof MemberSpec): MemberSpec => {
  const spec: Record<string, unknown> = { ...memberSpec(API_MEMBER) };
  delete spec[key];
  return spec as MemberSpec;
};

export const REQUIRED_MEMBER_CASES: readonly RequiredMemberCase[] = [
  { name: "missing repoKey", plan: only(omit("repoKey")), field: "members[0].repoKey" },
  { name: "missing slice", plan: only(omit("slice")), field: "members[0].slice" },
  { name: "missing branch", plan: only(omit("branch")), field: "members[0].branch" },
  { name: "missing gates", plan: only(omit("gates")), field: "members[0].gates" },
  {
    name: "empty slice",
    plan: only(memberSpec(API_MEMBER, { slice: "" })),
    field: "members[0].slice",
  },
  {
    name: "empty branch",
    plan: only(memberSpec(API_MEMBER, { branch: "" })),
    field: "members[0].branch",
  },
  {
    name: "empty gates",
    plan: only(memberSpec(API_MEMBER, { gates: [] })),
    field: "members[0].gates",
  },
  {
    name: "empty dependsOn element",
    plan: only(memberSpec(API_MEMBER, { dependsOn: [""] })),
    field: "members[0].dependsOn",
  },
  {
    name: "dependsOn is not an array",
    plan: only(memberSpec(API_MEMBER, { dependsOn: "api-service-1a2b3c4d" as never })),
    field: "members[0].dependsOn",
  },
];

/** A correctly populated entry that omits `dependsOn` entirely. */
export const OPTIONAL_DEPENDS_ON_PLAN = (() => {
  const spec: Record<string, unknown> = { ...memberSpec(API_MEMBER) };
  delete spec.dependsOn;
  return planYaml({ members: [spec as MemberSpec] });
})();
