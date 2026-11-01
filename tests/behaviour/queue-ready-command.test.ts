/**
 * TC-QREADY-001 / TC-QREADY-002 / TC-QREADY-032 / TC-QREADY-033 — command
 * grammar, canonicalization, source-failure success envelopes, and edge
 * projection/discipline.
 */
import { describe, expect, test } from "bun:test";
import { createQueueReadyCommandDefinition } from "../../packages/cli/src/commands/queue";
import {
  QUEUE_READY_MAX_POSITIONALS,
  type QueueReadyPayload,
} from "../../packages/core/src/contracts/index";
import {
  baseFacts,
  createRecorder,
  evaluate,
  failedPipelineRunRead,
  localContext,
  makeWorkItem,
  providerConfigFailed,
  queueRuntime,
  runProgram,
  runQueueReadyCli,
  unavailableBinding,
  workItemRead,
} from "../fixtures/queue-ready/harness";
import {
  canonicalCases,
  MALFORMED_REFS,
  REF_63,
  REF_64,
  REF_65,
} from "../fixtures/queue-ready/refs/cases";

const payloadOf = (stdout: string): QueueReadyPayload => {
  const envelope = JSON.parse(stdout) as { readonly data?: QueueReadyPayload };
  if (envelope.data === undefined) throw new Error("no data in envelope");
  return envelope.data;
};

const runtime = (refs: readonly string[] = ["GH-176"]) =>
  queueRuntime(
    baseFacts({
      tracker: workItemRead(
        refs.map((ref) => {
          const digits = ref.replace(/^.*-/, "");
          return makeWorkItem({ entityId: digits, labels: ["priority:high"] });
        }),
      ),
    }),
  );

