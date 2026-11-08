/**
 * TC-PILOT-006 — durable records keep their expected identities.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readQueueEntries } from "../../../packages/core/src/app/queue";
import {
  readBlockerLedger,
  readChangeTransitionsTolerant,
  readCloseoutHistory,
  readCommitTelemetry,
  readMergeTransactions,
} from "../../../packages/core/src/state/index";
import { createPilot, PILOT_REF, PILOT_REPOSITORY, type Pilot } from "../../fixtures/pilot/harness";

let pilot: Pilot | undefined;

const fixture = (): Pilot => {
  if (pilot === undefined) throw new Error("pilot fixture was not created");
  return pilot;
};

beforeAll(async () => {
  pilot = await createPilot();
  await pilot.runSequence();
});

afterAll(() => {
  pilot?.cleanup();
});

describe("TC-PILOT-006 durable records", () => {
  test("phase.transition records carry the delivery completion and its commit", () => {
    const read = readChangeTransitionsTolerant(fixture().store, PILOT_REF);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const delivery = read.value.transitions.find(
      (transition) => transition.phaseId === "delivery" && transition.operation === "complete",
    );
    expect(delivery).toBeDefined();
    expect(typeof delivery?.commitSha).toBe("string");
    expect(delivery?.commitIntent).toBe("atomic");
    for (const phaseId of ["system_spec_update", "review_fix", "quality_gates"]) {
      const record = read.value.transitions.find((transition) => transition.phaseId === phaseId);
      expect(record?.commitIntent).toBe("record-only");
    }
  });

  test("commit.telemetry records bind the delivery phase to the landed commit", () => {
    const transitions = readChangeTransitionsTolerant(fixture().store, PILOT_REF);
    const delivery = transitions.ok
      ? transitions.value.transitions.find((transition) => transition.phaseId === "delivery")
      : undefined;
    const read = readCommitTelemetry(fixture().store, PILOT_REF);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.records.length).toBeGreaterThan(0);
    const matching = read.value.records.find(
      (record) => record.commitSha === delivery?.commitSha && record.phaseId === "delivery",
    );
    expect(matching).toBeDefined();
    expect(matching?.landedAt).toBe(fixture().nowIso);
  });

  test("merge, closeout, and blocker-answer records exist with expected keys", () => {
    const transactions = readMergeTransactions(fixture().store, PILOT_REF);
    expect(transactions.ok).toBe(true);
    if (transactions.ok) {
      const merged = transactions.records.find((record) => record.result === "merged");
      expect(merged?.landing.shaOnBase).toBe(true);
    }

    const history = readCloseoutHistory(fixture().store, PILOT_REF);
    expect(history.ok).toBe(true);
    if (history.ok) {
      expect(history.value.length).toBeGreaterThan(0);
      expect(history.value.some((record) => record.operation === "transition-work-item")).toBe(
        true,
      );
    }

    const blockers = readBlockerLedger(fixture().store);
    expect(blockers.ok).toBe(true);
    if (blockers.ok) {
      expect(blockers.value.questions.some((question) => question.id === "Q-0001")).toBe(true);
      const answer = blockers.value.answers.find((record) => record.questionId === "Q-0001");
      expect(answer?.choice).toBe("lite");
      expect(answer?.answeredAt).toBe(fixture().nowIso);
    }
  });

  test("every seeded queue entry carries the pair and the pilot seed key", () => {
    const entries = readQueueEntries(fixture().store);
    expect(entries.ok, "the pilot queue ledger is readable").toBe(true);
    if (!entries.ok) return;
    expect(entries.records.length, "the pilot seeds queue entries").toBeGreaterThan(0);
    for (const record of entries.records) {
      expect(record.repository, `${record.ref}: the seed key`).toBe(PILOT_REPOSITORY);
      expect(record.repositoryRoot, `${record.ref}: the seed root`).toBe(
        `/pilot/${PILOT_REPOSITORY}`,
      );
    }
  });
});
