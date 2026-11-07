/**
 * TC-SCHED-010 / TC-DEPEND-003 / TC-COMPAT-001 (GH-237) — the real edge path
 * wires every queue subcommand and flag, lanes list/show and the --watch
 * refusal, and preserves the delivered `queue ready` payload through delegation.
 */
import { describe, expect, test } from "bun:test";
import { createQueueReadyCommandDefinition } from "../../packages/cli/src/commands/queue";
import type { QueueReadyPayload } from "../../packages/core/src/contracts/index";
import { evaluateQueueReady } from "../../packages/core/src/domain/index";
import { baseFacts, queueRuntime } from "../fixtures/queue-ready/harness";
import { createQueueEdgeHarness } from "../fixtures/queue/cli/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const data = (text: string): Record<string, unknown> => json(text).data as Record<string, unknown>;
const error = (text: string): Record<string, unknown> | undefined =>
  json(text).error as Record<string, unknown> | undefined;

describe("edge wiring: queue subcommands and flags", () => {
  test("add/list/plan/prioritize/dep/claim/release all reach the edge runtime", async () => {
    const harness = createQueueEdgeHarness("wiring");
    expect((await harness.run(["queue", "add", "GH-320", "--priority", "5", "--dep", "GH-999", "--json"])).exitCode).toBe(0);
    expect((await harness.run(["queue", "list", "--json"])).exitCode).toBe(0);
    expect((await harness.run(["queue", "plan", "--next", "2", "--json"])).exitCode).toBe(0);
    expect((await harness.run(["queue", "prioritize", "GH-320", "1", "--json"])).exitCode).toBe(0);
    expect((await harness.run(["queue", "dep", "GH-320", "GH-998", "--json"])).exitCode).toBe(0);
    expect((await harness.run(["queue", "add", "GH-321", "--json"])).exitCode).toBe(0);
    expect((await harness.run(["queue", "claim", "GH-321", "--holder", "holder-a", "--json"])).exitCode).toBe(0);
    expect((await harness.run(["queue", "release", "GH-321", "--holder", "holder-a", "--park", "preempted-for-close-item", "--json"])).exitCode).toBe(0);
  });

  test("the claim precheck is evaluated at edge level and refuses an open dependency", async () => {
    const harness = createQueueEdgeHarness("wiring-dependency");
    expect((await harness.run(["queue", "add", "GH-320", "--dep", "GH-999", "--json"])).exitCode).toBe(0);
    const refused = await harness.run(["queue", "claim", "GH-320", "--holder", "holder-a", "--json"]);
    expect(refused.exitCode).toBe(1);
    expect(error(refused.stdout)?.code).toBe("queue.precondition.unmet");
    expect(error(refused.stdout)?.summary).toContain("dependency-unobserved");
  });

  test("a deploy-unverified dependent merge is held at edge level", async () => {
    const harness = createQueueEdgeHarness("wiring-deploy");
    const facts = harness.factSource as unknown as {
      plans: Record<string, unknown>;
      workItems: Record<string, unknown>;
      close: Record<string, unknown>;
      deploy: unknown;
    };
    facts.workItems["GH-300"] = {
      state: "observed",
      deliveryState: "done",
      labels: ["priority:high"],
      blockedBy: [],
    };
    facts.plans["GH-300"] = { state: "valid", tier: "full" };
    facts.close["GH-300"] = "none";
    facts.close["GH-310"] = "merge-ready";
    facts.plans["GH-310"] = { state: "valid", tier: "full" };
    facts.workItems["GH-310"] = {
      state: "observed",
      deliveryState: "ready",
      labels: ["priority:high"],
      blockedBy: [],
    };
    facts.deploy = {
      expectations: { "GH-300": { state: "declared", steps: ["deploy"] } },
      verdicts: { "GH-300": { verdict: "unknown" } },
    };
    expect((await harness.run(["queue", "add", "GH-300", "--json"])).exitCode).toBe(0);
    expect((await harness.run(["queue", "add", "GH-310", "--dep", "GH-300", "--json"])).exitCode).toBe(0);
    const listed = await harness.run(["queue", "list", "--json"]);
    const list = data(listed.stdout);
    const entry = (list.entries as Array<Record<string, unknown>>).find(
      (candidate) => candidate.ref === "GH-310",
    );
    expect((entry?.blocking as Array<Record<string, unknown>>)[0]?.reason).toBe("deploy-unverified");
  });
});

describe("edge wiring: lanes list/show and --watch refusal", () => {
  test("lanes list and show are served through the edge seam", async () => {
    const harness = createQueueEdgeHarness("wiring-lanes");
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    const listed = await harness.run(["lanes", "list", "--json"]);
    expect(listed.exitCode).toBe(0);
    expect((data(listed.stdout).lanes as Array<Record<string, unknown>>).map((lane) => lane.ref)).toEqual([
      "GH-320",
    ]);
    const shown = await harness.run(["lanes", "show", "GH-320", "--json"]);
    expect(shown.exitCode).toBe(0);
    expect((data(shown.stdout).lanes as Array<Record<string, unknown>>).length).toBe(1);
  });

  test("lanes --watch is refused through fallback.invocation", async () => {
    const harness = createQueueEdgeHarness("wiring-lanes-watch");
    const refused = await harness.run(["lanes", "list", "--watch", "--json"]);
    expect(refused.exitCode).toBe(1);
    expect(error(refused.stdout)?.code).toBe("fallback.invocation");
  });
});

describe("TC-COMPAT-001 queue ready preservation through the full family", () => {
  test("the ready data is byte-identical to the delivered evaluator over the same fixtures", async () => {
    const harness = createQueueEdgeHarness("wiring-ready");
    const run = await harness.run(["queue", "ready", "GH-176", "--json"]);
    expect(run.exitCode).toBe(0);
    const expected = evaluateQueueReady(
      baseFacts({ candidates: ["GH-176"], nowIso: "2026-11-07T10:00:00Z", nowMs: Date.parse("2026-11-07T10:00:00Z") }),
    );
    expect(JSON.stringify(data(run.stdout))).toBe(JSON.stringify(expected));
    expect((data(run.stdout) as unknown as QueueReadyPayload).schemaVersion).toBe(
      "delivery.queue-ready.v1",
    );
  });

  test("the ready-only definition remains in the family and unchanged", async () => {
    const definition = createQueueReadyCommandDefinition(
      queueRuntime(baseFacts({ candidates: ["GH-176"] })),
    );
    expect(definition.positionals?.max).toBe(33);
    expect(definition.flags).toEqual([]);
  });
});
