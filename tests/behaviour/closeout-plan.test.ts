/**
 * TC-CLOSE-010..014, TC-CLOSE-059/060 (planner/renderer half), TC-CLOSE-067
 * (planner mapping) — the deterministic planner, canonical expansion, bounds,
 * and renderer. No provider or git runtime is executed here.
 */
import { describe, expect, test } from "bun:test";
import {
  CLOSEOUT_MAX_HUMAN_BYTES,
  CLOSEOUT_MAX_HUMAN_LINES,
  CLOSEOUT_MAX_MACHINE_BYTES,
  type CloseoutData,
  type CloseoutStep,
} from "../../packages/core/src/contracts/index";
import {
  boundCloseoutData,
  buildCloseoutPlan,
  type CloseoutDependentFact,
  type CloseoutPlanFacts,
  canonicalCloseoutJson,
  closeoutStepDefinitions,
  deriveCloseoutOperationId,
  renderCloseoutHuman,
  runCloseout,
  summarizeCloseout,
} from "../../packages/core/src/domain/closeout";
import { closeoutData, errorOf, runCloseoutCli } from "../fixtures/closeout/cli";
import { eligibleDependent, unavailableRelationDependent } from "../fixtures/closeout/dependents";
import {
  CANARY_TEXT,
  CLOSEOUT_SCHEMA_ID,
  CLOSEOUT_TIMESTAMP,
  DEFAULT_LABELS,
  makeDependent,
  makeFacts,
  makeGit,
  makeMergedRequest,
  makeProvider,
  makeState,
  makeWorkItem,
  observed,
  THREAD_ID,
  testDependent,
  WORK_ITEM_REF,
} from "../fixtures/closeout/harness";
import { EXPECTED_STEP_IDS } from "../fixtures/closeout/plan";
import { fakeInvalidPayload, fakeNotFound } from "../fixtures/closeout/read-observation";

const stepById = (steps: readonly CloseoutStep[], stepId: string): CloseoutStep => {
  const step = steps.find((entry) => entry.stepId === stepId);
  if (step === undefined) throw new Error(`missing step ${stepId}`);
  return step;
};

const dataFor = (facts: CloseoutPlanFacts): CloseoutData => {
  const plan = buildCloseoutPlan(facts);
  return {
    schemaId: CLOSEOUT_SCHEMA_ID,
    command: "closeout",
    workItemRef: plan.workItemRef,
    mode: "plan",
    baseRef: plan.baseRef,
    ...(plan.deliveryRequest === undefined ? {} : { deliveryRequest: plan.deliveryRequest }),
    steps: plan.steps,
    summary: plan.summary,
  };
};

describe("TC-CLOSE-010/011 dry-run plan shape and determinism", () => {
  test("the seven steps appear in the pinned order", () => {
    const plan = buildCloseoutPlan(makeFacts());
    expect(plan.steps.map((step) => step.stepId)).toEqual(EXPECTED_STEP_IDS);
    expect(plan.steps.map((step) => step.label)).toEqual(
      closeoutStepDefinitions.map((definition) => definition.label),
    );
    expect(plan.schemaId).toBe(CLOSEOUT_SCHEMA_ID);
    expect(plan.workItemRef).toBe(WORK_ITEM_REF);
    expect(plan.baseRef).toBe("main-tools");
  });

  test("the plan expands the lifecycle sweep and schedules the unassign clear", () => {
    const plan = buildCloseoutPlan(makeFacts());
    const labels = stepById(plan.steps, "lifecycle-label-sweep");
    expect(labels.outcome).toBe("would-apply");
    expect(labels.operations).toHaveLength(7);
    const removes = labels.operations.flatMap((operation) =>
      "remove" in operation.arguments ? (operation.arguments.remove ?? []) : [],
    );
    expect(removes).toEqual([
      "planning",
      "spec-ready",
      "readiness-passed",
      "in-progress",
      "review",
      "blocked",
    ]);
    expect(
      labels.operations.some(
        (operation) =>
          "add" in operation.arguments && operation.arguments.add?.includes("delivered"),
      ),
    ).toBe(true);
    const unassign = stepById(plan.steps, "unassign");
    expect(unassign.operations).toHaveLength(1);
    expect(unassign.operations[0]?.arguments).toEqual({ assignee: "none" });
  });

  test("repeated planning of the same facts is byte-identical", () => {
    const facts = makeFacts();
    const first = JSON.stringify(buildCloseoutPlan(facts));
    for (let index = 0; index < 3; index += 1) {
      expect(JSON.stringify(buildCloseoutPlan(facts))).toBe(first);
    }
  });

  test("the merged request drives comment resolution and branch cleanup", () => {
    const plan = buildCloseoutPlan(makeFacts());
    const threads = stepById(plan.steps, "comment-resolution");
    expect(threads.operations).toHaveLength(1);
    expect(threads.operations[0]?.arguments).toEqual({
      deliveryRequest: { systemName: "github", entityId: "504" },
      threadId: THREAD_ID,
    });
    const checkout = stepById(plan.steps, "checkout-restore");
    expect(checkout.operations[0]?.arguments).toEqual({ baseRef: "main-tools" });
    const branch = stepById(plan.steps, "branch-cleanup");
    expect(branch.operations[0]?.arguments).toEqual({
      branch: "feat/GH-183/closeout-v1-branch-cleanup",
    });
  });
});

