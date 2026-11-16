/**
 * TC-ACTION-001..005 — the five-field filing gate: the pinned SC-M2-S10-01
 * refusal, the all-or-nothing member matrix, the contract-rule matrix, the
 * conforming record shape, and the closed verb vocabulary (AC-F1-1, AC-F1-2,
 * AC-F2-1; DEC-8).
 */
import { describe, expect, test } from "bun:test";
import {
  ACTION_VERBS,
  type RetroActionCommandOutcome,
  type RetroActionDraft,
} from "../../packages/core/src/contracts/index";
import { actionRecord, conformingDraft } from "../fixtures/action/builders";
import { FILING_MS } from "../fixtures/action/clock";
import { actionSnapshot, fileAction } from "../fixtures/action/seed";
import { makeActionStore } from "../fixtures/action/store";

const codeOf = (outcome: RetroActionCommandOutcome): string | undefined =>
  outcome.ok ? undefined : outcome.error.code;

const fieldOf = (outcome: RetroActionCommandOutcome): string | undefined =>
  outcome.ok ? undefined : outcome.error.location?.field;

const summaryOf = (outcome: RetroActionCommandOutcome): string =>
  outcome.ok ? "" : (outcome.error.summary ?? "");

const fileInFreshStore = (draft: RetroActionDraft) => {
  const fixture = makeActionStore("filing");
  try {
    return { outcome: fileAction(fixture.store, draft), fixture };
  } catch (error) {
    fixture.cleanup();
    throw error;
  }
};

describe("TC-ACTION-001 SC-M2-S10-01 incomplete filing refused", () => {
  test("a filing missing measurableOutcome exits with retro.action-incomplete naming the field", () => {
    const fixture = makeActionStore("sc-01");
    try {
      const draft = conformingDraft();
      const { measurableOutcome: _omitted, ...withoutOutcome } = draft;
      const outcome = fileAction(fixture.store, withoutOutcome);
      expect(outcome.ok).toBe(false);
      expect(codeOf(outcome)).toBe("retro.action-incomplete");
      expect(fieldOf(outcome)).toBe("measurableOutcome");
      expect(summaryOf(outcome)).toContain("measurableOutcome");
      expect(actionSnapshot(fixture.store).actions).toEqual([]);
    } finally {
      fixture.cleanup();
    }
  });

  test("the paired conforming control lands exactly one row", () => {
    const fixture = makeActionStore("sc-01-control");
    try {
      const outcome = fileAction(fixture.store, conformingDraft());
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.data.actionId.length).toBeGreaterThan(0);
        expect(outcome.data.action.measurableOutcome).toBe(
          "the guard rejects the malformed envelope",
        );
      }
      expect(actionSnapshot(fixture.store).actions).toHaveLength(1);
    } finally {
      fixture.cleanup();
    }
  });
});

describe("TC-ACTION-002 filing is all-or-nothing for every contract member", () => {
  const omissions: ReadonlyArray<readonly [string, RetroActionDraft]> = [
    ["owner", { owner: undefined }],
    ["verb", { verb: undefined }],
    ["measurableOutcome", { measurableOutcome: undefined }],
    ["trackerEntry", { trackerEntry: undefined }],
    ["dueDate", { dueDate: undefined }],
    ["verificationArtifact", { verificationArtifact: undefined }],
    ["outcomeVerifier", { outcomeVerifier: undefined }],
    ["rollbackCondition", { rollbackCondition: undefined }],
  ];

  test("each single omission is refused naming that member and lands no row", () => {
    for (const [field, override] of omissions) {
      const fixture = makeActionStore(`omit-${field}`);
      try {
        const outcome = fileAction(fixture.store, conformingDraft(override));
        expect(codeOf(outcome), field).toBe("retro.action-incomplete");
        expect(fieldOf(outcome), field).toBe(field);
        expect(actionSnapshot(fixture.store).actions).toHaveLength(0);
        // The refusal detail names the member and never echoes field values.
        expect(summaryOf(outcome), field).not.toContain("GH-287");
      } finally {
        fixture.cleanup();
      }
    }
  });

  test("an outcome verifier without its window is refused as the verifier member", () => {
    const first = fileInFreshStore(
      conformingDraft({
        outcomeVerifier: { evidence: "metric:x", windowStart: "", windowEnd: "" },
      }),
    );
    try {
      expect(codeOf(first.outcome)).toBe("retro.action-incomplete");
      expect(fieldOf(first.outcome)).toBe("outcomeVerifier");
      expect(actionSnapshot(first.fixture.store).actions).toHaveLength(0);
    } finally {
      first.fixture.cleanup();
    }
  });
});

