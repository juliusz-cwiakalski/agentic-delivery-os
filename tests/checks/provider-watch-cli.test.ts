/**
 * GH-350 TC-WFRESH-003 (CLI arm) and TC-WFRESH-008 (snapshot arm) — a stale
 * watch reading through the composed `provider watch status` surface: the three
 * additive fields in the payload, the human line, the bound refusal, the live
 * zero-age posture, and a byte-identical state root.
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProviderComposition } from "@delivery-os/core/contracts";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import {
  listStoreFiles,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";

const NOW = 1_700_000_000_000;
const CONFIG_PATH = "/repo/.jaiship/config.yaml";
const BODY = JSON.stringify({
  code: 200,
  success: true,
  data: { limits: [{ type: "TOKENS_LIMIT", percentage: 12 }] },
});

const CONFIG = `provider:
  defaultChain: ch
  credentials:
    c:
      sourceKey:
        style: literal
        name: WATCH_KEY
  entries:
    p:
      class: subscription
  chains:
    ch:
      entries:
        - p
  profiles:
    tiers:
      t:
        description: watch tier
    profiles:
      prof:
        tier: t
        providers:
          - p
        seats:
          seat:
            model: watch-model
            pacingClass: judgment
            capability: text-only
    preferenceChain:
      base: prof
    watch:
      p:
        mapping: coding-plan-windows
        endpoint: https://watch.test/quota
        credentialRef: c
        thresholdPercent: 100
        maxAgeSeconds: 900
`;

type Run = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
  readonly stateBefore: readonly string[];
  readonly stateAfter: readonly string[];
};

const run = async (
  options: { readonly observedAtMs?: () => number; readonly config?: string } = {},
): Promise<Run> => {
  const root = makeTempRoot("gh350-watch-cli");
  try {
    const identity = makeIdentity(root);
    const { store } = openStore(identity);
    const snapshot = (): string[] =>
      listStoreFiles(identity.stateDirectory).map((name) => {
        const bytes = readFileSync(join(identity.stateDirectory, name));
        return `${name}:${createHash("sha256").update(bytes).digest("hex")}`;
      });
    const stateBefore = snapshot();
    const provider: ProviderComposition = {
      clock: { nowMs: () => NOW },
      credentialPort: { resolve: () => ({ ok: true, material: { value: "" } }) },
      transport: { send: async () => ({ status: 200, bodyText: BODY }) },
      sleep: { sleep: async () => undefined },
      stateStore: store,
      newFenceToken: () => "fence-watch-cli",
      ...(options.observedAtMs === undefined ? {} : { watchObservedAtMs: options.observedAtMs }),
    };
    const program = createConfigProgram({
      workingName: "jaiship",
      environment: { HOME: "/home/synthetic" },
      cwd: "/repo",
      homeDirectory: "/home/synthetic",
      platform: "linux",
      fs: {
        exists: (path) => path === CONFIG_PATH,
        readText: (path) => {
          if (path !== CONFIG_PATH) throw new Error("missing file");
          return options.config ?? CONFIG;
        },
      },
      repositoryIo: {
        exists: (path) => path === "/repo/.git",
        isFile: () => false,
        readText: () => "",
      },
      provider,
    });
    if (!program.ok) throw new Error("compose");
    let stdout = "";
    let stderr = "";
    const deps: CliDependencies = {
      brand: program.brand,
      clock: { now: () => NOW },
      newRunId: () => "run-gh350-watch-cli",
      secrets: program.secrets,
      program: program.program,
    };
    const exitCode = await runCli(
      ["provider", "watch", "status", "--json"],
      {
        stdout: { write: (chunk: string) => (stdout += chunk) },
        stderr: { write: (chunk: string) => (stderr += chunk) },
      },
      deps,
    );
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    return {
      exitCode,
      stdout,
      stderr,
      ...(parsed.data === undefined ? {} : { data: parsed.data as Record<string, unknown> }),
      ...(parsed.error === undefined ? {} : { error: parsed.error as Run["error"] }),
      stateBefore,
      stateAfter: snapshot(),
    };
  } finally {
    removeRoot(root);
  }
};

type View = {
  readonly name: string;
  readonly condition: string;
  readonly source: string;
  readonly checkedAt: string;
  readonly observedAt: string;
  readonly ageSeconds: number;
  readonly maxAgeSeconds: number;
};

const views = (result: Run): View[] => (result.data?.providers as View[] | undefined) ?? [];

describe("TC-WFRESH-003 a stale reading through the CLI", () => {
  test("the payload carries watch-stale with the three additive fields and writes nothing", async () => {
    const result = await run({ observedAtMs: () => NOW - 1_200_000 });
    expect(result.exitCode).toBe(0);
    const view = views(result)[0];
    if (view === undefined) throw new Error("no view");
    expect(view.condition).toBe("watch-stale");
    expect(view.observedAt).toBe("2023-11-14T21:53:20.000Z");
    expect(view.checkedAt).toBe("2023-11-14T22:13:20.000Z");
    expect(view.ageSeconds).toBe(1200);
    expect(view.maxAgeSeconds).toBe(900);
    expect(view.source).toBe("observed at 2023-11-14T21:53:20.000Z; max age 900s");
    expect(result.stateAfter).toEqual(result.stateBefore);
  });

  test("the human rendering states the stale condition without a body or credential claim", async () => {
    const root = makeTempRoot("gh350-watch-human");
    try {
      const { store } = openStore(makeIdentity(root));
      const program = createConfigProgram({
        workingName: "jaiship",
        environment: { HOME: "/home/synthetic" },
        cwd: "/repo",
        homeDirectory: "/home/synthetic",
        platform: "linux",
        fs: {
          exists: (path) => path === CONFIG_PATH,
          readText: () => CONFIG,
        },
        repositoryIo: {
          exists: (path) => path === "/repo/.git",
          isFile: () => false,
          readText: () => "",
        },
        provider: {
          clock: { nowMs: () => NOW },
          credentialPort: { resolve: () => ({ ok: true, material: { value: "" } }) },
          transport: { send: async () => ({ status: 200, bodyText: BODY }) },
          sleep: { sleep: async () => undefined },
          stateStore: store,
          newFenceToken: () => "fence-watch-human",
          watchObservedAtMs: () => NOW - 1_200_000,
        },
      });
      if (!program.ok) throw new Error("compose");
      let stdout = "";
      const deps: CliDependencies = {
        brand: program.brand,
        clock: { now: () => NOW },
        newRunId: () => "run-gh350-watch-human",
        secrets: program.secrets,
        program: program.program,
      };
      const exitCode = await runCli(
        ["provider", "watch", "status"],
        {
          stdout: { write: (chunk: string) => (stdout += chunk) },
          stderr: { write: () => undefined },
        },
        deps,
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain(
        "p: watch-stale (observed at 2023-11-14T21:53:20.000Z; max age 900s)",
      );
      expect(stdout).not.toMatch(/authorization|bearer|body/iu);
    } finally {
      removeRoot(root);
    }
  });

  test("the live composition observes at read time: age 0 and never stale", async () => {
    const result = await run();
    expect(result.exitCode).toBe(0);
    const view = views(result)[0];
    if (view === undefined) throw new Error("no view");
    expect(view.observedAt).toBe(view.checkedAt);
    expect(view.ageSeconds).toBe(0);
    expect(view.condition).not.toBe("watch-stale");
  });

  test("a non-positive bound refuses config.value.invalid, naming the key on the command failure", async () => {
    const badConfig = CONFIG.replace("maxAgeSeconds: 900", "maxAgeSeconds: 0");
    const result = await run({ config: badConfig });
    expect(result.exitCode).toBe(1);
    expect(result.error?.code).toBe("config.value.invalid");
    // The delivered failure envelope suppresses a config-shaped summary by
    // policy ("no untrusted config summary"), so the key is asserted on the
    // command's own failure value below, not on the emitted envelope.
    const program = createConfigProgram({
      workingName: "jaiship",
      environment: { HOME: "/home/synthetic" },
      cwd: "/repo",
      homeDirectory: "/home/synthetic",
      platform: "linux",
      fs: { exists: (path) => path === CONFIG_PATH, readText: () => badConfig },
      repositoryIo: {
        exists: (path) => path === "/repo/.git",
        isFile: () => false,
        readText: () => "",
      },
      provider: {
        clock: { nowMs: () => NOW },
        credentialPort: { resolve: () => ({ ok: true, material: { value: "" } }) },
        transport: { send: async () => ({ status: 200, bodyText: BODY }) },
        sleep: { sleep: async () => undefined },
        stateStore: openStore(makeIdentity(makeTempRoot("gh350-watch-bound-state"))).store,
        newFenceToken: () => "fence-watch-bound",
      },
    });
    if (!program.ok) throw new Error("compose");
    const definition = program.program.commands.provider;
    if (definition === undefined) throw new Error("provider command absent");
    const outcome = (await definition.handler({
      command: "provider",
      flags: {},
      argv: ["watch", "status"],
      positionals: ["watch", "status"],
      brand: program.brand,
    } as never)) as { error?: { code?: string; summary?: string } };
    expect(outcome.error?.code).toBe("config.value.invalid");
    expect(outcome.error?.summary).toContain("provider.profiles.watch.p.maxAgeSeconds");
  });
});