describe("TC-CLOSE-013 determinism under permuted inputs", () => {
  test("permuting labels, dependents, and threads does not change the plan", () => {
    const dependents = [
      eligibleDependent("203"),
      eligibleDependent("200"),
      eligibleDependent("202"),
    ];
    const threads = [
      { threadId: "PRRT_3", resolved: false, commentCount: 1 },
      { threadId: "PRRT_1", resolved: false, commentCount: 1 },
      { threadId: "PRRT_2", resolved: false, commentCount: 1 },
    ];
    const first = makeFacts({
      observedWorkItem: observed(makeWorkItem({ labels: [...DEFAULT_LABELS] })),
      dependents: observed<readonly CloseoutDependentFact[]>(dependents),
      mergedRequest: observed(makeMergedRequest({ threads })),
    });
    const second = makeFacts({
      observedWorkItem: observed(makeWorkItem({ labels: [...DEFAULT_LABELS].reverse() })),
      dependents: observed<readonly CloseoutDependentFact[]>([...dependents].reverse()),
      mergedRequest: observed(makeMergedRequest({ threads: [...threads].reverse() })),
    });
    expect(JSON.stringify(buildCloseoutPlan(second))).toBe(
      JSON.stringify(buildCloseoutPlan(first)),
    );
  });

  test("dependents are ordered by provider entity identity", () => {
    const plan = buildCloseoutPlan(
      makeFacts({
        dependents: observed<readonly CloseoutDependentFact[]>([
          eligibleDependent("300"),
          eligibleDependent("201"),
          eligibleDependent("202"),
        ]),
      }),
    );
    const step = stepById(plan.steps, "owed-flip-sweep");
    expect(step.operations.map((operation) => operation.target.entityId)).toEqual([
      "201",
      "202",
      "300",
    ]);
  });

  test("threads are ordered by thread identity", () => {
    const plan = buildCloseoutPlan(
      makeFacts({
        mergedRequest: observed(
          makeMergedRequest({
            threads: [
              { threadId: "PRRT_9", resolved: false, commentCount: 1 },
              { threadId: "PRRT_2", resolved: false, commentCount: 1 },
            ],
          }),
        ),
      }),
    );
    expect(
      stepById(plan.steps, "comment-resolution").operations.map((operation) =>
        "threadId" in operation.arguments ? operation.arguments.threadId : "",
      ),
    ).toEqual(["PRRT_2", "PRRT_9"]);
  });
});

