/**
 * The three-merge serial fixture (TC-F7-004; spec §24.6 Appendix F F8).
 *
 * Three lifecycle merges are offered from the same base: the first is clean and
 * lands once, the second reads `conflicting` directly, and the third reads
 * `unknown` and resolves through the one bounded re-read to `conflicting`. The
 * head is tracked by the injected git seam, so a head mutation is an observable
 * fact rather than an inference.
 *
 * The fixture also exposes the PRE-FIX ATTEMPT as a substitution: the retired
 * path attempted one local rebase-refresh when the request read `conflicting`,
 * and that attempt is injected into the same repaired composition here — no case
 * executes pre-fix code from an earlier commit (test plan GAP-TP-4 / M99). The
 * production composition performs no refresh at all; the substitution is the
 * control, and it must change the observed head.
 */
import {
  createMergeCommandDefinition,
  type MergeCommandRuntime,
} from "../../../packages/cli/src/commands/merge";
import { type CliDependencies, runCli } from "../../../packages/cli/src/index";
import type { DeliveryRequest } from "../../../packages/core/src/contracts/index";
import { bufferSink, SYNTHETIC_BRAND } from "../../golden/helpers";
import {
  baseCheckRuns,
  baseRequest,
  createMergeHarness,
  MERGE_CLOCK_MS,
  MERGE_LANDING_SHA,
  verificationRecord,
} from "./harness";

/** The base head every invocation starts from. */
export const SERIAL_BASE_HEAD = "5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a";
/** The head the pre-fix refresh produced on its first successful rebase. */
export const SERIAL_REFRESHED_HEAD = "6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b";
/** The head a second substitution attempt produces, so two mutations are visible. */
export const SERIAL_RECHECKED_HEAD = "7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c";

/** One invocation's declared provider reading. */
export type SerialInvocation = {
  readonly label: string;
  /** Successive request reads within the invocation, last one repeating. */
  readonly readings: readonly DeliveryRequest[];
};

/** A merge refusal's classified identity. */
export type SerialRefusal = {
  readonly code?: string;
  readonly summary?: string;
};

/** One observed invocation. */
export type SerialObservation = {
  readonly label: string;
  readonly exitCode: number;
  readonly refusal: SerialRefusal;
  readonly landings: number;
  readonly headBefore: string;
  readonly headAfter: string;
  readonly refreshAttempts: number;
};

/** One whole serial run. */
export type SerialRun = {
  readonly mode: "production" | "pre-fix-substituted";
  readonly observations: readonly SerialObservation[];
};

/** The git seam facts the fixture records. */
export type SerialGit = {
  readonly head: () => Promise<string | undefined>;
  readonly isContained: () => Promise<boolean>;
  readonly refresh: () => Promise<{
    readonly outcome: "succeeded";
    readonly oldSha: string;
    readonly newSha: string;
  }>;
  readonly land: () => Promise<{
    readonly ok: true;
    readonly squashSha: string;
    readonly requestState: string;
    readonly containedOnBase: boolean;
  }>;
  readonly deleteBranch: () => Promise<"ok">;
  readonly restoreCheckout: () => Promise<"ok">;
  readonly refreshAttempts: () => readonly string[];
  readonly mutationCount: () => number;
};

/** One recording git seam whose head moves only when the pre-fix attempt runs. */
export const createSerialGit = (): SerialGit => {
  const heads = [SERIAL_BASE_HEAD, SERIAL_REFRESHED_HEAD, SERIAL_RECHECKED_HEAD];
  let index = 0;
  const attempts: string[] = [];
  return {
    head: async () => heads[index],
    isContained: async () => true,
    refresh: async () => {
      const oldSha = heads[index] as string;
      if (index < heads.length - 1) index += 1;
      const newSha = heads[index] as string;
      attempts.push(`${oldSha}->${newSha}`);
      return { outcome: "succeeded", oldSha, newSha };
    },
    land: async () => ({
      ok: true,
      squashSha: MERGE_LANDING_SHA,
      requestState: "merged",
      containedOnBase: true,
    }),
    deleteBranch: async () => "ok",
    restoreCheckout: async () => "ok",
    refreshAttempts: () => [...attempts],
    mutationCount: () => attempts.length,
  };
};

/** One request reading bound to the fixture's tracked head. */
const serialRequest = (overrides: Partial<DeliveryRequest> = {}): DeliveryRequest =>
  baseRequest({
    headSha: SERIAL_BASE_HEAD,
    sourceHeadSha: SERIAL_BASE_HEAD,
    ...overrides,
  });

/** The three declared invocations, in order. */
export const serialThreeInvocations = (): readonly SerialInvocation[] => [
  {
    label: "merge-1",
    readings: [serialRequest({ mergeableState: "mergeable" })],
  },
  {
    label: "merge-2",
    readings: [serialRequest({ mergeableState: "conflicting" })],
  },
  {
    label: "merge-3",
    // The first read cannot decide; the one bounded re-read reports conflicting.
    readings: [
      serialRequest({ mergeableState: "unknown" }),
      serialRequest({ mergeableState: "conflicting" }),
    ],
  },
];

/** Wrap the ports so a `conflicting` read performs the retired refresh attempt. */
const withPreFixRefresh = (runtime: MergeCommandRuntime, git: SerialGit): MergeCommandRuntime => ({
  readConfig: runtime.readConfig,
  createPorts: (changeRef) => {
    const ports = runtime.createPorts(changeRef);
    return {
      ...ports,
      readRequestDetail: async () => {
        const read = await ports.readRequestDetail();
        if (read.ok && read.request.mergeableState === "conflicting") {
          // The pre-fix attempt: one local rebase-refresh before classification.
          await git.refresh();
        }
        return read;
      },
    };
  },
});

