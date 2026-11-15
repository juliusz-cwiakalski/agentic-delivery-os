/**
 * TC-XPLAN-003 bounds table (AC-F1-4, DEC-10): rejected over-bound cases and
 * the inclusive boundary pair (8 members, 8 dependsOn, 16 gates, 64-char ref).
 */
import { API_MEMBER } from "../../cross-repository/constants";
import { memberSpec, planYaml } from "../../cross-repository/plan";

/** A change ref of exactly `length` characters (`GH-` plus digits). */
const changeRefOfLength = (length: number): string => `GH-${"1"}${"0".repeat(length - 4)}`;

/** `a-00000000` is the shortest member key, so the ref length is controllable. */
const SHORT_KEY = "a-00000000";

/** Eight short declared keys `a-00000000`..`h-00000000`. */
const KEYS = Array.from({ length: 8 }, (_, index) => `${String.fromCharCode(97 + index)}-00000000`);

export const OVER_MEMBER_COUNT_PLAN = planYaml({
  members: Array.from({ length: 9 }, (_, index) =>
    memberSpec(API_MEMBER, {
      repoKey: `${String.fromCharCode(97 + index)}-00000000`,
      dependsOn: [],
      gates: ["ci-green"],
    }),
  ),
});

export const OVER_DEPENDS_ON_PLAN = planYaml({
  members: KEYS.map((repoKey, index) =>
    memberSpec(API_MEMBER, {
      repoKey,
      dependsOn: index === 7 ? [...KEYS.slice(0, 7), KEYS[0], KEYS[1]] : [],
      gates: ["ci-green"],
    }),
  ),
});

export const OVER_GATES_PLAN = planYaml({
  members: [
    memberSpec(API_MEMBER, {
      gates: Array.from({ length: 17 }, (_, index) => `gate-${String(index)}`),
    }),
  ],
});

/** A 65-character derived member ref: ref 54 + `@` + key 10. */
export const OVER_LENGTH_MEMBER_REF_PLAN = planYaml({
  workItemRef: changeRefOfLength(54),
  members: [memberSpec(API_MEMBER, { repoKey: SHORT_KEY, dependsOn: [], gates: ["ci-green"] })],
});

/** A 64-character derived member ref: ref 53 + `@` + key 10. */
export const BOUNDARY_MEMBER_REF_PLAN = planYaml({
  workItemRef: changeRefOfLength(53),
  members: [memberSpec(API_MEMBER, { repoKey: SHORT_KEY, dependsOn: [], gates: ["ci-green"] })],
});

/** Exactly 8 members, 8 edges on one member, 16 gates on every member. */
export const AT_BOUND_PLAN = planYaml({
  members: KEYS.map((repoKey, index) =>
    memberSpec(API_MEMBER, {
      repoKey,
      dependsOn: index === 7 ? [...KEYS.slice(0, 7), KEYS[0]] : [],
      gates: Array.from({ length: 16 }, (_, gate) => `gate-${String(gate)}`),
    }),
  ),
});
