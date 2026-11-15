/**
 * GH-310 DM-11 static probe: the delivered `VerifyGatesReport` keeps its literal
 * `overall: "pass"` and member-less records, while the additive
 * `CrossRepositoryVerifyGatesReport` widens `overall` and requires `member`.
 *
 * A report is selected by the PRESENCE of `definitionOfDone`, so the two types
 * are not interchangeable in either direction.
 */
import type {
  CrossRepositoryVerifyGateRecord,
  CrossRepositoryVerifyGatesReport,
  VerifyGatesReport,
} from "../../packages/core/src/contracts/verify-gates";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

type DeliveredOverallIsPass = Expect<Equal<VerifyGatesReport["overall"], "pass">>;
type DeliveredOverallIsNotFail = Expect<
  Equal<"fail" extends VerifyGatesReport["overall"] ? true : false, false>
>;
type CrossOverallIsPassOrFail = Expect<
  Equal<CrossRepositoryVerifyGatesReport["overall"], "pass" | "fail">
>;
type MemberIsRequiredString = Expect<Equal<CrossRepositoryVerifyGateRecord["member"], string>>;
type MemberIsRequired = Expect<
  Equal<{} extends Pick<CrossRepositoryVerifyGateRecord, "member"> ? true : false, false>
>;
type DeliveredLacksDefinitionOfDone = Expect<
  Equal<"definitionOfDone" extends keyof VerifyGatesReport ? true : false, false>
>;
type DeliveredIsNotCross = Expect<
  Equal<VerifyGatesReport extends CrossRepositoryVerifyGatesReport ? true : false, false>
>;
type CrossIsNotDelivered = Expect<
  Equal<CrossRepositoryVerifyGatesReport extends VerifyGatesReport ? true : false, false>
>;
type CrossKeepsRequiredDeliveredFields = Expect<
  Equal<"summary" extends keyof CrossRepositoryVerifyGatesReport ? true : false, true>
>;

export type Probes = [
  DeliveredOverallIsPass,
  DeliveredOverallIsNotFail,
  CrossOverallIsPassOrFail,
  MemberIsRequiredString,
  MemberIsRequired,
  DeliveredLacksDefinitionOfDone,
  DeliveredIsNotCross,
  CrossIsNotDelivered,
  CrossKeepsRequiredDeliveredFields,
];