describe("TC-ACTION-003 contract-rule refusals share the one filing identity", () => {
  const violations: ReadonlyArray<readonly [string, string, RetroActionDraft]> = [
    ["team owner", "owner", { ownerKind: "team" }],
    ["unverifiable verb review", "verb", { verb: "review" }],
    ["unverifiable verb improve", "verb", { verb: "improve" }],
    ["placeholder tracker", "trackerEntry", { trackerEntry: "todo" }],
    ["unknown owner kind", "owner", { ownerKind: "squad" }],
    ["verb outside vocabulary", "verb", { verb: "refactor" }],
  ];

  test("each non-conforming field is refused under retro.action-incomplete naming it", () => {
    for (const [label, field, override] of violations) {
      const fixture = makeActionStore(`rule-${field}-${label.replace(/\s+/gu, "-")}`);
      try {
        const outcome = fileAction(fixture.store, conformingDraft(override));
        expect(codeOf(outcome), label).toBe("retro.action-incomplete");
        expect(fieldOf(outcome), label).toBe(field);
        expect(actionSnapshot(fixture.store).actions).toHaveLength(0);
      } finally {
        fixture.cleanup();
      }
    }
  });

  test("human and agent-role owners both land", () => {
    for (const ownerKind of ["human", "agent-role"] as const) {
      const fixture = makeActionStore(`owner-${ownerKind}`);
      try {
        const outcome = fileAction(
          fixture.store,
          conformingDraft({ ownerKind, owner: `${ownerKind}:synthetic-owner` }),
        );
        expect(outcome.ok, ownerKind).toBe(true);
        expect(actionSnapshot(fixture.store).actions).toHaveLength(1);
      } finally {
        fixture.cleanup();
      }
    }
  });

  test("an unreachable tracker keeps the entry recorded with its state disclosed", () => {
    const fixture = makeActionStore("tracker-unreachable");
    try {
      const outcome = fileAction(
        fixture.store,
        conformingDraft({ trackerCorroboration: "unreachable" }),
      );
      expect(outcome.ok).toBe(true);
      const [record] = actionSnapshot(fixture.store).actions;
      expect(record?.trackerEntry).toBe("GH-287");
      expect(record?.trackerCorroboration).toBe("unreachable");
    } finally {
      fixture.cleanup();
    }
  });
});

describe("TC-ACTION-004 the conforming record carries every member", () => {
  test("every member is stored verbatim with the injected filing instant", () => {
    const fixture = makeActionStore("record");
    try {
      const outcome = fileAction(fixture.store, conformingDraft(), { actionId: "action-record" });
      expect(outcome.ok).toBe(true);
      const [record] = actionSnapshot(fixture.store).actions;
      expect(record).toEqual(actionRecord({}, { actionId: "action-record", filedAt: FILING_MS }));
      expect(record?.filedAt).toBe(FILING_MS);
      expect(record?.outcomeVerifier.windowStart).toBe("2026-10-15T00:00:00Z");
      expect(record?.outcomeVerifier.windowEnd).toBe("2026-11-15T00:00:00Z");
      expect(record?.rollbackCondition.length).toBeGreaterThan(0);
      expect(record?.level).toBe("change");
      expect(record?.window).toBe("window-a");
      expect(record?.verificationArtifact).toBe("artifact:tests/behaviour/action-filing.test.ts");
    } finally {
      fixture.cleanup();
    }
  });

  test("the stored record passes the boundary's own read-back validation", () => {
    const fixture = makeActionStore("record-readback");
    try {
      expect(fileAction(fixture.store, conformingDraft()).ok).toBe(true);
      const read = actionSnapshot(fixture.store);
      expect(read.verdict).toBe("valid");
      expect(read.malformed).toEqual([]);
      expect(read.actions).toHaveLength(1);
    } finally {
      fixture.cleanup();
    }
  });
});

describe("TC-ACTION-005 the closed verb vocabulary is exact", () => {
  test("each of the five verbs lands and round-trips byte-identically", () => {
    for (const verb of ACTION_VERBS) {
      const fixture = makeActionStore(`verb-${verb}`);
      try {
        expect(fileAction(fixture.store, conformingDraft({ verb })).ok, verb).toBe(true);
        expect(actionSnapshot(fixture.store).actions[0]?.verb).toBe(verb);
      } finally {
        fixture.cleanup();
      }
    }
  });

  test("near-misses and the two forbidden verbs are refused naming the verb", () => {
    for (const verb of ["Add", "add ", "added", "review", "improve"]) {
      const fixture = makeActionStore(`verb-refuse-${verb.trim()}`);
      try {
        const outcome = fileAction(fixture.store, conformingDraft({ verb }));
        expect(codeOf(outcome), verb).toBe("retro.action-incomplete");
        expect(fieldOf(outcome), verb).toBe("verb");
        expect(actionSnapshot(fixture.store).actions).toHaveLength(0);
      } finally {
        fixture.cleanup();
      }
    }
  });
});
