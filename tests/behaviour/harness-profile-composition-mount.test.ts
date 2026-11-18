/**
 * GH-335 review remediation F-2 — the production resolution call site is mounted.
 *
 * The production composition wraps its opencode port in
 * `createHarnessProfilePort` with the selected profile context, so a
 * caller-supplied agent identity is resolved to exactly one `--agent`/`--model`
 * pair by the delivered code (DEC-16, DM-4, AC-F3-1 offline), while a role-less
 * call stays an unchanged passthrough (DEC-15).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createOpencodeSession } from "../../packages/adapters/src/harness/index";
import {
  createHarnessProfilePort,
  type HarnessProfileContext,
} from "../../packages/cli/src/production";
import { resolveBinding } from "../../packages/core/src/domain/index";
import { buildHarnessSpawnEnvironment } from "../../packages/core/src/domain/harness-spawn-env";
import {
  HARNESS_COMMAND,
  PARENT_ENVIRONMENT,
  SPAWN_ENV_DESCRIPTOR,
  assembleLiveness,
  classifier,
  createFakeCredentialPort,
  createRecordingRunner,
  runnerResult,
  streamStarterFromRunner,
} from "../fixtures/harness/harness-io";
import {
  MULTI_SEAT_UNASSIGNED_PROFILE,
  MULTI_SEAT_UNASSIGNED_SELECTION,
  THREE_SEAT_PROFILE,
  THREE_SEAT_SELECTION,
} from "../fixtures/harness/profile";
import { PROPAGATION_BINDING_SEAMS, valueAfter } from "../fixtures/harness/propagation-harness";

const ROOT = process.cwd();

const context: HarnessProfileContext = {
  profile: THREE_SEAT_PROFILE,
  selection: THREE_SEAT_SELECTION,
  profileName: "synthetic-profile",
};

const buildMountedPort = (resolved: HarnessProfileContext | undefined) => {
  const credentials = createFakeCredentialPort();
  const recording = createRecordingRunner(() =>
    runnerResult(
      JSON.stringify({ session: { id: "ses-mounted" }, result: { completion: "complete" } }),
    ),
  );
  const adapter = createOpencodeSession({
    command: HARNESS_COMMAND,
    runner: recording.runner,
    starter: streamStarterFromRunner(recording.runner),
    buildEnvironment: (
      descriptor: never,
      context?: { readonly record?: Readonly<Record<string, string>> },
    ) =>
      buildHarnessSpawnEnvironment({
        descriptor,
        parentEnvironment: PARENT_ENVIRONMENT,
        credentials: credentials.port,
        ...(context?.record === undefined ? {} : { record: context.record }),
      }),
    classify: classifier,
    assembleLiveness,
    now: () => "2026-11-18T00:00:00.000Z",
    spawnArgs: ["--standalone", "run", "--format", "json"],
    bindingSeams: PROPAGATION_BINDING_SEAMS,
    versionVerdict: "inside",
  });
  const port = createHarnessProfilePort({
    port: adapter,
    context: () => resolved,
    resolve: resolveBinding,
  });
  return { port, invocations: recording.invocations };
};

describe("F-2 the production-composed port resolves a caller-supplied agent", () => {
  test("a caller-supplied agent yields exactly one resolved --agent/--model pair", async () => {
    const { port, invocations } = buildMountedPort(context);
    const spawned = await port.spawn({
      workItemRef: "GH-335",
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
      agent: "coder",
    });
    expect(spawned.ok).toBe(true);
    expect(invocations).toHaveLength(1);
    const args = invocations[0]?.args ?? [];
    expect(args.filter((value) => value === "--agent")).toHaveLength(1);
    expect(args.filter((value) => value === "--model")).toHaveLength(1);
    expect(valueAfter(args, "--agent")).toBe("coder");
    expect(valueAfter(args, "--model")).toBe("zai/glm-5#judgment");
  });

  test("a role-less call is an unchanged passthrough (DEC-15)", async () => {
    const { port, invocations } = buildMountedPort(context);
    const spawned = await port.spawn({
      workItemRef: "GH-335",
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(spawned.ok).toBe(true);
    const args = invocations[0]?.args ?? [];
    expect(args).not.toContain("--agent");
    expect(args).not.toContain("--model");
  });

  test("an unresolvable profile refuses through the DEC-18 identity with a fixed summary", async () => {
    // DEC-18: a pre-resolution input failure on the delivered `config.value.invalid`
    // identity, naming the agent-identity field, with a fixed bounded summary and
    // no interpolated caller value; no session starts.
    const { port, invocations } = buildMountedPort(undefined);
    const spawned = await port.spawn({
      workItemRef: "GH-335",
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
      agent: "coder",
    });
    expect(spawned.ok).toBe(false);
    if (spawned.ok) return;
    expect(spawned.error.code).toBe("config.value.invalid");
    expect(spawned.error.kind).toBe("config");
    expect(spawned.error.field).toBe("agent");
    expect(spawned.error.summary).toBe(
      "no provider profile could be resolved for the supplied agent",
    );
    expect(spawned.error.summary).not.toContain("coder");
    expect(invocations).toHaveLength(0);
  });

  test("the invalid-identity check precedes the unresolvable-context check (DEC-18)", async () => {
    const { port } = buildMountedPort(undefined);
    const spawned = await port.spawn({
      workItemRef: "GH-335",
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
      agent: "   ",
    });
    expect(spawned.ok).toBe(false);
    if (spawned.ok) return;
    // The invalid-identity refusal (DEC-17) wins over the missing context.
    expect(spawned.error.summary).toContain("empty or whitespace-only");
  });

  test("a caller-supplied value in a refusal summary is single-line and bounded (F-9)", async () => {
    const { port } = buildMountedPort({
      profile: MULTI_SEAT_UNASSIGNED_PROFILE,
      selection: MULTI_SEAT_UNASSIGNED_SELECTION,
      profileName: "synthetic-profile",
    });
    const hostile = `writer\nsecond line ${"x".repeat(120)}`;
    const spawned = await port.spawn({
      workItemRef: "GH-335",
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
      agent: hostile,
    });
    expect(spawned.ok).toBe(false);
    if (spawned.ok) return;
    const summary = spawned.error.summary ?? "";
    expect(summary).not.toContain("\n");
    expect(summary.length).toBeLessThanOrEqual(256);
    expect(summary).toContain("…");
  });

  test("the composition's context resolver selects the declared profile from real values (F-7)", async () => {
    const { resolveProfileContextFrom } = await import("../../packages/cli/src/production");
    const values = {
      provider: {
        credentials: { zai: { sourceKey: { style: "literal", name: "ZAI_API_KEY" } } },
        entries: { "zai-coding-plan": { class: "subscription" } },
        profiles: {
          tiers: { regular: {} },
          profiles: {
            mixed: {
              tier: "regular",
              providers: ["zai-coding-plan"],
              seats: {
                pm: { model: "claude-opus", pacingClass: "judgment", capability: "text-only" },
              },
              agentOverrides: { coder: "pm" },
            },
          },
          preferenceChain: { base: "mixed", fallbacks: [] },
        },
      },
    };
    const context = resolveProfileContextFrom(values as never, 0);
    expect(context).toBeDefined();
    expect(context?.profileName).toBe("mixed");
    expect(Object.keys(context?.profile.seats ?? {})).toEqual(["pm"]);
    expect(context?.selection.agentOverrides.coder).toBe("pm");
    expect(context?.selection.seatModels.pm).toBeDefined();
    // A configuration that declares no profile resolves no context.
    expect(resolveProfileContextFrom({} as never, 0)).toBeUndefined();
  });

  test("an agent the selected multi-seat profile assigns no seat refuses provider.profile.invalid", async () => {
    const { port, invocations } = buildMountedPort({
      profile: MULTI_SEAT_UNASSIGNED_PROFILE,
      selection: MULTI_SEAT_UNASSIGNED_SELECTION,
      profileName: "synthetic-profile",
    });
    const spawned = await port.spawn({
      workItemRef: "GH-335",
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
      agent: "writer",
    });
    expect(spawned.ok).toBe(false);
    if (spawned.ok) return;
    expect(spawned.error.code).toBe("provider.profile.invalid");
    expect(spawned.error.kind).toBe("provider");
    expect(spawned.error.summary ?? "").toContain("writer");
    expect(spawned.error.summary ?? "").toContain("synthetic-profile");
    expect(spawned.error.summary ?? "").toContain("seat-judgment");
    expect(invocations).toHaveLength(0);
  });

  test("a configured mode origin reaches the resolved facts (F-5)", async () => {
    const { createHarnessAdmission, productionHarnessRegistrations } = await import(
      "../../packages/cli/src/production"
    );
    const facts = await createHarnessAdmission({
      kind: "opencode",
      mode: "per-invocation-private-server",
      modeOrigin: "configured",
      registrations: productionHarnessRegistrations,
      versionProbe: async () => ({ status: "answered", stdout: "opencode v2.3.2" }),
      now: () => 0,
    })();
    expect(facts.ok).toBe(true);
    if (!facts.ok) return;
    expect(facts.facts.modeOrigin).toBe("configured");
    expect(facts.facts.mode).toBe("per-invocation-private-server");
  });

  test("the production dispatch composition mounts the wrapper on the opencode port", () => {
    const source = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    expect(source).toContain("opencode: createHarnessProfilePort({");
    expect(source).toContain("context: () => resolveProfileContext(),");
    expect(source).toContain("resolve: resolveBinding,");
  });
});
