/**
 * TC-SCHED-010 / TC-DEPEND-003 / TC-COMPAT-001 (GH-237) — the real edge path
 * wires every queue subcommand and flag, lanes list/show and the --watch
 * refusal, and preserves the delivered `queue ready` payload through delegation.
 */
import { describe, expect, test } from "bun:test";
import { createQueueReadyCommandDefinition } from "../../packages/cli/src/commands/queue";
import type { QueueReadyPayload } from "../../packages/core/src/contracts/index";
import { evaluateQueueReady } from "../../packages/core/src/domain/index";
import { createQueueEdgeHarness } from "../fixtures/queue/cli/harness";
import { producerPort, seedDependFacts, seedEntry } from "../fixtures/queue/depend/multi-repo";
import { baseFacts, queueRuntime } from "../fixtures/queue-ready/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const data = (text: string): Record<string, unknown> => json(text).data as Record<string, unknown>;
const error = (text: string): Record<string, unknown> | undefined =>
  json(text).error as Record<string, unknown> | undefined;
const blockingReason = (entry: Record<string, unknown> | undefined): unknown =>
  (entry?.blocking as Array<Record<string, unknown>> | undefined)?.[0]?.reason;

describe("edge wiring: queue subcommands and flags", () => {
  test("add/list/plan/prioritize/dep/claim/release all reach the edge runtime", async () => {
    const harness = createQueueEdgeHarness("wiring");
    expect(
      (
        await harness.run([
          "queue",
          "add",
          "GH-320",
          "--priority",
          "5",
          "--dep",
          "GH-999",
          "--json",
        ])
      ).exitCode,
    ).toBe(0);
    expect((await harness.run(["queue", "list", "--json"])).exitCode).toBe(0);
    expect((await harness.run(["queue", "plan", "--next", "2", "--json"])).exitCode).toBe(0);
    expect((await harness.run(["queue", "prioritize", "GH-320", "1", "--json"])).exitCode).toBe(0);
    expect((await harness.run(["queue", "dep", "GH-320", "GH-998", "--json"])).exitCode).toBe(0);
    expect((await harness.run(["queue", "add", "GH-321", "--json"])).exitCode).toBe(0);
    expect(
      (await harness.run(["queue", "claim", "GH-321", "--holder", "holder-a", "--json"])).exitCode,
    ).toBe(0);
    expect(
      (
        await harness.run([
          "queue",
          "release",
          "GH-321",
          "--holder",
          "holder-a",
          "--park",
          "preempted-for-close-item",
          "--json",
        ])
      ).exitCode,
    ).toBe(0);
  });

  test("the claim precheck is evaluated at edge level and refuses an open dependency", async () => {
    const harness = createQueueEdgeHarness("wiring-dependency");
    expect(
      (await harness.run(["queue", "add", "GH-320", "--dep", "GH-999", "--json"])).exitCode,
    ).toBe(0);
    const refused = await harness.run([
      "queue",
      "claim",
      "GH-320",
      "--holder",
      "holder-a",
      "--json",
    ]);
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
    expect(
      (await harness.run(["queue", "add", "GH-310", "--dep", "GH-300", "--json"])).exitCode,
    ).toBe(0);
    const listed = await harness.run(["queue", "list", "--json"]);
    const list = data(listed.stdout);
    const entry = (list.entries as Array<Record<string, unknown>>).find(
      (candidate) => candidate.ref === "GH-310",
    );
    const blocking = entry?.blocking as Array<Record<string, unknown>> | undefined;
    expect(blocking?.[0]?.reason).toBe("deploy-unverified");
  });
});

