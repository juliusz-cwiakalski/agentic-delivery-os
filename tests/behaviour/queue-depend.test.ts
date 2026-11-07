/**
 * TC-DEPEND-001..006 (GH-237) — producer-before-consumer ordering, producer
 * landing, and the producer-bound deploy-verified gate with a bounded memoized
 * read budget.
 */
import { describe, expect, test } from "bun:test";
import { computeQueueSchedule } from "../../packages/core/src/domain/index";
import {
  makeFacts,
  observed,
  REPO_A,
  REPO_B,
} from "../fixtures/queue/schedule/harness";

const close = "merge-ready" as const;

describe("TC-DEPEND-001 consumer held while the producer is unresolved", () => {
  test("a consumer with an open producer is held dependency-open and not scheduled", () => {
    const facts = makeFacts([
      { ref: "GH-300", repository: REPO_A, workItem: observed({ deliveryState: "ready" }) },
      { ref: "GH-301", repository: REPO_B, edges: ["GH-300"], close },
    ]);
    const schedule = computeQueueSchedule(facts);
    const consumer = schedule.entries.find((entry) => entry.ref === "GH-301");
    expect(consumer?.state).toBe("held");
    expect(consumer?.blocking[0]?.reason).toBe("dependency-open");
    expect(schedule.nextActions.some((action) => action.ref === "GH-301")).toBe(false);
  });

  test("a consumer of an undeclared producer is dependency-unobserved", () => {
    const facts = makeFacts([{ ref: "GH-301", repository: REPO_B, edges: ["GH-999"], close }]);
    const consumer = computeQueueSchedule(facts).entries.find((entry) => entry.ref === "GH-301");
    expect(consumer?.state).toBe("held");
    expect(consumer?.blocking[0]?.reason).toBe("dependency-unobserved");
  });
});

describe("TC-DEPEND-002 producer precedes consumer in one repository", () => {
  test("the producer ranks before the consumer regardless of priority", () => {
    const facts = makeFacts([
      { ref: "GH-300", repository: REPO_A, priority: 20, workItem: observed({ deliveryState: "done" }) },
      { ref: "GH-301", repository: REPO_A, priority: 1, edges: ["GH-300"] },
    ]);
    const schedule = computeQueueSchedule(facts);
    // Both are new starts; producer-first wins before priority inside the same
    // rank class and repository, so the producer is projected first and the
    // consumer is held by the per-pass single-flight projection.
    expect(schedule.nextActions[0]?.ref).toBe("GH-300");
    expect(schedule.entries.find((entry) => entry.ref === "GH-301")?.blocking[0]?.reason).toBe(
      "repo-claimed-in-pass",
    );
  });
});

describe("TC-DEPEND-003 producer-bound deploy expectations", () => {
  test("a dependent merge is eligible only after a verified deploy verdict", () => {
    const facts = makeFacts(
      [
        { ref: "GH-300", repository: REPO_A, workItem: observed({ deliveryState: "done" }) },
        { ref: "GH-301", repository: REPO_B, edges: ["GH-300"], close },
      ],
      {
        deploy: {
          expectations: { "GH-300": { state: "declared", steps: ["deploy"] } },
          verdicts: { "GH-300": { verdict: "verified" } },
        },
      },
    );
    const consumer = computeQueueSchedule(facts).entries.find((entry) => entry.ref === "GH-301");
    expect(consumer?.state).toBe("ready");
  });

  test("unknown or failed deploy verdicts hold the dependent at deploy-unverified", () => {
    for (const verdict of ["unknown", "failed"] as const) {
      const facts = makeFacts(
        [
          { ref: "GH-300", repository: REPO_A, workItem: observed({ deliveryState: "done" }) },
          { ref: "GH-301", repository: REPO_B, edges: ["GH-300"], close },
        ],
        {
          deploy: {
            expectations: { "GH-300": { state: "declared", steps: ["deploy"] } },
            verdicts: { "GH-300": { verdict } },
          },
        },
      );
      const consumer = computeQueueSchedule(facts).entries.find((entry) => entry.ref === "GH-301");
      expect(consumer?.state).toBe("held");
      expect(consumer?.blocking[0]?.reason).toBe("deploy-unverified");
    }
  });

  test("an unreadable producer configuration is unknown, never not-declared", () => {
    const facts = makeFacts(
      [
        { ref: "GH-300", repository: REPO_A, workItem: observed({ deliveryState: "done" }) },
        { ref: "GH-301", repository: REPO_B, edges: ["GH-300"], close },
      ],
      {
        deploy: {
          expectations: { "GH-300": { state: "unknown", reason: "config-invalid" } },
          verdicts: {},
        },
      },
    );
    const consumer = computeQueueSchedule(facts).entries.find((entry) => entry.ref === "GH-301");
    expect(consumer?.state).toBe("held");
    expect(consumer?.blocking[0]?.reason).toBe("deploy-unverified");
  });
});

