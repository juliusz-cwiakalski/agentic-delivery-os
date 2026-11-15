/**
 * The cross-repository suite-breadth fixture (GH-300 TC-SCITE-002/TC-SCITE-006):
 * one declared equality map and a two-member green world, with the two additive
 * report fields member-independent.
 */
import type { VerifySuiteMap } from "../../../packages/core/src/contracts/index";
import { EXPECTED_JOBS, run } from "../verify-gates/cases/facts";
import { validEqualityMap } from "../verify-gates/suite-map/cases";
import { API_MEMBER, WEB_MEMBER } from "./constants";
import {
  declaredMember,
  greenMemberReads,
  landingObservation,
  type MemberGatesWorld,
  reviewObservation,
} from "./facts";

/** The declared equality map the cross-repository fixtures cite. */
export const suiteMapDeclaration = (): VerifySuiteMap => validEqualityMap();

/** A two-member green world with the standard workflow job-name set. */
export const suiteMapMemberWorld = (): MemberGatesWorld => ({
  members: [declaredMember(API_MEMBER), declaredMember(WEB_MEMBER)],
  reads: {
    [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER, {
      checkRuns: {
        ok: true,
        value: { items: EXPECTED_JOBS.map((name) => run(name, "succeeded")), pageItemCount: 23 },
      },
    }),
    [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER, {
      checkRuns: {
        ok: true,
        value: { items: EXPECTED_JOBS.map((name) => run(name, "succeeded")), pageItemCount: 23 },
      },
    }),
  },
  landings: [landingObservation(API_MEMBER, true, 1), landingObservation(WEB_MEMBER, true, 2)],
  reviews: [reviewObservation(API_MEMBER), reviewObservation(WEB_MEMBER)],
});