describe("TC-QREADY-001 command grammar", () => {
  test("1..8 well-formed refs return one canonical success payload", async () => {
    for (const count of [1, 2, 8]) {
      const refs = Array.from({ length: count }, (_, index) => `GH-${index + 1}`);
      const recorder = createRecorder();
      const run = await runQueueReadyCli(
        ["queue", "ready", ...refs, "--json"],
        queueRuntime(
          baseFacts({
            tracker: workItemRead(
              refs.map((ref) =>
                makeWorkItem({ entityId: ref.replace(/^.*-/, ""), labels: ["priority:high"] }),
              ),
            ),
          }),
          recorder,
        ),
      );
      expect(run.exitCode).toBe(0);
      const payload = payloadOf(run.stdout);
      expect(payload.schemaVersion).toBe("delivery.queue-ready.v1");
      expect(payload.candidates).toHaveLength(count);
      expect(recorder.calls).toContain("readWorkItems");
      expect(recorder.calls).toContain("readDeliveryRequests");
    }
  });

  test("handler-level invalid cases reject before any source read", async () => {
    const invalid: readonly (readonly string[])[] = [
      ["queue", "ready"],
      ["queue", "create", "GH-1"],
      ["queue"],
      ["queue", "ready", ...Array.from({ length: 9 }, (_, index) => `GH-${index + 1}`)],
      ["queue", "ready", ...Array.from({ length: 32 }, (_, index) => `GH-${index + 1}`)],
      ...MALFORMED_REFS.map((ref) => ["queue", "ready", ref] as const),
      ["queue", "ready", REF_65],
      ["queue", "ready", "GH-176", "GH-176"],
      ["queue", "ready", "gh-176", "GH-176"],
      ["queue", "ready", "GH-007", "gh-007"],
    ];
    for (const argv of invalid) {
      const recorder = createRecorder();
      const run = await runQueueReadyCli([...argv, "--json"], queueRuntime(baseFacts(), recorder));
      expect(run.exitCode, argv.join(" ")).toBe(1);
      const envelope = JSON.parse(run.stdout) as {
        readonly data?: unknown;
        readonly error?: { readonly kind?: string; readonly code?: string };
      };
      expect(envelope.error?.code, argv.join(" ")).toBe("input.value.rejected");
      expect(envelope.data, argv.join(" ")).toBeUndefined();
      expect(recorder.calls, argv.join(" ")).toEqual([]);
    }
  });

  test("a 64-character canonical ref is accepted and 65 is rejected before reads", async () => {
    for (const [ref, accepted] of [
      [REF_64, true],
      [REF_63, true],
      [REF_65, false],
    ] as const) {
      const recorder = createRecorder();
      const run = await runQueueReadyCli(
        ["queue", "ready", ref, "--json"],
        queueRuntime(
          baseFacts({
            tracker: workItemRead([
              makeWorkItem({ entityId: ref.replace(/^.*-/, ""), labels: ["priority:high"] }),
            ]),
          }),
          recorder,
        ),
      );
      if (accepted) {
        expect(run.exitCode, ref).toBe(0);
        expect(payloadOf(run.stdout).candidates[0]?.workItemRef, ref).toBe(ref);
        expect(recorder.calls.length, ref).toBeGreaterThan(0);
      } else {
        expect(run.exitCode, ref).toBe(1);
        expect(recorder.calls, ref).toEqual([]);
      }
    }
  });

  test("33 refs (34 positionals) and an unknown flag remain parser fallback.invocation", async () => {
    const cases: readonly (readonly string[])[] = [
      ["queue", "ready", ...Array.from({ length: 33 }, (_, index) => `GH-${index + 1}`), "--json"],
      ["queue", "ready", "GH-1", "--limit", "2", "--json"],
      ["queue", "ready", "--json", "--limit", "2"],
    ];
    for (const argv of cases) {
      const recorder = createRecorder();
      const run = await runQueueReadyCli([...argv, "--json"], queueRuntime(baseFacts(), recorder));
      expect(run.exitCode, argv.join(" ")).toBe(1);
      const envelope = JSON.parse(run.stdout) as { readonly error?: { readonly code?: string } };
      expect(envelope.error?.code, argv.join(" ")).toBe("fallback.invocation");
      expect(recorder.calls, argv.join(" ")).toEqual([]);
    }
  });

  test("--json adds nothing but serialization and works on both sides of the refs", async () => {
    const before = await runQueueReadyCli(["queue", "ready", "--json", "GH-176"], runtime());
    const after = await runQueueReadyCli(["queue", "ready", "GH-176", "--json"], runtime());
    expect(before.exitCode).toBe(0);
    expect(after.exitCode).toBe(0);
    expect(payloadOf(before.stdout)).toEqual(payloadOf(after.stdout));
  });

  test("the handler returns the input failure discriminant for a grammar rejection", async () => {
    const definition = createQueueReadyCommandDefinition(runtime());
    const result = (await definition.handler({
      command: "queue",
      flags: {},
      argv: ["queue", "ready"],
      positionals: ["ready"],
      brand: (await import("../golden/helpers")).SYNTHETIC_BRAND,
    })) as { readonly error?: { readonly kind?: string; readonly code?: string } };
    expect(result.error?.kind).toBe("input");
    expect(result.error?.code).toBe("input.value.rejected");
  });

  test("the definition declares no flags and the pinned positional bound", () => {
    const definition = createQueueReadyCommandDefinition(runtime());
    expect(definition.flags).toEqual([]);
    expect(definition.positionals?.max).toBe(QUEUE_READY_MAX_POSITIONALS);
  });

  test("the handler is write-free and returns data without choosing an exit code", async () => {
    const definition = createQueueReadyCommandDefinition(runtime());
    const result = (await definition.handler({
      command: "queue",
      flags: {},
      argv: ["queue", "ready", "GH-176"],
      positionals: ["ready", "GH-176"],
      brand: (await import("../golden/helpers")).SYNTHETIC_BRAND,
    })) as { readonly data?: QueueReadyPayload };
    expect(result.data?.schemaVersion).toBe("delivery.queue-ready.v1");
  });

  test("a rejected invocation does not poison the harness (positive control)", async () => {
    const rejected = await runQueueReadyCli(["queue", "ready", "--json"], runtime());
    expect(rejected.exitCode).toBe(1);
    const valid = await runQueueReadyCli(["queue", "ready", "GH-176", "--json"], runtime());
    expect(valid.exitCode).toBe(0);
    expect(payloadOf(valid.stdout).candidates).toHaveLength(1);
  });
});

