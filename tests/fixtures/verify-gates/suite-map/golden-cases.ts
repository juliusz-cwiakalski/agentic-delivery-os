/**
 * The first-capture golden cases (GH-300 phase 4). One shared builder per case
 * so the capture script and the golden suite cannot drift.
 */
import type { VerifySuiteMap } from "../../../../packages/core/src/contracts/index";
import { API_MEMBER, CHANGE_REF, WEB_MEMBER } from "../../cross-repository/constants";
import {
  declaredMember,
  greenMemberReads,
  landingObservation,
  type MemberGatesWorld,
  memberGatesRuntime,
} from "../../cross-repository/facts";
import { baseFacts, clone, EXPECTED_JOBS, run as pipelineRun } from "../cases/facts";
import { combinedRuntime, type Run, runVerify } from "../cases/harness";
import {
  declaredRead,
  mirrorAbsentMap,
  REFERENCE_JOB,
  reorderedLocalMap,
  validEqualityMap,
  widerMap,
} from "./cases";

/** The standard green facts with the reference mirror corroborated by one run. */
const suiteMapFacts = () => {
  const facts = clone(baseFacts());
  const names = [...EXPECTED_JOBS, REFERENCE_JOB];
  facts.workflow = { outcome: "read", names };
  facts.checkRuns = {
    ok: true,
    value: {
      items: names.map((name) => pipelineRun(name, "succeeded")),
      pageItemCount: names.length,
    },
  };
  return facts;
};

/** Flow 2's declaration: `local: [tests]` against the eight-suite mirror. */
export const narrowedCaseMap = (): VerifySuiteMap => ({
  ...validEqualityMap(),
  local: ["tests"],
});

export const equalityRun = (): Promise<Run> =>
  runVerify(
    combinedRuntime({ facts: suiteMapFacts(), suiteMap: declaredRead(validEqualityMap()) }),
    ["gates", "GH-178"],
  );

export const reorderedRun = (): Promise<Run> =>
  runVerify(
    combinedRuntime({ facts: suiteMapFacts(), suiteMap: declaredRead(reorderedLocalMap()) }),
    ["gates", "GH-178"],
  );

export const equalityHuman = (): Promise<Run> =>
  runVerify(
    combinedRuntime({ facts: suiteMapFacts(), suiteMap: declaredRead(validEqualityMap()) }),
    ["gates", "GH-178"],
    { json: false },
  );

export const narrowedRun = (): Promise<Run> =>
  runVerify(
    combinedRuntime({ facts: suiteMapFacts(), suiteMap: declaredRead(narrowedCaseMap()) }),
    ["gates", "GH-300"],
  );

const memberReads = (member: typeof API_MEMBER) => {
  const names = [...EXPECTED_JOBS, REFERENCE_JOB];
  return greenMemberReads(member, {
    checkRuns: {
      ok: true,
      value: {
        items: names.map((name) => pipelineRun(name, "succeeded")),
        pageItemCount: names.length,
      },
    },
  });
};

export const narrowedMemberRun = (): Promise<Run> => {
  const world: MemberGatesWorld = {
    members: [declaredMember(API_MEMBER), declaredMember(WEB_MEMBER)],
    reads: {
      [API_MEMBER.repoKey]: memberReads(API_MEMBER),
      [WEB_MEMBER.repoKey]: memberReads(WEB_MEMBER),
    },
    landings: [landingObservation(API_MEMBER, true, 1), landingObservation(WEB_MEMBER, true, 2)],
  };
  const base = memberGatesRuntime(world);
  const gates = base.gates;
  if (gates === undefined) throw new Error("missing gates runtime");
  return runVerify(
    {
      ...base,
      gates: {
        ...gates,
        readWorkflow: () => ({
          outcome: "read" as const,
          names: [...EXPECTED_JOBS, REFERENCE_JOB],
        }),
        readSuiteMap: declaredRead(narrowedCaseMap()),
      },
    },
    ["gates", CHANGE_REF],
  );
};

export const causeMirrorRun = (): Promise<Run> =>
  runVerify(
    combinedRuntime({ facts: suiteMapFacts(), suiteMap: declaredRead(mirrorAbsentMap()) }),
    ["gates", "GH-300"],
  );

export const causeBreadthRun = (): Promise<Run> =>
  runVerify(combinedRuntime({ facts: suiteMapFacts(), suiteMap: declaredRead(widerMap()) }), [
    "gates",
    "GH-300",
  ]);
