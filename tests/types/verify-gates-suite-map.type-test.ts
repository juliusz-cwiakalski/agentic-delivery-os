/**
 * GH-300 static probes: both report types carry the two optional suite-breadth
 * fields together, `CommandResultDetail` gains the bounded `suiteBreadth` member
 * beside `holder`, the report union stays discriminated by `definitionOfDone`,
 * and no gate-record or citation type gained a field.
 */
import type {
  CommandResultDetail,
  CrossRepositoryVerifyGatesReport,
  VerifyGateCitation,
  VerifyGateRecord,
  VerifyGatesReport,
  VerifyGatesReportUnion,
  VerifySuiteMap,
  VerifySuiteMapRead,
} from "../../packages/core/src/contracts/index";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

type ReportSuiteBreadthIsOptional = Expect<
  Equal<"suiteBreadth" extends keyof VerifyGatesReport ? true : false, true>
>;
type ReportSuiteBreadthType = Expect<
  Equal<VerifyGatesReport["suiteBreadth"], readonly string[] | undefined>
>;
type ReportMirrorsJobType = Expect<Equal<VerifyGatesReport["mirrorsJob"], string | undefined>>;
type CrossSuiteBreadthType = Expect<
  Equal<CrossRepositoryVerifyGatesReport["suiteBreadth"], readonly string[] | undefined>
>;
type CrossMirrorsJobType = Expect<
  Equal<CrossRepositoryVerifyGatesReport["mirrorsJob"], string | undefined>
>;
type DetailCarriesHolder = Expect<Equal<CommandResultDetail["holder"], string | undefined>>;
type DetailCarriesSuiteBreadth = Expect<
  Equal<CommandResultDetail["suiteBreadth"], readonly string[] | undefined>
>;
type DetailKeySetIsClosed = Expect<Equal<keyof CommandResultDetail, "holder" | "suiteBreadth">>;
type GateRecordKeysUnchanged = Expect<
  Equal<keyof VerifyGateRecord, "id" | "verdict" | "reason" | "citation">
>;
type CitationKeysUnchanged = Expect<
  Equal<keyof VerifyGateCitation, "sources" | "identity" | "counts" | "names" | "reasons">
>;
type BothReportsAreUnionMembers = Expect<
  Equal<
    VerifyGatesReport extends VerifyGatesReportUnion
      ? CrossRepositoryVerifyGatesReport extends VerifyGatesReportUnion
        ? true
        : false
      : false,
    true
  >
>;
type DeclaredMapIsClosed = Expect<Equal<keyof VerifySuiteMap, "schemaVersion" | "jobs" | "local">>;
type ReadFailureCarriesTheConfigCode = Expect<
  Equal<Extract<VerifySuiteMapRead, { readonly ok: false }>["code"], "config.value.invalid">
>;

export type Probes = [
  ReportSuiteBreadthIsOptional,
  ReportSuiteBreadthType,
  ReportMirrorsJobType,
  CrossSuiteBreadthType,
  CrossMirrorsJobType,
  DetailCarriesHolder,
  DetailCarriesSuiteBreadth,
  DetailKeySetIsClosed,
  GateRecordKeysUnchanged,
  CitationKeysUnchanged,
  BothReportsAreUnionMembers,
  DeclaredMapIsClosed,
  ReadFailureCarriesTheConfigCode,
];