describe("TC-QREADY-032 canonicalization and candidate-set observation", () => {
  test("canonicalization uppercases the prefix and preserves digits", async () => {
    for (const { input, canonical } of canonicalCases) {
      const run = await runQueueReadyCli(["queue", "ready", input, "--json"], runtime([canonical]));
      expect(run.exitCode, input).toBe(0);
      expect(payloadOf(run.stdout).candidates[0]?.workItemRef, input).toBe(canonical);
    }
  });

  test("leading zeros are preserved and GH-007 ranks before GH-7", async () => {
    const run = await runQueueReadyCli(
      ["queue", "ready", "gh-176", "gh-007", "GH-7", "--json"],
      queueRuntime(
        baseFacts({
          tracker: workItemRead([
            makeWorkItem({ entityId: "176", labels: ["priority:high"] }),
            makeWorkItem({ entityId: "007", labels: ["priority:high"] }),
            makeWorkItem({ entityId: "7", labels: ["priority:high"] }),
          ]),
        }),
      ),
    );
    expect(run.exitCode).toBe(0);
    const refs = payloadOf(run.stdout).candidates.map((candidate) => candidate.workItemRef);
    expect(refs).toEqual(["GH-007", "GH-7", "GH-176"]);
  });

  test("candidate condition evaluation is independent per candidate", async () => {
    const run = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "GH-999", "--json"],
      queueRuntime(
        baseFacts({
          tracker: workItemRead([makeWorkItem({ entityId: "176", labels: ["priority:high"] })]),
        }),
      ),
    );
    const payload = payloadOf(run.stdout);
    const observed = payload.candidates.find((candidate) => candidate.workItemRef === "GH-176");
    const unobserved = payload.candidates.find((candidate) => candidate.workItemRef === "GH-999");
    expect(observed?.workItem.state).toBe("observed");
    expect(observed?.ready).toBe(true);
    expect(unobserved?.workItem).toEqual({ state: "unknown", reason: "work-item-unobserved" });
    expect(unobserved?.ready).toBe(false);
  });

  test("no discovery or filter flags exist", () => {
    const definition = createQueueReadyCommandDefinition(runtime());
    expect(definition.flags ?? []).toEqual([]);
    expect(definition.requiresValue).toBeUndefined();
  });
});

describe("shared status read composition preserves two independent gates", () => {
  test("a binding-observed, SHA-absent runtime keeps tracker/pulls observed and only CI unresolved", async () => {
    const recorder = createRecorder();
    const facts = baseFacts();
    const run = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "--json"],
      queueRuntime(
        {
          ...facts,
          repository: {
            binding: {
              state: "observed",
              host: "github.com",
              owner: "owner-placeholder",
              name: "project-placeholder",
              remoteName: "origin",
            },
            head: { branch: "feat/GH-176/x", detached: false },
          },
        },
        recorder,
      ),
    );
    expect(recorder.calls.filter((call) => call === "readWorkItems")).toHaveLength(1);
    expect(recorder.calls.filter((call) => call === "readDeliveryRequests")).toHaveLength(1);
    expect(recorder.calls.filter((call) => call === "readPipelineRuns")).toHaveLength(0);
    const states = payloadOf(run.stdout).candidates[0]?.conditions.map(
      (condition) => condition.state,
    );
    expect(states).toEqual([
      "satisfied",
      "satisfied",
      "satisfied",
      "satisfied",
      "unknown",
      "satisfied",
    ]);
    const ci = payloadOf(run.stdout).candidates[0]?.conditions[4];
    expect(ci?.evidence[0]?.reason).toBe("commit-unresolved");
  });

  test("a binding-unobserved run performs none of the three GitHub reads", async () => {
    const recorder = createRecorder();
    const facts = baseFacts();
    const run = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "--json"],
      queueRuntime(
        {
          ...facts,
          repository: {
            binding: unavailableBinding(),
            head: { branch: "feat/GH-176/x", detached: false },
          },
        },
        recorder,
      ),
    );
    expect(run.exitCode).toBe(0);
    for (const call of ["readWorkItems", "readDeliveryRequests", "readPipelineRuns"]) {
      expect(
        recorder.calls.filter((entry) => entry === call),
        call,
      ).toHaveLength(0);
    }
  });
});