describe("TC-DEPEND-003/004 producer-root deploy-expectation resolution", () => {
  const consumerOf = async (
    harness: ReturnType<typeof createQueueEdgeHarness>,
    consumerRef = "GH-301",
  ): Promise<Record<string, unknown> | undefined> => {
    const listed = await harness.run(["queue", "list", "--json"]);
    const entries = data(listed.stdout).entries as Array<Record<string, unknown>>;
    return entries.find((entry) => entry.ref === consumerRef);
  };

  const build = (port: Parameters<typeof producerPort>[0]) => {
    const harness = createQueueEdgeHarness("depend-resolution", {
      overrides: { deployExpectations: producerPort(port) },
    });
    seedEntry(harness, {
      ref: "GH-300",
      repository: "github.com/owner/repo-alpha",
      repositoryRoot: "/work/repo-alpha",
    });
    seedEntry(harness, {
      ref: "GH-301",
      repository: "github.com/owner/repo-beta",
      repositoryRoot: "/work/repo-beta",
      edges: ["GH-300"],
    });
    return harness;
  };

  test("a declared producer config with a verified verdict frees the dependent merge", async () => {
    const harness = build({
      "/work/repo-alpha": {
        normalizedRemote: "github.com/owner/repo-alpha",
        deploy: { ok: true, declared: true, steps: ["deploy"] },
      },
      "/work/repo-beta": {
        normalizedRemote: "github.com/owner/repo-beta",
        deploy: { ok: true, declared: false, steps: [] },
      },
    });
    seedDependFacts(harness, { verdict: "verified" });
    expect((await consumerOf(harness))?.state).toBe("ready");
  });

  test("a declared producer config with an unknown verdict holds deploy-unverified", async () => {
    const harness = build({
      "/work/repo-alpha": {
        normalizedRemote: "github.com/owner/repo-alpha",
        deploy: { ok: true, declared: true, steps: ["deploy"] },
      },
    });
    seedDependFacts(harness, { verdict: "unknown" });
    const consumer = await consumerOf(harness);
    expect(consumer?.state).toBe("held");
    expect(blockingReason(consumer)).toBe("deploy-unverified");
  });

  test("the producer's own not-declared config wins over a pre-resolved declared expectation", async () => {
    const harness = build({
      "/work/repo-alpha": {
        normalizedRemote: "github.com/owner/repo-alpha",
        deploy: { ok: true, declared: false, steps: [] },
      },
    });
    seedDependFacts(harness, {
      verdict: "unknown",
      preResolvedExpectations: { "GH-300": { state: "declared", steps: ["deploy"] } },
    });
    expect((await consumerOf(harness))?.state).toBe("ready");
  });

  test("a recorded root whose remote does not match the producer key is unknown, never not-declared", async () => {
    const harness = build({
      "/work/repo-alpha": {
        normalizedRemote: "github.com/owner/repo-beta",
        deploy: { ok: true, declared: false, steps: [] },
      },
    });
    seedDependFacts(harness, { verdict: "verified" });
    const consumer = await consumerOf(harness);
    expect(consumer?.state).toBe("held");
    expect(blockingReason(consumer)).toBe("deploy-unverified");
  });

  test("two recorded roots claiming one key collide and hold deploy-unverified", async () => {
    const harness = build({
      "/work/repo-alpha": {
        normalizedRemote: "github.com/owner/repo-alpha",
        deploy: { ok: true, declared: true, steps: ["deploy"] },
      },
      "/work/repo-alpha-2": {
        normalizedRemote: "github.com/owner/repo-alpha",
        deploy: { ok: true, declared: true, steps: ["deploy"] },
      },
    });
    seedEntry(harness, {
      ref: "GH-299",
      repository: "github.com/owner/repo-alpha",
      repositoryRoot: "/work/repo-alpha-2",
    });
    seedDependFacts(harness, { verdict: "verified" });
    const consumer = await consumerOf(harness);
    expect(consumer?.state).toBe("held");
    expect(blockingReason(consumer)).toBe("deploy-unverified");
  });

  test("an invalid matched config is unknown, never not-declared", async () => {
    const harness = build({
      "/work/repo-alpha": {
        normalizedRemote: "github.com/owner/repo-alpha",
        deploy: { ok: false, reason: "config-invalid" },
      },
    });
    seedDependFacts(harness, { verdict: "verified" });
    const consumer = await consumerOf(harness);
    expect(consumer?.state).toBe("held");
    expect(blockingReason(consumer)).toBe("deploy-unverified");
  });

  test("the invocation checkout's config never substitutes for the producer's", async () => {
    // The invocation runs from repo-beta (harness binding) and repo-beta's own
    // config declares expectations, but repo-alpha declares none. The producer's
    // own config governs, so the gate is landing-only.
    const harness = build({
      "/work/repo-alpha": {
        normalizedRemote: "github.com/owner/repo-alpha",
        deploy: { ok: true, declared: false, steps: [] },
      },
      "/work/repo-beta": {
        normalizedRemote: "github.com/owner/repo-beta",
        deploy: { ok: true, declared: true, steps: ["deploy"] },
      },
    });
    seedDependFacts(harness, { verdict: "unknown" });
    expect((await consumerOf(harness))?.state).toBe("ready");
  });
});

