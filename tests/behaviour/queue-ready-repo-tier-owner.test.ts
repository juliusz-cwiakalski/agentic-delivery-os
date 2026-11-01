/**
 * TC-QREADY-006 / TC-QREADY-007 / TC-QREADY-008 — repo-free local context,
 * tier-known labels, and no-owner-gate labels.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { nodeFileSystemFacts } from "../../packages/adapters/src/file/config-source";
import { readLocalPmContext } from "../../packages/adapters/src/file/pm-context";
import type { StatusTrackerAvailability } from "../../packages/core/src/contracts/index";
import {
  ALL_AVAILABLE,
  evaluate,
  makeWorkItem,
  workItemRead,
} from "../fixtures/queue-ready/harness";
import { ownerCases } from "../fixtures/queue-ready/owner/cases";
import { repoCases } from "../fixtures/queue-ready/repo/cases";
import { tierCases } from "../fixtures/queue-ready/tier/cases";

const ROOT = process.cwd();
const CONTEXT_DIR = join(ROOT, "tests/fixtures/queue-ready/pm-context");

const conditionOf = (facts: Parameters<typeof evaluate>[0], id: string) => {
  const candidate = evaluate(facts).candidates[0];
  if (candidate === undefined) throw new Error("candidate missing");
  const condition = candidate.conditions.find((entry) => entry.id === id);
  if (condition === undefined) throw new Error(`${id} missing`);
  return condition;
};

const signalAvailability = (
  labelSignal: "available" | "unavailable" | undefined,
): StatusTrackerAvailability => ({
  ...ALL_AVAILABLE,
  ...(labelSignal === "unavailable" ? { ownerHandBacks: "unavailable" } : {}),
});

const trackedItem = (input: {
  readonly labels: readonly string[];
  readonly unobserved?: boolean;
  readonly assignee?: string;
}) =>
  workItemRead(
    [
      makeWorkItem({
        entityId: input.unobserved === true ? "177" : "176",
        labels: input.labels,
        ...(input.assignee === undefined ? {} : { assignee: input.assignee }),
      }),
    ],
    ALL_AVAILABLE,
  );

describe("TC-QREADY-006 repo-free local PM context", () => {
  test("each in-memory context case matches its state, reason, and detail", () => {
    for (const testCase of repoCases) {
      const condition = conditionOf({ localContext: testCase.localContext }, "repo-free");
      expect(condition.state, testCase.name).toBe(testCase.state);
      expect(condition.evidence, testCase.name).toEqual([
        {
          source: "local-context",
          reason: testCase.reason,
          ...(testCase.detail === undefined ? {} : { detail: testCase.detail }),
        },
      ]);
    }
  });

  test("the committed YAML fixtures project through the delivered adapter and are never written", () => {
    const fs = nodeFileSystemFacts();
    const expected: readonly [string, string, string][] = [
      ["no-active-change.yaml", "satisfied", "no-active-change"],
      ["candidate-active.yaml", "satisfied", "candidate-is-active"],
      ["other-active.yaml", "unsatisfied", "other-active-change"],
      ["malformed.yaml.txt", "unknown", "local-context-malformed"],
      ["wrong-shape.yaml", "unknown", "local-context-malformed"],
    ];
    for (const [file, state, reason] of expected) {
      const path = join(CONTEXT_DIR, file);
      const before = readFileSync(path);
      const beforeMtime = statSync(path).mtimeMs;
      const localContext = readLocalPmContext({ path, fs });
      const payload = evaluate({ localContext });
      const condition = payload.candidates[0]?.conditions.find((entry) => entry.id === "repo-free");
      expect(condition?.state, file).toBe(state);
      expect(condition?.evidence[0]?.reason, file).toBe(reason);
      expect(readFileSync(path).equals(before), file).toBe(true);
      expect(statSync(path).mtimeMs, file).toBe(beforeMtime);
      expect(JSON.stringify(payload).includes("planted-queue-ready-notes-canary"), file).toBe(
        false,
      );
    }
  });

  test("a missing context file is unknown, never free", () => {
    const localContext = readLocalPmContext({
      path: join(CONTEXT_DIR, "absent.yaml"),
      fs: nodeFileSystemFacts(),
    });
    const condition = conditionOf({ localContext }, "repo-free");
    expect(condition.state).toBe("unknown");
    expect(condition.evidence[0]?.reason).toBe("local-context-missing");
  });
});

describe("TC-QREADY-007 tier-known", () => {
  test("each tier case matches its state, reason, and detail", () => {
    for (const testCase of tierCases) {
      const condition = conditionOf(
        {
          tracker: workItemRead(
            [
              makeWorkItem({
                entityId: testCase.unobserved === true ? "177" : "176",
                labels: testCase.labels,
              }),
            ],
            signalAvailability(testCase.labelSignal),
          ),
        },
        "tier-known",
      );
      expect(condition.state, testCase.name).toBe(testCase.state);
      expect(condition.evidence, testCase.name).toEqual([
        {
          source: "tracker",
          reason: testCase.reason,
          ...(testCase.detail === undefined ? {} : { detail: testCase.detail }),
        },
      ]);
    }
  });

  test("unobserved takes precedence over an unavailable label signal", () => {
    const condition = conditionOf(
      {
        tracker: workItemRead(
          [makeWorkItem({ entityId: "177", labels: ["priority:high"] })],
          signalAvailability("unavailable"),
        ),
      },
      "tier-known",
    );
    expect(condition.evidence[0]?.reason).toBe("work-item-unobserved");
  });
});

describe("TC-QREADY-008 no-owner-gate", () => {
  test("each owner case matches its state, reason, and detail", () => {
    for (const testCase of ownerCases) {
      const condition = conditionOf(
        {
          tracker: workItemRead(
            [
              makeWorkItem({
                entityId: testCase.unobserved === true ? "177" : "176",
                labels: testCase.labels,
                ...(testCase.assignee === undefined ? {} : { assignee: testCase.assignee }),
              }),
            ],
            signalAvailability(testCase.labelSignal),
          ),
        },
        "no-owner-gate",
      );
      expect(condition.state, testCase.name).toBe(testCase.state);
      expect(condition.evidence, testCase.name).toEqual([
        {
          source: "tracker",
          reason: testCase.reason,
          ...(testCase.detail === undefined ? {} : { detail: testCase.detail }),
        },
      ]);
    }
  });

  test("assignee is never a gate signal", () => {
    const condition = conditionOf(
      {
        tracker: trackedItem({ labels: ["priority:high"], assignee: "hand-back" }),
      },
      "no-owner-gate",
    );
    expect(condition.state).toBe("satisfied");
    expect(condition.evidence[0]?.reason).toBe("no-owner-labels");
  });
});