describe("TC-QREADY-002 source failures are evidence, not command failures", () => {
  const degradedFacts = () =>
    baseFacts({
      repository: {
        binding: unavailableBinding(),
        head: { branch: "feat/GH-176/x", detached: false },
      },
      tracker: workItemRead([]),
      changes: { ok: false, reason: "not-configured" },
      ci: failedPipelineRunRead("not-configured"),
      providers: {
        config: providerConfigFailed("config-invalid"),
        parks: { ok: false, reason: "state-unreadable" },
      },
      localContext: localContext(),
    });

  test("a degraded run returns one success envelope with every candidate and exit 0", async () => {
    const run = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "GH-179", "--json"],
      queueRuntime(degradedFacts()),
    );
    expect(run.exitCode).toBe(0);
    const envelope = JSON.parse(run.stdout) as {
      readonly data?: QueueReadyPayload;
      readonly error?: unknown;
    };
    expect(envelope.error).toBeUndefined();
    expect(envelope.data?.candidates).toHaveLength(2);
    for (const candidate of envelope.data?.candidates ?? []) {
      expect(candidate.conditions).toHaveLength(6);
      expect(candidate.ready).toBe(false);
      expect(candidate.close.association).toBe("unknown");
      expect(candidate.close.reason).toBe("pr-association-unknown");
      expect(candidate.closeClass).not.toBe("new-start");
    }
  });

  test("top-level reasons follow the six-group order and never carry verdict reasons", async () => {
    const run = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "--json"],
      queueRuntime(degradedFacts()),
    );
    const reasons = payloadOf(run.stdout).reasons;
    expect(reasons[0]).toBe("addressing-unresolved");
    expect(reasons).toContain("config-invalid");
    expect(reasons).toContain("state-unreadable");
    expect(reasons).toContain("pr-association-unknown");
    for (const forbidden of [
      "ci-pending",
      "tier-conflict",
      "dependency-open",
      "pr-not-associated",
      "read-failed",
    ]) {
      expect(reasons).not.toContain(forbidden as never);
    }
  });

  test("containment produces exactly one fallback.internal envelope with no data", async () => {
    const run = await runProgram(["queue", "ready", "GH-176", "--json"], {
      commands: {
        queue: {
          positionals: { max: 33 },
          handler: () => {
            throw new Error("synthetic containment failure");
          },
        },
      },
    });
    expect(run.exitCode).toBe(2);
    const envelope = JSON.parse(run.stdout) as {
      readonly error?: { readonly code?: string };
      readonly data?: unknown;
    };
    expect(envelope.error?.code).toBe("fallback.internal");
    expect(envelope.data).toBeUndefined();
  });

  test("the restored fixture reaches the Appendix A states", () => {
    const payload = evaluate();
    expect(payload.candidates[0]?.ready).toBe(true);
    expect(payload.candidates[0]?.closeClass).toBe("new-start");
  });
});

describe("edge projection and stream discipline", () => {
  test("exit 0 success and exit 1 grammar each serialize exactly once", async () => {
    for (const [argv, expected] of [
      [["queue", "ready", "GH-176"], 0],
      [["queue", "ready"], 1],
    ] as const) {
      const run = await runQueueReadyCli([...argv, "--json"], runtime());
      expect(run.exitCode).toBe(expected);
      expect(run.stdout.endsWith("\n")).toBe(true);
      const envelope = JSON.parse(run.stdout) as {
        readonly data?: unknown;
        readonly error?: unknown;
      };
      expect(envelope.data === undefined && envelope.error === undefined).toBe(false);
      if (expected === 0) {
        expect(run.stderr).toBe("");
      } else {
        expect(run.stderr.length).toBeGreaterThan(0);
      }
    }
  });
});
