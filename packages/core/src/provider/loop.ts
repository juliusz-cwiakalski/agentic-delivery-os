/**
 * Re-evaluation loop policy (GH-182 F-4, DM-13, DEC-9).
 *
 * MAX over conditions is already computed by `combineProviderConditions`; this
 * driver counts completed sleeps. After exactly N completed sleeps it announces
 * the cap and returns a `reevaluation-cap` park with no further fetch.
 */
import type {
  CombinedProviderCondition,
  ProviderAnnouncementRecord,
  ProviderClock,
  ProviderParkRecord,
  ProviderSleep,
} from "#contracts";
import { createParkAnnouncement } from "./announcements.js";
import { createParkRecord } from "./parks.js";

export type ProviderLoopInput = {
  readonly subjectKind?: "provider" | "chain";
  readonly subjectName: string;
  readonly evaluate: () => Promise<CombinedProviderCondition>;
  readonly clock: ProviderClock;
  readonly sleep: ProviderSleep;
  readonly maxSleepLoops: number;
  readonly capParkTtlSeconds: number;
};

export type ProviderLoopResult =
  | {
      readonly outcome: "clear";
      readonly completedSleeps: number;
      readonly condition: CombinedProviderCondition;
    }
  | {
      readonly outcome: "failed";
      readonly completedSleeps: number;
      readonly condition: CombinedProviderCondition;
    }
  | {
      readonly outcome: "capped";
      readonly completedSleeps: number;
      readonly condition: CombinedProviderCondition;
      readonly park: ProviderParkRecord;
      readonly announcement: ProviderAnnouncementRecord;
    };

const capOutcome = (
  input: ProviderLoopInput,
  completedSleeps: number,
  condition: CombinedProviderCondition,
): ProviderLoopResult => {
  const nowMs = input.clock.nowMs();
  const park = createParkRecord({
    subjectKind: input.subjectKind ?? "chain",
    subjectName: input.subjectName,
    cause: "reevaluation-cap",
    conditions: condition.status === "clear" ? [] : condition.conditions,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + input.capParkTtlSeconds * 1_000,
    evidence: { waitSeconds: input.capParkTtlSeconds },
  });
  return {
    outcome: "capped",
    completedSleeps,
    condition,
    park,
    announcement: createParkAnnouncement(park, nowMs),
  };
};

/** Drive the re-evaluation policy until clear, failed, or the completed-sleep cap. */
export const runProviderLoop = async (input: ProviderLoopInput): Promise<ProviderLoopResult> => {
  let completedSleeps = 0;
  let condition = await input.evaluate();
  for (;;) {
    if (condition.status === "clear") {
      return { outcome: "clear", completedSleeps, condition };
    }
    if (condition.status === "failed") {
      return { outcome: "failed", completedSleeps, condition };
    }
    if (completedSleeps >= input.maxSleepLoops) {
      return capOutcome(input, completedSleeps, condition);
    }
    await input.sleep.sleep(condition.waitSeconds * 1_000);
    completedSleeps += 1;
    if (completedSleeps >= input.maxSleepLoops) {
      return capOutcome(input, completedSleeps, condition);
    }
    condition = await input.evaluate();
  }
};