describe("TC-CLOSE-014 canonical expansion and identity distinctness", () => {
  test("every label operation has a distinct stable identity and flat arguments", () => {
    const plan = buildCloseoutPlan(makeFacts());
    const operations = stepById(plan.steps, "lifecycle-label-sweep").operations;
    const ids = operations.map((operation) => operation.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const operation of operations) {
      expect(operation.operationId).toMatch(/^[0-9a-f]{64}$/);
      expect(operation.arguments).not.toHaveProperty("labels");
    }
    expect(stepById(plan.steps, "unassign").operations[0]?.operationId).not.toBe(ids[0]);
  });

  test("canonical JSON sorts keys and omits undefined fields", () => {
    expect(canonicalCloseoutJson({ b: 1, a: { d: 2, c: [3, 1] } })).toBe(
      '{"a":{"c":[3,1],"d":2},"b":1}',
    );
    expect(canonicalCloseoutJson({ a: undefined, b: "x" })).toBe('{"b":"x"}');
  });

  test("changing one identity input changes only that identity", () => {
    const first = deriveCloseoutOperationId({
      workspaceId: "workspace-a",
      workItemRef: "GH-183",
      engine: "github",
      capabilityContext: "supported",
      operation: "write-work-item",
      arguments: { add: ["delivered"] },
      target: { systemName: "github", entityId: "183" },
    });
    const second = deriveCloseoutOperationId({
      workspaceId: "workspace-a",
      workItemRef: "GH-183",
      engine: "github",
      capabilityContext: "adapter-not-implemented",
      operation: "write-work-item",
      arguments: { add: ["delivered"] },
      target: { systemName: "github", entityId: "183" },
    });
    expect(second).not.toBe(first);
  });
});

describe("TC-CLOSE-067 planner read-observation mapping", () => {
  test("explicit not-found refuses closeout.target.unobserved with zero operations", () => {
    const step = stepById(
      buildCloseoutPlan(makeFacts({ observedWorkItem: fakeNotFound() })).steps,
      "ticket-to-done",
    );
    expect(step.outcome).toBe("would-refuse");
    expect(step.reason).toBe("closeout.target.unobserved");
    expect(step.operations).toEqual([]);
  });

  test("a malformed payload stays provider.payload.invalid, never the not-found code", () => {
    const step = stepById(
      buildCloseoutPlan(makeFacts({ observedWorkItem: fakeInvalidPayload() })).steps,
      "ticket-to-done",
    );
    expect(step.reason).toBe("provider.payload.invalid");
    expect(step.reason).not.toBe("closeout.target.unobserved");
  });

  test("an unavailable surface yields a declared gap, not an unobserved target", () => {
    const step = stepById(
      buildCloseoutPlan(makeFacts({ observedWorkItem: { observation: "unavailable" } })).steps,
      "ticket-to-done",
    );
    expect(step.outcome).toBe("skipped-gap");
    expect(step.reason).toBe("provider-unsupported");
  });

  test("an unavailable relation signal is skipped-noop and never flips", () => {
    const step = stepById(
      buildCloseoutPlan(makeFacts({ dependents: observed([unavailableRelationDependent()]) }))
        .steps,
      "owed-flip-sweep",
    );
    expect(step.outcome).toBe("skipped-noop");
    expect(step.reason).toBe("relation-signal-unavailable");
    expect(step.operations).toEqual([]);
  });

  test("an asserted empty blocker set is eligible and an open blocker is not", () => {
    const eligible = stepById(
      buildCloseoutPlan(makeFacts({ dependents: observed([eligibleDependent("200")]) })).steps,
      "owed-flip-sweep",
    );
    expect(eligible.operations).toHaveLength(1);
    const blocked = stepById(
      buildCloseoutPlan(
        makeFacts({
          dependents: observed([
            testDependent(
              makeDependent("201"),
              observed([
                makeDependent("202", {
                  status: { nativeStatus: "open", deliveryState: "in-progress" },
                }),
              ]),
            ),
          ]),
        }),
      ).steps,
      "owed-flip-sweep",
    );
    expect(blocked.operations).toEqual([]);
  });

  test("an absent merged head refuses branch cleanup", () => {
    const step = stepById(
      buildCloseoutPlan(
        makeFacts({
          mergedRequest: observed(makeMergedRequest({ headSha: undefined })),
        }),
      ).steps,
      "branch-cleanup",
    );
    expect(step.outcome).toBe("would-refuse");
    expect(step.reason).toBe("closeout.branch.unsafe");
  });

  test("a matching merged head deletes exactly one local branch", () => {
    const step = stepById(buildCloseoutPlan(makeFacts()).steps, "branch-cleanup");
    expect(step.operations).toHaveLength(1);
    expect(step.operations[0]?.arguments).toEqual({
      branch: "feat/GH-183/closeout-v1-branch-cleanup",
    });
  });
});

