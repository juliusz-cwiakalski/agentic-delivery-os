/**
 * TC-DISP-009 (phase-2 pure projection) — the token-to-exit matrix and the
 * Appendix G failure pairs. The exit digit comes only from the delivered
 * projection module; the plan file confirms the real process exit in phase 4.
 */
import { describe, expect, test } from "bun:test";
import { projectExitCode } from "../../packages/cli/src/projection";
import {
  classifyDispatchFailure,
  classifySpawnRefusal,
} from "../../packages/core/src/domain/dispatch-result";
import {
  DELIVERY_RESULT_TAXONOMY,
  DELIVERY_RESULT_TOKENS,
  type DeliveryResultToken,
} from "../../packages/core/src/contracts/index";

const exitFor = (resultToken: DeliveryResultToken): number => {
  const row = DELIVERY_RESULT_TAXONOMY.find((entry) => entry.token === resultToken);
  if (row === undefined) throw new Error(`no taxonomy row for ${resultToken}`);
  return projectExitCode(row.projectionClass);
};

const SUCCESS_TOKENS: readonly DeliveryResultToken[] = [
  "merged",
  "blocked",
  "pr-open",
  "pr-open-unverified",
  "finished",
  "noop-lane-nothing-to-do",
];

const EXIT_ONE_TOKENS: readonly DeliveryResultToken[] = [
  "failed",
  "max-restarts",
  "partial",
  "noop-lane-permission",
];

describe("TC-DISP-009 exit projection matrix", () => {
  test("success tokens exit 0", () => {
    for (const token of SUCCESS_TOKENS) expect(exitFor(token), token).toBe(0);
  });

  test("user-validation tokens exit 1", () => {
    for (const token of EXIT_ONE_TOKENS) expect(exitFor(token), token).toBe(1);
  });

  test("state-unverified exits 2, deliberately not bash's 1", () => {
    expect(exitFor("state-unverified")).toBe(2);
  });

  test("no token exits outside 0, 1, or 2", () => {
    for (const token of DELIVERY_RESULT_TOKENS) {
      expect([0, 1, 2], token).toContain(exitFor(token));
    }
  });
});

describe("Appendix G failure pairs project their pinned exits", () => {
  test("spawn failure is failed/failed at exit 1", () => {
    const row = classifyDispatchFailure({ kind: "spawn-failed" });
    expect(row.token).toBe("failed");
    expect(row.outcome).toBe("failed");
    expect(projectExitCode(row.projectionClass)).toBe(1);
  });

  test("restart-budget refusal is max-restarts/failed at exit 1", () => {
    const row = classifyDispatchFailure({ kind: "restart-budget-exceeded" });
    expect(row.token).toBe("max-restarts");
    expect(row.outcome).toBe("failed");
    expect(projectExitCode(row.projectionClass)).toBe(1);
  });

  test("resume-economics refusal is failed/failed at exit 1", () => {
    const row = classifyDispatchFailure({ kind: "resume-uneconomical" });
    expect(row.token).toBe("failed");
    expect(row.outcome).toBe("failed");
    expect(projectExitCode(row.projectionClass)).toBe(1);
  });

  test("harness spawn refusal is noop-lane-permission/refused at exit 1", () => {
    const row = classifySpawnRefusal();
    expect(row.token).toBe("noop-lane-permission");
    expect(row.outcome).toBe("refused");
    expect(projectExitCode(row.projectionClass)).toBe(1);
  });

  test("dispatch state-unverified is state-unverified at exit 2", () => {
    const row = classifyDispatchFailure({ kind: "state-unreadable" });
    expect(row.token).toBe("state-unverified");
    expect(projectExitCode(row.projectionClass)).toBe(2);
  });
});