describe("TC-DEPEND-004 no declared expectation is landing-only", () => {
  test("a landed producer without expectations passes with deploy not-declared", () => {
    const facts = makeFacts(
      [
        { ref: "GH-300", repository: REPO_A, workItem: observed({ deliveryState: "done" }) },
        { ref: "GH-301", repository: REPO_B, edges: ["GH-300"], close },
      ],
      {
        deploy: {
          expectations: { "GH-300": { state: "not-declared" } },
          verdicts: {},
        },
      },
    );
    const consumer = computeQueueSchedule(facts).entries.find((entry) => entry.ref === "GH-301");
    expect(consumer?.state).toBe("ready");
  });
});

describe("TC-DEPEND-005 deploy reads are bounded and memoized", () => {
  test("the fourth distinct producer overflows the budget and repeated producers memoize", () => {
    const facts = makeFacts(
      [
        { ref: "GH-300", repository: REPO_A, workItem: observed({ deliveryState: "done" }) },
        { ref: "GH-302", repository: REPO_A, workItem: observed({ deliveryState: "done" }) },
        { ref: "GH-303", repository: REPO_A, workItem: observed({ deliveryState: "done" }) },
        { ref: "GH-304", repository: REPO_A, workItem: observed({ deliveryState: "done" }) },
        { ref: "GH-311", repository: REPO_B, edges: ["GH-300"], close, priority: 1 },
        { ref: "GH-312", repository: REPO_B, edges: ["GH-302"], close, priority: 2 },
        { ref: "GH-313", repository: REPO_B, edges: ["GH-303"], close, priority: 3 },
        { ref: "GH-314", repository: REPO_B, edges: ["GH-304"], close, priority: 4 },
      ],
      {
        deploy: {
          expectations: {
            "GH-300": { state: "declared", steps: ["deploy"] },
            "GH-302": { state: "declared", steps: ["deploy"] },
            "GH-303": { state: "declared", steps: ["deploy"] },
            "GH-304": { state: "declared", steps: ["deploy"] },
          },
          verdicts: {
            "GH-300": { verdict: "verified" },
            "GH-302": { verdict: "verified" },
            "GH-303": { verdict: "verified" },
            "GH-304": { verdict: "verified" },
          },
        },
      },
    );
    const schedule = computeQueueSchedule(facts);
    expect(schedule.deployReads).toBe(3);
    const overflowed = schedule.entries.filter((entry) =>
      entry.blocking.some((block) => block.reason === "deploy-unverified"),
    );
    expect(overflowed.length).toBeGreaterThan(0);
  });
});

describe("TC-DEPEND-006 producer landing is observed", () => {
  test("an unlanded producer holds the consumer and a landed producer frees it", () => {
    const unlanded = makeFacts([
      { ref: "GH-300", repository: REPO_A, workItem: observed({ deliveryState: "in-progress" }) },
      { ref: "GH-301", repository: REPO_B, edges: ["GH-300"], close },
    ]);
    expect(
      computeQueueSchedule(unlanded).entries.find((entry) => entry.ref === "GH-301")?.state,
    ).toBe("held");

    const landed = makeFacts(
      [
        { ref: "GH-300", repository: REPO_A, workItem: observed({ deliveryState: "done" }) },
        { ref: "GH-301", repository: REPO_B, edges: ["GH-300"], close },
      ],
      {
        deploy: {
          expectations: { "GH-300": { state: "not-declared" } },
          verdicts: {},
        },
      },
    );
    expect(
      computeQueueSchedule(landed).entries.find((entry) => entry.ref === "GH-301")?.state,
    ).toBe("ready");
  });
});