describe("edge wiring: lanes list/show and --watch refusal", () => {
  test("lanes list and show are served through the edge seam", async () => {
    const harness = createQueueEdgeHarness("wiring-lanes");
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    const listed = await harness.run(["lanes", "list", "--json"]);
    expect(listed.exitCode).toBe(0);
    expect(
      (data(listed.stdout).lanes as Array<Record<string, unknown>>).map((lane) => lane.ref),
    ).toEqual(["GH-320"]);
    const shown = await harness.run(["lanes", "show", "GH-320", "--json"]);
    expect(shown.exitCode).toBe(0);
    expect((data(shown.stdout).lanes as Array<Record<string, unknown>>).length).toBe(1);
  });

  test("lanes --watch is accepted and degrades at exit 0", async () => {
    const harness = createQueueEdgeHarness("wiring-lanes-watch", {
      overrides: {
        watch: {
          maxIterations: 1,
          clock: {
            nowMs: () => Date.parse("2026-11-07T10:00:00Z"),
            nowIso: () => "2026-11-07T10:00:00Z",
            sleep: async () => undefined,
          },
        },
      },
    });
    const accepted = await harness.run(["lanes", "list", "--watch", "--json"]);
    expect(accepted.exitCode).toBe(0);
    expect(accepted.stdout).toContain("daemon-unreachable");
    expect(accepted.stdout).toContain('"watch": true');
    expect(accepted.stdout).toContain('"topic": "lanes"');
  });
});

describe("TC-COMPAT-001 queue ready preservation through the full family", () => {
  test("3-8 candidate refs are accepted and byte-identical to the ready evaluator", async () => {
    const harness = createQueueEdgeHarness("wiring-ready-multi");
    const refs = ["GH-176", "GH-177", "GH-178", "GH-179", "GH-180", "GH-181", "GH-182", "GH-183"];
    for (const count of [3, 5, 8]) {
      const candidates = refs.slice(0, count);
      const run = await harness.run(["queue", "ready", ...candidates, "--json"]);
      expect(run.exitCode).toBe(0);
      const expected = evaluateQueueReady(
        baseFacts({
          candidates,
          nowIso: "2026-11-07T10:00:00Z",
          nowMs: Date.parse("2026-11-07T10:00:00Z"),
        }),
      );
      expect(JSON.stringify(data(run.stdout))).toBe(JSON.stringify(expected));
    }
  });

  test("the ready data is byte-identical to the delivered evaluator over the same fixtures", async () => {
    const harness = createQueueEdgeHarness("wiring-ready");
    const run = await harness.run(["queue", "ready", "GH-176", "--json"]);
    expect(run.exitCode).toBe(0);
    const expected = evaluateQueueReady(
      baseFacts({
        candidates: ["GH-176"],
        nowIso: "2026-11-07T10:00:00Z",
        nowMs: Date.parse("2026-11-07T10:00:00Z"),
      }),
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
