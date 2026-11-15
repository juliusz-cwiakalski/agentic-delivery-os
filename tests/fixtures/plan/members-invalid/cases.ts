/**
 * TC-XPLAN-002 defect table (AC-F1-2): each case is one plan variant with one
 * declared member defect and the exact `members[i].<field>` it must classify.
 * The two-member baseline is the valid fixture; each entry mutates it.
 */
import { API_MEMBER, WEB_MEMBER } from "../../cross-repository/constants";
import { type MemberSpec, memberSpec, planYaml } from "../../cross-repository/plan";

export type InvalidMemberCase = {
  readonly name: string;
  readonly plan: string;
  readonly field: string;
};

const base = (members: readonly MemberSpec[]): string => planYaml({ members });

const api = memberSpec(API_MEMBER, { dependsOn: [] });
const web = memberSpec(WEB_MEMBER, { dependsOn: [API_MEMBER.repoKey] });

export const INVALID_MEMBER_CASES: readonly InvalidMemberCase[] = [
  {
    name: "duplicate repoKey",
    plan: base([api, { ...web, repoKey: API_MEMBER.repoKey }]),
    field: "members[1].repoKey",
  },
  {
    name: "unknown dependency target",
    plan: base([api, { ...web, dependsOn: ["ghost-repo-00000000"] }]),
    field: "members[1].dependsOn",
  },
  {
    name: "self edge",
    plan: base([api, { ...web, dependsOn: [WEB_MEMBER.repoKey] }]),
    field: "members[1].dependsOn",
  },
  {
    name: "dependency cycle",
    plan: base([
      { ...api, dependsOn: [WEB_MEMBER.repoKey] },
      { ...web, dependsOn: [API_MEMBER.repoKey] },
    ]),
    field: "members[0].dependsOn",
  },
  {
    name: "unknown member key",
    plan: base([{ ...api, owner: "someone" }, web]),
    field: "members[0].owner",
  },
];
