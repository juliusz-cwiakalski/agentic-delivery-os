/**
 * Injected review observations (GH-310 F-6, DM-7, DEC-8, DEC-17). One
 * `ReviewObservation` per declared member is the only review input; there is no
 * store, command, or live call to consult.
 */
import type {
  ReviewObservation,
  VerifyGatesReviewObservationVerdict,
} from "../../../packages/core/src/contracts/index";
import { API_MEMBER, type MemberFixture, WEB_MEMBER } from "./constants";

export const reviewFor = (
  member: MemberFixture,
  verdicts: readonly VerifyGatesReviewObservationVerdict[] = ["pass"],
): ReviewObservation => ({
  repoKey: member.repoKey,
  pullRequest: member.pullRequest,
  verdicts,
});

/** One passing observation per member, in declared order. */
export const oneObservationPerMember = (): readonly ReviewObservation[] => [
  reviewFor(API_MEMBER, ["pass"]),
  reviewFor(WEB_MEMBER, ["fail"]),
];

/** A duplicated observation for `web` plus one for `api` (TC-XREV-002). */
export const duplicatedObservation = (): readonly ReviewObservation[] => [
  reviewFor(API_MEMBER, ["pass"]),
  reviewFor(WEB_MEMBER, ["pass"]),
  reviewFor(WEB_MEMBER, ["fail"]),
];

export { API_MEMBER, WEB_MEMBER };