describe("TC-CLOSE-059/060 bounded machine and human output", () => {
  test("the machine payload stays within the bound and summarizes outcomes", () => {
    const data = dataFor(makeFacts());
    const bounded = boundCloseoutData(data);
    expect(JSON.stringify(bounded).length).toBeLessThanOrEqual(65_536);
    const summary = summarizeCloseout(bounded.steps);
    expect(summary.counts["would-apply"]).toBeGreaterThan(0);
    expect(summary.totalOperations).toBe(
      bounded.steps.reduce((n, s) => n + s.operations.length, 0),
    );
  });

  test("a large payload truncates deterministically with a marker", () => {
    const dependents = Array.from({ length: 400 }, (_, index) =>
      eligibleDependent(String(1000 + index).padStart(4, "0")),
    );
    const data = dataFor(makeFacts({ dependents: observed(dependents) }));
    const bounded = boundCloseoutData(data);
    expect(JSON.stringify(bounded).length).toBeLessThanOrEqual(65_536);
    expect(bounded.steps.some((step) => step.truncation?.truncated === true)).toBe(true);
  });

  test("human output is byte-identical and within 200 lines and 16 KiB", () => {
    const data = dataFor(makeFacts());
    const first = renderCloseoutHuman(data);
    const second = renderCloseoutHuman(data);
    expect(second).toBe(first);
    expect(first.split("\n").length).toBeLessThanOrEqual(CLOSEOUT_MAX_HUMAN_LINES + 1);
    expect(first.length).toBeLessThanOrEqual(CLOSEOUT_MAX_HUMAN_BYTES);
    expect(first.includes(CANARY_TEXT)).toBe(false);
  });
});

describe("TC-CLOSE-010/011 in-process CLI plan and apply", () => {
  test("plan mode renders one envelope with the seven ordered steps and zero writes", async () => {
    const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--json"]);
    expect(run.exitCode).toBe(0);
    expect(run.envelope.schemaVersion).toBe("delivery.result.v1");
    const data = closeoutData(run.envelope);
    expect(data.mode).toBe("plan");
    expect(data.steps.map((step) => step.stepId)).toEqual(EXPECTED_STEP_IDS);
    expect(run.provider.calls).toEqual([]);
    expect(run.git.calls).toEqual([]);
    expect(run.state.fence.acquired).toBe(0);
    expect(run.state.fence.appends).toBe(0);
  });

  test("apply mode executes the same ordered plan with apply outcomes", async () => {
    const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--apply", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = closeoutData(run.envelope);
    expect(data.mode).toBe("applied");
    expect(data.steps.map((step) => step.stepId)).toEqual(EXPECTED_STEP_IDS);
    expect(data.steps.some((step) => step.outcome === "applied")).toBe(true);
    expect(run.state.fence.acquired).toBe(1);
    expect(run.state.fence.released).toBe(1);
  });
});

