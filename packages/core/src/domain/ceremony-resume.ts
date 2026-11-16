/**
 * Ceremony resume (GH-296 F-4, NFR-4; E-5, E-6).
 *
 * Resume reads the recorded run and step set, refuses a contradicted sequence as
 * the delivered `state.store.torn` identity with zero writes, and then executes
 * only from the first unverified index. A verified step is never re-executed,
 * re-verified destructively, or re-rendered.
 */
import type { CeremonyDeclaration, CeremonyNote, CeremonyStepRecord } from "#contracts";
import {
  executeCeremonyAgenda,
  flattenCeremonyAgenda,
  type CeremonyEngineFailure,
  type CeremonyRunData,
  type CeremonyRunEnvironment,
  type CeremonyRunOutcome,
  type CeremonyStepOutcome,
} from "./ceremony-run.js";
import type { CeremonyIntake } from "./ceremony-intake.js";

/** One resume request; the note is optional because a resume never needs it. */
export type CeremonyResumeRequest = {
  readonly runId: string;
  readonly declaration: CeremonyDeclaration;
  readonly env: CeremonyRunEnvironment;
  readonly apply: boolean;
  readonly note?: CeremonyNote;
};

const failure = (code: string, summary: string): CeremonyEngineFailure => ({ code, summary });

const torn = (summary: string): CeremonyEngineFailure => failure("state.store.torn", summary);

const stepOutcomeOf = (record: CeremonyStepRecord): CeremonyStepOutcome => ({
  index: record.index,
  phaseIndex: record.phaseIndex,
  kind: record.kind,
  outcome: record.outcome,
  artifactRef: record.artifactRef,
  verification: record.verification,
  durationMs: record.durationMs,
  ...(record.reason === undefined ? {} : { reason: record.reason }),
});

const recordedVerdict = (steps: readonly CeremonyStepRecord[]) => {
  if (steps.some((step) => step.outcome === "unverified")) return "unverified" as const;
  if (steps.some((step) => step.outcome === "dry-run")) return "dry-run" as const;
  return "verified" as const;
};

/** Validate a recorded step set against the declaration; contradiction is torn. */
export const validateCeremonyStepSequence = (
  declaration: CeremonyDeclaration,
  steps: readonly CeremonyStepRecord[],
):
  | { readonly ok: true; readonly startIndex: number; readonly maxIndex: number }
  | { readonly ok: false; readonly reason: string } => {
  const expected = flattenCeremonyAgenda(declaration).length;
  if (steps.length === 0) return { ok: true, startIndex: 1, maxIndex: 0 };
  const byIndex = new Map<number, CeremonyStepRecord[]>();
  for (const step of steps) {
    if (!Number.isInteger(step.index) || step.index < 1 || step.index > expected) {
      return {
        ok: false,
        reason: `step record ${String(step.index)} is outside the declared agenda`,
      };
    }
    const entries = byIndex.get(step.index) ?? [];
    entries.push(step);
    byIndex.set(step.index, entries);
  }
  const indices = [...byIndex.keys()].sort((left, right) => left - right);
  for (const [position, index] of indices.entries()) {
    if (index !== position + 1) {
      return { ok: false, reason: `step record ${String(position + 1)} is missing` };
    }
    const attempts = byIndex.get(index) ?? [];
    if (attempts.length > 1) {
      const reattempts = attempts.slice(0, -1);
      if (reattempts.some((attempt) => attempt.outcome !== "unverified")) {
        return { ok: false, reason: `step ${String(index)} has two records for one index` };
      }
    }
  }
  const firstUnverified = indices.find((index) =>
    (byIndex.get(index) ?? []).some((attempt) => attempt.outcome === "unverified"),
  );
  const maxIndex = indices[indices.length - 1] ?? 0;
  if (firstUnverified !== undefined && firstUnverified < maxIndex) {
    return {
      ok: false,
      reason: `step ${String(firstUnverified)} is unverified but later steps are recorded`,
    };
  }
  const startIndex = firstUnverified ?? maxIndex + 1;
  return { ok: true, startIndex, maxIndex };
};

/** Resume one interrupted run from its first unverified step. */
export const resumeCeremony = (request: CeremonyResumeRequest): CeremonyRunOutcome => {
  const runsRead = request.env.records.readRuns();
  if (runsRead.verdict === "torn" || runsRead.verdict === "unknown") {
    return { ok: false, error: torn(runsRead.detail ?? "ceremony run records are unreadable") };
  }
  const run = runsRead.records.find((candidate) => candidate.runId === request.runId);
  if (run === undefined) {
    return {
      ok: false,
      error: failure("input.value.rejected", `no ceremony run "${request.runId}" is recorded`),
    };
  }
  const stepsRead = request.env.records.readSteps(request.runId);
  if (stepsRead.verdict === "torn" || stepsRead.verdict === "unknown") {
    return {
      ok: false,
      error: failure(
        stepsRead.verdict === "torn" ? "state.store.torn" : "state.store.unknown",
        stepsRead.detail ?? "ceremony step records are unreadable",
      ),
    };
  }
  const sequence = validateCeremonyStepSequence(request.declaration, stepsRead.records);
  if (!sequence.ok) return { ok: false, error: torn(sequence.reason) };
  const total = flattenCeremonyAgenda(request.declaration).length;
  if (
    sequence.maxIndex >= total &&
    stepsRead.records.every((step) => step.outcome !== "unverified")
  ) {
    return {
      ok: true,
      data: {
        ceremony: request.declaration.id,
        runId: request.runId,
        verdict: recordedVerdict(stepsRead.records),
        reused: true,
        origin: run.origin,
        trigger: run.trigger,
        scopeKey: run.scopeKey,
        window: run.trigger.actualWindow,
        steps: stepsRead.records.map(stepOutcomeOf),
        applied: stepsRead.records.some(
          (step) => step.kind === "sync" && step.outcome === "verified",
        ),
        carried: [],
      },
    };
  }
  const intake: CeremonyIntake = {
    declaration: request.declaration,
    ...(request.note === undefined ? {} : { note: request.note }),
    scopeKey: run.scopeKey,
    window: run.trigger.actualWindow,
    identity: {
      ceremonyId: request.declaration.id,
      scopeKey: run.scopeKey.value,
      windowStart: run.trigger.actualWindow.start,
      windowEnd: run.trigger.actualWindow.end,
    },
    trigger: run.trigger,
  };
  const agenda = executeCeremonyAgenda({
    declaration: request.declaration,
    intake,
    runId: request.runId,
    env: request.env,
    apply: request.apply,
    startIndex: sequence.startIndex,
  });
  if (!agenda.ok) return { ok: false, error: agenda.error };
  const all = [...stepsRead.records, ...agenda.records];
  const data: CeremonyRunData = {
    ceremony: request.declaration.id,
    runId: request.runId,
    verdict: recordedVerdict(all),
    reused: false,
    origin: run.origin,
    trigger: run.trigger,
    scopeKey: run.scopeKey,
    window: run.trigger.actualWindow,
    steps: all.map(stepOutcomeOf),
    applied: agenda.records.some((step) => step.kind === "sync" && step.outcome === "verified"),
    carried: agenda.carried,
  };
  return { ok: true, data };
};