const envelopeErrorOf = (envelope: Record<string, unknown> | undefined): SerialRefusal => {
  const error = envelope?.error;
  if (typeof error !== "object" || error === null) return {};
  const record = error as Record<string, unknown>;
  return {
    ...(typeof record.code === "string" ? { code: record.code } : {}),
    ...(typeof record.summary === "string" ? { summary: record.summary } : {}),
  };
};

/**
 * The three change refs the serial fixture merges, one per invocation: three
 * changes from the same base, not three re-runs of one change (a re-run would
 * exercise the delivered replay path, which is `TC-SYNC-005`'s case).
 */
export const serialChangeRef = (index: number): string => `GH-90${String(index + 1)}`;

/** Run the three invocations once, in the requested mode. */
export const runSerialThree = async (
  mode: "production" | "pre-fix-substituted",
): Promise<SerialRun> => {
  const git = createSerialGit();
  const observations: SerialObservation[] = [];
  const invocations = serialThreeInvocations();
  for (let index = 0; index < invocations.length; index += 1) {
    const invocation = invocations[index] as SerialInvocation;
    const changeRef = serialChangeRef(index);
    const harness = createMergeHarness({
      ref: changeRef,
      git: {
        head: git.head,
        isContained: () => git.isContained(),
        refresh: () => git.refresh(),
        land: async () => {
          const landed = await git.land();
          return {
            ok: true,
            squashSha: landed.squashSha,
            requestState: landed.requestState,
            containedOnBase: landed.containedOnBase,
          };
        },
        deleteBranch: () => git.deleteBranch(),
        restoreCheckout: () => git.restoreCheckout(),
      },
      request: serialRequest({ mergeableState: "mergeable" }),
      // The check page is bound to the fixture's tracked head: the CI gate's
      // head evidence is the resolved head (5a5a...), not the fixture default.
      checkRuns: { ...baseCheckRuns(), sha: SERIAL_BASE_HEAD },
    });
    try {
      harness.seedVerification(verificationRecord({ changeRef, headSha: SERIAL_BASE_HEAD }));
      let readIndex = 0;
      // Each invocation merges its own change: the served request carries the
      // invocation's own conforming source ref (the resolution candidate
      // filter matches the invocation ref's convention, not a shared branch).
      harness.setRequest(() => {
        const readingIndex = Math.min(readIndex, invocation.readings.length - 1);
        readIndex += 1;
        const reading = invocation.readings[readingIndex] as DeliveryRequest;
        return { ...reading, sourceRef: `feat/${changeRef}/serial` };
      });
      // The declared CI workflow (F-2): a healthy read naming the check page's
      // green jobs, so the merge-applicable CI gate evaluates green and the
      // serial sequence exercises the landing/sync paths it owns.
      const runtime =
        mode === "pre-fix-substituted"
          ? withPreFixRefresh(harness.runtime, git)
          : {
              ...harness.runtime,
              createPorts: (changeRef: string) => ({
                ...harness.runtime.createPorts(changeRef),
                readCiWorkflow: async () => ({
                  outcome: "read" as const,
                  names: ["CI / test (18)", "CI / lint"],
                }),
              }),
            };
      const definition = createMergeCommandDefinition(runtime);
      const headBefore = (await git.head()) as string;
      const landingsBefore = harness.counts.landing;
      const refreshBefore = git.mutationCount();
      const stdout = bufferSink();
      const stderr = bufferSink();
      let tick = 0;
      const deps: CliDependencies = {
        brand: SYNTHETIC_BRAND,
        clock: {
          now: () => {
            const value = tick === 0 ? MERGE_CLOCK_MS : MERGE_CLOCK_MS + 7;
            tick += 1;
            return value;
          },
        },
        newRunId: () => `run-serial-${invocation.label}`,
        secrets: [],
        program: { commands: { merge: definition } },
        mode: "interactive",
      };
      const exitCode = await runCli(["--json", "merge", changeRef], { stdout, stderr }, deps);
      const text = stdout.value.trim();
      const envelope =
        text.length === 0 ? undefined : (JSON.parse(text) as Record<string, unknown>);
      const headAfter = (await git.head()) as string;
      observations.push({
        label: invocation.label,
        exitCode,
        refusal: envelopeErrorOf(envelope),
        landings: harness.counts.landing - landingsBefore,
        headBefore,
        headAfter,
        refreshAttempts: git.mutationCount() - refreshBefore,
      });
    } finally {
      harness.cleanup();
    }
  }
  return { mode, observations };
};

/**
 * The control pair the meta-check reads: the production serial run mutates no
 * head, the substituted pre-fix attempt does. A control returning the production
 * value is a named failure there, not a silent pass.
 */
export const serialControlDiffers = async (): Promise<{
  readonly productionHeadMutations: number;
  readonly preFixHeadMutations: number;
}> => {
  const production = await runSerialThree("production");
  const preFix = await runSerialThree("pre-fix-substituted");
  const mutated = (run: SerialRun): number =>
    run.observations.filter((observation) => observation.headBefore !== observation.headAfter)
      .length;
  return {
    productionHeadMutations: mutated(production),
    preFixHeadMutations: mutated(preFix),
  };
};