describe("TC-CLOSE-012 CLI grammar rejection matrix", () => {
  const rejections: Array<{ id: string; argv: readonly string[]; code: string }> = [
    { id: "G-01", argv: ["closeout"], code: "input.value.rejected" },
    { id: "G-02", argv: ["closeout", "GH-183", "extra"], code: "input.value.rejected" },
    { id: "G-03", argv: ["closeout", "not-a-ref"], code: "input.value.rejected" },
    { id: "G-04", argv: ["closeout", "gh-183"], code: "input.value.rejected" },
    { id: "G-05", argv: ["closeout", "GH-183", "--bogus"], code: "fallback.invocation" },
    { id: "G-06", argv: ["closeout", "GH-183", "--apply", "false"], code: "input.value.rejected" },
    { id: "G-09", argv: ["closeout", "GH-183", "extra1", "extra2"], code: "fallback.invocation" },
  ];

  for (const testCase of rejections) {
    test(`${testCase.id} rejects with ${testCase.code} and zero source calls`, async () => {
      const run = await runCloseoutCli([...testCase.argv, "--json"]);
      expect(run.exitCode).toBe(1);
      expect(errorOf(run.envelope).code).toBe(testCase.code);
      expect(run.provider.calls).toEqual([]);
      expect(run.git.calls).toEqual([]);
      expect(run.state.fence.acquired).toBe(0);
    });
  }

  test("G-07 and G-08 are the valid sibling controls and reach the runtime", async () => {
    for (const argv of [
      ["closeout", "GH-183", "--apply", "--json"],
      ["closeout", "GH-183", "--apply", "--apply", "--json"],
    ] as const) {
      const run = await runCloseoutCli(argv);
      expect(run.exitCode).toBe(0);
      expect(run.provider.calls.length + run.git.calls.length).toBeGreaterThan(0);
    }
  });
});

describe("TC-CLOSE-061/067 CLI failure projection", () => {
  test("an explicit not-found exits 1 with zero writes", async () => {
    const run = await runCloseoutCli(["closeout", "GH-183", "--apply", "--json"], {
      facts: makeFacts({ observedWorkItem: fakeNotFound() }),
    });
    expect(run.exitCode).toBe(1);
    expect(errorOf(run.envelope).code).toBe("closeout.target.unobserved");
    expect(run.provider.calls).toEqual([]);
    expect(run.state.fence.acquired).toBe(0);
  });

  test("a malformed payload projects provider.payload.invalid at exit 2", async () => {
    const run = await runCloseoutCli(["closeout", "GH-183", "--json"], {
      facts: makeFacts({ observedWorkItem: fakeInvalidPayload() }),
    });
    expect(run.exitCode).toBe(2);
    expect(errorOf(run.envelope).code).toBe("provider.payload.invalid");
  });
});

describe("TC-CLOSE-067 plan-mode branch ambiguity renders would-refuse", () => {
  const ambiguousBranches = [
    { name: "feat/GH-183/one", head: "a".repeat(40) },
    { name: "feat/GH-183/two", head: "b".repeat(40) },
  ];

  test("plan mode succeeds and renders the ambiguity for inspection", async () => {
    const run = await runCloseoutCli(["closeout", "GH-183", "--json"], {
      facts: makeFacts({ branches: ambiguousBranches }),
    });
    expect(run.exitCode).toBe(0);
    const step = stepById(closeoutData(run.envelope).steps, "branch-cleanup");
    expect(step.outcome).toBe("would-refuse");
    expect(step.reason).toBe("closeout.target.ambiguous");
    expect(run.git.calls).toEqual([]);
  });

  test("apply mode projects closeout.target.ambiguous before any mutation", async () => {
    const run = await runCloseoutCli(["closeout", "GH-183", "--apply", "--json"], {
      facts: makeFacts({ branches: ambiguousBranches }),
    });
    expect(run.exitCode).toBe(1);
    expect(errorOf(run.envelope).code).toBe("closeout.target.ambiguous");
    expect(run.git.calls).toEqual([]);
  });
});

describe("TC-CLOSE-063/NFR-7 machine bound is measured in UTF-8 bytes", () => {
  test("a multibyte payload under the UTF-16 length but over the byte bound truncates", () => {
    const wide = "😀".repeat(22_000);
    const data = dataFor(makeFacts({ dependents: observed([eligibleDependent(wide)]) }));
    const unbounded = JSON.stringify(data);
    expect(unbounded.length).toBeLessThanOrEqual(CLOSEOUT_MAX_MACHINE_BYTES);
    expect(new TextEncoder().encode(unbounded).length).toBeGreaterThan(CLOSEOUT_MAX_MACHINE_BYTES);
    const bounded = boundCloseoutData(data);
    expect(new TextEncoder().encode(JSON.stringify(bounded)).length).toBeLessThanOrEqual(
      CLOSEOUT_MAX_MACHINE_BYTES,
    );
  });
});
